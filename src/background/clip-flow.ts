import {
  createExtensionError,
  ExtensionErrorCode,
  toErrorResponse,
  toSuccessResponse,
  type ExtensionError,
  type ExtensionResponse
} from "../shared/errors";
import {
  DEFAULT_CLIP_CAPTURE_MODE,
  MessageTarget,
  MessageType,
  type ClipCaptureMode,
  type ClipCaptureResultData,
  type MarkdownConvertCapturePayload,
  type MarkdownConvertResultData
} from "../shared/messages";
import { formatRequestId, type RequestId } from "../shared/request-id";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../shared/options/defaults";
import { coerceMarkdownSaveOptionsFromUnknown, type MarkdownSaveOptions } from "../shared/options/schema";
import { ensureOffscreenDocument, type EnsureOffscreenDocumentResult } from "./offscreen-client";
import { captureTabWithScripting } from "./page-capture-scripting";
import { readActiveTab, type ActiveTabInfo } from "./tabs";

export {
  createDownloadMarkdownDependencies,
  downloadMarkdownFromRequest,
  type DownloadMarkdownDependencies,
  type FetchedImageData
} from "./download-markdown";

/** 当前页剪藏依赖，测试可注入。 */
export interface ClipCurrentPageDependencies {
  /** 读取当前 active tab。 */
  readActiveTab(): Promise<ActiveTabInfo | null>;
  /** 在 tab 中采集页面原始内容。 */
  captureTab(tabId: number, clipMode: ClipCaptureMode): Promise<MarkdownConvertCapturePayload>;
  /** 确保 offscreen document 可用。 */
  ensureOffscreenDocument(): Promise<EnsureOffscreenDocumentResult>;
  /** 发送 runtime message。 */
  sendRuntimeMessage(message: unknown): Promise<ExtensionResponse<MarkdownConvertResultData> | null | undefined>;
  /** 读取 storage.sync 配置。 */
  readStoredOptions?(): Promise<unknown>;
}

/** M5 当前页剪藏默认依赖。 */
export function createClipCurrentPageDependencies(): ClipCurrentPageDependencies {
  return {
    readActiveTab,
    captureTab: captureTabWithScripting,
    ensureOffscreenDocument,
    sendRuntimeMessage(message) {
      return chrome.runtime.sendMessage(message) as Promise<ExtensionResponse<MarkdownConvertResultData>>;
    },
    readStoredOptions() {
      return chrome.storage.sync.get(null);
    }
  };
}

/** 执行当前页剪藏闭环。 */
export async function clipCurrentPageAsMarkdown(
  requestId: RequestId,
  dependencies: ClipCurrentPageDependencies = createClipCurrentPageDependencies(),
  clipMode: ClipCaptureMode = DEFAULT_CLIP_CAPTURE_MODE,
  downloadImages = false,
  optionsOverride?: MarkdownSaveOptions
): Promise<ExtensionResponse<ClipCaptureResultData>> {
  let activeTab: ActiveTabInfo | null;
  try {
    activeTab = await dependencies.readActiveTab();
  } catch (error) {
    return toErrorResponse(requestId, createClipFlowInternalError(error));
  }

  if (activeTab === null || activeTab.restricted) {
    return toErrorResponse(
      requestId,
      createExtensionError(ExtensionErrorCode.RESTRICTED_PAGE, {
        details: {
          url: activeTab?.url ?? null
        }
      })
    );
  }

  return clipTabAsMarkdown(requestId, activeTab, dependencies, clipMode, downloadImages, optionsOverride);
}

/** 剪藏指定 tab 为 Markdown，供 popup、context menu、commands 和批量入口复用。 */
export async function clipTabAsMarkdown(
  requestId: RequestId,
  tab: ActiveTabInfo,
  dependencies: ClipCurrentPageDependencies = createClipCurrentPageDependencies(),
  clipMode: ClipCaptureMode = DEFAULT_CLIP_CAPTURE_MODE,
  downloadImages = false,
  optionsOverride?: MarkdownSaveOptions
): Promise<ExtensionResponse<ClipCaptureResultData>> {
  if (tab.restricted) {
    return toErrorResponse(
      requestId,
      createExtensionError(ExtensionErrorCode.RESTRICTED_PAGE, {
        details: {
          url: tab.url
        }
      })
    );
  }

  let offscreen: EnsureOffscreenDocumentResult;
  try {
    offscreen = await dependencies.ensureOffscreenDocument();
  } catch (error) {
    return toErrorResponse(requestId, createOffscreenUnavailableError(error));
  }

  if (!offscreen.supported || !offscreen.available || !offscreen.ready) {
    return toErrorResponse(
      requestId,
      createExtensionError(ExtensionErrorCode.OFFSCREEN_UNAVAILABLE, {
        details: {
          supported: offscreen.supported,
          available: offscreen.available,
          ready: offscreen.ready
        }
      })
    );
  }

  try {
    const capture = await dependencies.captureTab(tab.id, clipMode);
    const options = optionsOverride ?? (await readClipOptions(dependencies, downloadImages));
    const convertResponse = await dependencies.sendRuntimeMessage({
      target: MessageTarget.OFFSCREEN,
      type: MessageType.MARKDOWN_CONVERT_REQUEST,
      requestId: formatRequestId("markdown-convert"),
      capture,
      options: optionsOverride ?? options
    });

    if (convertResponse === null || convertResponse === undefined) {
      return toErrorResponse(
        requestId,
        createExtensionError(ExtensionErrorCode.OFFSCREEN_UNAVAILABLE, {
          message: "转换运行时没有返回结果。"
        })
      );
    }

    if (!convertResponse.ok) {
      return toErrorResponse(requestId, convertResponse.error);
    }

    return toSuccessResponse(requestId, {
      ...convertResponse.data,
      hasSelection: capture.hasSelection,
      clipMode: capture.clipMode
    });
  } catch (error) {
    if (isRestrictedCaptureError(error)) {
      return toErrorResponse(requestId, createRestrictedCaptureError(error, tab.url));
    }

    return toErrorResponse(requestId, createClipFlowInternalError(error));
  }
}

/** 读取剪藏转换配置，popup 临时图片开关覆盖持久配置中的 downloadImages。 */
async function readClipOptions(
  dependencies: Pick<ClipCurrentPageDependencies, "readStoredOptions">,
  downloadImages: boolean
): Promise<MarkdownSaveOptions> {
  if (dependencies.readStoredOptions === undefined) {
    return {
      ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
      downloadImages
    };
  }

  const result = coerceMarkdownSaveOptionsFromUnknown(await dependencies.readStoredOptions());
  const options = result.ok ? result.options : DEFAULT_MARKDOWN_SAVE_OPTIONS;

  return {
    ...options,
    downloadImages
  };
}

/** 将剪藏流程未预期异常收敛为统一错误。 */
function createClipFlowInternalError(error: unknown): ExtensionError {
  return createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, {
    message: "当前页面剪藏失败。",
    details: {
      reason: "clip_flow_failed",
      errorName: error instanceof Error ? error.name : typeof error
    }
  });
}

/** offscreen ensure 异常收敛。 */
function createOffscreenUnavailableError(error: unknown): ExtensionError {
  return createExtensionError(ExtensionErrorCode.OFFSCREEN_UNAVAILABLE, {
    details: {
      reason: "offscreen_ensure_failed",
      errorName: error instanceof Error ? error.name : typeof error
    }
  });
}

/** scripting 无权限类异常收敛。 */
function createRestrictedCaptureError(error: unknown, url: string | null): ExtensionError {
  return createExtensionError(ExtensionErrorCode.RESTRICTED_PAGE, {
    details: {
      reason: "scripting_access_denied",
      url,
      message: error instanceof Error ? error.message : String(error)
    }
  });
}

/** 识别 Chrome scripting 权限、PDF、商店页和受限页错误。 */
function isRestrictedCaptureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("cannot access") ||
    message.includes("missing host permission") ||
    message.includes("extensions gallery") ||
    message.includes("chrome web store") ||
    message.includes("pdf")
  );
}
