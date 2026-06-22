import type TurndownService from "turndown";

import { resolveMarkDownloadUriOrOriginal } from "../../url/resolve";
import type { ConversionTurndownOptions } from "../turndown-factory";

/** 图片路径解析函数。 */
export type ImagePathResolver = (src: string, node: HTMLElement) => string;

/** 图片规则依赖的上下文。 */
export interface ImageRuleContext {
  /** 当前文章基准 URL，用于解析相对图片。 */
  baseURI?: string;
  /** 下载图片时把原始 src 映射为 Markdown 路径。 */
  imagePathResolver?: ImagePathResolver;
}

/** 图片规则使用的配置子集。 */
type ImageRuleOptions = Pick<ConversionTurndownOptions, "downloadImages" | "imageRefStyle" | "imageStyle">;

/** 清理 alt/title 属性中的多行空白。 */
function cleanAttribute(attribute: string | null): string {
  return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
}

/** 解析图片 src，无法解析时保持原值。 */
function resolveImageSource(src: string, baseURI: string | undefined): string {
  const trimmedSrc = src.trim();
  if (!baseURI) {
    return trimmedSrc;
  }

  try {
    return resolveMarkDownloadUriOrOriginal(trimmedSrc, baseURI);
  } catch {
    return trimmedSrc;
  }
}

/** 默认图片路径解析器，仅取 URL 路径中的文件名。 */
function defaultImagePathResolver(src: string): string {
  try {
    const url = new URL(src);
    const lastSegment = url.pathname.split("/").filter(Boolean).at(-1);
    return lastSegment ?? "image";
  } catch {
    const srcWithoutQuery = src.split("?")[0] ?? src;
    const lastSegment = srcWithoutQuery.split("/").filter(Boolean).at(-1);
    return lastSegment ?? "image";
  }
}

/** obsidian-nofolder 只保留文件名。 */
function toNoFolderPath(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

/** 解析 Markdown 中要使用的图片路径。 */
function resolveMarkdownImagePath(node: HTMLElement, options: ImageRuleOptions, context: ImageRuleContext): string {
  const rawSrc = node.getAttribute("src");
  if (rawSrc === null) {
    return "";
  }

  const resolvedSrc = resolveImageSource(rawSrc, context.baseURI);
  if (!options.downloadImages || options.imageStyle === "originalSource" || options.imageStyle === "base64") {
    return resolvedSrc;
  }

  const resolver = context.imagePathResolver ?? defaultImagePathResolver;
  const localPath = resolver(resolvedSrc, node);
  if (options.imageStyle === "obsidian-nofolder") {
    return toNoFolderPath(localPath);
  }

  if (options.imageStyle === "obsidian") {
    return localPath;
  }

  return localPath.split("/").map((segment) => encodeURI(segment)).join("/");
}

/** 构造 Markdown 图片引用的 title 部分。 */
function formatTitlePart(node: HTMLElement): string {
  const title = cleanAttribute(node.getAttribute("title"));
  return title ? ` "${title}"` : "";
}

/** 注册图片规则。 */
export function installImageRules(service: TurndownService, options: ImageRuleOptions, context: ImageRuleContext = {}): void {
  const references: string[] = [];
  const imageRule: TurndownService.Rule & { append(ruleOptions: TurndownService.Options): string } = {
    filter(node) {
      const rawSrc = node.getAttribute("src");
      if (
        node.nodeName === "IMG" &&
        rawSrc !== null &&
        options.downloadImages &&
        (options.imageStyle === "originalSource" || options.imageStyle === "base64" || options.imageStyle === "noImage")
      ) {
        context.imagePathResolver?.(resolveImageSource(rawSrc, context.baseURI), node);
      }

      return node.nodeName === "IMG" && node.getAttribute("src") !== null;
    },
    replacement(_content, node) {
      if (options.imageStyle === "noImage") {
        return "";
      }

      const src = resolveMarkdownImagePath(node, options, context);
      if (!src) {
        return "";
      }

      if (options.imageStyle === "obsidian" || options.imageStyle === "obsidian-nofolder") {
        return `![[${src}]]`;
      }

      const alt = cleanAttribute(node.getAttribute("alt"));
      const titlePart = formatTitlePart(node);
      if (options.imageRefStyle === "referenced") {
        const id = references.length + 1;
        references.push(`[fig${id}]: ${src}${titlePart}`);
        return `![${alt}][fig${id}]`;
      }

      return `![${alt}](${src}${titlePart})`;
    },
    append() {
      if (references.length === 0) {
        return "";
      }

      const markdown = `\n\n${references.join("\n")}\n\n`;
      references.splice(0, references.length);
      return markdown;
    }
  };

  service.addRule("conversionImages", imageRule);
}
