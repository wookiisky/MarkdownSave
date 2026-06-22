import TurndownService from "turndown";
// @ts-expect-error turndown-plugin-gfm 没有发布类型，导入后在边界窄化为 Turndown 插件。
import { gfm as importedGfmPlugin } from "turndown-plugin-gfm";

import { installCodeRules } from "./rules/code";
import { type ImageRuleContext, installImageRules } from "./rules/images";
import { type LinkRuleContext, installLinkRules } from "./rules/links";
import { type MathRuleContext, installMathRules } from "./rules/math";

/** conversion 层支持的链接输出样式。 */
export type ConversionLinkStyle = "inlined" | "referenced" | "stripLinks";

/** conversion 层支持的图片输出样式。 */
export type ConversionImageStyle = "originalSource" | "noImage" | "markdown" | "base64" | "obsidian" | "obsidian-nofolder";

/** conversion 层支持的图片引用样式。 */
export type ConversionImageRefStyle = "inlined" | "referenced";

/** conversion 层支持的斜体分隔符，包含 MarkDownload options 允许的双下划线。 */
export type ConversionEmDelimiter = "_" | "*" | "__";

/** Turndown factory 接收的显式配置子集。 */
export interface ConversionTurndownOptions {
  /** 标题输出样式。 */
  headingStyle?: "setext" | "atx";
  /** 分割线输出文本。 */
  hr?: string;
  /** 无序列表 marker。 */
  bulletListMarker?: "-" | "+" | "*";
  /** 代码块输出样式。 */
  codeBlockStyle?: "indented" | "fenced";
  /** fenced code 围栏。 */
  fence?: "```" | "~~~";
  /** em 分隔符。 */
  emDelimiter?: ConversionEmDelimiter;
  /** strong 分隔符。 */
  strongDelimiter?: "__" | "**";
  /** 链接输出样式，stripLinks 为 conversion 扩展。 */
  linkStyle?: ConversionLinkStyle;
  /** referenced link 输出样式。 */
  linkReferenceStyle?: "full" | "collapsed" | "shortcut";
  /** 图片输出样式。 */
  imageStyle?: ConversionImageStyle;
  /** 图片引用输出样式。 */
  imageRefStyle?: ConversionImageRefStyle;
  /** 是否使用本地下载图片路径。 */
  downloadImages?: boolean;
  /** 是否启用 Turndown 默认 Markdown escape。 */
  turndownEscape?: boolean;
}

/** Turndown 规则安装所需上下文。 */
export type ConversionRuleContext = LinkRuleContext & ImageRuleContext & MathRuleContext;

/** MarkDownload conversion 默认配置子集。 */
export const defaultConversionTurndownOptions: Required<ConversionTurndownOptions> = {
  headingStyle: "atx",
  hr: "___",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "_",
  strongDelimiter: "**",
  linkStyle: "inlined",
  linkReferenceStyle: "full",
  imageStyle: "markdown",
  imageRefStyle: "inlined",
  downloadImages: false,
  turndownEscape: true
};

/** 需要按 HTML 原样保留的标签。 */
const keepHtmlTagNames = new Set(["iframe", "sub", "sup", "u", "ins", "del", "small", "big"]);

/** 外部 GFM 包缺少官方类型，这里在边界显式窄化。 */
const gfmPlugin = importedGfmPlugin as TurndownService.Plugin;

/** Turndown 运行时支持更宽的 emDelimiter，类型声明偏窄。 */
type RuntimeTurndownOptions = Omit<TurndownService.Options, "emDelimiter"> & {
  /** 斜体分隔符。 */
  emDelimiter?: ConversionEmDelimiter;
};

/** 将 conversion 扩展配置清洗为 Turndown 构造器支持的配置。 */
function toTurndownOptions(options: Required<ConversionTurndownOptions>): RuntimeTurndownOptions {
  return {
    headingStyle: options.headingStyle,
    hr: options.hr,
    bulletListMarker: options.bulletListMarker,
    codeBlockStyle: options.codeBlockStyle,
    fence: options.fence,
    emDelimiter: options.emDelimiter,
    strongDelimiter: options.strongDelimiter,
    linkStyle: options.linkStyle === "stripLinks" ? "inlined" : options.linkStyle,
    linkReferenceStyle: options.linkReferenceStyle
  };
}

/** 创建已安装 GFM 与 MarkDownload conversion 规则的 TurndownService 实例。 */
export function createTurndownService(
  options: ConversionTurndownOptions = {},
  context: ConversionRuleContext = {}
): TurndownService {
  const mergedOptions: Required<ConversionTurndownOptions> = {
    ...defaultConversionTurndownOptions,
    ...options
  };
  const service = new TurndownService(toTurndownOptions(mergedOptions) as TurndownService.Options);

  if (mergedOptions.turndownEscape === false) {
    service.escape = (text: string): string => text;
  }

  service.use(gfmPlugin);
  service.keep((node) => keepHtmlTagNames.has(node.nodeName.toLowerCase()));
  installImageRules(service, mergedOptions, context);
  installLinkRules(service, mergedOptions, context);
  installMathRules(service, context);
  installCodeRules(service);

  return service;
}
