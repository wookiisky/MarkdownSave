import {
  createExtensionError,
  ExtensionErrorCode,
  toErrorResponse,
  toSuccessResponse,
  type ExtensionError,
  type ExtensionResponse
} from "../shared/errors";
import {
  MessageTarget,
  MessageType,
  readMessageTarget,
  validateExtensionRequest,
  type ClipCaptureMode,
  type RuntimePingData
} from "../shared/messages";
import { captureCurrentPage, CapturePageUnavailableError } from "./capture-page";
import type { RawContentCaptureResult } from "./capture-types";
import { initializePageContextBridge } from "./page-context-bridge";

/** content script 当前可返回的数据。 */
type ContentMessageData = RuntimePingData | RawContentCaptureResult;

/** content 页面采集函数，测试可注入替身。 */
type CaptureCurrentPage = (clipMode: ClipCaptureMode) => RawContentCaptureResult;

/** content runtime.onMessage 事件最小形状。 */
interface ContentRuntimeMessageTarget {
  /** 注册 runtime message listener。 */
  addListener(listener: typeof handleContentRuntimeMessage): void;
}

/** content runtime 最小形状。 */
interface ContentRuntimeApi {
  /** runtime message 事件。 */
  onMessage: ContentRuntimeMessageTarget;
}

/** content script 可测消息入口，支持 runtime ping 和当前页采集。 */
export function handleContentMessage(
  message: unknown,
  capturePage: CaptureCurrentPage = captureCurrentPageWithMode
): ExtensionResponse<ContentMessageData> | null {
  const target = readMessageTarget(message);

  if (target !== MessageTarget.CONTENT) {
    return null;
  }

  const validation = validateExtensionRequest(message);

  if (!validation.ok) {
    return null;
  }

  if (validation.message.type === MessageType.RUNTIME_PING_REQUEST) {
    return toSuccessResponse(validation.message.requestId, { pong: true });
  }

  if (validation.message.type === MessageType.CLIP_CAPTURE_REQUEST) {
    try {
      return toSuccessResponse(validation.message.requestId, capturePage(validation.message.clipMode));
    } catch (error) {
      return toErrorResponse(validation.message.requestId, createCaptureError(error));
    }
  }

  return null;
}

/** 用 clipMode 调用页面采集，隔离 captureCurrentPage 的 environment 入口。 */
function captureCurrentPageWithMode(clipMode: ClipCaptureMode): RawContentCaptureResult {
  return captureCurrentPage({ clipMode });
}

/** Chrome runtime.onMessage 适配器，未处理消息不抢占响应。 */
export function handleContentRuntimeMessage(
  message: unknown,
  _sender: unknown,
  sendResponse: (response: ExtensionResponse<ContentMessageData>) => void
): false {
  const response = handleContentMessage(message);

  if (response !== null) {
    sendResponse(response);
  }

  return false;
}

/** 将采集边界错误收敛为 runtime 结构化错误响应。 */
function createCaptureError(error: unknown): ExtensionError {
  if (error instanceof CapturePageUnavailableError) {
    return createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, {
      message: error.message,
      details: {
        reason: error.code,
        ...error.details
      }
    });
  }

  const errorName = error instanceof Error ? error.name : typeof error;

  return createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, {
    message: "页面采集失败。",
    details: {
      reason: "capture_failed",
      errorName
    }
  });
}

/** 初始化 content script 空入口。 */
export function initializeContentScript(runtimeApi?: ContentRuntimeApi): void {
  initializePageContextBridge();

  if (runtimeApi === undefined) {
    return;
  }

  runtimeApi.onMessage.addListener(handleContentRuntimeMessage);
}

const chromeRuntime = (globalThis as typeof globalThis & { chrome?: { runtime?: ContentRuntimeApi } }).chrome?.runtime;

if (typeof window !== "undefined") {
  initializeContentScript(chromeRuntime);
}
