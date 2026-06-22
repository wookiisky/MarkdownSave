import { afterEach, describe, expect, it, vi } from "vitest";

import {
  executeMarkdownAction,
  executeMarkdownActionAndReport,
  type MarkdownActionDependencies
} from "../../../src/background/markdown-actions";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";
import type { MarkdownConvertCapturePayload } from "../../../src/shared/messages";

/** 构造 capture。 */
function createCapture(tabId: number, clipMode: "selection" | "page"): MarkdownConvertCapturePayload {
  return {
    pageHtml: `<html><body><p>Tab ${tabId}</p></body></html>`,
    selectionHtml: clipMode === "selection" ? `<p>Selection ${tabId}</p>` : null,
    title: `Page ${tabId}`,
    baseUrl: `https://example.com/page-${tabId}`,
    pageUrl: `https://example.com/page-${tabId}`,
    hasSelection: clipMode === "selection",
    clipMode,
    metadata: {
      language: "zh-CN",
      charset: "utf-8",
      canonicalUrl: null,
      description: null,
      siteName: "Example"
    }
  };
}

/** 构造 action 测试依赖。 */
function createDependencies(): MarkdownActionDependencies & {
  copiedTexts: string[];
  openedUris: string[];
  downloads: chrome.downloads.DownloadOptions[];
  captureModes: Array<"selection" | "page">;
  writtenOptions: unknown[];
  reportedErrors: string[];
  batchStarts: unknown[];
} {
  const copiedTexts: string[] = [];
  const openedUris: string[] = [];
  const downloads: chrome.downloads.DownloadOptions[] = [];
  const captureModes: Array<"selection" | "page"> = [];
  const writtenOptions: unknown[] = [];
  const reportedErrors: string[] = [];
  const batchStarts: unknown[] = [];
  let batchActionId = 0;

  return {
    copiedTexts,
    openedUris,
    downloads,
    captureModes,
    writtenOptions,
    reportedErrors,
    batchStarts,
    clip: {
      readActiveTab: () => Promise.resolve({ id: 1, url: "https://example.com/page-1", restricted: false }),
      captureTab(tabId, clipMode) {
        captureModes.push(clipMode);
        return Promise.resolve(createCapture(tabId, clipMode));
      },
      ensureOffscreenDocument: () =>
        Promise.resolve({
          supported: true,
          available: true,
          created: false,
          ready: true
        }),
      sendRuntimeMessage(message) {
        const capture = (message as { capture: MarkdownConvertCapturePayload }).capture;
        return Promise.resolve({
          ok: true,
          requestId: "req_markdown-convert",
          data: {
            markdown: `Markdown ${capture.title}`,
            title: `Title ${capture.title}`,
            article: {
              title: `Title ${capture.title}`,
              pageTitle: capture.title,
              byline: "",
              excerpt: "",
              siteName: "Example",
              baseURI: capture.baseUrl,
              length: 10,
              dir: "",
              lang: "zh-CN",
              publishedTime: "",
              keywords: [],
              hash: "",
              host: "example.com",
              origin: "https://example.com",
              hostname: "example.com",
              pathname: `/page-${capture.title.substring(capture.title.lastIndexOf(" ") + 1)}`,
              port: "",
              protocol: "https:",
              search: ""
            },
            imageDownloads: [],
            downloadSettings: {
              downloadMode: "downloadsApi",
              saveAs: false,
              mdClipsFolder: null,
              disallowedChars: "[]#^"
            }
          }
        });
      }
    },
    download: {
      download(options) {
        downloads.push(options);
        return Promise.resolve(downloads.length);
      }
    },
    tabs: {
      query(queryInfo) {
        if (queryInfo.highlighted === true) {
          return Promise.resolve([
            { id: 2, url: "https://example.com/page-2" },
            { id: 3, url: "https://example.com/page-3" }
          ] as chrome.tabs.Tab[]);
        }

        return Promise.resolve([
          { id: 1, url: "https://example.com/page-1" },
          { id: 2, url: "https://example.com/page-2" }
        ] as chrome.tabs.Tab[]);
      }
    },
    readStoredOptions: () =>
      Promise.resolve({
        ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
        obsidianIntegration: true,
        obsidianVault: "Vault",
        obsidianFolder: "Notes/{host}"
      }),
    writeStoredOptions(options) {
      writtenOptions.push(options);
      return Promise.resolve();
    },
    writeClipboard(_tabId, text) {
      copiedTexts.push(text);
      return Promise.resolve();
    },
    openUri(uri) {
      openedUris.push(uri);
      return Promise.resolve();
    },
    reportActionFailure(error) {
      reportedErrors.push(error.code);
      return Promise.resolve();
    },
    startBatchDownload(request) {
      batchStarts.push(request);
      return Promise.resolve({
        ok: true,
        requestId: request.requestId,
        data: {
          jobId: request.jobId,
          status: "queued",
          totalTabs: 2,
          completedTabs: 0,
          failedTabs: 0
        }
      });
    },
    createBatchActionId() {
      batchActionId += 1;
      return `batch-${batchActionId}`;
    }
  };
}

describe("background markdown actions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("下载当前 tab 时复用剪藏和下载边界", async () => {
    const dependencies = createDependencies();

    const response = await executeMarkdownAction(
      "downloadTab",
      { tab: { id: 7, url: "https://example.com/page-7", restricted: false } },
      dependencies
    );

    expect(response.ok).toBe(true);
    expect(dependencies.captureModes).toEqual(["page"]);
    expect(dependencies.downloads[0]?.filename).toBe("Title Page 7.md");
  });

  it("复制链接和图片不触发剪藏", async () => {
    const dependencies = createDependencies();

    await executeMarkdownAction(
      "copyLink",
      {
        tab: { id: 1, url: "https://example.com/page-1", restricted: false },
        info: { menuItemId: "copy-markdown-link", linkUrl: "https://target.test", linkText: "Target" }
      },
      dependencies
    );
    await executeMarkdownAction(
      "copyImage",
      {
        tab: { id: 1, url: "https://example.com/page-1", restricted: false },
        info: { menuItemId: "copy-markdown-image", srcUrl: "https://target.test/image.png" }
      },
      dependencies
    );

    expect(dependencies.captureModes).toEqual([]);
    expect(dependencies.copiedTexts).toEqual(["[Target](https://target.test)", "![](https://target.test/image.png)"]);
  });

  it("复制选中 tab 链接列表使用 highlighted tabs", async () => {
    const dependencies = createDependencies();

    const response = await executeMarkdownAction(
      "copySelectedTabLinks",
      { tab: { id: 1, url: "https://example.com/page-1", restricted: false } },
      dependencies
    );

    expect(response.ok).toBe(true);
    expect(dependencies.copiedTexts).toEqual([
      "- [Title Page 2](https://example.com/page-2)\n- [Title Page 3](https://example.com/page-3)"
    ]);
  });

  it("复制 tab 链接使用真实 tab URL 而不是页面 baseURI", async () => {
    const dependencies = createDependencies();
    dependencies.clip.sendRuntimeMessage = (message) => {
      const capture = (message as { capture: MarkdownConvertCapturePayload }).capture;
      return Promise.resolve({
        ok: true,
        requestId: "req_markdown-convert",
        data: {
          markdown: `Markdown ${capture.title}`,
          title: "Title With Base",
          article: {
            title: "Title With Base",
            pageTitle: capture.title,
            byline: "",
            excerpt: "",
            siteName: "Example",
            baseURI: "https://example.com/assets/",
            length: 10,
            dir: "",
            lang: "zh-CN",
            publishedTime: "",
            keywords: [],
            hash: "",
            host: "example.com",
            origin: "https://example.com",
            hostname: "example.com",
            pathname: "/assets/",
            port: "",
            protocol: "https:",
            search: ""
          },
          imageDownloads: [],
          downloadSettings: {
            downloadMode: "downloadsApi",
            saveAs: false,
            mdClipsFolder: null,
            disallowedChars: "[]#^"
          }
        }
      });
    };

    const response = await executeMarkdownAction(
      "copyTabLink",
      { tab: { id: 5, url: "https://example.com/articles/page-5", restricted: false } },
      dependencies
    );

    expect(response.ok).toBe(true);
    expect(dependencies.copiedTexts).toEqual(["[Title With Base](https://example.com/articles/page-5)"]);
  });

  it("发送 Obsidian 时先复制 Markdown 再打开 Advanced URI", async () => {
    const dependencies = createDependencies();
    const events: string[] = [];
    dependencies.writeClipboard = (_tabId, text) => {
      events.push(`copy:${text}`);
      return Promise.resolve();
    };
    dependencies.openUri = (uri) => {
      events.push(`open:${uri}`);
      return Promise.resolve();
    };

    const response = await executeMarkdownAction(
      "copySelectionToObsidian",
      { tab: { id: 4, url: "https://example.com/page-4", restricted: false } },
      dependencies
    );

    expect(response.ok).toBe(true);
    expect(dependencies.captureModes).toEqual(["selection"]);
    expect(events).toEqual([
      "copy:Markdown Page 4",
      "open:obsidian://advanced-uri?vault=Vault&clipboard=true&mode=new&filepath=Notes/example.com/Title Page 4"
    ]);
  });

  it("checkbox action 写回切换后的 options", async () => {
    const dependencies = createDependencies();

    const response = await executeMarkdownAction("toggleDownloadImages", {}, dependencies);

    expect(response.ok).toBe(true);
    expect(dependencies.writtenOptions[0]).toMatchObject({ downloadImages: true });
  });

  it("下载全部 tabs 不被受限触发页拦截", async () => {
    const dependencies = createDependencies();

    const response = await executeMarkdownAction(
      "downloadAllTabs",
      { tab: { id: 1, url: "chrome://extensions", restricted: true } },
      dependencies
    );

    expect(response.ok).toBe(true);
    expect(dependencies.batchStarts).toHaveLength(1);
    expect(dependencies.captureModes).toEqual([]);
  });

  it("连续两次下载全部 tabs 使用不同 batch requestId", async () => {
    const dependencies = createDependencies();
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    await executeMarkdownAction("downloadAllTabs", {}, dependencies);
    await executeMarkdownAction("downloadAllTabs", {}, dependencies);

    expect(dependencies.batchStarts).toMatchObject([
      {
        requestId: "req_markdown-action-batch-start-batch-1",
        jobId: "job_batch-1"
      },
      {
        requestId: "req_markdown-action-batch-start-batch-2",
        jobId: "job_batch-2"
      }
    ]);
  });

  it("command 和 context menu 使用的包装会报告失败响应", async () => {
    const dependencies = createDependencies();

    const response = await executeMarkdownActionAndReport(
      "copyTab",
      { tab: { id: 1, url: "chrome://extensions", restricted: true } },
      dependencies
    );

    expect(response.ok).toBe(false);
    expect(dependencies.reportedErrors).toEqual(["restricted_page"]);
  });
});
