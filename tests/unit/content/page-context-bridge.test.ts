import { describe, expect, it } from "vitest";

import {
  PageContextBridgeEvent,
  PageContextBridgePayloadKind,
  validatePageContextBridgePayload
} from "../../../src/content/page-context-bridge";

describe("page context bridge", () => {
  it("暴露稳定事件名", () => {
    expect(PageContextBridgeEvent).toEqual({
      TO_PAGE: "markdownsave.page-context.to-page",
      FROM_PAGE: "markdownsave.page-context.from-page"
    });
  });

  it("清洗合法 payload", () => {
    const result = validatePageContextBridgePayload({
      source: "markdownsave",
      requestId: "req_bridge",
      kind: PageContextBridgePayloadKind.RUNTIME_READY,
      ignored: "dirty"
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        source: "markdownsave",
        requestId: "req_bridge",
        kind: "runtime-ready"
      }
    });
  });

  it("拒绝页面侧脏 payload", () => {
    expect(validatePageContextBridgePayload(null)).toEqual({ ok: false, reason: "payload_not_object" });
    expect(validatePageContextBridgePayload({ source: "page" })).toEqual({ ok: false, reason: "source_mismatch" });
    expect(validatePageContextBridgePayload({ source: "markdownsave" })).toEqual({
      ok: false,
      reason: "missing_request_id"
    });
    expect(validatePageContextBridgePayload({ source: "markdownsave", requestId: "req_1", kind: "clip" })).toEqual({
      ok: false,
      reason: "unknown_kind"
    });
  });
});
