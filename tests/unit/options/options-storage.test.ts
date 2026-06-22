import { describe, expect, it } from "vitest";

import {
  createOptionsExportFilename,
  exportOptionsToJson,
  importOptionsJsonToSyncStorage,
  readOptionsFromSyncStorage,
  saveOptionsToSyncStorage
} from "../../../src/options/options-storage";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";

/** 测试用 sync storage。 */
interface TestOptionsStorage {
  /** 当前状态。 */
  state: Record<string, unknown>;
  /** set 调用记录。 */
  setCalls: Array<Record<string, unknown>>;
  /** 读取 storage。 */
  get(keys?: unknown): Promise<Record<string, unknown>>;
  /** 写入 storage。 */
  set(items: Record<string, unknown>): Promise<void>;
}

/** 创建测试用 sync storage。 */
function createStorage(initialState: Record<string, unknown> = {}): TestOptionsStorage {
  return {
    state: { ...initialState },
    setCalls: [],
    get() {
      return Promise.resolve({ ...this.state });
    },
    set(items) {
      this.setCalls.push({ ...items });
      this.state = {
        ...this.state,
        ...items
      };
      return Promise.resolve();
    }
  };
}

describe("options storage", () => {
  it("从 storage.sync 读取旧配置并补齐默认值", async () => {
    const storage = createStorage({
      title: "{title}",
      includeTemplate: true,
      futureOption: "future"
    });

    const result = await readOptionsFromSyncStorage(storage);

    expect(result.ok).toBe(true);
    expect(result.options.title).toBe("{title}");
    expect(result.options.includeTemplate).toBe(true);
    expect(result.options.headingStyle).toBe(DEFAULT_MARKDOWN_SAVE_OPTIONS.headingStyle);
    expect(result.ignoredFields).toEqual(["futureOption"]);
    expect(storage.setCalls).toEqual([]);
  });

  it("storage.sync 读取失败时不写入旧配置", async () => {
    const storage = createStorage();
    storage.get = () => Promise.reject(new Error("read failed"));

    const result = await readOptionsFromSyncStorage(storage);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("读取失败用例不应成功");
    }
    expect(result.options).toEqual(DEFAULT_MARKDOWN_SAVE_OPTIONS);
    expect(result.errors[0]).toMatchObject({ code: "storage_read_failed" });
    expect(storage.setCalls).toEqual([]);
  });

  it("迁移失败时降级展示默认配置且不写入 storage.sync", async () => {
    const storage = createStorage({
      headingStyle: "markdown"
    });

    const result = await readOptionsFromSyncStorage(storage);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("迁移失败用例不应成功");
    }
    expect(result.options).toEqual(DEFAULT_MARKDOWN_SAVE_OPTIONS);
    expect(result.errors[0]).toMatchObject({ code: "options_validation_failed" });
    expect(storage.state.headingStyle).toBe("markdown");
    expect(storage.setCalls).toEqual([]);
  });

  it("写入 storage.sync 时只写当前已知 options 字段", async () => {
    const storage = createStorage({ futureOption: "future" });
    const options = {
      ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
      title: "{title}"
    };

    const result = await saveOptionsToSyncStorage(storage, options);

    expect(result.ok).toBe(true);
    expect(storage.setCalls).toHaveLength(1);
    expect(storage.setCalls[0]).toMatchObject({ title: "{title}" });
    expect(storage.setCalls[0]?.futureOption).toBeUndefined();
    expect(storage.state.futureOption).toBe("future");
  });

  it("导入旧配置 JSON 前校验并补齐缺字段", async () => {
    const storage = createStorage();
    const result = await importOptionsJsonToSyncStorage(
      storage,
      JSON.stringify({
        title: "{title}",
        mdClipsFolder: "clips"
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.options.title).toBe("{title}");
      expect(result.options.mdClipsFolder).toBe("clips");
      expect(result.options.headingStyle).toBe(DEFAULT_MARKDOWN_SAVE_OPTIONS.headingStyle);
    }
    expect(storage.setCalls).toHaveLength(1);
  });

  it("导入含未知未来字段的 JSON 时隔离未知字段且不写入", async () => {
    const storage = createStorage();

    const result = await importOptionsJsonToSyncStorage(
      storage,
      JSON.stringify({
        ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
        futureOption: "future"
      })
    );

    expect(result.ok).toBe(true);
    expect(result.ignoredFields).toEqual(["futureOption"]);
    expect(storage.setCalls).toHaveLength(1);
    expect(storage.setCalls[0]?.futureOption).toBeUndefined();
  });

  it("非法 JSON 导入失败且不覆盖 storage.sync", async () => {
    const storage = createStorage({ title: "{old}" });

    const result = await importOptionsJsonToSyncStorage(storage, "{");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("非法 JSON 用例不应成功");
    }
    expect(result.errors[0]).toMatchObject({ code: "json_parse_failed" });
    expect(storage.state.title).toBe("{old}");
    expect(storage.setCalls).toEqual([]);
  });

  it("非法 schema 导入失败且不覆盖 storage.sync", async () => {
    const storage = createStorage({ title: "{old}" });

    const result = await importOptionsJsonToSyncStorage(
      storage,
      JSON.stringify({
        ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
        downloadImages: "yes"
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("非法 schema 用例不应成功");
    }
    expect(result.errors[0]).toMatchObject({ code: "options_validation_failed" });
    expect(storage.state.title).toBe("{old}");
    expect(storage.setCalls).toEqual([]);
  });

  it("导出当前 options 为稳定 JSON", () => {
    const json = exportOptionsToJson(DEFAULT_MARKDOWN_SAVE_OPTIONS);

    expect(json.endsWith("\n")).toBe(true);
    expect(JSON.parse(json)).toEqual(DEFAULT_MARKDOWN_SAVE_OPTIONS);
  });

  it("导出后再导入得到同一份已知 options", async () => {
    const storage = createStorage();
    const options = {
      ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
      includeTemplate: true,
      title: "{title}"
    };

    const result = await importOptionsJsonToSyncStorage(storage, exportOptionsToJson(options));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.options).toEqual(options);
    }
    expect(storage.state).toMatchObject(options);
  });

  it("导出文件名使用 MarkdownSave 和本地日期", () => {
    expect(createOptionsExportFilename(new Date(2026, 5, 8))).toBe("MarkdownSave-export-2026-06-08.json");
  });
});
