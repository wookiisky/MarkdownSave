import { encodeMarkdownImagePath } from "../shared/filename/image-path";
import {
  ClipCaptureMode,
  type ClipCaptureMode as SharedClipCaptureMode,
  type MarkdownImageDownloadItem
} from "../shared/messages";

/** 页面剪藏模式文案。 */
export const POPUP_CLIP_CAPTURE_MODE_LABEL: Readonly<Record<SharedClipCaptureMode, string>> = {
  selection: "Selected Text",
  page: "Entire Document"
};

/** 判断页面剪藏模式是否已知。 */
export function isPopupClipCaptureMode(value: unknown): value is SharedClipCaptureMode {
  return value === ClipCaptureMode.SELECTION || value === ClipCaptureMode.PAGE;
}

/** 从边界返回值中清洗页面是否存在选区。 */
export function readPageHasSelection(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return value.hasSelection === true;
}

/** 只保留当前 Markdown 仍引用的图片下载计划。 */
export function filterImageDownloadsForMarkdown(
  markdown: string,
  imageDownloads: ReadonlyArray<MarkdownImageDownloadItem>
): ReadonlyArray<MarkdownImageDownloadItem> {
  if (markdown.length === 0 || imageDownloads.length === 0) {
    return [];
  }

  return imageDownloads.filter((image) => isImageDownloadReferencedByMarkdown(markdown, image));
}

/** 判断单张图片计划是否仍被当前 Markdown 引用。 */
function isImageDownloadReferencedByMarkdown(markdown: string, image: MarkdownImageDownloadItem): boolean {
  const encodedFilename = encodeMarkdownImagePath(image.filename);

  return (
    markdown.includes(image.filename) ||
    markdown.includes(encodedFilename) ||
    markdown.includes(image.sourceUrl) ||
    markdown.includes(image.originalSrc)
  );
}

/** 判断值是否为普通对象。 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
