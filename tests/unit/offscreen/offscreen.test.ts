import { describe, expect, it } from "vitest";

import { handleOffscreenMessage } from "../../../src/offscreen/offscreen";
import { ExtensionErrorCode, type ErrorResponse, type ExtensionResponse } from "../../../src/shared/errors";
import { MessageTarget, MessageType } from "../../../src/shared/messages";

// 测试中显式收窄错误响应，避免 nullable 分支被忽略。
function requireErrorResponse(response: ExtensionResponse | null): ErrorResponse {
  if (response === null || response.ok) {
    throw new Error("预期收到错误响应。");
  }

  return response;
}

describe("offscreen handler", () => {
  it("返回 runtime ping 成功响应", () => {
    const response = handleOffscreenMessage({
      target: MessageTarget.OFFSCREEN,
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId: "req_ping"
    });

    expect(response).toEqual({
      ok: true,
      requestId: "req_ping",
      data: { pong: true, ready: true }
    });
  });

  it("忽略缺少 target 的消息，避免抢占 background 默认响应", () => {
    const response = handleOffscreenMessage({
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId: "req_background_default"
    });

    expect(response).toBeNull();
  });

  it("忽略显式发往 background 的消息，避免抢占 background 响应", () => {
    const response = handleOffscreenMessage({
      target: MessageTarget.BACKGROUND,
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId: "req_background"
    });

    expect(response).toBeNull();
  });

  it("markdown convert 请求返回转换结果", () => {
    const response = handleOffscreenMessage({
      target: MessageTarget.OFFSCREEN,
      type: MessageType.MARKDOWN_CONVERT_REQUEST,
      requestId: "req_convert",
      capture: {
        pageHtml: "<html><body><p>正文</p></body></html>",
        selectionHtml: null,
        title: "页面标题",
        baseUrl: "https://example.com/post",
        pageUrl: "https://example.com/post",
        hasSelection: false,
        clipMode: "selection",
        metadata: {
          language: "zh-CN",
          charset: "utf-8",
          canonicalUrl: null,
          description: null,
          siteName: "Example"
        }
      }
    }, {
      convertMarkdown: (input) => ({
        markdown: input.capture.pageHtml.includes("正文") ? "正文" : "",
        title: input.capture.title,
        article: {
          title: input.capture.title,
          pageTitle: input.capture.title,
          byline: "",
          excerpt: "",
          siteName: input.capture.metadata.siteName ?? "",
          baseURI: input.capture.baseUrl,
          length: 2,
          dir: "",
          lang: input.capture.metadata.language ?? "",
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
    });

    expect(response).toEqual({
      ok: true,
      requestId: "req_convert",
      data: {
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
      }
    });
  });

  it("未知 message 返回可测错误", () => {
    const response = handleOffscreenMessage({
      target: MessageTarget.OFFSCREEN,
      type: "offscreen.unknown",
      requestId: "req_unknown"
    });

    const errorResponse = requireErrorResponse(response);
    expect(errorResponse.error.code).toBe(ExtensionErrorCode.UNKNOWN_MESSAGE);
  });
});
