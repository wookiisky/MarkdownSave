import { defineConfig } from "vitest/config";

// Vitest 覆盖单元测试和 M11 集成 fixture 合同。
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/{unit,integration}/**/*.test.ts"],
    globals: false,
    restoreMocks: true,
    clearMocks: true
  }
});
