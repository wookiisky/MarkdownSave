/** M3 offscreen document 固定入口路径。 */
export const OFFSCREEN_DOCUMENT_PATH = "offscreen/offscreen.html";

/** offscreen document 创建原因，使用 Chrome 官方枚举字符串。 */
export type OffscreenDocumentReason = `${chrome.offscreen.Reason}`;

/** offscreen document 创建参数边界。 */
export interface OffscreenDocumentCreateOptions {
  /** 扩展包内 offscreen html 路径。 */
  path: string;
  /** Chrome 要求的创建原因。 */
  reasons: readonly OffscreenDocumentReason[];
  /** Chrome 要求的创建说明。 */
  justification: string;
}

/** runtime contexts 查询适配器。 */
export interface OffscreenRuntimeAdapter {
  /** 获取扩展包内资源 URL。 */
  getURL(path: string): string;
  /** 查询扩展运行时 contexts。 */
  getContexts?: (filter: chrome.runtime.ContextFilter) => Promise<chrome.runtime.ExtensionContext[]>;
}

/** chrome.offscreen 适配器。 */
export interface OffscreenDocumentAdapter {
  /** 创建 offscreen document。 */
  createDocument(parameters: chrome.offscreen.CreateParameters): Promise<void>;
  /** 关闭 offscreen document。 */
  closeDocument(): Promise<void>;
}

/** offscreen 平台能力集合。 */
export interface OffscreenPlatformAdapter {
  /** runtime contexts 能力。 */
  runtime: OffscreenRuntimeAdapter;
  /** offscreen document 能力；旧环境可能不存在。 */
  offscreen?: OffscreenDocumentAdapter;
  /** OFFSCREEN_DOCUMENT context type 字符串。 */
  offscreenContextType?: `${chrome.runtime.ContextType}`;
}

/** 默认 offscreen 创建参数，M3 不承载真实剪贴板业务。 */
export const defaultOffscreenCreateOptions: OffscreenDocumentCreateOptions = {
  path: OFFSCREEN_DOCUMENT_PATH,
  reasons: ["DOM_PARSER", "CLIPBOARD", "BLOBS"],
  justification: "MarkdownSave MV3 runtime offscreen boundary."
};

/** 从全局 chrome 对象创建 offscreen 平台 adapter。 */
export function createChromeOffscreenPlatformAdapter(chromeApi: typeof chrome = chrome): OffscreenPlatformAdapter {
  const contextType = chromeApi.runtime.ContextType?.OFFSCREEN_DOCUMENT;
  const getContexts =
    typeof chromeApi.runtime.getContexts === "function"
      ? (filter: chrome.runtime.ContextFilter) => chromeApi.runtime.getContexts(filter)
      : undefined;

  return {
    runtime: {
      getURL(path) {
        return chromeApi.runtime.getURL(path);
      },
      getContexts
    },
    offscreen: chromeApi.offscreen,
    offscreenContextType: contextType
  };
}

/** 判断当前平台是否支持 M3 需要的 offscreen 能力。 */
export function isOffscreenSupported(platform: OffscreenPlatformAdapter): boolean {
  return (
    platform.offscreen !== undefined &&
    typeof platform.offscreen.createDocument === "function" &&
    typeof platform.runtime.getContexts === "function" &&
    platform.offscreenContextType === "OFFSCREEN_DOCUMENT"
  );
}

/** 查询已存在的 offscreen document contexts，创建前必须先调用。 */
export async function getExistingOffscreenDocuments(
  platform: OffscreenPlatformAdapter,
  path: string = OFFSCREEN_DOCUMENT_PATH
): Promise<chrome.runtime.ExtensionContext[]> {
  if (!isOffscreenSupported(platform) || platform.runtime.getContexts === undefined) {
    return [];
  }

  const documentUrl = platform.runtime.getURL(path);
  const offscreenContextType = platform.offscreenContextType;

  if (offscreenContextType === undefined) {
    return [];
  }

  return platform.runtime.getContexts({
    contextTypes: [offscreenContextType],
    documentUrls: [documentUrl]
  });
}

/** 创建 offscreen document 的唯一 wrapper，不做存在性判断。 */
export async function createOffscreenDocument(
  platform: OffscreenPlatformAdapter,
  options: OffscreenDocumentCreateOptions = defaultOffscreenCreateOptions
): Promise<void> {
  if (!isOffscreenSupported(platform)) {
    throw new Error("当前 Chrome runtime 不支持 offscreen document。");
  }

  const offscreen = platform.offscreen;

  if (offscreen === undefined) {
    throw new Error("当前 Chrome runtime 不支持 offscreen document。");
  }

  await offscreen.createDocument({
    url: options.path,
    reasons: [...options.reasons],
    justification: options.justification
  });
}
