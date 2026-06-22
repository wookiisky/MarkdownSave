import {
  createExtensionError,
  type ExtensionError,
  ExtensionErrorCode,
  toErrorResponse,
  toSuccessResponse,
  type ExtensionResponse
} from "../shared/errors";
import {
  DEFAULT_CLIP_CAPTURE_MODE,
  MessageTarget,
  MessageType,
  isClipCaptureMode,
  isMessageRecord,
  readMessageTarget,
  validateExtensionRequest,
  type MarkdownConvertCaptureMetadata,
  type MarkdownConvertCapturePayload,
  type MarkdownConvertResultData,
  type RuntimePingData
} from "../shared/messages";
import { validateMarkdownSaveOptionsFromUnknown, type MarkdownSaveOptions } from "../shared/options/schema";
import {
  DEFAULT_MARKDOWN_CONVERT_OPTIONS,
  MarkdownConvertRunnerError,
  runMarkdownConvert,
  type MarkdownConvertRunnerInput
} from "./convert-runner";
import { createOffscreenLifecycle } from "./lifecycle";

/** offscreen ping 成功数据。 */
export interface OffscreenPingData extends RuntimePingData {
  /** offscreen runtime handler 已 ready。 */
  ready: true;
}

/** offscreen 只需要最小 runtime.onMessage 注册能力。 */
interface RuntimeMessageTarget {
  /** 注册 runtime message listener。 */
  addListener(listener: typeof handleOffscreenRuntimeMessage): void;
}

/** offscreen 只读取最小 Chrome runtime 形状，避免依赖业务 API。 */
interface MinimalChromeRuntime {
  /** Chrome runtime 对象。 */
  runtime?: {
    /** runtime message 事件。 */
    onMessage?: RuntimeMessageTarget;
  };
}

/** offscreen 页面生命周期状态。 */
const lifecycle = createOffscreenLifecycle();

/** offscreen 转换依赖，测试可注入。 */
export interface OffscreenMessageHandlerDependencies {
  /** 执行 Markdown 转换。 */
  convertMarkdown(input: MarkdownConvertRunnerInput): MarkdownConvertResultData;
}

/** 默认 offscreen handler 依赖。 */
function createDefaultOffscreenMessageHandlerDependencies(): OffscreenMessageHandlerDependencies {
  return {
    convertMarkdown: (input) => runMarkdownConvert(input)
  };
}

// offscreen 加载后标记 ready，转换请求由 runtime message handler 处理。
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("load", () => {
    lifecycle.markReady();
  });
}

/** offscreen 可测消息入口，处理协议边界、runtime ping 和 Markdown 转换。 */
export function handleOffscreenMessage(
  message: unknown,
  dependencies: OffscreenMessageHandlerDependencies = createDefaultOffscreenMessageHandlerDependencies()
): ExtensionResponse<OffscreenPingData> | ExtensionResponse<MarkdownConvertResultData> | ExtensionResponse | null {
  const target = readMessageTarget(message);

  if (target !== MessageTarget.OFFSCREEN) {
    return null;
  }

  const validation = validateExtensionRequest(message);

  if (!validation.ok) {
    const error = createExtensionError(validation.code, { details: validation.details });

    return toErrorResponse(validation.requestId, error);
  }

  if (validation.message.type === MessageType.RUNTIME_PING_REQUEST) {
    lifecycle.markReady();

    return toSuccessResponse(validation.message.requestId, { pong: true, ready: true });
  }

  if (validation.message.type === MessageType.MARKDOWN_CONVERT_REQUEST) {
    const payload = validateMarkdownConvertPayload(validation.message.capture, validation.message.options);

    if (!payload.ok) {
      const error = createExtensionError(ExtensionErrorCode.INVALID_REQUEST, {
        details: payload.details
      });

      return toErrorResponse(validation.message.requestId, error);
    }

    try {
      const result = dependencies.convertMarkdown(payload.input);

      return toSuccessResponse(validation.message.requestId, result);
    } catch (error) {
      return toErrorResponse(validation.message.requestId, createMarkdownConvertError(error));
    }
  }

  const error = createExtensionError(ExtensionErrorCode.NOT_IMPLEMENTED, {
    details: {
      type: validation.message.type
    }
  });

  return toErrorResponse(validation.message.requestId, error);
}

/** Chrome runtime.onMessage 适配器，只负责调用纯 offscreen handler。 */
export function handleOffscreenRuntimeMessage(
  message: unknown,
  _sender: unknown,
  sendResponse: (response: ExtensionResponse) => void
): false {
  const response = handleOffscreenMessage(message);

  if (response !== null) {
    sendResponse(response);
  }

  return false;
}

/** 转换 payload 校验成功。 */
interface ValidMarkdownConvertPayload {
  /** 校验成功固定为 true。 */
  ok: true;
  /** 已清洗 runner 输入。 */
  input: MarkdownConvertRunnerInput;
}

/** 转换 payload 校验失败。 */
interface InvalidMarkdownConvertPayload {
  /** 校验失败固定为 false。 */
  ok: false;
  /** 已清洗错误细节。 */
  details: Readonly<Record<string, unknown>>;
}

/** 转换 payload 校验结果。 */
type MarkdownConvertPayloadValidation = ValidMarkdownConvertPayload | InvalidMarkdownConvertPayload;

/** 校验 markdown.convert.request 业务 payload。 */
function validateMarkdownConvertPayload(capture: unknown, options: unknown): MarkdownConvertPayloadValidation {
  const captureResult = readMarkdownConvertCapture(capture);

  if (!captureResult.ok) {
    return {
      ok: false,
      details: captureResult.details
    };
  }

  const optionsResult = readMarkdownConvertOptions(options);

  if (!optionsResult.ok) {
    return {
      ok: false,
      details: optionsResult.details
    };
  }

  return {
    ok: true,
    input: {
      capture: captureResult.capture,
      options: optionsResult.options
    }
  };
}

/** capture 校验成功。 */
interface ValidMarkdownConvertCapture {
  /** 校验成功固定为 true。 */
  ok: true;
  /** 已清洗 capture。 */
  capture: MarkdownConvertCapturePayload;
}

/** capture 校验失败。 */
interface InvalidMarkdownConvertCapture {
  /** 校验失败固定为 false。 */
  ok: false;
  /** 已清洗错误细节。 */
  details: Readonly<Record<string, unknown>>;
}

/** capture 校验结果。 */
type MarkdownConvertCaptureValidation = ValidMarkdownConvertCapture | InvalidMarkdownConvertCapture;

/** 从未知 payload 清洗 content capture result。 */
function readMarkdownConvertCapture(capture: unknown): MarkdownConvertCaptureValidation {
  if (!isMessageRecord(capture)) {
    return createInvalidCapture("capture_not_object");
  }

  const metadataResult = readMarkdownConvertMetadata(capture.metadata);

  if (!metadataResult.ok) {
    return metadataResult;
  }

  if (
    typeof capture.pageHtml !== "string" ||
    typeof capture.title !== "string" ||
    typeof capture.baseUrl !== "string" ||
    typeof capture.pageUrl !== "string" ||
    typeof capture.hasSelection !== "boolean" ||
    !isNullableString(capture.selectionHtml)
  ) {
    return createInvalidCapture("capture_field_invalid");
  }

  return {
    ok: true,
    capture: {
      pageHtml: capture.pageHtml,
      selectionHtml: capture.selectionHtml,
      title: capture.title,
      baseUrl: capture.baseUrl,
      pageUrl: capture.pageUrl,
      hasSelection: capture.hasSelection,
      clipMode: isClipCaptureMode(capture.clipMode) ? capture.clipMode : DEFAULT_CLIP_CAPTURE_MODE,
      metadata: metadataResult.metadata
    }
  };
}

/** metadata 校验成功。 */
interface ValidMarkdownConvertMetadata {
  /** 校验成功固定为 true。 */
  ok: true;
  /** 已清洗 metadata。 */
  metadata: MarkdownConvertCaptureMetadata;
}

/** metadata 校验结果。 */
type MarkdownConvertMetadataValidation = ValidMarkdownConvertMetadata | InvalidMarkdownConvertCapture;

/** 从未知 payload 清洗 capture metadata。 */
function readMarkdownConvertMetadata(metadata: unknown): MarkdownConvertMetadataValidation {
  if (!isMessageRecord(metadata)) {
    return createInvalidCapture("metadata_not_object");
  }

  if (
    !isNullableString(metadata.language) ||
    !isNullableString(metadata.charset) ||
    !isNullableString(metadata.canonicalUrl) ||
    !isNullableString(metadata.description) ||
    !isNullableString(metadata.siteName)
  ) {
    return createInvalidCapture("metadata_field_invalid");
  }

  return {
    ok: true,
    metadata: {
      language: metadata.language,
      charset: metadata.charset,
      canonicalUrl: metadata.canonicalUrl,
      description: metadata.description,
      siteName: metadata.siteName
    }
  };
}

/** 判断可空字符串。 */
function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

/** 构造 capture 校验失败。 */
function createInvalidCapture(reason: string): InvalidMarkdownConvertCapture {
  return {
    ok: false,
    details: {
      reason
    }
  };
}

/** options 校验成功。 */
interface ValidMarkdownConvertOptions {
  /** 校验成功固定为 true。 */
  ok: true;
  /** 已清洗 options。 */
  options: MarkdownSaveOptions;
}

/** options 校验失败。 */
interface InvalidMarkdownConvertOptions {
  /** 校验失败固定为 false。 */
  ok: false;
  /** 已清洗错误细节。 */
  details: Readonly<Record<string, unknown>>;
}

/** options 校验结果。 */
type MarkdownConvertOptionsValidation = ValidMarkdownConvertOptions | InvalidMarkdownConvertOptions;

/** 读取 Markdown 转换 options，缺失时显式使用默认配置。 */
function readMarkdownConvertOptions(options: unknown): MarkdownConvertOptionsValidation {
  if (options === undefined) {
    return {
      ok: true,
      options: DEFAULT_MARKDOWN_CONVERT_OPTIONS
    };
  }

  const result = validateMarkdownSaveOptionsFromUnknown(options);

  if (!result.ok) {
    return {
      ok: false,
      details: {
        reason: "options_invalid",
        errors: result.errors.map((error) => ({
          field: error.field,
          code: error.code,
          message: error.message
        }))
      }
    };
  }

  return {
    ok: true,
    options: result.options
  };
}

/** 将 runner 异常收敛为统一 ExtensionError。 */
function createMarkdownConvertError(error: unknown): ExtensionError {
  if (error instanceof MarkdownConvertRunnerError) {
    return createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, {
      message: error.message,
      details: {
        reason: error.reason
      }
    });
  }

  return createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, {
    details: {
      reason: "markdown_convert_failed"
    }
  });
}

const chromeRuntime = (globalThis as typeof globalThis & { chrome?: MinimalChromeRuntime }).chrome?.runtime;

if (chromeRuntime?.onMessage !== undefined) {
  chromeRuntime.onMessage.addListener(handleOffscreenRuntimeMessage);
}
