/** MarkDownload 固定移除的文件名非法字符。 */
const fixedIllegalFileNameCharacters = /[/?<>\\:*|":]/g;

/** 需要在正则字面含义下转义的字符。 */
const regularExpressionSpecialCharacters = new Set(["[", "\\", "^", "$", ".", "|", "?", "*", "+", "(", ")"]);

/** 将单字符转为正则安全片段。 */
function escapeRegExpCharacter(character: string): string {
  if (regularExpressionSpecialCharacters.has(character)) {
    return `\\${character}`;
  }

  return character;
}

/** 生成兼容 MarkDownload 的安全文件名。 */
export function generateValidFileName(title: string, disallowedChars: string | null = null): string {
  if (title.length === 0) {
    return title;
  }

  let name = title
    .replace(fixedIllegalFileNameCharacters, "")
    .replace(new RegExp("\u00A0", "g"), " ")
    .replace(/\s+/g, " ")
    .trim();

  if (disallowedChars === null || disallowedChars.length === 0) {
    return name;
  }

  for (const character of disallowedChars) {
    name = name.replace(new RegExp(escapeRegExpCharacter(character), "g"), "");
  }

  return name;
}

/** 按 / 分段清洗模板输出路径，并保留原始路径分隔符。 */
export function sanitizePathSegments(path: string, disallowedChars: string | null = null): string {
  return path
    .split("/")
    .map((segment) => generateValidFileName(segment, disallowedChars))
    .join("/");
}
