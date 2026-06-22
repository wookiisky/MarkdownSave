import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

type JsonRecord = Record<string, unknown>;

/** Chrome build audit input paths. */
export interface ChromeBuildAuditInput {
  /** Built extension directory, normally dist/chrome. */
  readonly extensionDirectory: string;
  /** Chrome Web Store zip path, normally dist/markdownsave-chrome.zip. */
  readonly packagePath: string;
}

/** Chrome build audit result for CLI output and tests. */
export interface ChromeBuildAuditReport {
  /** Number of files found in dist/chrome. */
  readonly distFileCount: number;
  /** Number of files found in the release zip. */
  readonly zipFileCount: number;
  /** Locale audit outcome. */
  readonly localeStatus: "not-declared" | "declared";
}

/** Package entry content indexed by normalized zip path. */
interface ZipEntryContent {
  /** Normalized zip entry path. */
  readonly entryName: string;
  /** Zip entry bytes. */
  readonly data: Buffer;
}

const requiredEntrypoints: readonly string[] = [
  "manifest.json",
  "background/service-worker.js",
  "content/content-script.js",
  "content/page-context.js",
  "offscreen/offscreen.html",
  "offscreen/offscreen.js",
  "popup/index.html",
  "popup/index.js",
  "options/index.html",
  "options/index.js"
] as const;

const expectedPermissions: readonly string[] = [
  "activeTab",
  "scripting",
  "downloads",
  "storage",
  "contextMenus",
  "clipboardWrite",
  "offscreen"
] as const;

const expectedHostPermissions: readonly string[] = ["<all_urls>"] as const;

const forbiddenManifestFields: readonly string[] = [
  "browser_action",
  "content_scripts",
  "optional_permissions",
  "optional_host_permissions"
] as const;

// 判断未知值是否是 JSON 对象。
function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 读取字符串字段，不把缺失字段误当成空字符串。
function readString(record: JsonRecord, fieldName: string): string | undefined {
  const value = record[fieldName];

  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}

// 读取对象字段，边界脏数据在进入审计规则前收敛。
function readRecord(record: JsonRecord, fieldName: string): JsonRecord | undefined {
  const value = record[fieldName];

  if (!isRecord(value)) {
    return undefined;
  }

  return value;
}

// 读取字符串数组字段。
function readStringArray(record: JsonRecord, fieldName: string): readonly string[] | undefined {
  const value = record[fieldName];

  if (!Array.isArray(value)) {
    return undefined;
  }

  if (!value.every((item) => typeof item === "string")) {
    return undefined;
  }

  return value;
}

// 读取对象数组字段。
function readRecordArray(record: JsonRecord, fieldName: string): readonly JsonRecord[] | undefined {
  const value = record[fieldName];

  if (!Array.isArray(value)) {
    return undefined;
  }

  if (!value.every(isRecord)) {
    return undefined;
  }

  return value;
}

// 把系统路径转成 Chrome 扩展和 zip 使用的正斜杠路径。
function normalizeRelativePath(pathName: string): string {
  return pathName.split("\\").join("/");
}

// 递归收集目录下全部文件。
async function collectDistFiles(rootDirectory: string, currentDirectory = rootDirectory): Promise<readonly string[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const fileNames: string[] = [];

  for (const entry of entries) {
    const entryPath = resolve(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      const childFiles = await collectDistFiles(rootDirectory, entryPath);
      fileNames.push(...childFiles);
      continue;
    }

    if (entry.isFile()) {
      fileNames.push(normalizeRelativePath(relative(rootDirectory, entryPath)));
    }
  }

  return fileNames.sort();
}

// 从 zip 中读取全部文件条目。
function collectZipEntries(zip: AdmZip): readonly ZipEntryContent[] {
  const entries: ZipEntryContent[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    entries.push({
      entryName: entry.entryName,
      data: entry.getData()
    });
  }

  return entries.sort((left, right) => left.entryName.localeCompare(right.entryName));
}

// 生成内容 hash，用于校验 zip 与 dist 完全一致。
function hashBuffer(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// 校验文件路径存在。
function assertFilePresent(fileSet: ReadonlySet<string>, fileName: string): void {
  if (!fileSet.has(fileName)) {
    throw new Error(`Chrome 发布产物缺少 ${fileName}。`);
  }
}

// 校验 manifest 图标引用都存在。
function assertIconFiles(manifest: JsonRecord, fileSet: ReadonlySet<string>): void {
  const iconSections = [readRecord(manifest, "icons"), readRecord(readRecord(manifest, "action") ?? {}, "default_icon")];

  for (const icons of iconSections) {
    if (!icons) {
      throw new Error("Chrome manifest 缺少 icons 或 action.default_icon。");
    }

    for (const iconPath of Object.values(icons)) {
      if (typeof iconPath !== "string") {
        throw new Error("Chrome manifest 图标路径必须是字符串。");
      }

      assertFilePresent(fileSet, iconPath);
    }
  }
}

// 校验 manifest 入口字段确实指向当前打包入口。
function assertManifestEntrypoints(manifest: JsonRecord, fileSet: ReadonlySet<string>): void {
  const background = readRecord(manifest, "background");
  const action = readRecord(manifest, "action");
  const optionsUi = readRecord(manifest, "options_ui");

  if (!background) {
    throw new Error("Chrome manifest 缺少 background。");
  }

  if (readString(background, "service_worker") !== "background/service-worker.js") {
    throw new Error("Chrome manifest background.service_worker 必须指向 background/service-worker.js。");
  }

  if (readString(background, "type") !== "module") {
    throw new Error("Chrome manifest background.type 必须是 module。");
  }

  if (!action) {
    throw new Error("Chrome manifest 缺少 action。");
  }

  if (readString(action, "default_popup") !== "popup/index.html") {
    throw new Error("Chrome manifest action.default_popup 必须指向 popup/index.html。");
  }

  if (!optionsUi) {
    throw new Error("Chrome manifest 缺少 options_ui。");
  }

  if (readString(optionsUi, "page") !== "options/index.html") {
    throw new Error("Chrome manifest options_ui.page 必须指向 options/index.html。");
  }

  if (optionsUi.open_in_tab !== false) {
    throw new Error("Chrome manifest options_ui.open_in_tab 必须是 false。");
  }

  for (const entrypoint of requiredEntrypoints) {
    assertFilePresent(fileSet, entrypoint);
  }
}

// 校验 web accessible resources 只暴露 page context 桥接脚本。
function assertWebAccessibleResources(manifest: JsonRecord): void {
  const resources = readRecordArray(manifest, "web_accessible_resources");

  if (!resources || resources.length !== 1) {
    throw new Error("Chrome manifest 必须只声明一组 web_accessible_resources。");
  }

  const resourceEntry = resources[0];
  const resourcePaths = readStringArray(resourceEntry, "resources");
  const matches = readStringArray(resourceEntry, "matches");

  if (!resourcePaths || resourcePaths.length !== 1 || resourcePaths[0] !== "content/page-context.js") {
    throw new Error("web_accessible_resources 只能暴露 content/page-context.js。");
  }

  if (!matches || matches.length !== 1 || matches[0] !== "<all_urls>") {
    throw new Error("web_accessible_resources matches 必须是 <all_urls>。");
  }
}

// 校验权限集合保持 Chrome Web Store 说明中的精确首版范围。
function assertManifestPermissions(manifest: JsonRecord): void {
  const permissions = readStringArray(manifest, "permissions");
  const hostPermissions = readStringArray(manifest, "host_permissions");

  if (!permissions || JSON.stringify(permissions) !== JSON.stringify(expectedPermissions)) {
    throw new Error("Chrome manifest permissions 必须与首版权限清单完全一致。");
  }

  if (!hostPermissions || JSON.stringify(hostPermissions) !== JSON.stringify(expectedHostPermissions)) {
    throw new Error("Chrome manifest host_permissions 必须只包含 <all_urls>。");
  }

  for (const fieldName of forbiddenManifestFields) {
    if (Reflect.has(manifest, fieldName)) {
      throw new Error(`Chrome manifest 不允许声明 ${fieldName}。`);
    }
  }
}

// 解析 CSP directive，便于精确校验脚本和对象资源来源。
function parseCspDirectives(csp: string): ReadonlyMap<string, readonly string[]> {
  const directives = new Map<string, readonly string[]>();

  for (const rawDirective of csp.split(";")) {
    const directive = rawDirective.trim();

    if (!directive) {
      continue;
    }

    const [name, ...values] = directive.split(/\s+/u);

    if (!name || directives.has(name)) {
      throw new Error("Chrome manifest CSP 包含重复或非法 directive。");
    }

    directives.set(name, values);
  }

  return directives;
}

// 校验 MV3 CSP 不允许远程脚本和 eval。
function assertContentSecurityPolicy(manifest: JsonRecord): void {
  const contentSecurityPolicy = readRecord(manifest, "content_security_policy");
  const extensionPages = contentSecurityPolicy ? readString(contentSecurityPolicy, "extension_pages") : undefined;

  if (!extensionPages) {
    throw new Error("Chrome manifest 缺少 content_security_policy.extension_pages。");
  }

  const directives = parseCspDirectives(extensionPages);
  const scriptSrc = directives.get("script-src");
  const objectSrc = directives.get("object-src");

  if (directives.size !== 2 || !scriptSrc || !objectSrc) {
    throw new Error("Chrome manifest CSP 必须只包含 script-src 和 object-src。");
  }

  if (JSON.stringify(scriptSrc) !== JSON.stringify(["'self'"])) {
    throw new Error("Chrome manifest CSP script-src 必须只允许 'self'。");
  }

  if (JSON.stringify(objectSrc) !== JSON.stringify(["'self'"])) {
    throw new Error("Chrome manifest CSP object-src 必须只允许 'self'。");
  }
}

// 校验 locale 目录与 manifest.default_locale 一致。
function assertLocaleRule(manifest: JsonRecord, fileSet: ReadonlySet<string>): "not-declared" | "declared" {
  const defaultLocale = readString(manifest, "default_locale");
  const hasLocaleDirectory = Array.from(fileSet).some((fileName) => fileName.startsWith("_locales/"));

  if (!defaultLocale) {
    if (hasLocaleDirectory) {
      throw new Error("Chrome manifest 未声明 default_locale 时不能包含 _locales 目录。");
    }

    return "not-declared";
  }

  assertFilePresent(fileSet, `_locales/${defaultLocale}/messages.json`);
  return "declared";
}

// 校验关键 manifest 入口和发布文件。
function assertManifestFacts(manifest: JsonRecord, fileSet: ReadonlySet<string>): "not-declared" | "declared" {
  if (manifest.manifest_version !== 3) {
    throw new Error("Chrome manifest_version 必须是 3。");
  }

  assertManifestEntrypoints(manifest, fileSet);
  assertIconFiles(manifest, fileSet);
  assertManifestPermissions(manifest);
  assertWebAccessibleResources(manifest);
  assertContentSecurityPolicy(manifest);
  return assertLocaleRule(manifest, fileSet);
}

// 校验 HTML/JS/manifest 中没有远程脚本加载和 eval。
function assertTextArtifactSafe(fileName: string, content: string): void {
  const isScannedFile = fileName.endsWith(".js") || fileName.endsWith(".html") || fileName === "manifest.json";

  if (!isScannedFile || fileName.endsWith(".map")) {
    return;
  }

  if (/\beval\s*\(/u.test(content) || /\bnew\s+Function\s*\(/u.test(content) || /\bFunction\s*\(/u.test(content)) {
    throw new Error(`${fileName} 包含 eval 或 Function 动态执行。`);
  }

  if (/(?:^|[^\w$])eval\s*\?/u.test(content) || /\(\s*0\s*,\s*eval\s*\)/u.test(content)) {
    throw new Error(`${fileName} 包含间接 eval。`);
  }

  if (content.includes("unsafe-eval")) {
    throw new Error(`${fileName} 包含 unsafe-eval。`);
  }

  if (/<script\b[^>]*\bsrc\s*=\s*(?:"https?:\/\/|'https?:\/\/|https?:\/\/)/iu.test(content)) {
    throw new Error(`${fileName} 包含远程 script src。`);
  }

  if (/\bimport\s+(?:[^"'()]+?\s+from\s+)?["']https?:\/\//u.test(content)) {
    throw new Error(`${fileName} 包含远程静态 import。`);
  }

  if (/\bimport\s*\(\s*["']https?:\/\//u.test(content)) {
    throw new Error(`${fileName} 包含远程 dynamic import。`);
  }

  if (/\bimportScripts\s*\(\s*["']https?:\/\//u.test(content)) {
    throw new Error(`${fileName} 包含远程 importScripts。`);
  }

  if (/\bsrc\s*=\s*["']https?:\/\/[^"']+["']/u.test(content) && /script/u.test(content)) {
    throw new Error(`${fileName} 包含疑似远程脚本赋值。`);
  }
}

// 校验 zip 根目录和 dist 文件清单完全一致。
function assertZipMatchesDist(distFiles: readonly string[], zipEntries: readonly ZipEntryContent[]): void {
  const zipEntryNames = zipEntries.map((entry) => entry.entryName);

  if (!zipEntryNames.includes("manifest.json")) {
    throw new Error("Chrome zip 根目录缺少 manifest.json。");
  }

  if (zipEntryNames.some((entryName) => entryName.startsWith("chrome/") || entryName.startsWith("dist/"))) {
    throw new Error("Chrome zip 根目录多包了一层目录。");
  }

  if (JSON.stringify(zipEntryNames) !== JSON.stringify(distFiles)) {
    throw new Error("Chrome zip 文件清单必须与 dist/chrome 完全一致。");
  }
}

// 校验 zip 每个文件内容与 dist/chrome 相同。
async function assertZipContentMatchesDist(
  extensionDirectory: string,
  zipEntries: readonly ZipEntryContent[]
): Promise<void> {
  for (const zipEntry of zipEntries) {
    const distData = await readFile(resolve(extensionDirectory, zipEntry.entryName));

    if (hashBuffer(distData) !== hashBuffer(zipEntry.data)) {
      throw new Error(`Chrome zip 文件 ${zipEntry.entryName} 与 dist/chrome 内容不一致。`);
    }
  }
}

// 从 dist/chrome 读取并解析 manifest。
async function readManifest(extensionDirectory: string): Promise<JsonRecord> {
  const manifestPath = resolve(extensionDirectory, "manifest.json");
  const manifestStat = await stat(manifestPath);

  if (!manifestStat.isFile()) {
    throw new Error("dist/chrome/manifest.json 必须是文件。");
  }

  const manifestText = await readFile(manifestPath, "utf8");
  const manifestValue: unknown = JSON.parse(manifestText);

  if (!isRecord(manifestValue)) {
    throw new Error("dist/chrome/manifest.json 必须是 JSON 对象。");
  }

  return manifestValue;
}

// 审计 Chrome 构建目录和发布 zip。
export async function auditChromeBuild(input: ChromeBuildAuditInput): Promise<ChromeBuildAuditReport> {
  const extensionDirectory = resolve(input.extensionDirectory);
  const packagePath = resolve(input.packagePath);
  const distFiles = await collectDistFiles(extensionDirectory);
  const fileSet = new Set(distFiles);
  const manifest = await readManifest(extensionDirectory);
  const localeStatus = assertManifestFacts(manifest, fileSet);
  const zipEntries = collectZipEntries(new AdmZip(packagePath));

  assertZipMatchesDist(distFiles, zipEntries);
  await assertZipContentMatchesDist(extensionDirectory, zipEntries);

  for (const fileName of distFiles) {
    const content = await readFile(resolve(extensionDirectory, fileName), "utf8");
    assertTextArtifactSafe(fileName, content);
  }

  return {
    distFileCount: distFiles.length,
    zipFileCount: zipEntries.length,
    localeStatus
  };
}
