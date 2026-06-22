import { generateValidFileName } from "./sanitize";

/** 图片样式，保持 MarkDownload 用户可见取值。 */
export const ImageStyle = {
  /** 使用原始图片地址。 */
  ORIGINAL_SOURCE: "originalSource",
  /** 移除 Markdown 图片。 */
  NO_IMAGE: "noImage",
  /** 写入普通 Markdown 本地图片路径。 */
  MARKDOWN: "markdown",
  /** 由下载边界读取为 base64 data URI。 */
  BASE64: "base64",
  /** 写入 Obsidian internal embed，保留文件夹。 */
  OBSIDIAN: "obsidian",
  /** 写入 Obsidian internal embed，只保留 basename。 */
  OBSIDIAN_NOFOLDER: "obsidian-nofolder"
} as const;

/** 图片样式联合类型。 */
export type ImageStyle = (typeof ImageStyle)[keyof typeof ImageStyle];

/** Markdown 图片渲染动作。 */
export const MarkdownImageReferenceKind = {
  /** 生成普通 Markdown 图片引用。 */
  MARKDOWN: "markdown",
  /** 生成 Obsidian internal embed。 */
  OBSIDIAN: "obsidian",
  /** 移除图片。 */
  STRIP: "strip"
} as const;

/** Markdown 图片渲染动作联合类型。 */
export type MarkdownImageReferenceKind =
  (typeof MarkdownImageReferenceKind)[keyof typeof MarkdownImageReferenceKind];

/** 图片路径规划输入。 */
export interface ImagePathPlanningInput {
  /** 原始图片 src；调用方负责在需要时先做 URL 兼容解析。 */
  src: string;
  /** 已格式化标题；仅 prependFilePath 为 true 时参与前缀拼接。 */
  title: string;
  /** 已完成模板替换和分段清洗的图片前缀。 */
  imagePrefix: string;
  /** 额外不允许出现在图片文件名中的字符。 */
  disallowedChars: string | null;
  /** 图片输出样式。 */
  imageStyle: ImageStyle;
  /** 已占用的下载文件名，用于 MarkDownload 兼容冲突编号。 */
  existingFilenames: readonly string[];
  /** 是否按旧 getImageFilename 默认行为把 title 路径拼到 imagePrefix 前。 */
  prependFilePath: boolean;
}

/** 图片路径规划结果。 */
export interface ImagePathPlan {
  /** 图片输出样式。 */
  imageStyle: ImageStyle;
  /** 原始图片 src。 */
  originalSrc: string;
  /** 下载阶段使用的文件名；不需要下载时为 null。 */
  downloadFilename: string | null;
  /** Markdown/Obsidian 中写入的图片路径；strip 时为 null。 */
  markdownPath: string | null;
  /** Markdown 图片渲染动作。 */
  referenceKind: MarkdownImageReferenceKind;
}

/** 从 src 中按 MarkDownload 规则截取 basename。 */
function readSourceBasename(src: string): string {
  const slashPosition = src.lastIndexOf("/");
  const queryPosition = src.indexOf("?");
  const basenameEnd = queryPosition > 0 ? queryPosition : src.length;

  return src.substring(slashPosition + 1, basenameEnd);
}

/** data URI 图片按 MarkDownload 规则转为 image.<type>。 */
function normalizeDataUriBasename(basename: string): string {
  if (!basename.includes(";base64,")) {
    return basename;
  }

  return `image.${basename.substring(0, basename.indexOf(";"))}`;
}

/** 无扩展名图片追加 .idunno，等待边界层按 MIME 修正。 */
function ensureImageExtension(filename: string): string {
  const extension = filename.substring(filename.lastIndexOf("."));
  if (extension === filename) {
    return `${filename}.idunno`;
  }

  return filename;
}

/** 按 MarkDownload 旧规则计算图片前缀。 */
function buildImagePrefix(title: string, imagePrefix: string, prependFilePath: boolean): string {
  if (!prependFilePath) {
    return imagePrefix;
  }

  if (title.includes("/")) {
    return title.substring(0, title.lastIndexOf("/") + 1) + imagePrefix;
  }

  return title + (imagePrefix.startsWith("/") ? "" : "/") + imagePrefix;
}

/** 对重复下载文件名追加或递增编号。 */
function appendConflictNumber(filename: string, index: number): string {
  const parts = filename.split(".");
  if (index === 1) {
    parts.splice(parts.length - 1, 0, String(index));
  } else {
    parts.splice(parts.length - 2, 1, String(index));
  }

  return parts.join(".");
}

/** 生成未去重的下载文件名。 */
export function buildMarkDownloadImageFilename(
  src: string,
  title: string,
  imagePrefix: string,
  disallowedChars: string | null = null,
  prependFilePath = true
): string {
  const sourceBasename = readSourceBasename(src);
  const dataUriBasename = normalizeDataUriBasename(sourceBasename);
  const filenameWithExtension = ensureImageExtension(dataUriBasename);
  const filename = generateValidFileName(filenameWithExtension, disallowedChars);
  const prefix = buildImagePrefix(title, imagePrefix, prependFilePath);

  return prefix + filename;
}

/** 按 MarkDownload 规则避让已占用下载文件名。 */
export function dedupeMarkDownloadImageFilename(filename: string, existingFilenames: readonly string[]): string {
  let uniqueFilename = filename;
  let conflictIndex = 1;

  while (existingFilenames.includes(uniqueFilename)) {
    uniqueFilename = appendConflictNumber(uniqueFilename, conflictIndex);
    conflictIndex += 1;
  }

  return uniqueFilename;
}

/** 非 Obsidian Markdown 图片路径逐段 encodeURI。 */
export function encodeMarkdownImagePath(filename: string): string {
  return filename
    .split("/")
    .map((segment) => encodeURI(segment))
    .join("/");
}

/** 规划图片下载文件名和 Markdown/Obsidian 内部引用路径。 */
export function planImagePath(input: ImagePathPlanningInput): ImagePathPlan {
  if (input.imageStyle === ImageStyle.NO_IMAGE) {
    return {
      imageStyle: input.imageStyle,
      originalSrc: input.src,
      downloadFilename: null,
      markdownPath: null,
      referenceKind: MarkdownImageReferenceKind.STRIP
    };
  }

  if (input.imageStyle === ImageStyle.ORIGINAL_SOURCE) {
    return {
      imageStyle: input.imageStyle,
      originalSrc: input.src,
      downloadFilename: null,
      markdownPath: input.src,
      referenceKind: MarkdownImageReferenceKind.MARKDOWN
    };
  }

  const candidateFilename = buildMarkDownloadImageFilename(
    input.src,
    input.title,
    input.imagePrefix,
    input.disallowedChars,
    input.prependFilePath
  );
  const downloadFilename = dedupeMarkDownloadImageFilename(candidateFilename, input.existingFilenames);

  if (input.imageStyle === ImageStyle.BASE64) {
    return {
      imageStyle: input.imageStyle,
      originalSrc: input.src,
      downloadFilename,
      markdownPath: input.src,
      referenceKind: MarkdownImageReferenceKind.MARKDOWN
    };
  }

  if (input.imageStyle === ImageStyle.OBSIDIAN_NOFOLDER) {
    return {
      imageStyle: input.imageStyle,
      originalSrc: input.src,
      downloadFilename,
      markdownPath: downloadFilename.substring(downloadFilename.lastIndexOf("/") + 1),
      referenceKind: MarkdownImageReferenceKind.OBSIDIAN
    };
  }

  if (input.imageStyle === ImageStyle.OBSIDIAN) {
    return {
      imageStyle: input.imageStyle,
      originalSrc: input.src,
      downloadFilename,
      markdownPath: downloadFilename,
      referenceKind: MarkdownImageReferenceKind.OBSIDIAN
    };
  }

  return {
    imageStyle: input.imageStyle,
    originalSrc: input.src,
    downloadFilename,
    markdownPath: encodeMarkdownImagePath(downloadFilename),
    referenceKind: MarkdownImageReferenceKind.MARKDOWN
  };
}
