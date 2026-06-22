/** URL 解析失败原因，调用方可按稳定值分支。 */
export const UrlResolveFailureReason = {
  /** baseURI 不是 URL 构造器可接受的绝对 URL。 */
  INVALID_BASE_URI: "invalid_base_uri"
} as const;

/** URL 解析失败原因联合类型。 */
export type UrlResolveFailureReason = (typeof UrlResolveFailureReason)[keyof typeof UrlResolveFailureReason];

/** MarkDownload URL 兼容解析使用的分支。 */
export const MarkDownloadUriResolutionStrategy = {
  /** href 本身已经是 URL 构造器可接受的绝对 URL，保持原值。 */
  ABSOLUTE_HREF: "absolute_href",
  /** href 以 / 开头，使用 baseURI 的 origin 拼接。 */
  ORIGIN_RELATIVE: "origin_relative",
  /** href 不是绝对 URL 且不以 / 开头，直接追加到 baseURI.href。 */
  BASE_HREF_APPEND: "base_href_append"
} as const;

/** MarkDownload URL 兼容解析分支联合类型。 */
export type MarkDownloadUriResolutionStrategy =
  (typeof MarkDownloadUriResolutionStrategy)[keyof typeof MarkDownloadUriResolutionStrategy];

/** URL 解析成功结果。 */
export interface ResolvedMarkDownloadUri {
  /** 成功固定为 true。 */
  ok: true;
  /** 解析后的 href；绝对 URL 输入保持原始字符串。 */
  href: string;
  /** 命中的兼容解析分支。 */
  strategy: MarkDownloadUriResolutionStrategy;
}

/** URL 解析失败结果。 */
export interface FailedMarkDownloadUriResolution {
  /** 失败固定为 false。 */
  ok: false;
  /** 失败原因。 */
  reason: UrlResolveFailureReason;
  /** 原始 href，供调用方选择回退策略。 */
  href: string;
  /** 原始 baseURI，便于边界日志记录。 */
  baseURI: string;
}

/** MarkDownload URL 兼容解析结果。 */
export type MarkDownloadUriResolution = ResolvedMarkDownloadUri | FailedMarkDownloadUriResolution;

/** 判断字符串是否可直接作为 URL，成功时不得改写原始 href。 */
function isUrlConstructorAcceptable(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** 安全解析 baseURI，避免无效边界数据把异常带入核心流程。 */
function readBaseUrl(baseURI: string): URL | null {
  try {
    return new URL(baseURI);
  } catch {
    return null;
  }
}

/** 按 MarkDownload validateUri 历史行为解析 href。 */
export function resolveMarkDownloadUri(href: string, baseURI: string): MarkDownloadUriResolution {
  if (isUrlConstructorAcceptable(href)) {
    return {
      ok: true,
      href,
      strategy: MarkDownloadUriResolutionStrategy.ABSOLUTE_HREF
    };
  }

  const baseUrl = readBaseUrl(baseURI);
  if (baseUrl === null) {
    return {
      ok: false,
      reason: UrlResolveFailureReason.INVALID_BASE_URI,
      href,
      baseURI
    };
  }

  if (href.startsWith("/")) {
    return {
      ok: true,
      href: baseUrl.origin + href,
      strategy: MarkDownloadUriResolutionStrategy.ORIGIN_RELATIVE
    };
  }

  return {
    ok: true,
    href: baseUrl.href + (baseUrl.href.endsWith("/") ? "/" : "") + href,
    strategy: MarkDownloadUriResolutionStrategy.BASE_HREF_APPEND
  };
}

/** 兼容旧调用点的原值回退策略：baseURI 无效时返回原始 href。 */
export function resolveMarkDownloadUriOrOriginal(href: string, baseURI: string): string {
  const result = resolveMarkDownloadUri(href, baseURI);
  if (!result.ok) {
    return result.href;
  }

  return result.href;
}
