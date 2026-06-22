import { isNonEmptyId, type RequestId } from "../shared/request-id";

/** page context bridge 稳定事件名。 */
export const PageContextBridgeEvent = {
  /** isolated world 发往 page context。 */
  TO_PAGE: "markdownsave.page-context.to-page",
  /** page context 发回 isolated world。 */
  FROM_PAGE: "markdownsave.page-context.from-page"
} as const;

/** page context bridge 事件名联合。 */
export type PageContextBridgeEvent = (typeof PageContextBridgeEvent)[keyof typeof PageContextBridgeEvent];

/** page context bridge payload kind。 */
export const PageContextBridgePayloadKind = {
  /** 运行时 ready 探测，不采集 DOM。 */
  RUNTIME_READY: "runtime-ready"
} as const;

/** page context bridge payload kind 联合。 */
export type PageContextBridgePayloadKind =
  (typeof PageContextBridgePayloadKind)[keyof typeof PageContextBridgePayloadKind];

/** page context bridge payload。 */
export interface PageContextBridgePayload {
  /** 固定来源，避免误接收页面任意事件。 */
  source: "markdownsave";
  /** 请求 id。 */
  requestId: RequestId;
  /** payload 类型。 */
  kind: PageContextBridgePayloadKind;
}

/** bridge payload 清洗成功。 */
export interface ValidPageContextBridgePayload {
  /** 清洗成功固定为 true。 */
  ok: true;
  /** 已清洗 payload。 */
  payload: PageContextBridgePayload;
}

/** bridge payload 清洗失败。 */
export interface InvalidPageContextBridgePayload {
  /** 清洗失败固定为 false。 */
  ok: false;
  /** 失败原因。 */
  reason: "payload_not_object" | "source_mismatch" | "missing_request_id" | "unknown_kind";
}

/** bridge payload 清洗结果。 */
export type PageContextBridgePayloadValidation = ValidPageContextBridgePayload | InvalidPageContextBridgePayload;

/** 最小事件目标，用于测试和浏览器 window。 */
export interface PageContextBridgeTarget {
  /** 注册事件监听。 */
  addEventListener(type: PageContextBridgeEvent, listener: EventListener): void;
  /** 派发事件。 */
  dispatchEvent(event: Event): boolean;
}

/** 判断输入是否为普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 清洗 page context bridge payload，不信任页面传入对象。 */
export function validatePageContextBridgePayload(value: unknown): PageContextBridgePayloadValidation {
  if (!isRecord(value)) {
    return { ok: false, reason: "payload_not_object" };
  }

  if (value.source !== "markdownsave") {
    return { ok: false, reason: "source_mismatch" };
  }

  if (!isNonEmptyId(value.requestId)) {
    return { ok: false, reason: "missing_request_id" };
  }

  if (value.kind !== PageContextBridgePayloadKind.RUNTIME_READY) {
    return { ok: false, reason: "unknown_kind" };
  }

  return {
    ok: true,
    payload: {
      source: "markdownsave",
      requestId: value.requestId,
      kind: value.kind
    }
  };
}

/** 初始化 isolated world bridge 空入口，不采集 DOM。 */
export function initializePageContextBridge(target: PageContextBridgeTarget = window): void {
  target.addEventListener(PageContextBridgeEvent.FROM_PAGE, (event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    validatePageContextBridgePayload(event.detail);
  });
}

/** 发送 page context ready 事件。 */
export function dispatchPageContextReady(target: PageContextBridgeTarget, requestId: RequestId): boolean {
  const event = new CustomEvent(PageContextBridgeEvent.FROM_PAGE, {
    detail: {
      source: "markdownsave",
      requestId,
      kind: PageContextBridgePayloadKind.RUNTIME_READY
    }
  });

  return target.dispatchEvent(event);
}
