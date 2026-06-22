import { describe, expect, it } from "vitest";

import { handleCommandBoundary, readCommandAction, resolveCommandBoundary } from "../../../src/background/commands";
import type { MarkdownActionDependencies } from "../../../src/background/markdown-actions";
import { MessageType } from "../../../src/shared/messages";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";

/** 等待 command 边界中的异步 action。 */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** 构造 restricted tab 场景依赖。 */
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

describe("background commands", () => {
  it("保留 MarkDownload command 边界", () => {
    expect(resolveCommandBoundary("download_tab_as_markdown")).toEqual({
      commandId: "download_tab_as_markdown",
      requestType: MessageType.DOWNLOAD_MARKDOWN_REQUEST
    });
    expect(resolveCommandBoundary("missing")).toBeNull();
  });

  it("映射 command id 到 M8 action", () => {
    expect(readCommandAction("download_tab_as_markdown")).toBe("downloadTab");
    expect(readCommandAction("copy_tab_as_markdown")).toBe("copyTab");
    expect(readCommandAction("copy_selection_as_markdown")).toBe("copySelection");
    expect(readCommandAction("copy_tab_as_markdown_link")).toBe("copyTabLink");
    expect(readCommandAction("copy_selected_tab_as_markdown_link")).toBe("copySelectedTabLinks");
    expect(readCommandAction("copy_selection_to_obsidian")).toBe("copySelectionToObsidian");
    expect(readCommandAction("copy_tab_to_obsidian")).toBe("copyTabToObsidian");
    expect(readCommandAction("_execute_action")).toBeNull();
  });

  it("command action 失败时报告可见诊断", async () => {
    const dependencies = createActionDependencies();

    handleCommandBoundary("copy_tab_as_markdown", dependencies);
    await flushAsync();

    expect(dependencies.reportedErrors).toEqual(["restricted_page"]);
  });
});
