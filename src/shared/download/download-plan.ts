import { encodeMarkdownImagePath } from "../filename/image-path";
import { generateValidFileName, sanitizePathSegments } from "../filename/sanitize";

/** Markdown 下载模式，保持 MarkDownload 用户可见取值。 */
export const DownloadPlanMode = {
  /** 浏览器 Downloads API 下载。 */
  DOWNLOADS_API: "downloadsApi",
  /** content script link 兜底下载。 */
  CONTENT_LINK: "contentLink"
} as const;

/** Markdown 下载模式联合类型。 */
export type DownloadPlanMode = (typeof DownloadPlanMode)[keyof typeof DownloadPlanMode];

/** Markdown 下载计划输入。 */
export interface MarkdownDownloadPlanInput {
  /** 已完成模板替换的 Markdown 标题。 */
  title: string;
  /** 已完成模板替换的 Markdown 下载目录。 */
  mdClipsFolder: string | null;
  /** Markdown 文件下载模式。 */
  downloadMode: DownloadPlanMode;
  /** downloadsApi 模式是否弹出保存对话框。 */
  saveAs: boolean;
  /** 额外不允许出现在清洗后文件名中的字符。 */
  disallowedChars: string | null;
}

/** Markdown 下载计划输出。 */
export interface MarkdownDownloadPlan {
  /** Markdown 文件下载模式。 */
  downloadMode: DownloadPlanMode;
  /** 传给下载边界层的 Markdown 文件名。 */
  filename: string;
  /** 传给下载边界层的 saveAs；contentLink 不支持另存为，固定为 false。 */
  saveAs: boolean;
}

/** 图片下载计划输入。 */
export interface ImageDownloadPlanInput {
  /** 已完成模板替换的 Markdown 下载目录。 */
  mdClipsFolder: string | null;
  /** 已完成模板替换的 Markdown 标题。 */
  title: string;
  /** Markdown 中已经规划好的图片文件名。 */
  imageFilename: string;
  /** 额外不允许出现在清洗后目录段中的字符。 */
  disallowedChars: string | null;
}

/** 图片下载计划输出。 */
export interface ImageDownloadPlan {
  /** 传给下载边界层的图片文件名。 */
  filename: string;
  /** 图片下载兼容 MarkDownload，固定不弹出保存对话框。 */
  saveAs: false;
}

/** 将空值清洗为下载目录空字符串。 */
function readFolderValue(mdClipsFolder: string | null): string {
  if (mdClipsFolder === null) {
    return "";
  }

  return mdClipsFolder;
}

/** 清洗 mdClipsFolder 每个路径段，并在非空时补齐尾部 /。 */
export function sanitizeDownloadFolder(mdClipsFolder: string | null, disallowedChars: string | null): string {
  const folder = readFolderValue(mdClipsFolder);
  if (folder.length === 0) {
    return "";
  }

  const sanitizedFolder = sanitizePathSegments(folder, disallowedChars);
  if (sanitizedFolder.length === 0 || sanitizedFolder.endsWith("/")) {
    return sanitizedFolder;
  }

  return `${sanitizedFolder}/`;
}

/** 按 MarkDownload 规则规划 Markdown 下载文件名和 saveAs。 */
export function planMarkdownDownload(input: MarkdownDownloadPlanInput): MarkdownDownloadPlan {
  const folder = sanitizeDownloadFolder(input.mdClipsFolder, input.disallowedChars);

  if (input.downloadMode === DownloadPlanMode.DOWNLOADS_API) {
    return {
      downloadMode: input.downloadMode,
      filename: `${folder}${input.title}.md`,
      saveAs: input.saveAs
    };
  }

  return {
    downloadMode: input.downloadMode,
    filename: `${folder}${generateValidFileName(input.title, input.disallowedChars)}.md`,
    saveAs: false
  };
}

/** 截取 Markdown 标题中的目录部分。 */
function readTitleFolder(title: string): string {
  const lastSlashIndex = title.lastIndexOf("/");
  if (lastSlashIndex < 0) {
    return "";
  }

  return title.substring(0, lastSlashIndex + 1);
}

/** 按 MarkDownload 规则规划图片下载文件名。 */
export function planImageDownload(input: ImageDownloadPlanInput): ImageDownloadPlan {
  const folder = sanitizeDownloadFolder(input.mdClipsFolder, input.disallowedChars);
  const titleFolder = readTitleFolder(input.title);

  return {
    filename: `${folder}${titleFolder}${input.imageFilename}`,
    saveAs: false
  };
}

/** 按 MarkDownload 规则替换 Markdown 中的图片文件名。 */
export function replaceMarkdownImageFilename(
  markdown: string,
  oldFilename: string,
  newFilename: string,
  isObsidian: boolean
): string {
  if (oldFilename.length === 0 || oldFilename === newFilename) {
    return markdown;
  }

  if (isObsidian) {
    return markdown.replaceAll(oldFilename, newFilename);
  }

  return markdown.replaceAll(encodeMarkdownImagePath(oldFilename), encodeMarkdownImagePath(newFilename));
}
