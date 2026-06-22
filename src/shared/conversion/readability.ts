import { Readability } from "@mozilla/readability";

/** Readability 包装层稳定错误码。 */
export const ReadabilityErrorCode = {
  /** Readability.parse 返回 null，shared 层不做旧版 content fallback。 */
  PARSE_EMPTY: "readability_parse_empty"
} as const;

/** Readability 包装层稳定错误码联合类型。 */
export type ReadabilityErrorCode = (typeof ReadabilityErrorCode)[keyof typeof ReadabilityErrorCode];

/** Readability 可传入的显式配置子集。 */
export interface ReadabilityParseOptions {
  /** 是否输出 Readability 内部调试日志。 */
  debug?: boolean;
  /** 最大解析元素数量，0 表示不限制。 */
  maxElemsToParse?: number;
  /** 候选正文节点数量。 */
  nbTopCandidates?: number;
  /** 正文最小字符数阈值。 */
  charThreshold?: number;
  /** 是否保留全部 class。 */
  keepClasses?: boolean;
  /** keepClasses=false 时仍需保留的 class。 */
  classesToPreserve?: string[];
  /** 是否禁用 JSON-LD 元数据解析。 */
  disableJSONLD?: boolean;
  /** 允许保留的视频地址规则。 */
  allowedVideoRegex?: RegExp;
}

/** Readability 成功提取后的结构化正文。 */
export interface ReadabilityArticle {
  /** 文章标题。 */
  title: string;
  /** 清洗后的正文 HTML。 */
  content: string;
  /** 正文纯文本。 */
  textContent: string;
  /** 正文纯文本长度。 */
  length: number;
  /** 摘要。 */
  excerpt: string;
  /** 作者署名。 */
  byline: string;
  /** 文本方向。 */
  dir: string;
  /** 站点名称。 */
  siteName: string;
  /** 文章语言。 */
  lang: string;
  /** 发布时间。 */
  publishedTime: string;
}

/** Readability 解析成功结果。 */
export interface ReadabilitySuccess {
  /** 成功固定为 true。 */
  ok: true;
  /** 结构化正文。 */
  article: ReadabilityArticle;
}

/** Readability 解析失败结果。 */
export interface ReadabilityFailure {
  /** 失败固定为 false。 */
  ok: false;
  /** 稳定错误码。 */
  code: ReadabilityErrorCode;
  /** 面向开发排障的明确错误信息。 */
  message: string;
}

/** Readability 包装层返回结果。 */
export type ReadabilityResult = ReadabilitySuccess | ReadabilityFailure;

/** Readability 原始返回结构。 */
interface RawReadabilityArticle {
  /** 文章标题。 */
  title: string | null | undefined;
  /** 清洗后的正文 HTML。 */
  content: string | null | undefined;
  /** 正文纯文本。 */
  textContent: string | null | undefined;
  /** 正文纯文本长度。 */
  length: number | null | undefined;
  /** 摘要。 */
  excerpt: string | null | undefined;
  /** 作者署名。 */
  byline: string | null | undefined;
  /** 文本方向。 */
  dir: string | null | undefined;
  /** 站点名称。 */
  siteName: string | null | undefined;
  /** 文章语言。 */
  lang: string | null | undefined;
  /** 发布时间。 */
  publishedTime: string | null | undefined;
}

/** Readability parser 边界，测试可注入受控 parser。 */
export type ReadabilityArticleParser = (
  document: Document,
  options: ReadabilityParseOptions
) => RawReadabilityArticle | null;

/** 构造 parse null 时的稳定失败结果。 */
export function toReadabilityFailure(): ReadabilityFailure {
  return {
    ok: false,
    code: ReadabilityErrorCode.PARSE_EMPTY,
    message: "Readability 未能提取正文；conversion shared 层不做旧版 content fallback。"
  };
}

/** 将 Readability 可空字段规整为 conversion 层稳定结构。 */
function normalizeReadabilityArticle(article: RawReadabilityArticle): ReadabilityArticle {
  return {
    title: article.title ?? "",
    content: article.content ?? "",
    textContent: article.textContent ?? "",
    length: article.length ?? 0,
    excerpt: article.excerpt ?? "",
    byline: article.byline ?? "",
    dir: article.dir ?? "",
    siteName: article.siteName ?? "",
    lang: article.lang ?? "",
    publishedTime: article.publishedTime ?? ""
  };
}

/** 默认 Readability parser。 */
function parseWithReadability(document: Document, options: ReadabilityParseOptions): RawReadabilityArticle | null {
  return new Readability(document, options).parse();
}

/** 用 Readability 解析文档；失败时显式返回错误，不做旧 MarkDownload 的 content fallback。 */
export function parseReadableDocument(
  document: Document,
  options: ReadabilityParseOptions = {},
  parseArticle: ReadabilityArticleParser = parseWithReadability
): ReadabilityResult {
  const clonedNode = document.cloneNode(true);
  if (clonedNode.nodeType !== document.DOCUMENT_NODE) {
    return toReadabilityFailure();
  }

  const clonedDocument = clonedNode as Document;
  const article = parseArticle(clonedDocument, options);
  if (article === null) {
    return toReadabilityFailure();
  }

  return {
    ok: true,
    article: normalizeReadabilityArticle(article)
  };
}
