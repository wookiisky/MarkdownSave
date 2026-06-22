import AdmZip from "adm-zip";
import { mkdir, readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const extensionDirectory = resolve(import.meta.dirname, "../dist/chrome");
const packagePath = resolve(import.meta.dirname, "../dist/markdownsave-chrome.zip");

// 判断路径是否是文件。
async function isFile(filePath: string): Promise<boolean> {
  const fileStat = await stat(filePath);
  return fileStat.isFile();
}

// 递归收集 dist/chrome 下的扩展产物。
async function collectFiles(directory: string): Promise<string[]> {
  const directoryEntries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of directoryEntries) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      const childFiles = await collectFiles(entryPath);
      files.push(...childFiles);
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

// 校验 zip 根目录直接包含 manifest 和扩展产物，避免多包一层目录。
function assertPackageRoot(zip: AdmZip): void {
  const entryNames = zip.getEntries().map((entry) => entry.entryName);

  if (!entryNames.includes("manifest.json")) {
    throw new Error("Chrome zip 根目录缺少 manifest.json，请先运行 npm run build。");
  }

  const hasNestedChromeRoot = entryNames.some((entryName) => entryName.startsWith("chrome/"));
  const hasNestedDistRoot = entryNames.some((entryName) => entryName.startsWith("dist/"));

  if (hasNestedChromeRoot || hasNestedDistRoot) {
    throw new Error("Chrome zip 根目录多包了一层目录，必须直接包含 manifest.json。");
  }
}

if (!(await isFile(resolve(extensionDirectory, "manifest.json")))) {
  throw new Error("dist/chrome/manifest.json 不存在，请先运行 npm run build。");
}

const zip = new AdmZip();
const files = await collectFiles(extensionDirectory);

for (const file of files) {
  zip.addLocalFile(file, relative(extensionDirectory, resolve(file, "..")));
}

assertPackageRoot(zip);
await mkdir(resolve(packagePath, ".."), { recursive: true });
zip.writeZip(packagePath);

const writtenZip = new AdmZip(packagePath);
assertPackageRoot(writtenZip);
