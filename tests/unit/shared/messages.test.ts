import { describe, expect, it } from "vitest";

import { ExtensionErrorCode } from "../../../src/shared/errors";
import {
  DEFAULT_CLIP_CAPTURE_MODE,
  MessageTarget,
  MessageType,
  readMessageTarget,
  validateExtensionRequest
} from "../../../src/shared/messages";
import { formatJobId, formatRequestId } from "../../../src/shared/request-id";

describe("shared messages", () => {
  it("识别未知 message type", () => {
    const result = validateExtensionRequest({
      type: "unknown.message",
      requestId: "req_1"
    });

    expect(result).toEqual({
      ok: false,
      code: ExtensionErrorCode.UNKNOWN_MESSAGE,
      requestId: "req_1",
      details: { type: "unknown.message" }
    });
  });

  it("拒绝缺少 requestId 的已知请求", () => {
    const result = validateExtensionRequest({
      type: MessageType.RUNTIME_PING_REQUEST
    });

    expect(result).toEqual({
      ok: false,
      code: ExtensionErrorCode.MISSING_REQUEST_ID,
      requestId: null,
      details: { type: MessageType.RUNTIME_PING_REQUEST }
    });
  });

  it("拒绝缺少 jobId 的批量请求", () => {
    const result = validateExtensionRequest({
      type: MessageType.BATCH_START_REQUEST,
      requestId: "req_1"
    });

    expect(result).toEqual({
      ok: false,
      code: ExtensionErrorCode.MISSING_JOB_ID,
      requestId: "req_1",
      details: { type: MessageType.BATCH_START_REQUEST }
    });
  });

  it("拒绝缺少 jobId 的批量取消请求", () => {
    const result = validateExtensionRequest({
      type: MessageType.BATCH_CANCEL_REQUEST,
      requestId: "req_cancel"
    });

    expect(result).toEqual({
      ok: false,
      code: ExtensionErrorCode.MISSING_JOB_ID,
      requestId: "req_cancel",
      details: { type: MessageType.BATCH_CANCEL_REQUEST }
    });
  });

  it("拒绝把结果消息当作请求路由", () => {
    const result = validateExtensionRequest({
      type: MessageType.RUNTIME_PING_RESULT,
      requestId: "req_1"
    });

    expect(result).toEqual({
      ok: false,
      code: ExtensionErrorCode.INVALID_REQUEST,
      requestId: "req_1",
      details: {
        type: MessageType.RUNTIME_PING_RESULT,
        reason: "result_message_cannot_be_routed_as_request"
      }
    });
  });

  it("通过已知请求 envelope 校验", () => {
    const tabIds = [1, 2, 2, "bad"];
    const result = validateExtensionRequest({
      type: MessageType.BATCH_START_REQUEST,
      requestId: "req_1",
      jobId: "job_1",
      tabIds
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === MessageType.BATCH_START_REQUEST) {
      expect(result.message.type).toBe(MessageType.BATCH_START_REQUEST);
      expect(result.message.requestId).toBe("req_1");
      expect(result.message.tabIds).toBe(tabIds);
    }
  });

  it("通过批量取消请求 envelope 校验", () => {
    const result = validateExtensionRequest({
      type: MessageType.BATCH_CANCEL_REQUEST,
      requestId: "req_cancel",
      jobId: "job_1"
    });

    expect(result).toEqual({
      ok: true,
      message: {
        type: MessageType.BATCH_CANCEL_REQUEST,
        requestId: "req_cancel",
        jobId: "job_1"
      }
    });
  });

  it("download markdown request 保留图片计划和下载设置", () => {
    const imageDownloads = [
      {
        originalSrc: "https://example.com/photo",
        sourceUrl: "https://example.com/photo",
        filename: "Images/photo.idunno",
        isObsidian: false,
        outputStyle: "download"
      }
    ];
    const downloadSettings = {
      downloadMode: "downloadsApi",
      saveAs: true,
      mdClipsFolder: "Clips",
      disallowedChars: "[]#^"
    };

    const result = validateExtensionRequest({
      type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
      requestId: "req_download",
      markdown: "![Photo](Images/photo.idunno)",
      title: "Articles/Page",
      imageDownloads,
      downloadSettings
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === MessageType.DOWNLOAD_MARKDOWN_REQUEST) {
      expect(result.message.imageDownloads).toBe(imageDownloads);
      expect(result.message.downloadSettings).toBe(downloadSettings);
    }
  });

  it("clip capture request 缺少 clipMode 时默认选区优先", () => {
    const result = validateExtensionRequest({
      type: MessageType.CLIP_CAPTURE_REQUEST,
      requestId: "req_clip"
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === MessageType.CLIP_CAPTURE_REQUEST) {
      expect(result.message.clipMode).toBe(DEFAULT_CLIP_CAPTURE_MODE);
    }
  });

  it("clip capture request 非法 clipMode 清洗为默认 selection", () => {
    const result = validateExtensionRequest({
      type: MessageType.CLIP_CAPTURE_REQUEST,
      requestId: "req_clip",
      clipMode: "invalid"
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === MessageType.CLIP_CAPTURE_REQUEST) {
      expect(result.message.clipMode).toBe("selection");
    }
  });

  it("clip capture request 保留显式 page 模式", () => {
    const result = validateExtensionRequest({
      type: MessageType.CLIP_CAPTURE_REQUEST,
      requestId: "req_clip",
      clipMode: "page"
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.message.type === MessageType.CLIP_CAPTURE_REQUEST) {
      expect(result.message.clipMode).toBe("page");
    }
  });

  it("读取显式 runtime message target", () => {
    expect(readMessageTarget({ target: MessageTarget.OFFSCREEN })).toBe(MessageTarget.OFFSCREEN);
    expect(readMessageTarget({ target: "unknown" })).toBeNull();
    expect(readMessageTarget(null)).toBeNull();
  });

  it("shared 纯函数不需要 Chrome API", () => {
    expect("chrome" in globalThis).toBe(false);
    expect(formatRequestId("Clip Capture 1")).toBe("req_clip-capture-1");
    expect(formatJobId(35)).toBe("job_z");
  });
});
