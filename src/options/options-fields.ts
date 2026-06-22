import {
  BulletListMarker,
  CodeBlockStyle,
  CodeFence,
  DownloadMode,
  EmDelimiter,
  HeadingStyle,
  HorizontalRuleStyle,
  ImageReferenceStyle,
  ImageStyle,
  LinkReferenceStyle,
  LinkStyle,
  StrongDelimiter
} from "../shared/options/defaults";
import type { MarkdownSaveOptionField, MarkdownSaveOptions } from "../shared/options/schema";

/** options 控件类型。 */
export type OptionControlKind = "text" | "textarea" | "checkbox" | "radio";

/** options 分区 id。 */
export type OptionSectionId = "template" | "general" | "download" | "markdown" | "images";

/** 单选项定义。 */
export interface OptionChoiceDefinition {
  /** 单选值。 */
  value: string;
  /** UI 标签。 */
  label: string;
  /** 示例文本。 */
  example?: string;
}

/** option 控件定义。 */
export interface OptionFieldDefinition {
  /** option 字段名。 */
  field: MarkdownSaveOptionField;
  /** 所属分区。 */
  section: OptionSectionId;
  /** 控件类型。 */
  kind: OptionControlKind;
  /** UI 标签。 */
  label: string;
  /** 辅助说明。 */
  help?: string;
  /** 输入 placeholder。 */
  placeholder?: string;
  /** 单选选项。 */
  choices?: ReadonlyArray<OptionChoiceDefinition>;
}

/** options 分区定义。 */
export interface OptionSectionDefinition {
  /** 分区 id。 */
  id: OptionSectionId;
  /** 分区标题。 */
  title: string;
}

/** MarkDownload options 分区。 */
export const OPTION_SECTION_DEFINITIONS: ReadonlyArray<OptionSectionDefinition> = [
  { id: "template", title: "模板" },
  { id: "general", title: "通用" },
  { id: "download", title: "下载" },
  { id: "markdown", title: "Markdown 转换" },
  { id: "images", title: "图片" }
];

/** MarkDownload 全量 options 控件定义。 */
export const OPTION_FIELD_DEFINITIONS: ReadonlyArray<OptionFieldDefinition> = [
  {
    field: "title",
    section: "template",
    kind: "text",
    label: "标题/文件名模板",
    help: "支持 {pageTitle}、{title}、{date:YYYY-MM-DD} 和 URL/meta 模板变量。"
  },
  {
    field: "frontmatter",
    section: "template",
    kind: "textarea",
    label: "Front-matter 模板",
    help: "启用模板后插入到 Markdown 顶部。"
  },
  {
    field: "backmatter",
    section: "template",
    kind: "textarea",
    label: "Back-matter 模板",
    help: "启用模板后插入到 Markdown 底部。"
  },
  {
    field: "includeTemplate",
    section: "template",
    kind: "checkbox",
    label: "剪藏文本追加 front/back 模板"
  },
  {
    field: "disallowedChars",
    section: "general",
    kind: "text",
    label: "额外移除的文件名字符",
    help: "在浏览器默认禁止字符之外继续移除这些字符。"
  },
  {
    field: "contextMenus",
    section: "general",
    kind: "checkbox",
    label: "启用右键菜单"
  },
  {
    field: "obsidianIntegration",
    section: "general",
    kind: "checkbox",
    label: "启用 Obsidian Advanced URI 集成"
  },
  {
    field: "obsidianVault",
    section: "general",
    kind: "text",
    label: "Obsidian Vault 名称",
    placeholder: "留空时使用 Obsidian 主 vault"
  },
  {
    field: "obsidianFolder",
    section: "general",
    kind: "text",
    label: "Obsidian 目标目录",
    placeholder: "例如 Clippers"
  },
  {
    field: "downloadMode",
    section: "download",
    kind: "radio",
    label: "Markdown 下载模式",
    choices: [
      { value: DownloadMode.DOWNLOADS_API, label: "Downloads API", example: "支持保存目录、图片下载和另存为。" },
      { value: DownloadMode.CONTENT_LINK, label: "Content Link", example: "用于 Downloads API 冲突时的兜底模式。" }
    ]
  },
  {
    field: "saveAs",
    section: "download",
    kind: "checkbox",
    label: "总是显示另存为对话框"
  },
  {
    field: "downloadImages",
    section: "download",
    kind: "checkbox",
    label: "下载图片到 Markdown 文件旁边"
  },
  {
    field: "mdClipsFolder",
    section: "download",
    kind: "text",
    label: "Downloads 内 Markdown 保存目录",
    placeholder: "例如 markdown-clips"
  },
  {
    field: "imagePrefix",
    section: "download",
    kind: "text",
    label: "图片文件名前缀模板"
  },
  {
    field: "headingStyle",
    section: "markdown",
    kind: "radio",
    label: "标题样式",
    choices: [
      { value: HeadingStyle.SETEXT, label: "Setext", example: "All About Dogs\n==============" },
      { value: HeadingStyle.ATX, label: "ATX", example: "# All About Dogs" }
    ]
  },
  {
    field: "hr",
    section: "markdown",
    kind: "radio",
    label: "水平线样式",
    choices: [
      { value: HorizontalRuleStyle.ASTERISKS, label: "***" },
      { value: HorizontalRuleStyle.DASHES, label: "---" },
      { value: HorizontalRuleStyle.UNDERSCORES, label: "___" }
    ]
  },
  {
    field: "bulletListMarker",
    section: "markdown",
    kind: "radio",
    label: "无序列表标记",
    choices: [
      { value: BulletListMarker.ASTERISK, label: "*" },
      { value: BulletListMarker.DASH, label: "-" },
      { value: BulletListMarker.PLUS, label: "+" }
    ]
  },
  {
    field: "codeBlockStyle",
    section: "markdown",
    kind: "radio",
    label: "代码块样式",
    choices: [
      { value: CodeBlockStyle.INDENTED, label: "缩进", example: "    const hello = true;" },
      { value: CodeBlockStyle.FENCED, label: "围栏", example: "```\nconst hello = true;\n```" }
    ]
  },
  {
    field: "fence",
    section: "markdown",
    kind: "radio",
    label: "代码围栏",
    choices: [
      { value: CodeFence.BACKTICKS, label: "```" },
      { value: CodeFence.TILDES, label: "~~~" }
    ]
  },
  {
    field: "emDelimiter",
    section: "markdown",
    kind: "radio",
    label: "斜体分隔符",
    choices: [
      { value: EmDelimiter.UNDERSCORE, label: "_italics_" },
      { value: EmDelimiter.ASTERISK, label: "*italics*" },
      { value: EmDelimiter.DOUBLE_UNDERSCORE, label: "__italics__" }
    ]
  },
  {
    field: "strongDelimiter",
    section: "markdown",
    kind: "radio",
    label: "粗体分隔符",
    choices: [
      { value: StrongDelimiter.DOUBLE_ASTERISK, label: "**bold**" },
      { value: StrongDelimiter.DOUBLE_UNDERSCORE, label: "__bold__" }
    ]
  },
  {
    field: "linkStyle",
    section: "markdown",
    kind: "radio",
    label: "链接样式",
    choices: [
      { value: LinkStyle.INLINED, label: "行内", example: "[Google](https://google.com)" },
      { value: LinkStyle.REFERENCED, label: "引用", example: "[Google]\n\n[Google]: https://google.com" },
      { value: LinkStyle.STRIP_LINKS, label: "去除链接", example: "Google" }
    ]
  },
  {
    field: "linkReferenceStyle",
    section: "markdown",
    kind: "radio",
    label: "链接引用样式",
    choices: [
      { value: LinkReferenceStyle.FULL, label: "完整", example: "[Google][1]\n\n[1]: https://google.com" },
      { value: LinkReferenceStyle.COLLAPSED, label: "折叠", example: "[Google][]\n\n[Google]: https://google.com" },
      { value: LinkReferenceStyle.SHORTCUT, label: "快捷", example: "[Google]\n\n[Google]: https://google.com" }
    ]
  },
  {
    field: "turndownEscape",
    section: "markdown",
    kind: "checkbox",
    label: "转义 Markdown 字符",
    help: "禁用后，HTML 中的 Markdown 特殊字符不会额外加反斜线。"
  },
  {
    field: "imageStyle",
    section: "images",
    kind: "radio",
    label: "图片样式",
    choices: [
      { value: ImageStyle.ORIGINAL_SOURCE, label: "原始地址", example: "![](https://example.com/image.jpg)" },
      { value: ImageStyle.NO_IMAGE, label: "去除图片" },
      { value: ImageStyle.MARKDOWN, label: "Markdown 图片", example: "![](folder/image.jpg)" },
      { value: ImageStyle.BASE64, label: "Base64", example: "![](data:image/png;base64,...)" },
      { value: ImageStyle.OBSIDIAN, label: "Obsidian 嵌入", example: "![[folder/image.jpg]]" },
      { value: ImageStyle.OBSIDIAN_NOFOLDER, label: "Obsidian 嵌入，无目录", example: "![[image.jpg]]" }
    ]
  },
  {
    field: "imageRefStyle",
    section: "images",
    kind: "radio",
    label: "图片引用样式",
    choices: [
      { value: ImageReferenceStyle.INLINED, label: "行内", example: "![](address/of/image.jpg)" },
      { value: ImageReferenceStyle.REFERENCED, label: "引用", example: "![][fig1]\n\n[fig1]: address/of/image.jpg" }
    ]
  }
];

/** 读取字段是否应该显示。 */
export function isOptionFieldVisible(options: MarkdownSaveOptions, field: MarkdownSaveOptionField): boolean {
  if (field === "saveAs" || field === "downloadImages" || field === "mdClipsFolder") {
    return options.downloadMode === DownloadMode.DOWNLOADS_API;
  }

  if (field === "imagePrefix") {
    return options.downloadMode === DownloadMode.DOWNLOADS_API && options.downloadImages;
  }

  if (field === "linkReferenceStyle") {
    return options.linkStyle === LinkStyle.REFERENCED;
  }

  if (field === "fence") {
    return options.codeBlockStyle === CodeBlockStyle.FENCED;
  }

  if (field === "imageRefStyle") {
    return !options.imageStyle.startsWith("obsidian") && options.imageStyle !== ImageStyle.NO_IMAGE;
  }

  return true;
}

/** 读取图片样式选项是否可编辑。 */
export function isImageStyleChoiceDisabled(options: MarkdownSaveOptions, value: string): boolean {
  const requiresImageDownloads =
    value === ImageStyle.MARKDOWN ||
    value === ImageStyle.BASE64 ||
    value === ImageStyle.OBSIDIAN ||
    value === ImageStyle.OBSIDIAN_NOFOLDER;

  return requiresImageDownloads && (options.downloadMode !== DownloadMode.DOWNLOADS_API || !options.downloadImages);
}
