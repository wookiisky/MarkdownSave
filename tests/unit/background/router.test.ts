import { describe, expect, it } from "vitest";

import type { BatchJobDependencies } from "../../../src/background/batch-jobs";
import { handleAsyncBackgroundBusinessMessage, routeBackgroundMessage } from "../../../src/background/router";
import { ExtensionErrorCode, type ErrorResponse, type ExtensionResponse } from "../../../src/shared/errors";
import { MessageTarget, MessageType, type ClipCaptureMode } from "../../../src/shared/messages";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";

// 测试中显式收窄错误响应，避免 nullable 分支被忽略。
function requireErrorResponse(response: ExtensionResponse | null): ErrorResponse {
  if (response === null || response.ok) {
    throw new Error("预期收到错误响应。");
  }

  return response;
}

// 构造 router batch 测试依赖。
function createBatchDependencies(): BatchJobDependencies {
  const storageState: Record<string, unknown> = {};

  return {
    storage: {
      get: () => Promise.resolve(storageState),
      set(items) {
        Object.assign(storageState, items);
        return Promise.resolve();
      },
      remove(keys) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          delete storageState[String(key)];
        }
        return Promise.resolve();
      }
    },
    tabs: {
      query: () => Promise.resolve([]),
      get: () => Promise.reject(new Error("不应读取 tab"))
    },
    clip: {
      readActiveTab: () => Promise.resolve({ id: 1, url: "https://example.com", restricted: false }),
      captureTab: () => Promise.reject(new Error("不应剪藏")),
      ensureOffscreenDocument: () => Promise.reject(new Error("不应创建 offscreen")),
      sendRuntimeMessage: () => Promise.reject(new Error("不应转换"))
    },
    download: {
      download: () => Promise.reject(new Error("不应下载"))
    },
    readStoredOptions: () => Promise.resolve(DEFAULT_MARKDOWN_SAVE_OPTIONS),
    now: () => 1,
    runInBackground() {
      return undefined;
    },
    concurrency: 2,
    ttlMs: 86_400_000
  };
}

describe("background router", () => {
  it("返回 runtime ping 成功响应", () => {
    const response = routeBackgroundMessage({
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId: "req_ping"
    });

    expect(response).toEqual({
      ok: true,
      requestId: "req_ping",
      data: { pong: true }
    });
  });

  it("忽略显式发往 offscreen 的消息，避免抢占 offscreen 响应", () => {
    const response = routeBackgroundMessage({
      target: MessageTarget.OFFSCREEN,
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId: "req_offscreen"
    });

    expect(response).toBeNull();
  });

  it("未知 message 返回 unknown message 错误", () => {
    const response = routeBackgroundMessage({
      type: "missing.message",
      requestId: "req_unknown"
    });

    const errorResponse = requireErrorResponse(response);
    expect(errorResponse.requestId).toBe("req_unknown");
    expect(errorResponse.error.code).toBe(ExtensionErrorCode.UNKNOWN_MESSAGE);
  });

  it("缺少 requestId 返回 missing requestId 错误", () => {
    const response = routeBackgroundMessage({
      type: MessageType.RUNTIME_PING_REQUEST
    });

    const errorResponse = requireErrorResponse(response);
    expect(errorResponse.requestId).toBeNull();
    expect(errorResponse.error.code).toBe(ExtensionErrorCode.MISSING_REQUEST_ID);
  });

  it("批量消息缺少 jobId 返回 missing jobId 错误", () => {
    const response = routeBackgroundMessage({
      type: MessageType.BATCH_START_REQUEST,
      requestId: "req_batch"
    });

    const errorResponse = requireErrorResponse(response);
    expect(errorResponse.requestId).toBe("req_batch");
    expect(errorResponse.error.code).toBe(ExtensionErrorCode.MISSING_JOB_ID);
  });

  it("已知但未实现请求返回 not implemented 错误", () => {
    const response = routeBackgroundMessage({
      type: MessageType.CLIP_CAPTURE_REQUEST,
      requestId: "req_capture"
    });

    const errorResponse = requireErrorResponse(response);
    expect(errorResponse.error.code).toBe(ExtensionErrorCode.NOT_IMPLEMENTED);
    expect(errorResponse.error.details).toEqual({ type: MessageType.CLIP_CAPTURE_REQUEST });
  });

  it("异步处理当前页剪藏请求", async () => {
    const capturedModes: ClipCaptureMode[] = [];
    const response = await handleAsyncBackgroundBusinessMessage(
      {
        type: MessageType.CLIP_CAPTURE_REQUEST,
        requestId: "req_clip",
        clipMode: "page"
      },
      {
        clip: {
          readActiveTab: () => Promise.resolve({ id: 1, url: "https://example.com", restricted: false }),
          captureTab: (_tabId, clipMode) => {
            capturedModes.push(clipMode);
            return Promise.resolve({
              pageHtml: "<html><body>正文</body></html>",
              selectionHtml: null,
              title: "页面标题",
              baseUrl: "https://example.com",
              pageUrl: "https://example.com",
              hasSelection: false,
              clipMode,
              metadata: {
                language: null,
                charset: null,
                canonicalUrl: null,
                description: null,
                siteName: null
              }
            });
          },
          ensureOffscreenDocument: () =>
            Promise.resolve({
              supported: true,
              available: true,
              created: false,
              ready: true
            }),
          sendRuntimeMessage: () =>
            Promise.resolve({
              ok: true,
              requestId: "req_markdown-convert",
              data: {
                markdown: "正文",
                title: "页面标题",
                article: {
                  title: "页面标题",
                  pageTitle: "页面标题",
                  byline: "",
                  excerpt: "",
                  siteName: "",
                  baseURI: "https://example.com",
                  length: 2,
                  dir: "",
                  lang: "",
                  publishedTime: "",
                  keywords: [],
                  hash: "",
                  host: "example.com",
                  origin: "https://example.com",
                  hostname: "example.com",
                  pathname: "/",
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
            })
        }
      }
    );

    expect(response).toMatchObject({
      ok: true,
      requestId: "req_clip",
      data: {
        markdown: "正文",
        title: "页面标题"
      }
    });
    expect(capturedModes).toEqual(["page"]);
  });

  it("异步处理 Markdown 下载请求", async () => {
    const response = await handleAsyncBackgroundBusinessMessage(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "正文",
        title: "页面标题"
      },
      {
        download: {
          download: () => Promise.resolve(9)
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: 9 }
    });
  });

  it("异步处理批量启动和取消请求", async () => {
    const batch = createBatchDependencies();

    const start = await handleAsyncBackgroundBusinessMessage(
      {
        type: MessageType.BATCH_START_REQUEST,
        requestId: "req_batch_start",
        jobId: "job_router"
      },
      { batch }
    );
    const cancel = await handleAsyncBackgroundBusinessMessage(
      {
        type: MessageType.BATCH_CANCEL_REQUEST,
        requestId: "req_batch_cancel",
        jobId: "job_router"
      },
      { batch }
    );

    expect(start).toMatchObject({
      ok: true,
      requestId: "req_batch_start",
      data: {
        jobId: "job_router"
      }
    });
    expect(cancel).toMatchObject({
      ok: true,
      requestId: "req_batch_cancel",
      data: {
        jobId: "job_router",
        status: "canceled"
      }
    });
  });

  it("异步 Markdown 下载请求保留图片计划和下载设置", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];

    const response = await handleAsyncBackgroundBusinessMessage(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "![Photo](Images/photo.idunno)",
        title: "Articles/Page",
        imageDownloads: [
          {
            originalSrc: "https://example.com/assets/photo",
            sourceUrl: "https://example.com/assets/photo",
            filename: "Images/photo.idunno",
            isObsidian: false,
            outputStyle: "download"
          }
        ],
        downloadSettings: {
          downloadMode: "downloadsApi",
          saveAs: false,
          mdClipsFolder: "Clips",
          disallowedChars: "[]#^"
        }
      },
      {
        download: {
          download(options) {
            downloads.push(options);
            return Promise.resolve(downloads.length);
          },
          fetchImage() {
            return Promise.resolve({
              dataUrl: "data:image/png;base64,AAAA",
              mimeType: "image/png"
            });
          }
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: 1 }
    });
    expect(downloads[0]?.filename).toBe("Clips/Articles/Page.md");
    expect(decodeURIComponent(String(downloads[0]?.url))).toContain("![Photo](Images/photo.png)");
    expect(downloads[1]).toEqual({
      url: "data:image/png;base64,AAAA",
      filename: "Clips/Articles/Images/photo.png",
      saveAs: false
    });
  });
});
