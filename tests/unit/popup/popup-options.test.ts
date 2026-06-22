import { describe, expect, it } from "vitest";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";
import { readPopupStoredOptions, savePopupStoredOption } from "../../../src/popup/popup-options";

describe("popup-options", () => {
  it("从 storage.sync 读取 popup 初始开关状态", async () => {
    const result = await readPopupStoredOptions({
      storage: {
        get() {
          return Promise.resolve({
            ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
            includeTemplate: true,
            downloadImages: true
          });
        },
        set() {
          return Promise.resolve();
        },
        remove() {
          return Promise.resolve();
        }
      }
    });

    expect(result).toEqual({
      includeTemplate: true,
      downloadImages: true
    });
  });

  it("storage.sync 不可用时回退到默认开关状态", async () => {
    const result = await readPopupStoredOptions({
      storage: null
    });

    expect(result).toEqual({
      includeTemplate: DEFAULT_MARKDOWN_SAVE_OPTIONS.includeTemplate,
      downloadImages: DEFAULT_MARKDOWN_SAVE_OPTIONS.downloadImages
    });
  });

  it("只持久化 popup 允许写回的字段", async () => {
    const writes: Array<Record<string, unknown>> = [];

    await savePopupStoredOption("includeTemplate", true, {
      storage: {
        get() {
          return Promise.resolve({});
        },
        set(items) {
          writes.push(items);
          return Promise.resolve();
        },
        remove() {
          return Promise.resolve();
        }
      }
    });

    expect(writes).toEqual([{ includeTemplate: true }]);
  });
});
