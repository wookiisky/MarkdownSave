import type { RequestId } from "./request-id";

/** 稳定错误码，机器断言只依赖这些值。 */
export const ExtensionErrorCode = {
  /** 无法识别 message type 或消息不是对象。 */
  UNKNOWN_MESSAGE: "unknown_message",
  /** 已知请求缺少 requestId。 */
  MISSING_REQUEST_ID: "missing_request_id",
  /** 批量请求缺少 jobId。 */
  MISSING_JOB_ID: "missing_job_id",
  /** 消息类型已知，但不是当前入口可处理的请求。 */
  INVALID_REQUEST: "invalid_request",
  /** 协议已定义，但业务尚未在当前里程碑实现。 */
  NOT_IMPLEMENTED: "not_implemented",
  /** 当前页面不允许剪藏或缺少可访问权限。 */
  RESTRICTED_PAGE: "restricted_page",
  /** offscreen 转换运行时不可用。 */
  OFFSCREEN_UNAVAILABLE: "offscreen_unavailable",
  /** Markdown 下载失败。 */
  DOWNLOAD_FAILED: "download_failed",
  /** 未归类的内部错误。 */
  INTERNAL_ERROR: "internal_error"
} as const;

/** 稳定错误码联合类型。 */
export type ExtensionErrorCode = (typeof ExtensionErrorCode)[keyof typeof ExtensionErrorCode];

/** 运行时错误对象，供 UI 文案和机器断言共同派生。 */
export interface ExtensionError {
  /** 稳定错误码。 */
  code: ExtensionErrorCode;
  /** 面向开发排障的明确错误信息。 */
  message: string;
  /** 调用方是否可以在修正输入或稍后状态变化后重试。 */
  recoverable: boolean;
  /** 仅存放已清洗的调试细节，不承载业务主事实。 */
  details?: Readonly<Record<string, unknown>>;
}

/** 失败响应，requestId 缺失时显式使用 null。 */
export interface ErrorResponse {
  /** 失败响应固定为 false。 */
  ok: false;
  /** 请求 id；原始请求缺失时为 null。 */
  requestId: RequestId | null;
  /** 结构化错误对象。 */
  error: ExtensionError;
}

/** 成功响应。 */
export interface SuccessResponse<Data> {
  /** 成功响应固定为 true。 */
  ok: true;
  /** 请求 id。 */
  requestId: RequestId;
  /** 响应数据。 */
  data: Data;
}

/** 统一响应类型。 */
export type ExtensionResponse<Data = unknown> = SuccessResponse<Data> | ErrorResponse;

/** 默认错误信息，调用方可覆盖 message 但不能改变错误码语义。 */
const defaultErrorMessages: Readonly<Record<ExtensionErrorCode, string>> = {
  [ExtensionErrorCode.UNKNOWN_MESSAGE]: "未知消息类型。",
  [ExtensionErrorCode.MISSING_REQUEST_ID]: "请求缺少 requestId。",
  [ExtensionErrorCode.MISSING_JOB_ID]: "批量请求缺少 jobId。",
  [ExtensionErrorCode.INVALID_REQUEST]: "请求结构无效。",
  [ExtensionErrorCode.NOT_IMPLEMENTED]: "该消息已定义但尚未实现。",
  [ExtensionErrorCode.RESTRICTED_PAGE]: "当前页面不能剪藏。",
  [ExtensionErrorCode.OFFSCREEN_UNAVAILABLE]: "转换运行时不可用。",
  [ExtensionErrorCode.DOWNLOAD_FAILED]: "Markdown 下载失败。",
  [ExtensionErrorCode.INTERNAL_ERROR]: "内部错误。"
};

/** 默认可恢复标记，M2 只表达协议错误和未实现边界。 */
const defaultRecoverable: Readonly<Record<ExtensionErrorCode, boolean>> = {
  [ExtensionErrorCode.UNKNOWN_MESSAGE]: false,
  [ExtensionErrorCode.MISSING_REQUEST_ID]: false,
  [ExtensionErrorCode.MISSING_JOB_ID]: false,
  [ExtensionErrorCode.INVALID_REQUEST]: false,
  [ExtensionErrorCode.NOT_IMPLEMENTED]: false,
  [ExtensionErrorCode.RESTRICTED_PAGE]: false,
  [ExtensionErrorCode.OFFSCREEN_UNAVAILABLE]: true,
  [ExtensionErrorCode.DOWNLOAD_FAILED]: true,
  [ExtensionErrorCode.INTERNAL_ERROR]: false
};

/** 构造统一错误对象。 */
export function createExtensionError(
  code: ExtensionErrorCode,
  options: {
    /** 覆盖默认错误信息。 */
    message?: string;
    /** 覆盖默认可恢复标记。 */
    recoverable?: boolean;
    /** 已清洗的错误细节。 */
    details?: Readonly<Record<string, unknown>>;
  } = {}
): ExtensionError {
  const message = options.message ?? defaultErrorMessages[code];
  const recoverable = options.recoverable ?? defaultRecoverable[code];

  if (options.details === undefined) {
    return { code, message, recoverable };
  }

  return { code, message, recoverable, details: options.details };
}

/** 构造统一失败响应。 */
export function toErrorResponse(requestId: RequestId | null, error: ExtensionError): ErrorResponse {
  return {
    ok: false,
    requestId,
    error
  };
}

/** 构造统一成功响应。 */
export function toSuccessResponse<Data>(requestId: RequestId, data: Data): SuccessResponse<Data> {
  return {
    ok: true,
    requestId,
    data
  };
}
