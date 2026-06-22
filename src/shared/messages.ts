import { ExtensionErrorCode } from "./errors";
import type { JobId, RequestId } from "./request-id";
import { isNonEmptyId } from "./request-id";

/** 稳定 message type，禁止在业务代码中散落字符串。 */
export const MessageType = {
  /** runtime ping 请求。 */
  RUNTIME_PING_REQUEST: "runtime.ping.request",
  /** runtime ping 结果。 */
  RUNTIME_PING_RESULT: "runtime.ping.result",
  /** content 采集请求。 */
  CLIP_CAPTURE_REQUEST: "clip.capture.request",
  /** content 采集结果。 */
  CLIP_CAPTURE_RESULT: "clip.capture.result",
  /** Markdown 转换请求。 */
  MARKDOWN_CONVERT_REQUEST: "markdown.convert.request",
  /** Markdown 转换结果。 */
  MARKDOWN_CONVERT_RESULT: "markdown.convert.result",
  /** Markdown 下载请求。 */
  DOWNLOAD_MARKDOWN_REQUEST: "download.markdown.request",
  /** Markdown 下载结果。 */
  DOWNLOAD_MARKDOWN_RESULT: "download.markdown.result",
  /** 批量任务启动请求。 */
  BATCH_START_REQUEST: "batch.start.request",
  /** 批量任务启动结果。 */
  BATCH_START_RESULT: "batch.start.result",
  /** 批量任务取消请求。 */
  BATCH_CANCEL_REQUEST: "batch.cancel.request",
  /** 批量任务取消结果。 */
  BATCH_CANCEL_RESULT: "batch.cancel.result"
} as const;

/** 已知 message type 联合。 */
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/** runtime message 目标运行时。 */
export const MessageTarget = {
  /** background service worker。 */
  BACKGROUND: "background",
  /** offscreen document。 */
  OFFSCREEN: "offscreen",
  /** content script。 */
  CONTENT: "content"
} as const;

/** runtime message 目标运行时联合。 */
export type MessageTarget = (typeof MessageTarget)[keyof typeof MessageTarget];

/** 剪藏采集模式，selection 表示选区优先，page 表示全文。 */
export const ClipCaptureMode = {
  /** 有选区时使用选区 HTML。 */
  SELECTION: "selection",
  /** 始终使用全文 Readability 逻辑。 */
  PAGE: "page"
} as const;

/** 剪藏采集模式联合。 */
export type ClipCaptureMode = (typeof ClipCaptureMode)[keyof typeof ClipCaptureMode];

/** 默认剪藏模式，保持 MarkDownload 的选区优先入口语义。 */
export const DEFAULT_CLIP_CAPTURE_MODE: ClipCaptureMode = ClipCaptureMode.SELECTION;

/** batch job 状态。 */
export const BatchJobStatus = {
  /** 等待执行。 */
  QUEUED: "queued",
  /** 正在执行。 */
  RUNNING: "running",
  /** 已完成。 */
  COMPLETED: "completed",
  /** 已失败。 */
  FAILED: "failed",
  /** 已取消。 */
  CANCELED: "canceled",
  /** 已过期。 */
  EXPIRED: "expired"
} as const;

/** batch job 状态联合类型。 */
export type BatchJobStatus = (typeof BatchJobStatus)[keyof typeof BatchJobStatus];

/** 已知请求 message type。 */
export type RequestMessageType =
  | typeof MessageType.RUNTIME_PING_REQUEST
  | typeof MessageType.CLIP_CAPTURE_REQUEST
  | typeof MessageType.MARKDOWN_CONVERT_REQUEST
  | typeof MessageType.DOWNLOAD_MARKDOWN_REQUEST
  | typeof MessageType.BATCH_START_REQUEST
  | typeof MessageType.BATCH_CANCEL_REQUEST;

/** 已知结果 message type。 */
export type ResultMessageType =
  | typeof MessageType.RUNTIME_PING_RESULT
  | typeof MessageType.CLIP_CAPTURE_RESULT
  | typeof MessageType.MARKDOWN_CONVERT_RESULT
  | typeof MessageType.DOWNLOAD_MARKDOWN_RESULT
  | typeof MessageType.BATCH_START_RESULT
  | typeof MessageType.BATCH_CANCEL_RESULT;

/** 请求 envelope，所有请求必须携带 requestId。 */
export interface RequestEnvelope<Type extends RequestMessageType> {
  /** 稳定 message type。 */
  type: Type;
  /** 请求 id，用于响应关联。 */
  requestId: RequestId;
}

/** runtime ping 请求。 */
export type RuntimePingRequest = RequestEnvelope<typeof MessageType.RUNTIME_PING_REQUEST>;

/** content 采集请求。 */
export interface ClipCaptureRequest extends RequestEnvelope<typeof MessageType.CLIP_CAPTURE_REQUEST> {
  /** 剪藏采集模式；非法输入在请求边界清洗为默认值。 */
  clipMode: ClipCaptureMode;
  /** 本次剪藏是否下载图片；非法输入按 false 清洗。 */
  downloadImages: boolean;
}

/** Markdown 转换输入中的页面 meta。 */
export interface MarkdownConvertCaptureMetadata {
  /** 页面声明语言。 */
  language: string | null;
  /** 页面字符集。 */
  charset: string | null;
  /** canonical URL。 */
  canonicalUrl: string | null;
  /** 页面描述。 */
  description: string | null;
  /** 站点名或 Open Graph site_name。 */
  siteName: string | null;
}

/** Markdown 转换输入中的 content 采集结果。 */
export interface MarkdownConvertCapturePayload {
  /** 当前页面完整 HTML。 */
  pageHtml: string;
  /** 当前选区 HTML；没有选区时为 null。 */
  selectionHtml: string | null;
  /** 页面标题。 */
  title: string;
  /** 页面 base URL，用于解析相对链接。 */
  baseUrl: string;
  /** 当前页面 URL。 */
  pageUrl: string;
  /** 是否存在非空选区。 */
  hasSelection: boolean;
  /** 本次剪藏采集模式。 */
  clipMode: ClipCaptureMode;
  /** 页面原始 meta 信息。 */
  metadata: MarkdownConvertCaptureMetadata;
}

/** Markdown 转换请求，payload 在 offscreen 边界继续清洗。 */
export interface MarkdownConvertRequest extends RequestEnvelope<typeof MessageType.MARKDOWN_CONVERT_REQUEST> {
  /** content 采集结果；unknown 避免脏数据越过 offscreen 校验边界。 */
  capture: unknown;
  /** 显式转换配置；缺失时 offscreen 使用默认配置。 */
  options: unknown;
}

/** Markdown 下载请求，payload 在 background 下载边界继续清洗。 */
export interface DownloadMarkdownRequest extends RequestEnvelope<typeof MessageType.DOWNLOAD_MARKDOWN_REQUEST> {
  /** 要下载的 Markdown 内容。 */
  markdown: unknown;
  /** 下载文件标题，不含扩展名。 */
  title: unknown;
  /** 转换阶段生成的图片下载计划。 */
  imageDownloads?: unknown;
  /** 转换阶段生成的下载设置。 */
  downloadSettings?: unknown;
}

/** 批量任务启动请求，必须额外携带 jobId。 */
export interface BatchStartRequest extends RequestEnvelope<typeof MessageType.BATCH_START_REQUEST> {
  /** 批量任务 id。 */
  jobId: JobId;
  /** 调用方指定的 tab id 列表；业务边界继续清洗。 */
  tabIds?: unknown;
}

/** 批量任务取消请求，必须额外携带 jobId。 */
export interface BatchCancelRequest extends RequestEnvelope<typeof MessageType.BATCH_CANCEL_REQUEST> {
  /** 批量任务 id。 */
  jobId: JobId;
}

/** 当前协议层已知请求联合。 */
export type ExtensionRequest =
  | RuntimePingRequest
  | ClipCaptureRequest
  | MarkdownConvertRequest
  | DownloadMarkdownRequest
  | BatchStartRequest
  | BatchCancelRequest;

/** runtime ping 成功数据。 */
export interface RuntimePingData {
  /** ping 响应固定为 true，便于健康检查断言。 */
  pong: true;
}

/** Markdown 转换输出中的 article 元数据。 */
export interface MarkdownConvertArticleMetadata {
  /** Readability 或页面标题。 */
  title: string;
  /** 原页面标题。 */
  pageTitle: string;
  /** 作者署名。 */
  byline: string;
  /** 摘要。 */
  excerpt: string;
  /** 站点名称。 */
  siteName: string;
  /** 页面基准 URL。 */
  baseURI: string;
  /** 正文纯文本长度。 */
  length: number;
  /** 文本方向。 */
  dir: string;
  /** 文章语言。 */
  lang: string;
  /** 发布时间。 */
  publishedTime: string;
  /** keywords meta。 */
  keywords: ReadonlyArray<string>;
  /** URL hash，含 #。 */
  hash: string;
  /** host，含端口。 */
  host: string;
  /** origin。 */
  origin: string;
  /** hostname，不含端口。 */
  hostname: string;
  /** pathname。 */
  pathname: string;
  /** port。 */
  port: string;
  /** protocol，含冒号。 */
  protocol: string;
  /** search，含 ?。 */
  search: string;
}

/** 转换阶段规划出的图片下载项。 */
export interface MarkdownImageDownloadItem {
  /** 原始图片 src，供调试和去重。 */
  originalSrc: string;
  /** 可下载的绝对图片 URL 或 data URI。 */
  sourceUrl: string;
  /** Markdown 中使用的图片文件名，未拼接 mdClipsFolder 和 Markdown 标题目录。 */
  filename: string;
  /** 是否为 Obsidian 图片路径。 */
  isObsidian: boolean;
  /** 图片处理动作；base64 只替换 Markdown，不落盘图片。 */
  outputStyle: "download" | "base64";
}

/** Markdown 下载设置，来自转换时使用的 options。 */
export interface MarkdownDownloadSettingsData {
  /** Markdown 下载模式。 */
  downloadMode: "downloadsApi" | "contentLink";
  /** downloadsApi 模式是否弹出保存对话框。 */
  saveAs: boolean;
  /** Downloads 下的 Markdown 保存目录，已按模板清洗。 */
  mdClipsFolder: string | null;
  /** 文件名额外禁用字符。 */
  disallowedChars: string;
}

/** Markdown 转换结果数据。 */
export interface MarkdownConvertResultData {
  /** 最终 Markdown。 */
  markdown: string;
  /** 按标题模板生成的标题。 */
  title: string;
  /** article 元数据，供下载与 UI 使用。 */
  article: MarkdownConvertArticleMetadata;
  /** 图片下载计划；没有图片时为空数组。 */
  imageDownloads: ReadonlyArray<MarkdownImageDownloadItem>;
  /** 下载设置，供 popup 传给 background。 */
  downloadSettings: MarkdownDownloadSettingsData;
}

/** 当前页剪藏结果数据，包含转换结果和页面原始采集事实。 */
export interface ClipCaptureResultData extends MarkdownConvertResultData {
  /** 原页面是否存在非空选区，供 popup 决定是否展示切换入口。 */
  hasSelection: boolean;
  /** 本次剪藏使用的采集模式。 */
  clipMode: ClipCaptureMode;
}

/** Markdown 下载结果数据。 */
export interface DownloadMarkdownResultData {
  /** 下载请求是否已被 background 接受。 */
  downloaded: boolean;
}

/** 批量任务结果摘要。 */
export interface BatchJobSummaryData {
  /** 批量任务 id。 */
  jobId: JobId;
  /** 任务当前状态。 */
  status: BatchJobStatus;
  /** 任务 tab 总数。 */
  totalTabs: number;
  /** 已完成 tab 数，包含 downloaded 和 skipped。 */
  completedTabs: number;
  /** 失败 tab 数，只包含 failed。 */
  failedTabs: number;
}

/** 批量启动结果数据。 */
export type BatchStartResultData = BatchJobSummaryData;

/** 批量取消结果数据。 */
export type BatchCancelResultData = BatchJobSummaryData;

/** 请求校验成功。 */
export interface ValidRequestResult {
  /** 校验成功固定为 true。 */
  ok: true;
  /** 已识别的请求。 */
  message: ExtensionRequest;
}

/** 请求校验失败。 */
export interface InvalidRequestResult {
  /** 校验失败固定为 false。 */
  ok: false;
  /** 可直接映射为错误对象的稳定错误码。 */
  code:
    | typeof ExtensionErrorCode.UNKNOWN_MESSAGE
    | typeof ExtensionErrorCode.MISSING_REQUEST_ID
    | typeof ExtensionErrorCode.MISSING_JOB_ID
    | typeof ExtensionErrorCode.INVALID_REQUEST;
  /** 已清洗 requestId，缺失时为 null。 */
  requestId: RequestId | null;
  /** 已清洗调试细节。 */
  details: Readonly<Record<string, unknown>>;
}

/** 请求校验结果。 */
export type RequestValidationResult = ValidRequestResult | InvalidRequestResult;

/** 已知 message type 列表。 */
export const ALL_MESSAGE_TYPES = Object.values(MessageType);

/** 已知请求 message type 列表。 */
export const REQUEST_MESSAGE_TYPES: ReadonlyArray<RequestMessageType> = [
  MessageType.RUNTIME_PING_REQUEST,
  MessageType.CLIP_CAPTURE_REQUEST,
  MessageType.MARKDOWN_CONVERT_REQUEST,
  MessageType.DOWNLOAD_MARKDOWN_REQUEST,
  MessageType.BATCH_START_REQUEST,
  MessageType.BATCH_CANCEL_REQUEST
];

/** 已知结果 message type 列表。 */
export const RESULT_MESSAGE_TYPES: ReadonlyArray<ResultMessageType> = [
  MessageType.RUNTIME_PING_RESULT,
  MessageType.CLIP_CAPTURE_RESULT,
  MessageType.MARKDOWN_CONVERT_RESULT,
  MessageType.DOWNLOAD_MARKDOWN_RESULT,
  MessageType.BATCH_START_RESULT,
  MessageType.BATCH_CANCEL_RESULT
];

/** 判断值是否为普通对象。 */
export function isMessageRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 判断 message type 是否属于协议已知范围。 */
export function isKnownMessageType(value: unknown): value is MessageType {
  return typeof value === "string" && ALL_MESSAGE_TYPES.includes(value as MessageType);
}

/** 判断 message type 是否为请求类型。 */
export function isRequestMessageType(value: unknown): value is RequestMessageType {
  return typeof value === "string" && REQUEST_MESSAGE_TYPES.includes(value as RequestMessageType);
}

/** 读取可选 target；缺失时表示 background 默认处理。 */
export function readMessageTarget(message: unknown): MessageTarget | null {
  if (!isMessageRecord(message)) {
    return null;
  }

  const target = message.target;

  if (target === MessageTarget.BACKGROUND || target === MessageTarget.OFFSCREEN || target === MessageTarget.CONTENT) {
    return target;
  }

  return null;
}

/** 判断请求是否为批量启动请求。 */
export function isBatchStartRequest(message: ExtensionRequest): message is BatchStartRequest {
  return message.type === MessageType.BATCH_START_REQUEST;
}

/** 判断值是否为合法剪藏模式。 */
export function isClipCaptureMode(value: unknown): value is ClipCaptureMode {
  return value === ClipCaptureMode.SELECTION || value === ClipCaptureMode.PAGE;
}

/** 校验跨运行时请求 envelope，业务 payload 留给具体边界继续清洗。 */
export function validateExtensionRequest(message: unknown): RequestValidationResult {
  if (!isMessageRecord(message)) {
    return createInvalidRequest(ExtensionErrorCode.UNKNOWN_MESSAGE, null, {
      reason: "message_not_object"
    });
  }

  const messageType = message.type;
  const requestId = isNonEmptyId(message.requestId) ? message.requestId : null;

  if (!isKnownMessageType(messageType)) {
    return createInvalidRequest(ExtensionErrorCode.UNKNOWN_MESSAGE, requestId, {
      type: sanitizeDetailValue(messageType)
    });
  }

  if (!isRequestMessageType(messageType)) {
    return createInvalidRequest(ExtensionErrorCode.INVALID_REQUEST, requestId, {
      type: messageType,
      reason: "result_message_cannot_be_routed_as_request"
    });
  }

  if (requestId === null) {
    return createInvalidRequest(ExtensionErrorCode.MISSING_REQUEST_ID, null, {
      type: messageType
    });
  }

  if (
    (messageType === MessageType.BATCH_START_REQUEST || messageType === MessageType.BATCH_CANCEL_REQUEST) &&
    !isNonEmptyId(message.jobId)
  ) {
    return createInvalidRequest(ExtensionErrorCode.MISSING_JOB_ID, requestId, {
      type: messageType
    });
  }

  return {
    ok: true,
    message: createValidatedRequest(messageType, requestId, message)
  };
}

/** 创建校验失败结果。 */
function createInvalidRequest(
  code: InvalidRequestResult["code"],
  requestId: RequestId | null,
  details: Readonly<Record<string, unknown>>
): InvalidRequestResult {
  return {
    ok: false,
    code,
    requestId,
    details
  };
}

/** 从已校验 envelope 显式构造请求对象，避免把脏对象强转进核心逻辑。 */
function createValidatedRequest(
  type: RequestMessageType,
  requestId: RequestId,
  message: Record<string, unknown>
): ExtensionRequest {
  if (type === MessageType.BATCH_START_REQUEST && isNonEmptyId(message.jobId)) {
    return {
      type,
      requestId,
      jobId: message.jobId,
      tabIds: message.tabIds
    };
  }

  if (type === MessageType.BATCH_CANCEL_REQUEST && isNonEmptyId(message.jobId)) {
    return {
      type,
      requestId,
      jobId: message.jobId
    };
  }

  if (type === MessageType.CLIP_CAPTURE_REQUEST) {
    return {
      type,
      requestId,
      clipMode: readClipCaptureMode(message.clipMode),
      downloadImages: message.downloadImages === true
    };
  }

  if (type === MessageType.MARKDOWN_CONVERT_REQUEST) {
    return {
      type,
      requestId,
      capture: message.capture,
      options: message.options
    };
  }

  if (type === MessageType.DOWNLOAD_MARKDOWN_REQUEST) {
    return {
      type,
      requestId,
      markdown: message.markdown,
      title: message.title,
      imageDownloads: message.imageDownloads,
      downloadSettings: message.downloadSettings
    };
  }

  return { type: MessageType.RUNTIME_PING_REQUEST, requestId };
}

/** 读取剪藏模式，非法值按产品确认清洗为默认 selection。 */
function readClipCaptureMode(value: unknown): ClipCaptureMode {
  if (isClipCaptureMode(value)) {
    return value;
  }

  return DEFAULT_CLIP_CAPTURE_MODE;
}

/** 清洗 unknown 细节，避免把复杂对象泄漏进错误 details。 */
function sanitizeDetailValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined || value === null) {
    return null;
  }

  return typeof value;
}
