import {
  createExtensionError,
  ExtensionErrorCode,
  toErrorResponse,
  toSuccessResponse,
  type ExtensionResponse
} from "../shared/errors";
import {
  MessageTarget,
  MessageType,
  readMessageTarget,
  validateExtensionRequest,
  type BatchCancelRequest,
  type BatchStartRequest,
  type DownloadMarkdownRequest,
  type RuntimePingData
} from "../shared/messages";
import {
  cancelBatchDownloadJob,
  startBatchDownloadJob,
  type BatchJobDependencies
} from "./batch-jobs";
import {
  clipCurrentPageAsMarkdown,
  downloadMarkdownFromRequest,
  type ClipCurrentPageDependencies,
  type DownloadMarkdownDependencies
} from "./clip-flow";

/** background 可测路由入口，M2 只实现协议边界和 runtime ping。 */
export function routeBackgroundMessage(message: unknown): ExtensionResponse<RuntimePingData> | ExtensionResponse | null {
  const target = readMessageTarget(message);

  if (target !== null && target !== MessageTarget.BACKGROUND) {
    return null;
  }

  const validation = validateExtensionRequest(message);

  if (!validation.ok) {
    const error = createExtensionError(validation.code, { details: validation.details });

    return toErrorResponse(validation.requestId, error);
  }

  if (validation.message.type === MessageType.RUNTIME_PING_REQUEST) {
    return toSuccessResponse(validation.message.requestId, { pong: true });
  }

  const error = createExtensionError(ExtensionErrorCode.NOT_IMPLEMENTED, {
    details: {
      type: validation.message.type
    }
  });

  return toErrorResponse(validation.message.requestId, error);
}

/** Chrome runtime.onMessage 适配器，只负责调用纯路由并返回同步响应。 */
export function handleBackgroundRuntimeMessage(
  message: unknown,
  _sender: unknown,
  sendResponse: (response: ExtensionResponse) => void
): boolean {
  if (isAsyncBackgroundBusinessMessage(message)) {
    void handleAsyncBackgroundBusinessMessage(message)
      .then((response) => {
        if (response !== null) {
          sendResponse(response);
        }
      })
      .catch((error: unknown) => {
        sendResponse(
          toErrorResponse(
            null,
            createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, {
              details: {
                reason: "background_async_handler_rejected",
                errorName: error instanceof Error ? error.name : typeof error
              }
            })
          )
        );
      });

    return true;
  }

  const response = routeBackgroundMessage(message);

  if (response !== null) {
    sendResponse(response);
  }

  return false;
}

/** background 异步业务测试依赖。 */
export interface AsyncBackgroundBusinessDependencies {
  /** 当前页剪藏依赖。 */
  clip?: ClipCurrentPageDependencies;
  /** Markdown 下载依赖。 */
  download?: DownloadMarkdownDependencies;
  /** 批量任务依赖。 */
  batch?: BatchJobDependencies;
}

/** 判断消息是否需要异步业务处理。 */
function isAsyncBackgroundBusinessMessage(message: unknown): boolean {
  const target = readMessageTarget(message);

  if (target !== null && target !== MessageTarget.BACKGROUND) {
    return false;
  }

  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return false;
  }

  const type = (message as Record<string, unknown>).type;

  return (
    type === MessageType.CLIP_CAPTURE_REQUEST ||
    type === MessageType.DOWNLOAD_MARKDOWN_REQUEST ||
    type === MessageType.BATCH_START_REQUEST ||
    type === MessageType.BATCH_CANCEL_REQUEST
  );
}

/** 处理 background M5 异步业务。 */
export async function handleAsyncBackgroundBusinessMessage(
  message: unknown,
  dependencies: AsyncBackgroundBusinessDependencies = {}
): Promise<ExtensionResponse | null> {
  const target = readMessageTarget(message);

  if (target !== null && target !== MessageTarget.BACKGROUND) {
    return null;
  }

  const validation = validateExtensionRequest(message);

  if (!validation.ok) {
    const error = createExtensionError(validation.code, { details: validation.details });

    return toErrorResponse(validation.requestId, error);
  }

  if (validation.message.type === MessageType.CLIP_CAPTURE_REQUEST) {
    return clipCurrentPageAsMarkdown(
      validation.message.requestId,
      dependencies.clip,
      validation.message.clipMode,
      validation.message.downloadImages
    );
  }

  if (validation.message.type === MessageType.DOWNLOAD_MARKDOWN_REQUEST) {
    return downloadMarkdownFromRequest(validation.message as DownloadMarkdownRequest, dependencies.download);
  }

  if (validation.message.type === MessageType.BATCH_START_REQUEST) {
    return startBatchDownloadJob(validation.message as BatchStartRequest, dependencies.batch);
  }

  if (validation.message.type === MessageType.BATCH_CANCEL_REQUEST) {
    return cancelBatchDownloadJob(validation.message as BatchCancelRequest, dependencies.batch);
  }

  return null;
}
