import type { ClipCaptureMode } from "../shared/messages";

/** 页面 meta 采集结果，content 只返回原始页面事实。 */
export interface RawContentMetadata {
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

/** content 原始采集结果，不包含最终 Markdown。 */
export interface RawContentCaptureResult {
  /** 当前页面完整 HTML。 */
  pageHtml: string;
  /** 当前选区 HTML；没有选区时为 null。 */
  selectionHtml: string | null;
  /** 页面标题。 */
  title: string;
  /** 页面 base URL，用于后续解析相对链接。 */
  baseUrl: string;
  /** 当前页面 URL。 */
  pageUrl: string;
  /** 是否存在非空选区。 */
  hasSelection: boolean;
  /** 本次剪藏采集模式。 */
  clipMode: ClipCaptureMode;
  /** 页面原始 meta 信息。 */
  metadata: RawContentMetadata;
}
