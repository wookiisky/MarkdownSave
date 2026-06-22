import { describe, expect, it } from "vitest";

import {
  createContextMenuDefinitions,
  queueRebuildContextMenus,
  readContextMenuAction,
  rebuildContextMenus,
  registerContextMenuClickListener,
  type ContextMenusRegistrationApi
} from "../../../src/background/context-menus";
import type { MarkdownActionDependencies } from "../../../src/background/markdown-actions";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";

/** 等待 Promise 微任务和事件监听中的异步动作。 */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** 构造最小 action 依赖。 */
function createActionDependencies(): MarkdownActionDependencies & { reportedErrors: string[] } {
  const reportedErrors: string[] = [];

  return {
    reportedErrors,
    clip: {
      readActiveTab: () => Promise.resolve({ id: 1, url: "chrome://extensions", restricted: true }),
      captureTab: () => Promise.reject(new Error("unexpected capture")),
      ensureOffscreenDocument: () => Promise.reject(new Error("unexpected offscreen")),
      sendRuntimeMessage: () => Promise.reject(new Error("unexpected message"))
    },
    download: {
      download: () => Promise.reject(new Error("unexpected download"))
    },
    tabs: {
      query: () => Promise.resolve([{ id: 1, url: "chrome://extensions" }] as chrome.tabs.Tab[])
    },
    readStoredOptions: () => Promise.resolve(DEFAULT_MARKDOWN_SAVE_OPTIONS),
    writeStoredOptions: () => Promise.resolve(),
    writeClipboard: () => Promise.resolve(),
    openUri: () => Promise.resolve(),
    reportActionFailure(error) {
      reportedErrors.push(error.code);
      return Promise.resolve();
    },
    startBatchDownload: () =>
      Promise.resolve({
        ok: true,
        requestId: "req_batch",
        data: {
          jobId: "job_batch",
          status: "queued",
          totalTabs: 0,
          completedTabs: 0,
          failedTabs: 0
        }
      }),
    createBatchActionId: () => "batch-test"
  };
}

describe("background context menus", () => {
  it("按 options 创建 checkbox 和 Obsidian 菜单", () => {
    const definitions = createContextMenuDefinitions({
      ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
      includeTemplate: true,
      downloadImages: true,
      obsidianIntegration: true
    });

    expect(definitions.find((item) => item.id === "toggle-includeTemplate")).toMatchObject({ checked: true });
    expect(definitions.find((item) => item.id === "tabtoggle-downloadImages")).toMatchObject({ checked: true });
    expect(definitions.map((item) => item.id)).toContain("copy-markdown-obsidian");
    expect(definitions.map((item) => item.id)).toContain("copy-markdown-obsall");
  });

  it("contextMenus 关闭时只移除旧菜单不创建新菜单", async () => {
    const creates: unknown[] = [];
    let removed = 0;

    const count = await rebuildContextMenus(
      {
        create(properties) {
          creates.push(properties);
        },
        removeAll() {
          removed += 1;
        },
        update() {
          return undefined;
        },
        onClicked: {
          addListener() {
            return undefined;
          }
        }
      },
      {
        ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
        contextMenus: false
      }
    );

    expect(count).toBe(0);
    expect(creates).toEqual([]);
    expect(removed).toBe(1);
  });

  it("映射 MarkDownload 菜单 id 到 M8 action", () => {
    expect(readContextMenuAction("download-markdown-selection")).toBe("downloadSelection");
    expect(readContextMenuAction("copy-markdown-link")).toBe("copyLink");
    expect(readContextMenuAction("copy-markdown-image")).toBe("copyImage");
    expect(readContextMenuAction("copy-markdown-obsidian")).toBe("copySelectionToObsidian");
    expect(readContextMenuAction("tabtoggle-downloadImages")).toBe("toggleDownloadImages");
    expect(readContextMenuAction("missing")).toBeNull();
  });

  it("串行化并发菜单重建，最终使用最新 options", async () => {
    const creates: unknown[] = [];
    let removed = 0;
    const contextMenusApi: ContextMenusRegistrationApi = {
      create(properties) {
        creates.push(properties);
      },
      removeAll() {
        removed += 1;
      },
      update() {
        return undefined;
      },
      onClicked: {
        addListener() {
          return undefined;
        }
      }
    };

    await Promise.all([
      queueRebuildContextMenus(contextMenusApi, {
        ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
        includeTemplate: false,
        downloadImages: false
      }),
      queueRebuildContextMenus(contextMenusApi, {
        ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
        includeTemplate: true,
        downloadImages: true
      })
    ]);

    expect(removed).toBe(1);
    expect(creates.find((item) => (item as { id: string }).id === "toggle-includeTemplate")).toMatchObject({
      checked: true
    });
    expect(creates.find((item) => (item as { id: string }).id === "toggle-downloadImages")).toMatchObject({
      checked: true
    });
  });

  it("context menu 点击失败时报告可见诊断", async () => {
    const listeners: Array<(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void> = [];
    const dependencies = createActionDependencies();

    registerContextMenuClickListener(
      {
        create() {
          return undefined;
        },
        removeAll() {
          return undefined;
        },
        update() {
          return undefined;
        },
        onClicked: {
          addListener(registeredListener) {
            listeners.push(registeredListener);
          }
        }
      },
      dependencies
    );

    const listener = listeners[0];
    if (listener === undefined) {
      throw new Error("未注册 context menu listener");
    }

    listener(
      { menuItemId: "copy-markdown-all" } as chrome.contextMenus.OnClickData,
      { id: 1, url: "chrome://extensions" } as chrome.tabs.Tab
    );
    await flushAsync();

    expect(dependencies.reportedErrors).toEqual(["restricted_page"]);
  });
});
