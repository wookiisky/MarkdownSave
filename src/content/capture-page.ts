import type { RawContentCaptureResult, RawContentMetadata } from "./capture-types";
import { captureCurrentSelection } from "./capture-selection";
import { removeHiddenNodes, type GetElementVisibilityStyle } from "./remove-hidden";
import { DEFAULT_CLIP_CAPTURE_MODE, type ClipCaptureMode } from "../shared/messages";

/** 页面采集失败的稳定错误码。 */
export const CapturePageErrorCode = {
  /** 当前运行环境缺少 document。 */
  MISSING_DOCUMENT: "missing_document",
  /** 当前 document 缺少 documentElement。 */
  MISSING_DOCUMENT_ELEMENT: "missing_document_element",
  /** 当前 document 缺少 head。 */
  MISSING_HEAD: "missing_head",
  /** 当前 document 缺少 body。 */
  MISSING_BODY: "missing_body",
  /** 当前运行环境缺少 location。 */
  MISSING_LOCATION: "missing_location"
} as const;

/** 页面采集失败错误码联合。 */
export type CapturePageErrorCode = (typeof CapturePageErrorCode)[keyof typeof CapturePageErrorCode];

/** 页面采集依赖，生产环境默认读取当前页面，测试可显式注入。 */
export interface CaptureCurrentPageEnvironment {
  /** 待读取的页面 document。 */
  document?: Document;
  /** 当前页面 location。 */
  location?: Pick<Location, "href" | "origin">;
  /** 当前页面 window，用于读取真实选区。 */
  window?: Pick<Window, "getSelection">;
  /** 本次剪藏采集模式。 */
  clipMode?: ClipCaptureMode;
  /** 可注入的 computed style 读取函数。 */
  getElementStyle?: GetElementVisibilityStyle;
}

/** 页面采集的结构化失败。 */
export class CapturePageUnavailableError extends Error {
  /** 稳定错误码。 */
  readonly code: CapturePageErrorCode;
  /** 已清洗的错误细节。 */
  readonly details: Readonly<Record<string, unknown>>;

  /** 构造页面采集边界错误。 */
  constructor(code: CapturePageErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = "CapturePageUnavailableError";
    this.code = code;
    this.details = details;
  }
}

/** 采集当前页全文原始 HTML，并附带真实页面选区事实。 */
export function captureCurrentPage(environment: CaptureCurrentPageEnvironment = {}): RawContentCaptureResult {
  const sourceDocument = resolveCurrentDocument(environment);
  const currentDocument = cloneDocument(sourceDocument);
  const currentLocation = resolveCurrentLocation(environment);
  const clipMode = environment.clipMode ?? DEFAULT_CLIP_CAPTURE_MODE;
  const selection = captureCurrentSelection({
    document: sourceDocument,
    window: environment.window
  });
  const documentElement = requireDocumentElement(currentDocument);
  const head = requireHead(currentDocument);
  const body = requireBody(currentDocument);

  ensureTitleElement(currentDocument, head);
  const baseUrl = ensureBaseElement(currentDocument, head, currentLocation);
  removeHiddenNodes(body, environment.getElementStyle);

  return {
    pageHtml: documentElement.outerHTML,
    selectionHtml: selection.selectionHtml,
    title: currentDocument.title,
    baseUrl,
    pageUrl: currentLocation.href,
    hasSelection: selection.hasSelection,
    clipMode,
    metadata: collectMetadata(currentDocument)
  };
}

/** 克隆页面 Document，避免采集时修改真实网页 DOM。 */
function cloneDocument(sourceDocument: Document): Document {
  const clonedNode = sourceDocument.cloneNode(true);

  if (clonedNode.nodeType !== sourceDocument.DOCUMENT_NODE) {
    throw new CapturePageUnavailableError(CapturePageErrorCode.MISSING_DOCUMENT, "无法克隆当前页面 document。");
  }

  return clonedNode as Document;
}

/** 从注入环境或全局对象读取 document。 */
function resolveCurrentDocument(environment: CaptureCurrentPageEnvironment): Document {
  const currentDocument = environment.document ?? (globalThis as typeof globalThis & { document?: Document }).document;

  if (currentDocument === undefined) {
    throw new CapturePageUnavailableError(CapturePageErrorCode.MISSING_DOCUMENT, "当前运行环境缺少 document。");
  }

  return currentDocument;
}

/** 从注入环境或全局 window 读取 location。 */
function resolveCurrentLocation(environment: CaptureCurrentPageEnvironment): Pick<Location, "href" | "origin"> {
  const globalWindow = (globalThis as typeof globalThis & { window?: Window }).window;
  const globalLocation = globalWindow === undefined ? undefined : globalWindow.location;
  const currentLocation = environment.location ?? globalLocation;

  if (currentLocation === undefined) {
    throw new CapturePageUnavailableError(CapturePageErrorCode.MISSING_LOCATION, "当前运行环境缺少 location。");
  }

  return currentLocation;
}

/** 读取 documentElement，缺失时返回结构化采集错误。 */
function requireDocumentElement(currentDocument: Document): HTMLElement {
  const documentElement = currentDocument.documentElement;

  if (documentElement === null) {
    throw new CapturePageUnavailableError(CapturePageErrorCode.MISSING_DOCUMENT_ELEMENT, "当前页面缺少 documentElement。");
  }

  return documentElement;
}

/** 读取 head，缺失时返回结构化采集错误。 */
function requireHead(currentDocument: Document): HTMLHeadElement {
  const head = currentDocument.head;

  if (head === null) {
    throw new CapturePageUnavailableError(CapturePageErrorCode.MISSING_HEAD, "当前页面缺少 head。");
  }

  return head;
}

/** 读取 body，缺失时返回结构化采集错误。 */
function requireBody(currentDocument: Document): HTMLElement {
  const body = currentDocument.body;

  if (body === null) {
    throw new CapturePageUnavailableError(CapturePageErrorCode.MISSING_BODY, "当前页面缺少 body。");
  }

  return body;
}

/** 保证 head 中存在 title 元素，缺失时使用 document.title 补齐。 */
function ensureTitleElement(currentDocument: Document, head: HTMLHeadElement): void {
  const existingTitle = head.querySelector("title");

  if (existingTitle !== null) {
    return;
  }

  const titleElement = currentDocument.createElement("title");
  titleElement.textContent = currentDocument.title;
  head.appendChild(titleElement);
}

/** 保证 base 存在且限定在当前 origin 下。 */
function ensureBaseElement(
  currentDocument: Document,
  head: HTMLHeadElement,
  currentLocation: Pick<Location, "href" | "origin">
): string {
  const existingBase = head.querySelector("base");
  const baseElement = existingBase ?? currentDocument.createElement("base");
  const currentBaseUrl = readHref(baseElement);
  const shouldResetBase = existingBase === null || !currentBaseUrl.startsWith(currentLocation.origin);

  if (shouldResetBase) {
    setHref(baseElement, currentLocation.href);
  }

  if (existingBase === null) {
    head.appendChild(baseElement);
  }

  return readHref(baseElement);
}

/** 汇总页面 meta 原始事实。 */
function collectMetadata(currentDocument: Document): RawContentMetadata {
  return {
    language: readLanguage(currentDocument),
    charset: readCharset(currentDocument),
    canonicalUrl: readLinkHref(currentDocument, "link[rel='canonical']"),
    description: readMetaContent(currentDocument, "meta[name='description']"),
    siteName: readMetaContent(currentDocument, "meta[property='og:site_name']")
  };
}

/** 读取 html lang。 */
function readLanguage(currentDocument: Document): string | null {
  const language = currentDocument.documentElement.getAttribute("lang");

  if (language === "") {
    return null;
  }

  return language;
}

/** 读取 document 字符集。 */
function readCharset(currentDocument: Document): string | null {
  const charset = currentDocument.characterSet;

  if (charset === "") {
    return null;
  }

  return charset;
}

/** 读取 link href。 */
function readLinkHref(currentDocument: Document, selector: string): string | null {
  const element = currentDocument.head.querySelector(selector);

  if (element === null) {
    return null;
  }

  const href = readHref(element);

  if (href === "") {
    return null;
  }

  return href;
}

/** 读取 meta content。 */
function readMetaContent(currentDocument: Document, selector: string): string | null {
  const element = currentDocument.head.querySelector(selector);

  if (element === null) {
    return null;
  }

  const content = element.getAttribute("content");

  if (content === "" || content === null) {
    return null;
  }

  return content;
}

/** 读取支持 href 属性的元素。 */
function readHref(element: Element): string {
  const hrefElement = element as Element & { href?: unknown };
  const propertyHref = hrefElement.href;

  if (typeof propertyHref === "string") {
    return propertyHref;
  }

  return element.getAttribute("href") ?? "";
}

/** 写入支持 href 属性的元素。 */
function setHref(element: Element, href: string): void {
  const hrefElement = element as Element & { href?: string };
  hrefElement.href = href;
  element.setAttribute("href", href);
}
