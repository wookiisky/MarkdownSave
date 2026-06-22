import { describe, expect, it } from "vitest";

import { handleContentMessage } from "../../../src/content/content-script";
import type { RawContentCaptureResult } from "../../../src/content/capture-types";
import { ExtensionErrorCode, type ErrorResponse, type ExtensionResponse } from "../../../src/shared/errors";
import { MessageTarget, MessageType } from "../../../src/shared/messages";

// 测试中显式收窄错误响应，避免 nullable 分支被忽略。
function requireErrorResponse(response: ExtensionResponse | null): ErrorResponse {
  if (response === null || response.ok) {
    throw new Error("预期收到错误响应。");
  }

  return response;
}

/** 构造 content 采集结果替身。 */
function createCaptureResult(): RawContentCaptureResult {
  return {
    pageHtml: "<html><head><title>页面标题</title></head><body>正文</body></html>",
    selectionHtml: null,
    title: "页面标题",
      baseUrl: "https://example.com/articles/1",
      pageUrl: "https://example.com/articles/1",
      hasSelection: false,
      clipMode: "selection",
      metadata: {
      language: "zh-CN",
      charset: "UTF-8",
      canonicalUrl: null,
      description: null,
      siteName: null
    }
  };
}

describe("content script handler", () => {
  it("只响应显式发往 content 的 runtime ping", () => {
    const response = handleContentMessage({
      target: MessageTarget.CONTENT,
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId: "req_content"
    });

    expect(response).toEqual({
      ok: true,
      requestId: "req_content",
      data: { pong: true }
    });
  });

  it("忽略缺少 target 的消息，避免抢占 background 默认响应", () => {
    const response = handleContentMessage({
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId: "req_background_default"
    });

    expect(response).toBeNull();
  });

  it("忽略显式发往 offscreen 的消息", () => {
    const response = handleContentMessage({
      target: MessageTarget.OFFSCREEN,
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId: "req_offscreen"
    });

    expect(response).toBeNull();
  });

  it("响应发往 content 的 capture request 并返回真实采集结果", () => {
    const captureResult = createCaptureResult();
    const capturedModes: string[] = [];
    const response = handleContentMessage(
      {
        target: MessageTarget.CONTENT,
        type: MessageType.CLIP_CAPTURE_REQUEST,
        requestId: "req_capture",
        clipMode: "page"
      },
      (clipMode) => {
        capturedModes.push(clipMode);
        return {
          ...captureResult,
          clipMode
        };
      }
    );

    expect(response).toEqual({
      ok: true,
      requestId: "req_capture",
      data: {
        ...captureResult,
        clipMode: "page"
      }
    });
    expect(capturedModes).toEqual(["page"]);
  });

  it("采集环境缺失时返回结构化错误响应", () => {
    const response = handleContentMessage({
      target: MessageTarget.CONTENT,
      type: MessageType.CLIP_CAPTURE_REQUEST,
      requestId: "req_capture_missing_document"
    });

    const errorResponse = requireErrorResponse(response);
    expect(errorResponse.requestId).toBe("req_capture_missing_document");
    expect(errorResponse.error.code).toBe(ExtensionErrorCode.INTERNAL_ERROR);
    expect(errorResponse.error.details).toEqual({ reason: "missing_document" });
  });
});
