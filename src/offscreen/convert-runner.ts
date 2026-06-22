import { cleanInvisibleCharacters } from "../shared/conversion/clean-markdown";
import {
  parseReadableDocument,
  type ReadabilityArticle,
  type ReadabilityResult
} from "../shared/conversion/readability";
import { createTurndownService, type ConversionTurndownOptions } from "../shared/conversion/turndown-factory";
import { sanitizeDownloadFolder } from "../shared/download/download-plan";
import { ImageStyle, planImagePath } from "../shared/filename/image-path";
import { sanitizePathSegments } from "../shared/filename/sanitize";
import type {
  MarkdownConvertArticleMetadata,
  MarkdownConvertCaptureMetadata,
  MarkdownConvertCapturePayload,
  MarkdownConvertResultData,
  MarkdownImageDownloadItem
} from "../shared/messages";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../shared/options/defaults";
import type { MarkdownSaveOptions } from "../shared/options/schema";
import { mergeArticleWithExtractedMeta } from "../shared/template/meta";
import { replaceTemplateText, type TemplateArticle, type TemplateArticleValue } from "../shared/template/replace";
import { readUrlComponents, type UrlComponents } from "../shared/url/components";

/** Markdown 转换 runner 输入。 */
export interface MarkdownConvertRunnerInput {
  /** content 采集结果。 */
  capture: MarkdownConvertCapturePayload;
  /** 转换配置；调用方必须显式传入，缺失时由边界补默认值。 */
  options: MarkdownSaveOptions;
}

/** DOMParser 最小依赖面，方便 node 单元测试注入。 */
export interface MarkdownConvertDomParser {
  /** 将 HTML 字符串解析为 Document。 */
  parseFromString(html: string, mimeType: DOMParserSupportedType): Document;
}

/** Markdown 转换 runner 依赖。 */
export interface MarkdownConvertRunnerDependencies {
  /** 创建 DOMParser。 */
  createDomParser(): MarkdownConvertDomParser;
  /** 执行 Readability 解析。 */
  parseReadableDocument(document: Document): ReadabilityResult;
  /** 当前时间，供模板测试稳定输出。 */
  now?: Date;
}

/** Markdown 转换 runner 可恢复失败。 */
export class MarkdownConvertRunnerError extends Error {
  /** 稳定错误原因。 */
  readonly reason: "dom_parser_unavailable" | "empty_convertible_content";

  /** 创建转换错误。 */
  constructor(reason: MarkdownConvertRunnerError["reason"], message: string) {
    super(message);
    this.name = "MarkdownConvertRunnerError";
    this.reason = reason;
  }
}

/** 空 Readability article，供 fallback 分支补齐显式字段。 */
const EMPTY_READABILITY_ARTICLE: ReadabilityArticle = {
  title: "",
  content: "",
  textContent: "",
  length: 0,
  excerpt: "",
  byline: "",
  dir: "",
  siteName: "",
  lang: "",
  publishedTime: ""
};

/** 将默认配置显式收窄为运行时 options。 */
export const DEFAULT_MARKDOWN_CONVERT_OPTIONS: MarkdownSaveOptions = { ...DEFAULT_MARKDOWN_SAVE_OPTIONS };

/** 默认 runner 依赖，生产 offscreen 使用全局 DOMParser。 */
export function createDefaultMarkdownConvertRunnerDependencies(): MarkdownConvertRunnerDependencies {
  return {
    createDomParser: () => {
      if (typeof DOMParser !== "function") {
        throw new MarkdownConvertRunnerError("dom_parser_unavailable", "当前运行时不支持 DOMParser。");
      }

      return new DOMParser();
    },
    parseReadableDocument: (document) => parseReadableDocument(document)
  };
}

/** 执行 offscreen Markdown 转换闭环。 */
export function runMarkdownConvert(
  input: MarkdownConvertRunnerInput,
  dependencies: MarkdownConvertRunnerDependencies = createDefaultMarkdownConvertRunnerDependencies()
): MarkdownConvertResultData {
  const document = dependencies.createDomParser().parseFromString(input.capture.pageHtml, "text/html");
  const baseURI = readBaseURI(input.capture);

  preprocessDocumentForMarkDownload(document);

  const selectionContentHtml = readSelectionContentHtml(input.capture);
  let readableArticle = EMPTY_READABILITY_ARTICLE;
  let contentHtml: string;

  if (selectionContentHtml !== null) {
    contentHtml = selectionContentHtml;
  } else {
    const readableResult = dependencies.parseReadableDocument(document);
    readableArticle = readableResult.ok ? readableResult.article : EMPTY_READABILITY_ARTICLE;
    contentHtml = readArticleContentHtml(readableResult, document);
  }

  if (contentHtml.trim().length === 0) {
    throw new MarkdownConvertRunnerError("empty_convertible_content", "页面没有可转换内容。");
  }

  const article = buildTemplateArticle(document, input.capture, readableArticle, contentHtml, baseURI);
  const turndownOptions = toConversionTurndownOptions(input.options);
  const imageDownloads: MarkdownImageDownloadItem[] = [];
  const imagePathResolver = createImagePathResolver(input.options, article, imageDownloads);
  const turndownService = createTurndownService(turndownOptions, { baseURI, imagePathResolver });
  installOffscreenKeepHtmlRules(turndownService);

  const markdownContent = turndownService.turndown(contentHtml);
  const markdown = cleanInvisibleCharacters(applyTemplates(markdownContent, article, input.options, dependencies.now));
  const title = readOutputTitle(article, input.options);

  return {
    markdown,
    title,
    article: toArticleMetadata(article),
    imageDownloads,
    downloadSettings: {
      downloadMode: input.options.downloadMode,
      saveAs: input.options.saveAs,
      mdClipsFolder: formatMdClipsFolder(article, input.options),
      disallowedChars: input.options.disallowedChars
    }
  };
}

/** selection 模式下用选区 HTML 覆盖正文内容，空选区继续走全文 fallback。 */
function readSelectionContentHtml(capture: MarkdownConvertCapturePayload): string | null {
  if (capture.clipMode !== "selection") {
    return null;
  }

  const selectionHtml = capture.selectionHtml;
  if (selectionHtml === null || selectionHtml.trim().length === 0) {
    return null;
  }

  return selectionHtml;
}

/** offscreen 局部保留规则，确保 GFM strikethrough 不改写 MarkDownload 保留标签。 */
function installOffscreenKeepHtmlRules(service: ReturnType<typeof createTurndownService>): void {
  const keepHtmlTagNames = new Set(["iframe", "sub", "sup", "u", "ins", "del", "small", "big"]);

  service.addRule("offscreenKeepHtmlTags", {
    filter(node) {
      return keepHtmlTagNames.has(node.nodeName.toLowerCase());
    },
    replacement(content, node) {
      return readOuterHtml(node, content);
    }
  });
}

/** 从 Turndown 节点读取 outerHTML，缺失时回退内容。 */
function readOuterHtml(node: Node, fallback: string): string {
  const element = node as HTMLElement;
  return typeof element.outerHTML === "string" ? element.outerHTML : fallback;
}

/** 读取转换使用的 baseURI。 */
function readBaseURI(capture: MarkdownConvertCapturePayload): string {
  const trimmedBaseUrl = capture.baseUrl.trim();
  if (trimmedBaseUrl) {
    return trimmedBaseUrl;
  }

  return capture.pageUrl.trim();
}

/** 执行旧 MarkDownload 在 Readability 前的 DOM 预处理。 */
function preprocessDocumentForMarkDownload(document: Document): void {
  for (const br of Array.from(document.querySelectorAll("pre br"))) {
    br.replaceWith(document.createElement("br-keep"));
  }

  for (const heading of Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))) {
    heading.removeAttribute("class");
  }

  document.documentElement?.removeAttribute("class");
}

/** 读取 Readability 正文，空正文时回退到 body 或 documentElement。 */
function readArticleContentHtml(readableResult: ReadabilityResult, document: Document): string {
  if (readableResult.ok && readableResult.article.content.trim().length > 0) {
    return readableResult.article.content;
  }

  const bodyHtml = document.body?.innerHTML ?? "";
  if (bodyHtml.trim().length > 0) {
    return bodyHtml;
  }

  return document.documentElement?.outerHTML ?? "";
}

/** 构造模板 article 字段。 */
function buildTemplateArticle(
  document: Document,
  capture: MarkdownConvertCapturePayload,
  readableArticle: ReadabilityArticle,
  contentHtml: string,
  baseURI: string
): TemplateArticle {
  const pageTitle = readPageTitle(document, capture, readableArticle);
  const urlComponents = readSafeUrlComponents(baseURI);
  const baseArticle: Record<string, TemplateArticleValue> = {
    ...urlComponents,
    title: readableArticle.title || pageTitle,
    pageTitle,
    byline: readableArticle.byline,
    excerpt: readableArticle.excerpt,
    siteName: readableArticle.siteName || capture.metadata.siteName || "",
    baseURI,
    length: readableArticle.length,
    dir: readableArticle.dir,
    lang: readableArticle.lang || capture.metadata.language || "",
    publishedTime: readableArticle.publishedTime,
    content: contentHtml,
    canonicalUrl: capture.metadata.canonicalUrl ?? "",
    description: capture.metadata.description ?? "",
    charset: capture.metadata.charset ?? ""
  };
  const withDocumentMeta = mergeArticleWithExtractedMeta(baseArticle, document);

  return mergeCaptureMetadata(withDocumentMeta, capture.metadata);
}

/** 读取页面标题，保证 title/pageTitle 不为空时优先使用页面事实。 */
function readPageTitle(
  document: Document,
  capture: MarkdownConvertCapturePayload,
  readableArticle: ReadabilityArticle
): string {
  const captureTitle = capture.title.trim();
  if (captureTitle) {
    return captureTitle;
  }

  const documentTitle = document.title.trim();
  if (documentTitle) {
    return documentTitle;
  }

  return readableArticle.title;
}

/** 读取 URL 组件；baseURI 非法时只保留空组件，避免转换中断。 */
function readSafeUrlComponents(baseURI: string): UrlComponents {
  const result = readUrlComponents(baseURI);
  if (result.ok) {
    return result.components;
  }

  return {
    baseURI,
    hash: "",
    host: "",
    origin: "",
    hostname: "",
    pathname: "",
    port: "",
    protocol: "",
    search: ""
  };
}

/** 将 content 采集到的 meta 补到 article，且不覆盖 DOM meta。 */
function mergeCaptureMetadata(article: TemplateArticle, metadata: MarkdownConvertCaptureMetadata): TemplateArticle {
  const mergedArticle: Record<string, TemplateArticleValue> = { ...article };

  mergeIfMissing(mergedArticle, "language", metadata.language);
  mergeIfMissing(mergedArticle, "charset", metadata.charset);
  mergeIfMissing(mergedArticle, "canonicalUrl", metadata.canonicalUrl);
  mergeIfMissing(mergedArticle, "description", metadata.description);
  mergeIfMissing(mergedArticle, "siteName", metadata.siteName);

  return mergedArticle;
}

/** 仅在字段为空时补充 meta。 */
function mergeIfMissing(article: Record<string, TemplateArticleValue>, field: string, value: string | null): void {
  if (value === null || value.trim().length === 0) {
    return;
  }

  const existingValue = article[field];
  if (existingValue !== undefined && existingValue !== null && String(existingValue).trim().length > 0) {
    return;
  }

  article[field] = value;
}

/** 转换 options 到 Turndown factory 子集。 */
function toConversionTurndownOptions(options: MarkdownSaveOptions): ConversionTurndownOptions {
  return {
    headingStyle: options.headingStyle,
    hr: options.hr,
    bulletListMarker: options.bulletListMarker,
    codeBlockStyle: options.codeBlockStyle,
    fence: options.fence,
    emDelimiter: options.emDelimiter,
    strongDelimiter: options.strongDelimiter,
    linkStyle: options.linkStyle,
    linkReferenceStyle: options.linkReferenceStyle,
    imageStyle: options.imageStyle,
    imageRefStyle: options.imageRefStyle,
    downloadImages: options.downloadImages,
    turndownEscape: options.turndownEscape
  };
}

/** 创建图片路径解析器，同时收集 background 下载计划。 */
function createImagePathResolver(
  options: MarkdownSaveOptions,
  article: TemplateArticle,
  imageDownloads: MarkdownImageDownloadItem[]
): (src: string) => string {
  const usedFilenames: string[] = [];
  const imagePrefix = formatImagePrefix(article, options);

  return (src: string) => {
    const plan = planImagePath({
      src,
      title: "",
      imagePrefix,
      disallowedChars: options.disallowedChars,
      imageStyle: options.imageStyle,
      existingFilenames: usedFilenames,
      prependFilePath: false
    });

    const downloadFilename =
      plan.downloadFilename ??
      (options.imageStyle === ImageStyle.ORIGINAL_SOURCE
        ? readOriginalSourceDownloadFilename(src, imagePrefix, options.disallowedChars, usedFilenames)
        : null);

    if (downloadFilename !== null) {
      usedFilenames.push(downloadFilename);
      imageDownloads.push({
        originalSrc: src,
        sourceUrl: src,
        filename: downloadFilename,
        isObsidian: plan.referenceKind === "obsidian",
        outputStyle: options.imageStyle === "base64" ? "base64" : "download"
      });
    }

    return plan.downloadFilename ?? plan.markdownPath ?? src;
  };
}

/** originalSource 保持 Markdown 原 URL，但开启下载时仍需要规划本地图片文件。 */
function readOriginalSourceDownloadFilename(
  src: string,
  imagePrefix: string,
  disallowedChars: string | null,
  usedFilenames: readonly string[]
): string | null {
  const downloadPlan = planImagePath({
    src,
    title: "",
    imagePrefix,
    disallowedChars,
    imageStyle: ImageStyle.MARKDOWN,
    existingFilenames: usedFilenames,
    prependFilePath: false
  });

  return downloadPlan.downloadFilename;
}

/** 格式化 imagePrefix，保持 MarkDownload 的模板替换和逐段清洗顺序。 */
function formatImagePrefix(article: TemplateArticle, options: MarkdownSaveOptions): string {
  const replaced = replaceTemplateText(options.imagePrefix, article, { disallowedChars: options.disallowedChars });
  return sanitizePathSegments(replaced, options.disallowedChars);
}

/** 格式化 Markdown 下载目录，M7 只在 downloadsApi 模式下保留 mdClipsFolder。 */
function formatMdClipsFolder(article: TemplateArticle, options: MarkdownSaveOptions): string | null {
  if (options.downloadMode !== "downloadsApi" || options.mdClipsFolder === null || options.mdClipsFolder.length === 0) {
    return null;
  }

  const replaced = replaceTemplateText(options.mdClipsFolder, article, { disallowedChars: options.disallowedChars });
  const folder = sanitizeDownloadFolder(replaced, options.disallowedChars);
  return folder.length > 0 ? folder : null;
}

/** 按 includeTemplate 拼装 frontmatter/backmatter。 */
function applyTemplates(
  markdownContent: string,
  article: TemplateArticle,
  options: MarkdownSaveOptions,
  now: Date | undefined
): string {
  if (!options.includeTemplate) {
    return markdownContent;
  }

  const replaceOptions = { now };
  const frontmatter = replaceTemplateText(options.frontmatter, article, replaceOptions);
  const backmatter = replaceTemplateText(options.backmatter, article, replaceOptions);

  return [frontmatter, markdownContent, backmatter].filter((part) => part.trim().length > 0).join("\n\n");
}

/** 读取输出标题模板。 */
function readOutputTitle(article: TemplateArticle, options: MarkdownSaveOptions): string {
  const disallowedChars = `${options.disallowedChars}/`;
  const title = sanitizePathSegments(
    replaceTemplateText(options.title, article, { disallowedChars }).trim(),
    options.disallowedChars
  );
  if (title) {
    return title;
  }

  const pageTitle = article.pageTitle;
  return typeof pageTitle === "string" ? pageTitle : "";
}

/** 将模板 article 收窄为响应中的稳定 article 元数据。 */
function toArticleMetadata(article: TemplateArticle): MarkdownConvertArticleMetadata {
  return {
    title: readStringArticleField(article, "title"),
    pageTitle: readStringArticleField(article, "pageTitle"),
    byline: readStringArticleField(article, "byline"),
    excerpt: readStringArticleField(article, "excerpt"),
    siteName: readStringArticleField(article, "siteName"),
    baseURI: readStringArticleField(article, "baseURI"),
    length: readNumberArticleField(article, "length"),
    dir: readStringArticleField(article, "dir"),
    lang: readStringArticleField(article, "lang"),
    publishedTime: readStringArticleField(article, "publishedTime"),
    keywords: readStringArrayArticleField(article, "keywords"),
    hash: readStringArticleField(article, "hash"),
    host: readStringArticleField(article, "host"),
    origin: readStringArticleField(article, "origin"),
    hostname: readStringArticleField(article, "hostname"),
    pathname: readStringArticleField(article, "pathname"),
    port: readStringArticleField(article, "port"),
    protocol: readStringArticleField(article, "protocol"),
    search: readStringArticleField(article, "search")
  };
}

/** 读取字符串 article 字段。 */
function readStringArticleField(article: TemplateArticle, field: string): string {
  const value = article[field];
  return typeof value === "string" ? value : "";
}

/** 读取数字 article 字段。 */
function readNumberArticleField(article: TemplateArticle, field: string): number {
  const value = article[field];
  return typeof value === "number" ? value : 0;
}

/** 读取字符串数组 article 字段。 */
function readStringArrayArticleField(article: TemplateArticle, field: string): ReadonlyArray<string> {
  const value = article[field];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}
