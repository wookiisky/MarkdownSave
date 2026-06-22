import { replaceDatePlaceholders } from "./date";

/** 支持的模板参数化后缀。 */
export const TemplateValueSuffix = {
  /** 转小写。 */
  LOWER: "lower",
  /** 转大写。 */
  UPPER: "upper",
  /** 小写 kebab-case。 */
  KEBAB: "kebab",
  /** 保留大小写 kebab-case。 */
  MIXED_KEBAB: "mixed-kebab",
  /** 小写 snake_case。 */
  SNAKE: "snake",
  /** 保留大小写 snake_case。 */
  MIXED_SNAKE: "mixed_snake",
  /** Obsidian Custom Attachment Location 兼容格式。 */
  OBSIDIAN_CAL: "obsidian-cal",
  /** camelCase。 */
  CAMEL: "camel",
  /** PascalCase。 */
  PASCAL: "pascal"
} as const;

/** 支持的模板参数化后缀联合。 */
export type TemplateValueSuffix = (typeof TemplateValueSuffix)[keyof typeof TemplateValueSuffix];

/** 可替换 article 字段值。 */
export type TemplateArticleValue = string | number | boolean | ReadonlyArray<string> | null | undefined;

/** 模板替换 article 数据。 */
export type TemplateArticle = Readonly<Record<string, TemplateArticleValue>>;

/** 模板替换选项。 */
export interface ReplaceTemplateTextOptions {
  /** 文件名模式下额外移除的字符；缺失时不做文件名清洗。 */
  disallowedChars?: string | null;
  /** 用于测试或确定性输出的当前时间。 */
  now?: Date;
}

/** 通用占位符匹配。 */
const TEMPLATE_PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;

/** keywords 占位符匹配。 */
const KEYWORDS_PLACEHOLDER_PATTERN = /\{keywords(?::([^{}]*))?\}/g;

/** 非法文件名字符。 */
const ILLEGAL_FILENAME_CHARACTER_PATTERN = /[/?<>\\:*|":]/g;

/** 不换行空格。 */
const NON_BREAKING_SPACE_PATTERN = /\u00A0/g;

/** 连续空白。 */
const WHITESPACE_PATTERN = /\s+/g;

/** 已知后缀列表。 */
const TEMPLATE_VALUE_SUFFIXES: ReadonlyArray<TemplateValueSuffix> = Object.values(TemplateValueSuffix);

/** 替换 MarkDownload 兼容模板文本。 */
export function replaceTemplateText(
  template: string,
  article: TemplateArticle,
  options: ReplaceTemplateTextOptions = {}
): string {
  const withDates = replaceDatePlaceholders(template, options.now);
  const withKeywords = replaceKeywordsPlaceholders(withDates, article);

  return withKeywords.replace(TEMPLATE_PLACEHOLDER_PATTERN, (_placeholder, body: string) => {
    const parsedPlaceholder = parseTemplatePlaceholderBody(body);

    if (parsedPlaceholder.field === "content") {
      return "";
    }

    const rawValue = article[parsedPlaceholder.field];
    if (!isScalarTemplateValue(rawValue)) {
      return "";
    }

    const value = normalizeTemplateValue(rawValue, options.disallowedChars);

    if (!parsedPlaceholder.suffix) {
      return value;
    }

    return applyTemplateValueSuffix(value, parsedPlaceholder.suffix);
  });
}

/** 清洗文件名模式下的字段值。 */
export function sanitizeTemplateValueForFilename(value: string, disallowedChars: string | null = null): string {
  let name = value
    .replace(ILLEGAL_FILENAME_CHARACTER_PATTERN, "")
    .replace(NON_BREAKING_SPACE_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();

  if (!disallowedChars) {
    return name;
  }

  for (const char of disallowedChars) {
    name = name.replace(new RegExp(escapeRegExp(char), "g"), "");
  }

  return name;
}

/** 替换 keywords 占位符。 */
function replaceKeywordsPlaceholders(template: string, article: TemplateArticle): string {
  return template.replace(KEYWORDS_PLACEHOLDER_PATTERN, (_placeholder, separator: string | undefined) => {
    const keywords = article.keywords;
    const normalizedKeywords = Array.isArray(keywords) ? keywords : [];
    const normalizedSeparator = separator === undefined ? "," : decodeKeywordSeparator(separator);

    return normalizedKeywords.join(normalizedSeparator);
  });
}

/** 解码 keywords 自定义分隔符。 */
function decodeKeywordSeparator(separator: string): string {
  return separator.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
}

/** 判断字段值是否可作为普通模板文本替换。 */
function isScalarTemplateValue(value: TemplateArticleValue): value is string | number | boolean | null | undefined {
  return !Array.isArray(value);
}

/** 规范化字段值，必要时进行文件名清洗。 */
function normalizeTemplateValue(value: string | number | boolean | null | undefined, disallowedChars?: string | null): string {
  const text = value === null || value === undefined ? "" : String(value);
  return text && disallowedChars !== undefined ? sanitizeTemplateValueForFilename(text, disallowedChars) : text;
}

/** 解析占位符主体，并仅把末尾已知后缀视为参数化指令。 */
function parseTemplatePlaceholderBody(body: string): { field: string; suffix: TemplateValueSuffix | null } {
  for (const suffix of TEMPLATE_VALUE_SUFFIXES) {
    const suffixToken = `:${suffix}`;

    if (body.endsWith(suffixToken)) {
      return {
        field: body.slice(0, -suffixToken.length),
        suffix
      };
    }
  }

  return {
    field: body,
    suffix: null
  };
}

/** 应用模板参数化后缀。 */
function applyTemplateValueSuffix(value: string, suffix: TemplateValueSuffix): string {
  switch (suffix) {
    case TemplateValueSuffix.LOWER:
      return value.toLowerCase();
    case TemplateValueSuffix.UPPER:
      return value.toUpperCase();
    case TemplateValueSuffix.KEBAB:
      return value.replace(/ /g, "-").toLowerCase();
    case TemplateValueSuffix.MIXED_KEBAB:
      return value.replace(/ /g, "-");
    case TemplateValueSuffix.SNAKE:
      return value.replace(/ /g, "_").toLowerCase();
    case TemplateValueSuffix.MIXED_SNAKE:
      return value.replace(/ /g, "_");
    case TemplateValueSuffix.OBSIDIAN_CAL:
      return value.replace(/ /g, "-").replace(/-{2,}/g, "-");
    case TemplateValueSuffix.CAMEL:
      return value.replace(/ ./g, (part) => part.trim().toUpperCase()).replace(/^./, (part) => part.toLowerCase());
    case TemplateValueSuffix.PASCAL:
      return value.replace(/ ./g, (part) => part.trim().toUpperCase()).replace(/^./, (part) => part.toUpperCase());
  }
}

/** 转义正则特殊字符。 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
