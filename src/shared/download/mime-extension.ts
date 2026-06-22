import mime from "mime";

/** MarkDownload 用于未知图片扩展名的临时后缀。 */
const UNKNOWN_IMAGE_EXTENSION = ".idunno";

/** 清洗边界传入的 MIME 字符串。 */
function normalizeMimeType(mimeType: string | null): string | null {
  if (mimeType === null) {
    return null;
  }

  const [type] = mimeType.split(";");
  const normalizedType = type.trim().toLowerCase();
  if (normalizedType.length === 0) {
    return null;
  }

  return normalizedType;
}

/** MIME 已知时把 .idunno 替换为推断扩展名，未知时保留原文件名。 */
export function replaceIdunnoExtensionByMimeType(filename: string, mimeType: string | null): string {
  if (!filename.endsWith(UNKNOWN_IMAGE_EXTENSION)) {
    return filename;
  }

  const normalizedMimeType = normalizeMimeType(mimeType);
  if (normalizedMimeType === null) {
    return filename;
  }

  const extension = mime.getExtension(normalizedMimeType);
  if (extension === null) {
    return filename;
  }

  return `${filename.slice(0, -UNKNOWN_IMAGE_EXTENSION.length)}.${extension}`;
}
