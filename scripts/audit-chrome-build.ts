import { resolve } from "node:path";
import { auditChromeBuild } from "./chrome-build-audit";

const extensionDirectory = resolve(import.meta.dirname, "../dist/chrome");
const packagePath = resolve(import.meta.dirname, "../dist/markdownsave-chrome.zip");

// 执行 Chrome 发布产物审计。
async function runAudit(): Promise<void> {
  const report = await auditChromeBuild({
    extensionDirectory,
    packagePath
  });

  console.log(
    `Chrome build audit passed: ${report.distFileCount} dist files, ${report.zipFileCount} zip files, locale=${report.localeStatus}.`
  );
}

await runAudit();
