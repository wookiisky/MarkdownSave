import { defineConfig, devices } from "@playwright/test";

// Playwright 只执行 Chromium 扩展 smoke 验证。
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium-extension",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
