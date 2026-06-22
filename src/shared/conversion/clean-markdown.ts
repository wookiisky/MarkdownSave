/** CodeMirror 会标红的不可见字符范围。 */
const invisibleCharacterPattern =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g;

/** 清理旧 MarkDownload 输出阶段移除的不可见字符。 */
export function cleanInvisibleCharacters(markdown: string): string {
  return markdown.replace(invisibleCharacterPattern, "");
}
