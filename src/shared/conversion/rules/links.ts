import type TurndownService from "turndown";

import { resolveMarkDownloadUriOrOriginal } from "../../url/resolve";
import type { ConversionTurndownOptions } from "../turndown-factory";

/** 链接规则依赖的上下文。 */
export interface LinkRuleContext {
  /** 当前文章基准 URL，用于解析相对链接。 */
  baseURI?: string;
}

/** 获取可用于链接规则的 href，无法解析时保持原值。 */
function resolveHref(rawHref: string, baseURI: string | undefined): string {
  const href = rawHref.trim();
  if (!baseURI) {
    return href;
  }

  return resolveMarkDownloadUriOrOriginal(href, baseURI);
}

/** 注册链接规则；stripLinks 时返回 content，其余交回默认链接规则。 */
export function installLinkRules(
  service: TurndownService,
  options: Pick<ConversionTurndownOptions, "linkStyle">,
  context: LinkRuleContext = {}
): void {
  service.addRule("conversionLinks", {
    filter(node) {
      if (node.nodeName !== "A") {
        return false;
      }

      const href = node.getAttribute("href");
      if (href === null) {
        return false;
      }

      node.setAttribute("href", resolveHref(href, context.baseURI));
      return options.linkStyle === "stripLinks";
    },
    replacement(content) {
      return content;
    }
  });
}
