import { describe, expect, it } from "vitest";

import {
  createExtensionError,
  ExtensionErrorCode,
  toErrorResponse,
  toSuccessResponse
} from "../../../src/shared/errors";

describe("shared errors", () => {
  it("保持稳定错误码", () => {
    expect(Object.values(ExtensionErrorCode)).toEqual([
      "unknown_message",
      "missing_request_id",
      "missing_job_id",
      "invalid_request",
      "not_implemented",
      "restricted_page",
      "offscreen_unavailable",
      "download_failed",
      "internal_error"
    ]);
  });

  it("构造可测错误对象", () => {
    const error = createExtensionError(ExtensionErrorCode.INVALID_REQUEST, {
      details: { type: "runtime.ping.result" }
    });

    expect(error).toEqual({
      code: ExtensionErrorCode.INVALID_REQUEST,
      message: "请求结构无效。",
      recoverable: false,
      details: { type: "runtime.ping.result" }
    });
  });

  it("构造成功和失败响应", () => {
    const success = toSuccessResponse("req_1", { pong: true });
    const error = createExtensionError(ExtensionErrorCode.MISSING_REQUEST_ID);
    const failure = toErrorResponse(null, error);

    expect(success).toEqual({
      ok: true,
      requestId: "req_1",
      data: { pong: true }
    });
    expect(failure).toEqual({
      ok: false,
      requestId: null,
      error
    });
  });
});
