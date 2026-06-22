import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";

const rootDirectory = resolve(import.meta.dirname, "src");

// Vite 多入口配置，生成 Chrome MV3 最小扩展产物。
export default defineConfig({
  root: rootDirectory,
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, "dist/chrome"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        "background/service-worker": resolve(rootDirectory, "background/service-worker.ts"),
        "content/content-script": resolve(rootDirectory, "content/content-script.ts"),
        "content/page-context": resolve(rootDirectory, "content/page-context.ts"),
        "offscreen/offscreen": resolve(rootDirectory, "offscreen/offscreen.html"),
        "popup/index": resolve(rootDirectory, "popup/index.html"),
        "options/index": resolve(rootDirectory, "options/index.html")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
