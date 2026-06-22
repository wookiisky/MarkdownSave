/** 元素可见性判断只依赖的样式字段。 */
export interface ElementVisibilityStyle {
  /** CSS display 计算值。 */
  display: string;
  /** CSS visibility 计算值。 */
  visibility: string;
}

/** 可注入的 computed style 读取函数，便于单元测试隔离 DOM 环境。 */
export type GetElementVisibilityStyle = (element: Element) => ElementVisibilityStyle;

/** MarkDownload 兼容：这些标签不参与隐藏节点删除。 */
const SKIPPED_TAG_NAMES = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "MATH"]);

/** 从 body 子树中删除 display:none 或 visibility:hidden 的元素。 */
export function removeHiddenNodes(
  body: Element,
  getElementStyle: GetElementVisibilityStyle = readDefaultElementStyle
): void {
  removeHiddenChildren(body, getElementStyle);
}

/** 深度遍历元素子节点，删除隐藏元素并跳过指定标签子树。 */
function removeHiddenChildren(parent: Element, getElementStyle: GetElementVisibilityStyle): void {
  const children = Array.from(parent.children);

  for (const child of children) {
    if (SKIPPED_TAG_NAMES.has(child.tagName)) {
      continue;
    }

    const style = getElementStyle(child);
    const hiddenByDisplay = style.display === "none";
    const hiddenByVisibility = style.visibility === "hidden";

    if (hiddenByDisplay || hiddenByVisibility) {
      child.remove();
      continue;
    }

    removeHiddenChildren(child, getElementStyle);
  }
}

/** 读取浏览器默认 computed style；非浏览器测试环境缺失时按可见处理。 */
function readDefaultElementStyle(element: Element): ElementVisibilityStyle {
  const styleReader = (globalThis as typeof globalThis & { getComputedStyle?: GetElementVisibilityStyle })
    .getComputedStyle;

  if (styleReader === undefined) {
    return {
      display: "",
      visibility: ""
    };
  }

  return styleReader(element);
}
