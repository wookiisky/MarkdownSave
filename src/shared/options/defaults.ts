/** 标题转换风格取值。 */
export const HeadingStyle = {
  /** Setext 风格标题。 */
  SETEXT: "setext",
  /** ATX 风格标题。 */
  ATX: "atx"
} as const;

/** 标题转换风格联合。 */
export type HeadingStyle = (typeof HeadingStyle)[keyof typeof HeadingStyle];

/** 水平线样式取值。 */
export const HorizontalRuleStyle = {
  /** 星号水平线。 */
  ASTERISKS: "***",
  /** 短横线水平线。 */
  DASHES: "---",
  /** 下划线水平线。 */
  UNDERSCORES: "___"
} as const;

/** 水平线样式联合。 */
export type HorizontalRuleStyle = (typeof HorizontalRuleStyle)[keyof typeof HorizontalRuleStyle];

/** 无序列表标记取值。 */
export const BulletListMarker = {
  /** 星号列表。 */
  ASTERISK: "*",
  /** 短横线列表。 */
  DASH: "-",
  /** 加号列表。 */
  PLUS: "+"
} as const;

/** 无序列表标记联合。 */
export type BulletListMarker = (typeof BulletListMarker)[keyof typeof BulletListMarker];

/** 代码块样式取值。 */
export const CodeBlockStyle = {
  /** 缩进代码块。 */
  INDENTED: "indented",
  /** 围栏代码块。 */
  FENCED: "fenced"
} as const;

/** 代码块样式联合。 */
export type CodeBlockStyle = (typeof CodeBlockStyle)[keyof typeof CodeBlockStyle];

/** 代码围栏取值。 */
export const CodeFence = {
  /** 反引号围栏。 */
  BACKTICKS: "```",
  /** 波浪线围栏。 */
  TILDES: "~~~"
} as const;

/** 代码围栏联合。 */
export type CodeFence = (typeof CodeFence)[keyof typeof CodeFence];

/** 斜体分隔符取值。 */
export const EmDelimiter = {
  /** 单下划线斜体。 */
  UNDERSCORE: "_",
  /** 单星号斜体。 */
  ASTERISK: "*",
  /** 双下划线斜体。 */
  DOUBLE_UNDERSCORE: "__"
} as const;

/** 斜体分隔符联合。 */
export type EmDelimiter = (typeof EmDelimiter)[keyof typeof EmDelimiter];

/** 粗体分隔符取值。 */
export const StrongDelimiter = {
  /** 双星号粗体。 */
  DOUBLE_ASTERISK: "**",
  /** 双下划线粗体。 */
  DOUBLE_UNDERSCORE: "__"
} as const;

/** 粗体分隔符联合。 */
export type StrongDelimiter = (typeof StrongDelimiter)[keyof typeof StrongDelimiter];

/** 链接输出样式取值。 */
export const LinkStyle = {
  /** 行内链接。 */
  INLINED: "inlined",
  /** 引用链接。 */
  REFERENCED: "referenced",
  /** 去除链接。 */
  STRIP_LINKS: "stripLinks"
} as const;

/** 链接输出样式联合。 */
export type LinkStyle = (typeof LinkStyle)[keyof typeof LinkStyle];

/** 链接引用样式取值。 */
export const LinkReferenceStyle = {
  /** 完整数字引用。 */
  FULL: "full",
  /** 折叠引用。 */
  COLLAPSED: "collapsed",
  /** 快捷引用。 */
  SHORTCUT: "shortcut"
} as const;

/** 链接引用样式联合。 */
export type LinkReferenceStyle = (typeof LinkReferenceStyle)[keyof typeof LinkReferenceStyle];

/** 图片输出样式取值。 */
export const ImageStyle = {
  /** 使用原始图片地址。 */
  ORIGINAL_SOURCE: "originalSource",
  /** 去除图片。 */
  NO_IMAGE: "noImage",
  /** Markdown 图片。 */
  MARKDOWN: "markdown",
  /** Base64 图片。 */
  BASE64: "base64",
  /** Obsidian 图片嵌入。 */
  OBSIDIAN: "obsidian",
  /** 无目录 Obsidian 图片嵌入。 */
  OBSIDIAN_NOFOLDER: "obsidian-nofolder"
} as const;

/** 图片输出样式联合。 */
export type ImageStyle = (typeof ImageStyle)[keyof typeof ImageStyle];

/** 图片引用样式取值。 */
export const ImageReferenceStyle = {
  /** 行内图片引用。 */
  INLINED: "inlined",
  /** 引用式图片引用。 */
  REFERENCED: "referenced"
} as const;

/** 图片引用样式联合。 */
export type ImageReferenceStyle = (typeof ImageReferenceStyle)[keyof typeof ImageReferenceStyle];

/** 下载模式取值。 */
export const DownloadMode = {
  /** 浏览器 Downloads API。 */
  DOWNLOADS_API: "downloadsApi",
  /** content link 兜底下载。 */
  CONTENT_LINK: "contentLink"
} as const;

/** 下载模式联合。 */
export type DownloadMode = (typeof DownloadMode)[keyof typeof DownloadMode];

/** MarkDownload 默认 frontmatter 模板。 */
export const DEFAULT_FRONTMATTER_TEMPLATE =
  "---\ncreated: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})\ntags: [{keywords}]\nsource: {baseURI}\nauthor: {byline}\n---\n\n# {pageTitle}\n\n> ## Excerpt\n> {excerpt}\n\n---";

/** MarkdownSave 默认配置，完全迁移自 MarkDownload default-options.js。 */
export const DEFAULT_MARKDOWN_SAVE_OPTIONS = {
  headingStyle: HeadingStyle.ATX,
  hr: HorizontalRuleStyle.UNDERSCORES,
  bulletListMarker: BulletListMarker.DASH,
  codeBlockStyle: CodeBlockStyle.FENCED,
  fence: CodeFence.BACKTICKS,
  emDelimiter: EmDelimiter.UNDERSCORE,
  strongDelimiter: StrongDelimiter.DOUBLE_ASTERISK,
  linkStyle: LinkStyle.INLINED,
  linkReferenceStyle: LinkReferenceStyle.FULL,
  imageStyle: ImageStyle.MARKDOWN,
  imageRefStyle: ImageReferenceStyle.INLINED,
  frontmatter: DEFAULT_FRONTMATTER_TEMPLATE,
  backmatter: "",
  title: "{pageTitle}",
  includeTemplate: false,
  saveAs: false,
  downloadImages: false,
  imagePrefix: "{pageTitle}/",
  mdClipsFolder: null,
  disallowedChars: "[]#^",
  downloadMode: DownloadMode.DOWNLOADS_API,
  turndownEscape: true,
  contextMenus: true,
  obsidianIntegration: false,
  obsidianVault: "",
  obsidianFolder: ""
} as const;
