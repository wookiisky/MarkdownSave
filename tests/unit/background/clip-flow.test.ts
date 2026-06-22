import { describe, expect, it } from "vitest";

import {
  clipCurrentPageAsMarkdown,
  downloadMarkdownFromRequest,
  type ClipCurrentPageDependencies,
  type DownloadMarkdownDependencies
} from "../../../src/background/clip-flow";
import { ExtensionErrorCode } from "../../../src/shared/errors";
import { MessageType, type ClipCaptureMode, type MarkdownConvertCapturePayload } from "../../../src/shared/messages";
import { toSuccessResponse } from "../../../src/shared/errors";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";

/** 构造 content capture。 */
function createCapture(
  clipMode: ClipCaptureMode = "selection",
  overrides: Partial<MarkdownConvertCapturePayload> = {}
): MarkdownConvertCapturePayload {
  return {
    pageHtml: "<html><body><p>正文</p></body></html>",
    selectionHtml: null,
    title: "页面标题",
    baseUrl: "https://example.com/post",
    pageUrl: "https://example.com/post",
    hasSelection: false,
    clipMode,
    metadata: {
      language: "zh-CN",
      charset: "utf-8",
      canonicalUrl: null,
      description: null,
      siteName: "Example"
    },
    ...overrides
  };
}

/** 构造剪藏依赖。 */
function createClipDependencies(overrides: Partial<ClipCurrentPageDependencies> = {}): ClipCurrentPageDependencies {
  return {
    readActiveTab: () => Promise.resolve({ id: 7, url: "https://example.com/post", restricted: false }),
    captureTab: () => Promise.resolve(createCapture()),
    ensureOffscreenDocument: () =>
      Promise.resolve({
        supported: true,
        available: true,
        created: false,
        ready: true
      }),
    sendRuntimeMessage: () =>
      Promise.resolve(
        toSuccessResponse("req_markdown-convert", {
          markdown: "正文",
          title: "页面标题",
          article: {
            title: "页面标题",
            pageTitle: "页面标题",
            byline: "",
            excerpt: "",
            siteName: "Example",
            baseURI: "https://example.com/post",
            length: 2,
            dir: "",
            lang: "zh-CN",
            publishedTime: "",
            keywords: [],
            hash: "",
            host: "example.com",
            origin: "https://example.com",
            hostname: "example.com",
            pathname: "/post",
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
        })
      ),
    ...overrides
  };
}

describe("background clip flow", () => {
  it("受限页面返回明确错误", async () => {
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        readActiveTab: () => Promise.resolve({ id: 1, url: "chrome://extensions", restricted: true })
      })
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(ExtensionErrorCode.RESTRICTED_PAGE);
    }
  });

  it("offscreen 不可用时返回明确错误", async () => {
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        ensureOffscreenDocument: () =>
          Promise.resolve({
            supported: true,
            available: true,
            created: true,
            ready: false
          })
      })
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(ExtensionErrorCode.OFFSCREEN_UNAVAILABLE);
    }
  });

  it("offscreen ensure 拒绝时返回 offscreen_unavailable", async () => {
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        ensureOffscreenDocument: () => Promise.reject(new Error("offscreen create failed"))
      })
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(ExtensionErrorCode.OFFSCREEN_UNAVAILABLE);
    }
  });

  it("scripting 无权限失败时返回 restricted_page", async () => {
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        captureTab: () => Promise.reject(new Error("Cannot access contents of url chrome://extensions/"))
      })
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(ExtensionErrorCode.RESTRICTED_PAGE);
      expect(response.error.details).toMatchObject({ reason: "scripting_access_denied" });
    }
  });

  it("active tab 查询失败时返回统一内部错误", async () => {
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        readActiveTab: () => Promise.reject(new Error("tabs query failed"))
      })
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(ExtensionErrorCode.INTERNAL_ERROR);
    }
  });

  it("采集当前页并转交 offscreen 转换", async () => {
    const sentMessages: unknown[] = [];
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        captureTab(tabId) {
          expect(tabId).toBe(7);
          return Promise.resolve(createCapture());
        },
        sendRuntimeMessage(message) {
          sentMessages.push(message);
          return createClipDependencies().sendRuntimeMessage(message);
        }
      })
    );

    expect(response).toMatchObject({
      ok: true,
      requestId: "req_clip",
      data: {
        markdown: "正文",
        title: "页面标题",
        hasSelection: false,
        clipMode: "selection"
      }
    });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      type: MessageType.MARKDOWN_CONVERT_REQUEST,
      capture: createCapture()
    });
  });

  it("剪藏转换读取 storage.sync options 且用请求 downloadImages 覆盖图片开关", async () => {
    const sentMessages: unknown[] = [];
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        readStoredOptions: () =>
          Promise.resolve({
            ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
            includeTemplate: true,
            linkStyle: "referenced",
            downloadImages: false
          }),
        sendRuntimeMessage(message) {
          sentMessages.push(message);
          return createClipDependencies().sendRuntimeMessage(message);
        }
      }),
      "page",
      true
    );

    expect(response.ok).toBe(true);
    expect(sentMessages[0]).toMatchObject({
      options: {
        includeTemplate: true,
        linkStyle: "referenced",
        downloadImages: true
      }
    });
  });

  it("返回给 popup 的结果包含页面选区事实", async () => {
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        captureTab() {
          return Promise.resolve(
            createCapture("selection", {
              selectionHtml: "<strong>选区</strong>",
              hasSelection: true
            })
          );
        }
      })
    );

    expect(response).toMatchObject({
      ok: true,
      data: {
        hasSelection: true,
        clipMode: "selection"
      }
    });
  });

  it("显式全文模式会传给采集和 offscreen 转换", async () => {
    const sentMessages: unknown[] = [];
    const capturedModes: ClipCaptureMode[] = [];
    const response = await clipCurrentPageAsMarkdown(
      "req_clip",
      createClipDependencies({
        captureTab(_tabId, clipMode) {
          capturedModes.push(clipMode);
          return Promise.resolve(createCapture(clipMode));
        },
        sendRuntimeMessage(message) {
          sentMessages.push(message);
          return createClipDependencies().sendRuntimeMessage(message);
        }
      }),
      "page"
    );

    expect(response.ok).toBe(true);
    expect(capturedModes).toEqual(["page"]);
    expect(sentMessages[0]).toMatchObject({
      type: MessageType.MARKDOWN_CONVERT_REQUEST,
      capture: createCapture("page")
    });
  });

  it("下载 Markdown 时清洗文件名并使用 data URL", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];
    const dependencies: DownloadMarkdownDependencies = {
      download(options) {
        downloads.push(options);
        return Promise.resolve(42);
      }
    };

    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "# 标题",
        title: "A?B"
      },
      dependencies
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: 42 }
    });
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.filename).toBe("AB.md");
    expect(downloads[0]?.url).toBe("data:text/markdown;charset=utf-8,%23%20%E6%A0%87%E9%A2%98");
  });

  it("downloads API 主文件失败时降级为 contentLink 下载", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];
    const executed: Array<{ tabId: number; filename: string; markdown: string }> = [];

    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "# 标题",
        title: "页面标题",
        downloadSettings: {
          downloadMode: "downloadsApi",
          saveAs: false,
          mdClipsFolder: null,
          disallowedChars: "[]#^"
        }
      },
      {
        download(options) {
          downloads.push(options);
          return Promise.reject(new Error("downloads api blocked"));
        },
        readActiveTab() {
          return Promise.resolve({ id: 9, url: "https://example.com", restricted: false });
        },
        executeContentLinkDownload(tabId, filename, markdown) {
          executed.push({ tabId, filename, markdown });
          return Promise.resolve();
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: -1 }
    });
    expect(downloads).toHaveLength(1);
    expect(executed).toEqual([{ tabId: 9, filename: "页面标题.md", markdown: "# 标题" }]);
  });

  it("downloads API 主文件失败降级 contentLink 后仍下载图片", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];
    const executed: Array<{ tabId: number; filename: string; markdown: string }> = [];

    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "![Photo](Images/photo.png)",
        title: "页面标题",
        imageDownloads: [
          {
            originalSrc: "https://example.com/assets/photo.png",
            sourceUrl: "https://example.com/assets/photo.png",
            filename: "Images/photo.png",
            isObsidian: false,
            outputStyle: "download"
          }
        ],
        downloadSettings: {
          downloadMode: "downloadsApi",
          saveAs: false,
          mdClipsFolder: null,
          disallowedChars: "[]#^"
        }
      },
      {
        download(options) {
          downloads.push(options);
          if (downloads.length === 1) {
            return Promise.reject(new Error("downloads api blocked"));
          }

          return Promise.resolve(downloads.length);
        },
        readActiveTab() {
          return Promise.resolve({ id: 9, url: "https://example.com", restricted: false });
        },
        executeContentLinkDownload(tabId, filename, markdown) {
          executed.push({ tabId, filename, markdown });
          return Promise.resolve();
        },
        fetchImage() {
          return Promise.resolve({
            dataUrl: "data:image/png;base64,AAAA",
            mimeType: "image/png"
          });
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: -1 }
    });
    expect(executed).toEqual([{ tabId: 9, filename: "页面标题.md", markdown: "![Photo](Images/photo.png)" }]);
    expect(downloads[1]).toEqual({
      url: "data:image/png;base64,AAAA",
      filename: "Images/photo.png",
      saveAs: false
    });
  });

  it("下载 Markdown 前按图片 MIME 修正路径并下载图片", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];
    const dependencies: DownloadMarkdownDependencies = {
      download(options) {
        downloads.push(options);
        return Promise.resolve(downloads.length);
      },
      fetchImage(sourceUrl) {
        expect(sourceUrl).toBe("https://example.com/assets/photo");
        return Promise.resolve({
          dataUrl: "data:image/png;base64,AAAA",
          mimeType: "image/png"
        });
      }
    };

    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "![Photo](Images/photo.idunno)",
        title: "页面标题",
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
          saveAs: true,
          mdClipsFolder: " Clips ",
          disallowedChars: "[]#^"
        }
      },
      dependencies
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: 1 }
    });
    expect(downloads).toHaveLength(2);
    expect(downloads[0]).toMatchObject({
      filename: "Clips/页面标题.md",
      saveAs: true
    });
    expect(decodeURIComponent(String(downloads[0]?.url))).toContain("![Photo](Images/photo.png)");
    expect(downloads[1]).toEqual({
      url: "data:image/png;base64,AAAA",
      filename: "Clips/Images/photo.png",
      saveAs: false
    });
  });

  it("标题模板包含目录段时保留 Markdown 和图片下载目录", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];
    const dependencies: DownloadMarkdownDependencies = {
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
    };

    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "![Photo](Images/photo.idunno)",
        title: "Articles/2026/Page?",
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
          disallowedChars: "?"
        }
      },
      dependencies
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: 1 }
    });
    expect(downloads[0]).toMatchObject({
      filename: "Clips/Articles/2026/Page.md",
      saveAs: false
    });
    expect(downloads[1]).toEqual({
      url: "data:image/png;base64,AAAA",
      filename: "Clips/Articles/2026/Images/photo.png",
      saveAs: false
    });
  });

  it("图片下载失败不破坏 Markdown 下载结果", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];
    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "![Photo](Images/photo.png)",
        title: "页面标题",
        imageDownloads: [
          {
            originalSrc: "https://example.com/assets/photo.png",
            sourceUrl: "https://example.com/assets/photo.png",
            filename: "Images/photo.png",
            isObsidian: false,
            outputStyle: "download"
          }
        ],
        downloadSettings: {
          downloadMode: "downloadsApi",
          saveAs: false,
          mdClipsFolder: null,
          disallowedChars: "[]#^"
        }
      },
      {
        download(options) {
          downloads.push(options);
          if (downloads.length > 1) {
            return Promise.reject(new Error("image download failed"));
          }

          return Promise.resolve(1);
        },
        fetchImage() {
          return Promise.resolve({
            dataUrl: "data:image/png;base64,AAAA",
            mimeType: "image/png"
          });
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: 1 }
    });
    expect(downloads).toHaveLength(2);
  });

  it("base64 图片只替换 Markdown，不额外下载图片文件", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];
    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "![Photo](https://example.com/assets/photo.png)",
        title: "页面标题",
        imageDownloads: [
          {
            originalSrc: "https://example.com/assets/photo.png",
            sourceUrl: "https://example.com/assets/photo.png",
            filename: "Images/photo.png",
            isObsidian: false,
            outputStyle: "base64"
          }
        ],
        downloadSettings: {
          downloadMode: "downloadsApi",
          saveAs: false,
          mdClipsFolder: null,
          disallowedChars: "[]#^"
        }
      },
      {
        download(options) {
          downloads.push(options);
          return Promise.resolve(1);
        },
        fetchImage() {
          return Promise.resolve({
            dataUrl: "data:image/png;base64,AAAA",
            mimeType: "image/png"
          });
        }
      }
    );

    expect(response.ok).toBe(true);
    expect(downloads).toHaveLength(1);
    expect(decodeURIComponent(String(downloads[0]?.url))).toContain("![Photo](data:image/png;base64,AAAA)");
  });

  it("contentLink 模式在 active tab 中触发链接下载", async () => {
    const executed: Array<{ tabId: number; filename: string; markdown: string }> = [];
    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "# 标题",
        title: "A/B?",
        downloadSettings: {
          downloadMode: "contentLink",
          saveAs: true,
          mdClipsFolder: "Clips",
          disallowedChars: "?"
        }
      },
      {
        download() {
          throw new Error("contentLink 不应调用 downloads API");
        },
        readActiveTab() {
          return Promise.resolve({ id: 9, url: "https://example.com", restricted: false });
        },
        executeContentLinkDownload(tabId, filename, markdown) {
          executed.push({ tabId, filename, markdown });
          return Promise.resolve();
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: -1 }
    });
    expect(executed).toEqual([{ tabId: 9, filename: "Clips/AB.md", markdown: "# 标题" }]);
  });

  it("contentLink 模式触发链接下载后仍下载图片", async () => {
    const downloads: chrome.downloads.DownloadOptions[] = [];
    const executed: Array<{ tabId: number; filename: string; markdown: string }> = [];

    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "![Photo](Images/photo.png)",
        title: "页面标题",
        imageDownloads: [
          {
            originalSrc: "https://example.com/assets/photo.png",
            sourceUrl: "https://example.com/assets/photo.png",
            filename: "Images/photo.png",
            isObsidian: false,
            outputStyle: "download"
          }
        ],
        downloadSettings: {
          downloadMode: "contentLink",
          saveAs: false,
          mdClipsFolder: "Clips",
          disallowedChars: "[]#^"
        }
      },
      {
        download(options) {
          downloads.push(options);
          return Promise.resolve(downloads.length);
        },
        readActiveTab() {
          return Promise.resolve({ id: 9, url: "https://example.com", restricted: false });
        },
        executeContentLinkDownload(tabId, filename, markdown) {
          executed.push({ tabId, filename, markdown });
          return Promise.resolve();
        },
        fetchImage() {
          return Promise.resolve({
            dataUrl: "data:image/png;base64,AAAA",
            mimeType: "image/png"
          });
        }
      }
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_download",
      data: { downloaded: true, downloadId: -1 }
    });
    expect(executed).toEqual([{ tabId: 9, filename: "Clips/页面标题.md", markdown: "![Photo](Images/photo.png)" }]);
    expect(downloads).toEqual([
      {
        url: "data:image/png;base64,AAAA",
        filename: "Clips/Images/photo.png",
        saveAs: false
      }
    ]);
  });

  it("下载 payload 非法时返回 invalid_request", async () => {
    const response = await downloadMarkdownFromRequest(
      {
        type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
        requestId: "req_download",
        markdown: "",
        title: "Title"
      },
      {
        download() {
          throw new Error("不应调用下载 API");
        }
      }
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe(ExtensionErrorCode.INVALID_REQUEST);
    }
  });
});
