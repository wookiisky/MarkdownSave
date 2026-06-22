import AdmZip from "adm-zip";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditChromeBuild } from "../../../scripts/chrome-build-audit";

interface AuditFixture {
  readonly extensionDirectory: string;
  readonly packagePath: string;
}

type FixtureFileOverrides = Readonly<Record<string, string | Buffer>>;

const validManifest = {
  manifest_version: 3,
  name: "MarkdownSave",
  version: "0.1.0",
  icons: {
    "16": "icons/favicon-16x16.png",
    "32": "icons/favicon-32x32.png",
    "48": "icons/favicon-48x48.png",
    "128": "icons/appicon-128x128.png"
  },
  action: {
    default_title: "MarkdownSave",
    default_popup: "popup/index.html",
    default_icon: {
      "16": "icons/favicon-16x16.png",
      "32": "icons/favicon-32x32.png",
      "48": "icons/favicon-48x48.png",
      "128": "icons/appicon-128x128.png"
    }
  },
  background: {
    service_worker: "background/service-worker.js",
    type: "module"
  },
  options_ui: {
    page: "options/index.html",
    open_in_tab: false
  },
  permissions: ["activeTab", "scripting", "downloads", "storage", "contextMenus", "clipboardWrite", "offscreen"],
  host_permissions: ["<all_urls>"],
  web_accessible_resources: [
    {
      resources: ["content/page-context.js"],
      matches: ["<all_urls>"]
    }
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';"
  }
} as const;

const validFiles: FixtureFileOverrides = {
  "manifest.json": `${JSON.stringify(validManifest, null, 2)}\n`,
  "background/service-worker.js": "chrome.runtime.onMessage.addListener(() => undefined);\n",
  "content/content-script.js": "window.__markdownSaveContent = true;\n",
  "content/page-context.js": "window.__markdownSavePageContext = true;\n",
  "offscreen/offscreen.html": "<!doctype html><script type=\"module\" src=\"offscreen.js\"></script>\n",
  "offscreen/offscreen.js": "navigator.clipboard;\n",
  "popup/index.html": "<!doctype html><script type=\"module\" src=\"index.js\"></script>\n",
  "popup/index.js": "const example = 'https://example.com/not-a-script.js';\n",
  "options/index.html": "<!doctype html><script type=\"module\" src=\"index.js\"></script>\n",
  "options/index.js": "const optionsReady = true;\n",
  "icons/favicon-16x16.png": Buffer.from([1]),
  "icons/favicon-32x32.png": Buffer.from([2]),
  "icons/favicon-48x48.png": Buffer.from([3]),
  "icons/appicon-128x128.png": Buffer.from([4])
};

// 写入测试文件并创建父目录。
async function writeFixtureFile(extensionDirectory: string, fileName: string, content: string | Buffer): Promise<void> {
  const filePath = resolve(extensionDirectory, fileName);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

// 创建临时 Chrome 发布产物 fixture。
async function createFixture(fileOverrides: FixtureFileOverrides = {}): Promise<AuditFixture> {
  const rootDirectory = await mkdtemp(resolve(tmpdir(), "markdownsave-audit-"));
  const extensionDirectory = resolve(rootDirectory, "dist/chrome");
  const packagePath = resolve(rootDirectory, "dist/markdownsave-chrome.zip");
  const files = {
    ...validFiles,
    ...fileOverrides
  };

  for (const [fileName, content] of Object.entries(files)) {
    await writeFixtureFile(extensionDirectory, fileName, content);
  }

  await writeZipFromDist(extensionDirectory, packagePath, Object.keys(files));
  return { extensionDirectory, packagePath };
}

// 从 dist fixture 写出 zip。
async function writeZipFromDist(
  extensionDirectory: string,
  packagePath: string,
  fileNames: readonly string[],
  mutateFile?: string
): Promise<void> {
  const zip = new AdmZip();

  for (const fileName of [...fileNames].sort()) {
    const data = mutateFile === fileName ? Buffer.from("changed") : await readFile(resolve(extensionDirectory, fileName));
    zip.addFile(fileName, data);
  }

  await mkdir(dirname(packagePath), { recursive: true });
  zip.writeZip(packagePath);
}

describe("Chrome build audit", () => {
  it("accepts a valid dist and zip with ordinary https content strings", async () => {
    const fixture = await createFixture();

    await expect(auditChromeBuild(fixture)).resolves.toEqual({
      distFileCount: Object.keys(validFiles).length,
      zipFileCount: Object.keys(validFiles).length,
      localeStatus: "not-declared"
    });
  });

  it("rejects a zip that wraps files in an extra chrome directory", async () => {
    const fixture = await createFixture();
    const zip = new AdmZip();

    for (const fileName of Object.keys(validFiles)) {
      const data = await readFile(resolve(fixture.extensionDirectory, fileName));
      zip.addFile(`chrome/${fileName}`, data);
    }

    zip.writeZip(fixture.packagePath);

    await expect(auditChromeBuild(fixture)).rejects.toThrow("Chrome zip 根目录缺少 manifest.json");
  });

  it("rejects a zip whose file content differs from dist", async () => {
    const fixture = await createFixture();
    await writeZipFromDist(fixture.extensionDirectory, fixture.packagePath, Object.keys(validFiles), "popup/index.js");

    await expect(auditChromeBuild(fixture)).rejects.toThrow("popup/index.js 与 dist/chrome 内容不一致");
  });

  it("rejects unsafe eval in manifest CSP", async () => {
    const manifest = {
      ...validManifest,
      content_security_policy: {
        extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self';"
      }
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("script-src 必须只允许 'self'");
  });

  it("rejects unexpected manifest permissions", async () => {
    const manifest = {
      ...validManifest,
      permissions: [...validManifest.permissions, "tabs"]
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("permissions 必须与首版权限清单完全一致");
  });

  it("rejects unexpected host permissions", async () => {
    const manifest = {
      ...validManifest,
      host_permissions: ["<all_urls>", "https://example.com/*"]
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("host_permissions 必须只包含 <all_urls>");
  });

  it("rejects static content scripts and MV2 browser action fields", async () => {
    const manifest = {
      ...validManifest,
      browser_action: {},
      content_scripts: [
        {
          matches: ["<all_urls>"],
          js: ["content/content-script.js"]
        }
      ]
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("不允许声明 browser_action");
  });

  it("rejects manifest entrypoints that do not point to packaged runtime files", async () => {
    const manifest = {
      ...validManifest,
      background: {
        service_worker: "background/other-worker.js",
        type: "module"
      }
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow(
      "background.service_worker 必须指向 background/service-worker.js"
    );
  });

  it("rejects non-module background service workers", async () => {
    const manifest = {
      ...validManifest,
      background: {
        service_worker: "background/service-worker.js",
        type: "classic"
      }
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("background.type 必须是 module");
  });

  it("rejects invalid popup and options entrypoint declarations", async () => {
    const manifest = {
      ...validManifest,
      action: {
        ...validManifest.action,
        default_popup: "popup/other.html"
      },
      options_ui: {
        page: "options/index.html",
        open_in_tab: true
      }
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("action.default_popup 必须指向 popup/index.html");
  });

  it("rejects options pages that open in a tab", async () => {
    const manifest = {
      ...validManifest,
      options_ui: {
        page: "options/index.html",
        open_in_tab: true
      }
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("options_ui.open_in_tab 必须是 false");
  });

  it("rejects CSP with extra script sources", async () => {
    const manifest = {
      ...validManifest,
      content_security_policy: {
        extension_pages: "script-src 'self' https://cdn.example.test; object-src 'self';"
      }
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("script-src 必须只允许 'self'");
  });

  it("rejects CSP without object-src", async () => {
    const manifest = {
      ...validManifest,
      content_security_policy: {
        extension_pages: "script-src 'self';"
      }
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("必须只包含 script-src 和 object-src");
  });

  it("rejects remote script src while allowing ordinary URL strings", async () => {
    const fixture = await createFixture({
      "popup/index.html": "<!doctype html><script src=\"https://cdn.example.test/app.js\"></script>\n"
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("远程 script src");
  });

  it("rejects eval and new Function in JavaScript bundles", async () => {
    const fixture = await createFixture({
      "options/index.js": "const run = new Function('return 1');\n"
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("eval 或 Function 动态执行");
  });

  it("rejects bare Function calls in JavaScript bundles", async () => {
    const fixture = await createFixture({
      "options/index.js": "const run = Function('return 1');\n"
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("eval 或 Function 动态执行");
  });

  it("rejects indirect eval in JavaScript bundles", async () => {
    const fixture = await createFixture({
      "options/index.js": "const run = (0, eval)('1 + 1');\n"
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("间接 eval");
  });

  it("rejects static remote imports in JavaScript bundles", async () => {
    const fixture = await createFixture({
      "options/index.js": "import \"https://cdn.example.test/app.js\";\n"
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("远程静态 import");
  });

  it("rejects unquoted remote script src in HTML", async () => {
    const fixture = await createFixture({
      "popup/index.html": "<!doctype html><script src=https://cdn.example.test/app.js></script>\n"
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("远程 script src");
  });

  it("requires _locales when default_locale is declared", async () => {
    const manifest = {
      ...validManifest,
      default_locale: "zh_CN"
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`
    });

    await expect(auditChromeBuild(fixture)).rejects.toThrow("_locales/zh_CN/messages.json");
  });

  it("accepts _locales when default_locale has matching messages file", async () => {
    const manifest = {
      ...validManifest,
      default_locale: "zh_CN"
    };
    const fixture = await createFixture({
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
      "_locales/zh_CN/messages.json": "{\"extensionName\":{\"message\":\"MarkdownSave\"}}\n"
    });

    await expect(auditChromeBuild(fixture)).resolves.toMatchObject({
      localeStatus: "declared"
    });
  });
});
