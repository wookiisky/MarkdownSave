/** URL 组件提取失败原因，调用方可按稳定值分支。 */
export const UrlComponentsFailureReason = {
  /** baseURI 不是 URL 构造器可接受的绝对 URL。 */
  INVALID_BASE_URI: "invalid_base_uri"
} as const;

/** URL 组件提取失败原因联合类型。 */
export type UrlComponentsFailureReason = (typeof UrlComponentsFailureReason)[keyof typeof UrlComponentsFailureReason];

/** 从 baseURI 派生出的 MarkDownload article URL 字段。 */
export interface UrlComponents {
  /** 原始 baseURI，保持与 DOM baseURI 输入一致。 */
  baseURI: string;
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

/** URL 组件提取成功结果。 */
export interface UrlComponentsSuccess {
  /** 成功固定为 true。 */
  ok: true;
  /** 已提取的 URL 字段。 */
  components: UrlComponents;
}

/** URL 组件提取失败结果。 */
export interface UrlComponentsFailure {
  /** 失败固定为 false。 */
  ok: false;
  /** 失败原因。 */
  reason: UrlComponentsFailureReason;
  /** 原始 baseURI。 */
  baseURI: string;
}

/** URL 组件提取结果。 */
export type UrlComponentsResult = UrlComponentsSuccess | UrlComponentsFailure;

/** 从 baseURI 提取 MarkDownload article URL 字段。 */
export function readUrlComponents(baseURI: string): UrlComponentsResult {
  let url: URL;

  try {
    url = new URL(baseURI);
  } catch {
    return {
      ok: false,
      reason: UrlComponentsFailureReason.INVALID_BASE_URI,
      baseURI
    };
  }

  return {
    ok: true,
    components: {
      baseURI,
      hash: url.hash,
      host: url.host,
      origin: url.origin,
      hostname: url.hostname,
      pathname: url.pathname,
      port: url.port,
      protocol: url.protocol,
      search: url.search
    }
  };
}
