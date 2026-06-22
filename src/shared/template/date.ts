import dayjs from "dayjs";

/** MarkDownload date 占位符格式。 */
const DATE_PLACEHOLDER_PATTERN = /\{date:(.+?)\}/g;

/** 使用 dayjs 按本地时间格式化日期。 */
export function formatLocalDate(format: string, now: Date = new Date()): string {
  return dayjs(now).format(format);
}

/** 替换模板中的 {date:FORMAT} 占位符。 */
export function replaceDatePlaceholders(template: string, now: Date = new Date()): string {
  return template.replace(DATE_PLACEHOLDER_PATTERN, (_placeholder, format: string) => formatLocalDate(format, now));
}
