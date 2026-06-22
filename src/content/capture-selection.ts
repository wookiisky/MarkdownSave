/** 当前选区 HTML 采集结果。 */
export interface CapturedSelectionHtml {
  /** 当前选区 HTML；没有可用选区时为 null。 */
  selectionHtml: string | null;
  /** 是否存在非空选区。 */
  hasSelection: boolean;
}

/** 选区采集依赖，生产环境默认读取当前页面，测试可显式注入。 */
export interface CaptureCurrentSelectionEnvironment {
  /** 当前页面 document，用于创建临时容器。 */
  document?: Document;
  /** 当前页面 window，用于读取 Selection。 */
  window?: Pick<Window, "getSelection">;
}

/** 旧版 IE document.selection 的最小契约，仅用于边界清洗。 */
interface LegacySelectionDocument extends Document {
  /** 旧 IE 文本选区入口。 */
  selection?: {
    /** 创建旧 IE range。 */
    createRange?: () => {
      /** 旧 IE range HTML。 */
      htmlText?: unknown;
    };
  };
}

/** 采集当前页面选区 HTML fragment。 */
export function captureCurrentSelection(environment: CaptureCurrentSelectionEnvironment = {}): CapturedSelectionHtml {
  const currentDocument = resolveSelectionDocument(environment);
  if (currentDocument === null) {
    return createEmptySelection();
  }

  const legacyHtml = readLegacySelectionHtml(currentDocument);

  if (legacyHtml !== null) {
    return normalizeSelectionHtml(legacyHtml);
  }

  const currentWindow = resolveSelectionWindow(environment);
  const selection = currentWindow?.getSelection();

  if (selection === null || selection === undefined || selection.rangeCount === 0) {
    return createEmptySelection();
  }

  const fragments: string[] = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    const container = currentDocument.createElement("div");
    container.appendChild(range.cloneContents());
    fragments.push(container.innerHTML);
  }

  return normalizeSelectionHtml(fragments.join(""));
}

/** 从注入环境或全局对象读取 document。 */
function resolveSelectionDocument(environment: CaptureCurrentSelectionEnvironment): Document | null {
  return environment.document ?? (globalThis as typeof globalThis & { document?: Document }).document ?? null;
}

/** 从注入环境或全局对象读取 window。 */
function resolveSelectionWindow(environment: CaptureCurrentSelectionEnvironment): Pick<Window, "getSelection"> | null {
  const globalWindow = (globalThis as typeof globalThis & { window?: Window }).window;
  return environment.window ?? globalWindow ?? null;
}

/** 读取旧 IE HTML 选区，现代 Chrome 正常返回 null。 */
function readLegacySelectionHtml(currentDocument: Document): string | null {
  const legacySelection = (currentDocument as LegacySelectionDocument).selection;
  const createRange = legacySelection?.createRange;

  if (typeof createRange !== "function") {
    return null;
  }

  const range = createRange();
  return typeof range.htmlText === "string" ? range.htmlText : "";
}

/** 规整选区 HTML，空白选区不伪造内容。 */
function normalizeSelectionHtml(selectionHtml: string): CapturedSelectionHtml {
  if (selectionHtml.trim().length === 0) {
    return createEmptySelection();
  }

  return {
    selectionHtml,
    hasSelection: true
  };
}

/** 构造空选区结果。 */
function createEmptySelection(): CapturedSelectionHtml {
  return {
    selectionHtml: null,
    hasSelection: false
  };
}
