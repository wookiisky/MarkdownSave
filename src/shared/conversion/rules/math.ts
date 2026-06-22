import type TurndownService from "turndown";

/** 单个数学节点的结构化信息。 */
export interface MathInfo {
  /** TeX 原文。 */
  tex: string;
  /** 是否为 inline math。 */
  inline: boolean;
}

/** 按节点 id 索引的数学信息。 */
export type MathRegistry = Readonly<Record<string, MathInfo>>;

/** 数学规则依赖的上下文。 */
export interface MathRuleContext {
  /** Readability 前预处理收集的数学信息。 */
  math?: MathRegistry;
}

/** 清理数学源码中的 NBSP。 */
function cleanTex(tex: string): string {
  return tex.trim().replaceAll("\u00a0", "");
}

/** 注册基于 article.math id 命中的数学规则。 */
export function installMathRules(service: TurndownService, context: MathRuleContext = {}): void {
  const math = context.math ?? {};

  service.addRule("conversionMath", {
    filter(node) {
      const id = node.getAttribute("id");
      return id !== null && Object.hasOwn(math, id);
    },
    replacement(_content, node) {
      const id = node.getAttribute("id");
      if (id === null) {
        return "";
      }

      const mathInfo = math[id];
      if (mathInfo === undefined) {
        return "";
      }

      let tex = cleanTex(mathInfo.tex);
      if (mathInfo.inline) {
        tex = tex.replaceAll("\n", " ");
        return `$${tex}$`;
      }

      return `$$\n${tex}\n$$`;
    }
  });
}
