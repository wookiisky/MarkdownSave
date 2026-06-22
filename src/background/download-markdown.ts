import {
  createExtensionError,
  ExtensionErrorCode,
  toErrorResponse,
  toSuccessResponse,
  type ExtensionResponse
} from "../shared/errors";
import type { DownloadMarkdownRequest } from "../shared/messages";
import {
  DownloadPlanMode,
  planImageDownload,
  planMarkdownDownload,
  replaceMarkdownImageFilename
} from "../shared/download/download-plan";
import { replaceIdunnoExtensionByMimeType } from "../shared/download/mime-extension";
import { sanitizePathSegments } from "../shared/filename/sanitize";
import { readActiveTab, type ActiveTabInfo } from "./tabs";

/** Markdown 下载依赖，测试可注入。 */
export interface DownloadMarkdownDependencies {
  /** 调用下载 API。 */
  download(options: chrome.downloads.DownloadOptions): Promise<number>;
  /** 读取当前 active tab，供 contentLink 降级使用。 */
  readActiveTab?(): Promise<ActiveTabInfo | null>;
  /** 在页面中通过 content link 触发下载。 */
  executeContentLinkDownload?(tabId: number, filename: string, markdown: string): Promise<void>;
  /** 读取图片 Blob，供 MIME 推断和 data URL 下载。 */
  fetchImage?(sourceUrl: string): Promise<FetchedImageData>;
}

/** M5 Markdown 下载默认依赖。 */
export function createDownloadMarkdownDependencies(): DownloadMarkdownDependencies {
  return {
    download(options) {
      return chrome.downloads.download(options);
    },
    readActiveTab,
    async executeContentLinkDownload(tabId, filename, markdown) {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: triggerContentLinkDownload,
        args: [filename, base64EncodeUnicode(markdown)]
      });
    },
    async fetchImage(sourceUrl) {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`image fetch failed: ${response.status}`);
      }

      const blob = await response.blob();
      return {
        dataUrl: await createDataUrlFromBlob(blob),
        mimeType: blob.type || response.headers.get("content-type")
      };
    }
  };
}

/** 下载 Markdown 文本。 */
export async function downloadMarkdownFromRequest(
  request: DownloadMarkdownRequest,
  dependencies: DownloadMarkdownDependencies = createDownloadMarkdownDependencies()
): Promise<ExtensionResponse<{ downloaded: true; downloadId: number }>> {
  const payload = readDownloadPayload(request);
  if (!payload.ok) {
    return toErrorResponse(
      request.requestId,
      createExtensionError(ExtensionErrorCode.INVALID_REQUEST, {
        details: payload.details
      })
    );
  }

  try {
    const preparedDownload = await prepareMarkdownAndImagesForDownload(payload, dependencies);

    if (payload.downloadSettings.downloadMode === DownloadPlanMode.CONTENT_LINK) {
      const contentLinkResult = await tryExecuteContentLinkDownload(preparedDownload, dependencies);
      if (!contentLinkResult.ok) {
        const errorCode =
          contentLinkResult.details.reason === "content_link_active_tab_unavailable"
            ? ExtensionErrorCode.RESTRICTED_PAGE
            : ExtensionErrorCode.DOWNLOAD_FAILED;

        return toErrorResponse(
          request.requestId,
          createExtensionError(errorCode, {
            details: contentLinkResult.details
          })
        );
      }

      await downloadPreparedImages(preparedDownload.images, dependencies);
      return toSuccessResponse(request.requestId, { downloaded: true, downloadId: -1 });
    }

    let downloadId: number;
    try {
      downloadId = await dependencies.download({
        url: createMarkdownDataUrl(preparedDownload.markdown),
        filename: preparedDownload.markdownPlan.filename,
        saveAs: preparedDownload.markdownPlan.saveAs
      });
    } catch (downloadError) {
      const fallbackResult = await tryExecuteContentLinkDownload(preparedDownload, dependencies);
      if (fallbackResult.ok) {
        await downloadPreparedImages(preparedDownload.images, dependencies);
        return toSuccessResponse(request.requestId, { downloaded: true, downloadId: -1 });
      }

      return toErrorResponse(
        request.requestId,
        createExtensionError(ExtensionErrorCode.DOWNLOAD_FAILED, {
          details: {
            reason: "downloads_api_rejected",
            downloadsErrorName: downloadError instanceof Error ? downloadError.name : typeof downloadError,
            contentLinkFallback: fallbackResult.details
          }
        })
      );
    }

    await downloadPreparedImages(preparedDownload.images, dependencies);

    return toSuccessResponse(request.requestId, { downloaded: true, downloadId });
  } catch (error) {
    return toErrorResponse(
      request.requestId,
      createExtensionError(ExtensionErrorCode.DOWNLOAD_FAILED, {
        details: {
          reason: "downloads_api_rejected",
          errorName: error instanceof Error ? error.name : typeof error
        }
      })
    );
  }
}

/** 下载已准备好的图片，单张失败不阻断主 Markdown。 */
async function downloadPreparedImages(
  images: ReadonlyArray<PreparedImageDownload>,
  dependencies: DownloadMarkdownDependencies
): Promise<void> {
  for (const image of images) {
    try {
      await dependencies.download({
        url: image.dataUrl,
        filename: image.filename,
        saveAs: false
      });
    } catch {
      continue;
    }
  }
}

/** 下载 payload 校验成功。 */
interface ValidDownloadPayload {
  /** 校验成功固定为 true。 */
  ok: true;
  /** Markdown 内容。 */
  markdown: string;
  /** 已清洗标题。 */
  title: string;
  /** 图片下载计划。 */
  imageDownloads: ReadonlyArray<ValidImageDownloadPayload>;
  /** 下载设置。 */
  downloadSettings: ValidDownloadSettingsPayload;
}

/** 下载 payload 校验失败。 */
interface InvalidDownloadPayload {
  /** 校验失败固定为 false。 */
  ok: false;
  /** 已清洗错误细节。 */
  details: Readonly<Record<string, unknown>>;
}

/** 下载 payload 校验结果。 */
type DownloadPayloadValidation = ValidDownloadPayload | InvalidDownloadPayload;

/** 已校验图片下载项。 */
interface ValidImageDownloadPayload {
  /** 原始图片 src。 */
  originalSrc: string;
  /** 可下载图片 URL。 */
  sourceUrl: string;
  /** 图片文件名。 */
  filename: string;
  /** 是否为 Obsidian 图片路径。 */
  isObsidian: boolean;
  /** 图片输出动作。 */
  outputStyle: "download" | "base64";
}

/** 已校验下载设置。 */
interface ValidDownloadSettingsPayload {
  /** 下载模式。 */
  downloadMode: DownloadPlanMode;
  /** 是否弹出保存对话框。 */
  saveAs: boolean;
  /** Markdown 保存目录。 */
  mdClipsFolder: string | null;
  /** 额外禁止字符。 */
  disallowedChars: string;
}

/** 已抓取图片数据。 */
export interface FetchedImageData {
  /** 可直接传给 downloads API 的 data URL。 */
  dataUrl: string;
  /** 图片 MIME。 */
  mimeType: string | null;
}

/** 准备好的图片下载。 */
interface PreparedImageDownload {
  /** 图片 data URL。 */
  dataUrl: string;
  /** 最终下载路径。 */
  filename: string;
}

/** 准备好的 Markdown 和图片下载计划。 */
interface PreparedDownload {
  /** 已按 MIME 替换后的 Markdown。 */
  markdown: string;
  /** Markdown 下载计划。 */
  markdownPlan: ReturnType<typeof planMarkdownDownload>;
  /** 图片下载列表。 */
  images: ReadonlyArray<PreparedImageDownload>;
}

/** contentLink 执行结果。 */
type ContentLinkDownloadResult =
  | {
      /** 执行成功固定为 true。 */
      ok: true;
    }
  | {
      /** 执行失败固定为 false。 */
      ok: false;
      /** 已清洗失败细节。 */
      details: Readonly<Record<string, unknown>>;
    };

/** 从未知请求 payload 清洗 Markdown 下载参数。 */
function readDownloadPayload(request: DownloadMarkdownRequest): DownloadPayloadValidation {
  if (typeof request.markdown !== "string" || request.markdown.trim().length === 0) {
    return {
      ok: false,
      details: {
        reason: "markdown_invalid"
      }
    };
  }

  if (typeof request.title !== "string") {
    return {
      ok: false,
      details: {
        reason: "title_invalid"
      }
    };
  }

  const downloadSettings = readDownloadSettings(request.downloadSettings);
  const sanitizedTitle = sanitizePathSegments(request.title, downloadSettings.disallowedChars);
  const title = sanitizedTitle.replaceAll("/", "").length > 0 ? sanitizedTitle : "MarkdownSave";

  return {
    ok: true,
    markdown: request.markdown,
    title,
    imageDownloads: readImageDownloads(request.imageDownloads),
    downloadSettings
  };
}

/** 从 unknown 读取图片下载计划。 */
function readImageDownloads(value: unknown): ReadonlyArray<ValidImageDownloadPayload> {
  if (!Array.isArray(value)) {
    return [];
  }

  const downloads: ValidImageDownloadPayload[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    if (
      typeof record.originalSrc === "string" &&
      typeof record.sourceUrl === "string" &&
      typeof record.filename === "string" &&
      typeof record.isObsidian === "boolean" &&
      (record.outputStyle === "download" || record.outputStyle === "base64")
    ) {
      downloads.push({
        originalSrc: record.originalSrc,
        sourceUrl: record.sourceUrl,
        filename: record.filename,
        isObsidian: record.isObsidian,
        outputStyle: record.outputStyle
      });
    }
  }

  return downloads;
}

/** 从 unknown 读取下载设置，缺失时使用 M7 默认下载设置。 */
function readDownloadSettings(value: unknown): ValidDownloadSettingsPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return createDefaultDownloadSettings();
  }

  const record = value as Record<string, unknown>;
  const downloadMode =
    record.downloadMode === DownloadPlanMode.CONTENT_LINK ? DownloadPlanMode.CONTENT_LINK : DownloadPlanMode.DOWNLOADS_API;

  return {
    downloadMode,
    saveAs: typeof record.saveAs === "boolean" ? record.saveAs : false,
    mdClipsFolder: typeof record.mdClipsFolder === "string" ? record.mdClipsFolder : null,
    disallowedChars: typeof record.disallowedChars === "string" ? record.disallowedChars : "[]#^"
  };
}

/** 默认下载设置。 */
function createDefaultDownloadSettings(): ValidDownloadSettingsPayload {
  return {
    downloadMode: DownloadPlanMode.DOWNLOADS_API,
    saveAs: false,
    mdClipsFolder: null,
    disallowedChars: "[]#^"
  };
}

/** 在当前页面尝试执行 contentLink 下载。 */
async function tryExecuteContentLinkDownload(
  preparedDownload: PreparedDownload,
  dependencies: DownloadMarkdownDependencies
): Promise<ContentLinkDownloadResult> {
  if (dependencies.readActiveTab === undefined || dependencies.executeContentLinkDownload === undefined) {
    return {
      ok: false,
      details: { reason: "content_link_dependency_unavailable" }
    };
  }

  let activeTab: ActiveTabInfo | null;
  try {
    activeTab = await dependencies.readActiveTab();
  } catch (error) {
    return {
      ok: false,
      details: {
        reason: "content_link_active_tab_read_failed",
        errorName: error instanceof Error ? error.name : typeof error
      }
    };
  }

  if (activeTab === null || activeTab.restricted) {
    return {
      ok: false,
      details: { reason: "content_link_active_tab_unavailable" }
    };
  }

  try {
    await dependencies.executeContentLinkDownload(
      activeTab.id,
      preparedDownload.markdownPlan.filename,
      preparedDownload.markdown
    );
  } catch (error) {
    return {
      ok: false,
      details: {
        reason: "content_link_execution_failed",
        errorName: error instanceof Error ? error.name : typeof error
      }
    };
  }

  return { ok: true };
}

/** 准备 Markdown 和图片下载，单张图片失败不阻断 Markdown。 */
async function prepareMarkdownAndImagesForDownload(
  payload: ValidDownloadPayload,
  dependencies: DownloadMarkdownDependencies
): Promise<PreparedDownload> {
  let markdown = payload.markdown;
  const images: PreparedImageDownload[] = [];

  for (const image of payload.imageDownloads) {
    try {
      if (dependencies.fetchImage === undefined) {
        continue;
      }

      const fetchedImage = await dependencies.fetchImage(image.sourceUrl);
      if (image.outputStyle === "base64") {
        markdown = markdown.replaceAll(image.sourceUrl, fetchedImage.dataUrl);
        continue;
      }

      const finalImageFilename = replaceIdunnoExtensionByMimeType(image.filename, fetchedImage.mimeType);
      markdown = replaceMarkdownImageFilename(markdown, image.filename, finalImageFilename, image.isObsidian);
      const imagePlan = planImageDownload({
        mdClipsFolder: payload.downloadSettings.mdClipsFolder,
        title: payload.title,
        imageFilename: finalImageFilename,
        disallowedChars: payload.downloadSettings.disallowedChars
      });
      images.push({
        dataUrl: fetchedImage.dataUrl,
        filename: imagePlan.filename
      });
    } catch {
      continue;
    }
  }

  return {
    markdown,
    markdownPlan: planMarkdownDownload({
      title: payload.title,
      mdClipsFolder: payload.downloadSettings.mdClipsFolder,
      downloadMode: payload.downloadSettings.downloadMode,
      saveAs: payload.downloadSettings.saveAs,
      disallowedChars: payload.downloadSettings.disallowedChars
    }),
    images
  };
}

/** 构造 data URL。 */
function createMarkdownDataUrl(markdown: string): string {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
}

/** 将 Blob 转为 data URL，避免 MV3 service worker 依赖 object URL。 */
async function createDataUrlFromBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }

  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

/** UTF-8 安全 base64 编码。 */
function base64EncodeUnicode(markdown: string): string {
  return btoa(unescape(encodeURIComponent(markdown)));
}

/** contentLink 降级注入函数，必须自包含。 */
function triggerContentLinkDownload(filename: string, encodedMarkdown: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = `data:text/markdown;base64,${encodedMarkdown}`;
  link.click();
  link.remove();
}
