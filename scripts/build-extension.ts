import { build, type InlineConfig } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import manifest from "../src/manifest/manifest.config";

const outputDirectory = resolve(import.meta.dirname, "../dist/chrome");
const manifestPath = resolve(outputDirectory, "manifest.json");
const watchMode = process.argv.includes("--watch");

// 写入 manifest 主事实，保证 dist/chrome 是可加载扩展目录。
async function writeChromeManifest(): Promise<void> {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

// 执行一次生产构建并同步 manifest。
async function buildOnce(): Promise<void> {
  await build();
  await writeChromeManifest();
}

// 启动 Vite watch，并在每次 bundle 结束后同步 manifest。
async function buildWatch(): Promise<void> {
  await writeChromeManifest();

  const config: InlineConfig = {
    build: {
      watch: {}
    }
  };
  const watcher = await build(config);

  if ("on" in watcher) {
    watcher.on("event", async (event) => {
      if (event.code === "BUNDLE_END" || event.code === "END") {
        await writeChromeManifest();
      }
    });
  }
}

if (watchMode) {
  await buildWatch();
} else {
  await buildOnce();
}
