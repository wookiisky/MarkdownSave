import {
  BulletListMarker,
  CodeBlockStyle,
  CodeFence,
  DEFAULT_MARKDOWN_SAVE_OPTIONS,
  DownloadMode,
  EmDelimiter,
  HeadingStyle,
  HorizontalRuleStyle,
  ImageReferenceStyle,
  ImageStyle,
  LinkReferenceStyle,
  LinkStyle,
  StrongDelimiter,
  type BulletListMarker as BulletListMarkerValue,
  type CodeBlockStyle as CodeBlockStyleValue,
  type CodeFence as CodeFenceValue,
  type DownloadMode as DownloadModeValue,
  type EmDelimiter as EmDelimiterValue,
  type HeadingStyle as HeadingStyleValue,
  type HorizontalRuleStyle as HorizontalRuleStyleValue,
  type ImageReferenceStyle as ImageReferenceStyleValue,
  type ImageStyle as ImageStyleValue,
  type LinkReferenceStyle as LinkReferenceStyleValue,
  type LinkStyle as LinkStyleValue,
  type StrongDelimiter as StrongDelimiterValue
} from "./defaults";

/** MarkdownSave 核心配置，只包含当前版本识别的字段。 */
export interface MarkdownSaveOptions {
  /** 标题转换风格。 */
  headingStyle: HeadingStyleValue;
  /** 水平线样式。 */
  hr: HorizontalRuleStyleValue;
  /** 无序列表标记。 */
  bulletListMarker: BulletListMarkerValue;
  /** 代码块样式。 */
  codeBlockStyle: CodeBlockStyleValue;
  /** 代码围栏字符。 */
  fence: CodeFenceValue;
  /** 斜体分隔符。 */
  emDelimiter: EmDelimiterValue;
  /** 粗体分隔符。 */
  strongDelimiter: StrongDelimiterValue;
  /** 链接输出样式。 */
  linkStyle: LinkStyleValue;
  /** 链接引用样式。 */
  linkReferenceStyle: LinkReferenceStyleValue;
  /** 图片输出样式。 */
  imageStyle: ImageStyleValue;
  /** 图片引用样式。 */
  imageRefStyle: ImageReferenceStyleValue;
  /** 输出开头模板。 */
  frontmatter: string;
  /** 输出结尾模板。 */
  backmatter: string;
  /** 标题或文件名模板。 */
  title: string;
  /** 是否包含 frontmatter/backmatter 模板。 */
  includeTemplate: boolean;
  /** 是否总是显示另存为对话框。 */
  saveAs: boolean;
  /** 是否下载图片。 */
  downloadImages: boolean;
  /** 图片文件名前缀模板。 */
  imagePrefix: string;
  /** Downloads 下的 Markdown 保存目录；缺失时不指定目录。 */
  mdClipsFolder: string | null;
  /** 文件名模板替换时额外移除的字符。 */
  disallowedChars: string;
  /** Markdown 文件下载模式。 */
  downloadMode: DownloadModeValue;
  /** 是否转义 Markdown 字符。 */
  turndownEscape: boolean;
  /** 是否启用右键菜单。 */
  contextMenus: boolean;
  /** 是否启用 Obsidian 集成。 */
  obsidianIntegration: boolean;
  /** Obsidian vault 名称。 */
  obsidianVault: string;
  /** Obsidian 目标目录。 */
  obsidianFolder: string;
}

/** option 校验错误码。 */
export type OptionValidationErrorCode = "options_not_object" | "invalid_type" | "invalid_enum";

/** option 字段名联合。 */
export type MarkdownSaveOptionField = keyof MarkdownSaveOptions;

/** option 校验错误。 */
export interface OptionValidationError {
  /** 出错字段；整体输入非法时为 null。 */
  field: MarkdownSaveOptionField | null;
  /** 稳定错误码。 */
  code: OptionValidationErrorCode;
  /** 面向日志和 UI 的中文错误说明。 */
  message: string;
  /** 已清洗但未采纳的原始值。 */
  value?: unknown;
  /** 类型错误时的期望类型。 */
  expectedType?: "string" | "boolean" | "string_or_null";
  /** 枚举错误时的允许值。 */
  allowedValues?: ReadonlyArray<string>;
}

/** option 校验成功。 */
export interface ValidOptionsResult {
  /** 校验成功固定为 true。 */
  ok: true;
  /** 已补齐默认值、且只包含已知字段的配置。 */
  options: MarkdownSaveOptions;
  /** 被隔离的未知未来字段。 */
  ignoredFields: ReadonlyArray<string>;
}

/** option 校验失败。 */
export interface InvalidOptionsResult {
  /** 校验失败固定为 false。 */
  ok: false;
  /** 结构化校验错误。 */
  errors: ReadonlyArray<OptionValidationError>;
  /** 被隔离的未知未来字段。 */
  ignoredFields: ReadonlyArray<string>;
}

/** option 校验结果。 */
export type OptionsValidationResult = ValidOptionsResult | InvalidOptionsResult;

/** 字符串 option 字段。 */
type StringOptionField =
  | "frontmatter"
  | "backmatter"
  | "title"
  | "imagePrefix"
  | "disallowedChars"
  | "obsidianVault"
  | "obsidianFolder";

/** 布尔 option 字段。 */
type BooleanOptionField =
  | "includeTemplate"
  | "saveAs"
  | "downloadImages"
  | "turndownEscape"
  | "contextMenus"
  | "obsidianIntegration";

/** 可空字符串 option 字段。 */
type NullableStringOptionField = "mdClipsFolder";

/** 枚举 option 规格。 */
interface EnumOptionSpec {
  /** 字段名。 */
  field: MarkdownSaveOptionField;
  /** 允许值。 */
  allowedValues: ReadonlyArray<string>;
}

/** 已知 option 字段顺序，错误输出按此顺序稳定排序。 */
const OPTION_FIELD_ORDER: ReadonlyArray<MarkdownSaveOptionField> = [
  "headingStyle",
  "hr",
  "bulletListMarker",
  "codeBlockStyle",
  "fence",
  "emDelimiter",
  "strongDelimiter",
  "linkStyle",
  "linkReferenceStyle",
  "imageStyle",
  "imageRefStyle",
  "frontmatter",
  "backmatter",
  "title",
  "includeTemplate",
  "saveAs",
  "downloadImages",
  "imagePrefix",
  "mdClipsFolder",
  "disallowedChars",
  "downloadMode",
  "turndownEscape",
  "contextMenus",
  "obsidianIntegration",
  "obsidianVault",
  "obsidianFolder"
];

/** 字符串字段集合。 */
const STRING_OPTION_FIELDS: ReadonlyArray<StringOptionField> = [
  "frontmatter",
  "backmatter",
  "title",
  "imagePrefix",
  "disallowedChars",
  "obsidianVault",
  "obsidianFolder"
];

/** 布尔字段集合。 */
const BOOLEAN_OPTION_FIELDS: ReadonlyArray<BooleanOptionField> = [
  "includeTemplate",
  "saveAs",
  "downloadImages",
  "turndownEscape",
  "contextMenus",
  "obsidianIntegration"
];

/** 可空字符串字段集合。 */
const NULLABLE_STRING_OPTION_FIELDS: ReadonlyArray<NullableStringOptionField> = ["mdClipsFolder"];

/** 枚举字段集合。 */
const ENUM_OPTION_SPECS: ReadonlyArray<EnumOptionSpec> = [
  { field: "headingStyle", allowedValues: Object.values(HeadingStyle) },
  { field: "hr", allowedValues: Object.values(HorizontalRuleStyle) },
  { field: "bulletListMarker", allowedValues: Object.values(BulletListMarker) },
  { field: "codeBlockStyle", allowedValues: Object.values(CodeBlockStyle) },
  { field: "fence", allowedValues: Object.values(CodeFence) },
  { field: "emDelimiter", allowedValues: Object.values(EmDelimiter) },
  { field: "strongDelimiter", allowedValues: Object.values(StrongDelimiter) },
  { field: "linkStyle", allowedValues: Object.values(LinkStyle) },
  { field: "linkReferenceStyle", allowedValues: Object.values(LinkReferenceStyle) },
  { field: "imageStyle", allowedValues: Object.values(ImageStyle) },
  { field: "imageRefStyle", allowedValues: Object.values(ImageReferenceStyle) },
  { field: "downloadMode", allowedValues: Object.values(DownloadMode) }
];

/** 已知 option 字段集合。 */
const OPTION_FIELD_SET = new Set<MarkdownSaveOptionField>(OPTION_FIELD_ORDER);

/** 校验未知 JSON 并补齐默认 option。 */
export function validateMarkdownSaveOptionsFromUnknown(input: unknown): OptionsValidationResult {
  return coerceMarkdownSaveOptionsFromUnknown(input);
}

/** 将未知 JSON 清洗为核心 option；失败时返回结构化错误。 */
export function coerceMarkdownSaveOptionsFromUnknown(input: unknown): OptionsValidationResult {
  if (!isPlainOptionsRecord(input)) {
    return {
      ok: false,
      errors: [
        {
          field: null,
          code: "options_not_object",
          message: "options 必须是普通对象"
        }
      ],
      ignoredFields: []
    };
  }

  const ignoredFields = collectIgnoredFields(input);
  const errors = collectValidationErrors(input);

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      ignoredFields
    };
  }

  return {
    ok: true,
    options: buildMarkdownSaveOptions(input),
    ignoredFields
  };
}

/** 判断值是否为普通对象。 */
export function isPlainOptionsRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

/** 收集未知未来字段。 */
function collectIgnoredFields(record: Record<string, unknown>): ReadonlyArray<string> {
  return Object.keys(record).filter((field) => !OPTION_FIELD_SET.has(field as MarkdownSaveOptionField));
}

/** 收集所有字段级校验错误。 */
function collectValidationErrors(record: Record<string, unknown>): ReadonlyArray<OptionValidationError> {
  const errors: OptionValidationError[] = [];

  for (const field of OPTION_FIELD_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(record, field)) {
      continue;
    }

    const value = record[field];
    const enumSpec = ENUM_OPTION_SPECS.find((spec) => spec.field === field);

    if (enumSpec) {
      collectEnumValidationError(errors, enumSpec, value);
      continue;
    }

    if (STRING_OPTION_FIELDS.includes(field as StringOptionField)) {
      collectStringValidationError(errors, field, value);
      continue;
    }

    if (BOOLEAN_OPTION_FIELDS.includes(field as BooleanOptionField)) {
      collectBooleanValidationError(errors, field, value);
      continue;
    }

    if (NULLABLE_STRING_OPTION_FIELDS.includes(field as NullableStringOptionField)) {
      collectNullableStringValidationError(errors, field, value);
    }
  }

  return errors;
}

/** 收集枚举字段错误。 */
function collectEnumValidationError(errors: OptionValidationError[], spec: EnumOptionSpec, value: unknown): void {
  if (typeof value === "string" && spec.allowedValues.includes(value)) {
    return;
  }

  errors.push({
    field: spec.field,
    code: "invalid_enum",
    message: `${spec.field} 不在允许范围内`,
    value,
    allowedValues: spec.allowedValues
  });
}

/** 收集字符串字段错误。 */
function collectStringValidationError(
  errors: OptionValidationError[],
  field: MarkdownSaveOptionField,
  value: unknown
): void {
  if (typeof value === "string") {
    return;
  }

  errors.push({
    field,
    code: "invalid_type",
    message: `${field} 类型必须是 string`,
    value,
    expectedType: "string"
  });
}

/** 收集布尔字段错误。 */
function collectBooleanValidationError(
  errors: OptionValidationError[],
  field: MarkdownSaveOptionField,
  value: unknown
): void {
  if (typeof value === "boolean") {
    return;
  }

  errors.push({
    field,
    code: "invalid_type",
    message: `${field} 类型必须是 boolean`,
    value,
    expectedType: "boolean"
  });
}

/** 收集可空字符串字段错误。 */
function collectNullableStringValidationError(
  errors: OptionValidationError[],
  field: MarkdownSaveOptionField,
  value: unknown
): void {
  if (typeof value === "string" || value === null) {
    return;
  }

  errors.push({
    field,
    code: "invalid_type",
    message: `${field} 类型必须是 string 或 null`,
    value,
    expectedType: "string_or_null"
  });
}

/** 构建只包含已知字段的配置对象。 */
function buildMarkdownSaveOptions(record: Record<string, unknown>): MarkdownSaveOptions {
  return {
    headingStyle: readEnumOption(record, "headingStyle", DEFAULT_MARKDOWN_SAVE_OPTIONS.headingStyle),
    hr: readEnumOption(record, "hr", DEFAULT_MARKDOWN_SAVE_OPTIONS.hr),
    bulletListMarker: readEnumOption(record, "bulletListMarker", DEFAULT_MARKDOWN_SAVE_OPTIONS.bulletListMarker),
    codeBlockStyle: readEnumOption(record, "codeBlockStyle", DEFAULT_MARKDOWN_SAVE_OPTIONS.codeBlockStyle),
    fence: readEnumOption(record, "fence", DEFAULT_MARKDOWN_SAVE_OPTIONS.fence),
    emDelimiter: readEnumOption(record, "emDelimiter", DEFAULT_MARKDOWN_SAVE_OPTIONS.emDelimiter),
    strongDelimiter: readEnumOption(record, "strongDelimiter", DEFAULT_MARKDOWN_SAVE_OPTIONS.strongDelimiter),
    linkStyle: readEnumOption(record, "linkStyle", DEFAULT_MARKDOWN_SAVE_OPTIONS.linkStyle),
    linkReferenceStyle: readEnumOption(record, "linkReferenceStyle", DEFAULT_MARKDOWN_SAVE_OPTIONS.linkReferenceStyle),
    imageStyle: readEnumOption(record, "imageStyle", DEFAULT_MARKDOWN_SAVE_OPTIONS.imageStyle),
    imageRefStyle: readEnumOption(record, "imageRefStyle", DEFAULT_MARKDOWN_SAVE_OPTIONS.imageRefStyle),
    frontmatter: readStringOption(record, "frontmatter", DEFAULT_MARKDOWN_SAVE_OPTIONS.frontmatter),
    backmatter: readStringOption(record, "backmatter", DEFAULT_MARKDOWN_SAVE_OPTIONS.backmatter),
    title: readStringOption(record, "title", DEFAULT_MARKDOWN_SAVE_OPTIONS.title),
    includeTemplate: readBooleanOption(record, "includeTemplate", DEFAULT_MARKDOWN_SAVE_OPTIONS.includeTemplate),
    saveAs: readBooleanOption(record, "saveAs", DEFAULT_MARKDOWN_SAVE_OPTIONS.saveAs),
    downloadImages: readBooleanOption(record, "downloadImages", DEFAULT_MARKDOWN_SAVE_OPTIONS.downloadImages),
    imagePrefix: readStringOption(record, "imagePrefix", DEFAULT_MARKDOWN_SAVE_OPTIONS.imagePrefix),
    mdClipsFolder: readNullableStringOption(record, "mdClipsFolder", DEFAULT_MARKDOWN_SAVE_OPTIONS.mdClipsFolder),
    disallowedChars: readStringOption(record, "disallowedChars", DEFAULT_MARKDOWN_SAVE_OPTIONS.disallowedChars),
    downloadMode: readEnumOption(record, "downloadMode", DEFAULT_MARKDOWN_SAVE_OPTIONS.downloadMode),
    turndownEscape: readBooleanOption(record, "turndownEscape", DEFAULT_MARKDOWN_SAVE_OPTIONS.turndownEscape),
    contextMenus: readBooleanOption(record, "contextMenus", DEFAULT_MARKDOWN_SAVE_OPTIONS.contextMenus),
    obsidianIntegration: readBooleanOption(
      record,
      "obsidianIntegration",
      DEFAULT_MARKDOWN_SAVE_OPTIONS.obsidianIntegration
    ),
    obsidianVault: readStringOption(record, "obsidianVault", DEFAULT_MARKDOWN_SAVE_OPTIONS.obsidianVault),
    obsidianFolder: readStringOption(record, "obsidianFolder", DEFAULT_MARKDOWN_SAVE_OPTIONS.obsidianFolder)
  };
}

/** 读取已通过校验的枚举字段。 */
function readEnumOption<Value extends string>(
  record: Record<string, unknown>,
  field: MarkdownSaveOptionField,
  defaultValue: Value
): Value {
  const value = record[field];
  return typeof value === "string" ? (value as Value) : defaultValue;
}

/** 读取已通过校验的字符串字段。 */
function readStringOption(
  record: Record<string, unknown>,
  field: StringOptionField,
  defaultValue: string
): string {
  const value = record[field];
  return typeof value === "string" ? value : defaultValue;
}

/** 读取已通过校验的布尔字段。 */
function readBooleanOption(
  record: Record<string, unknown>,
  field: BooleanOptionField,
  defaultValue: boolean
): boolean {
  const value = record[field];
  return typeof value === "boolean" ? value : defaultValue;
}

/** 读取已通过校验的可空字符串字段。 */
function readNullableStringOption(
  record: Record<string, unknown>,
  field: NullableStringOptionField,
  defaultValue: string | null
): string | null {
  const value = record[field];
  return typeof value === "string" || value === null ? value : defaultValue;
}
