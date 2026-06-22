import type { TemplateArticle, TemplateArticleValue } from "./replace";

/** meta-like 输入记录。 */
export type MetaLikeRecord = Readonly<Record<string, unknown>>;

/** 可提取 meta 的输入源。 */
export type MetaSource = Document | ReadonlyArray<MetaLikeRecord>;

/** Document 中的 meta 元素最小接口。 */
interface MetaElementLike {
  /** 读取 meta attribute。 */
  getAttribute(name: string): string | null;
}

/** Document 最小接口，便于测试和跨运行时复用。 */
interface DocumentLike {
  /** 查询 meta 元素。 */
  querySelectorAll(selectors: string): ArrayLike<MetaElementLike> | Iterable<MetaElementLike>;
}

/** 从 HTML Document 或 meta-like 数据中提取 meta 并合并到 article。 */
export function mergeArticleWithExtractedMeta(article: TemplateArticle, source: MetaSource): TemplateArticle {
  const mergedArticle: Record<string, TemplateArticleValue> = { ...article };
  const metaRecords = readMetaRecords(source);

  for (const metaRecord of metaRecords) {
    const metaKey = readMetaKey(metaRecord);
    const content = readStringField(metaRecord, "content");

    if (!metaKey || content === null || Object.prototype.hasOwnProperty.call(mergedArticle, metaKey)) {
      continue;
    }

    mergedArticle[metaKey] = metaKey === "keywords" ? splitKeywords(content) : content;
  }

  return mergedArticle;
}

/** 读取 meta 源数据。 */
function readMetaRecords(source: MetaSource): ReadonlyArray<MetaLikeRecord> {
  if (Array.isArray(source)) {
    return source;
  }

  if (!isDocumentLike(source)) {
    return [];
  }

  return Array.from(source.querySelectorAll("meta[name][content], meta[property][content]")).map((metaElement) => ({
    name: metaElement.getAttribute("name"),
    property: metaElement.getAttribute("property"),
    content: metaElement.getAttribute("content")
  }));
}

/** 判断输入是否具备 Document 查询能力。 */
function isDocumentLike(source: unknown): source is DocumentLike {
  return typeof source === "object" && source !== null && typeof (source as DocumentLike).querySelectorAll === "function";
}

/** 读取 meta name 或 property。 */
function readMetaKey(metaRecord: MetaLikeRecord): string | null {
  const name = readStringField(metaRecord, "name");
  if (name) {
    return name;
  }

  return readStringField(metaRecord, "property");
}

/** 读取字符串字段并清洗空白。 */
function readStringField(record: MetaLikeRecord, field: string): string | null {
  const value = record[field];
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

/** 按英文逗号拆分 keywords。 */
function splitKeywords(content: string): ReadonlyArray<string> {
  return content.split(",").map((keyword) => keyword.trim());
}
