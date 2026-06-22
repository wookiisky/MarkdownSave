import type TurndownService from "turndown";

/** 可参与 fenced code 输出的 Turndown 配置。 */
interface FencedCodeOptions {
  /** 代码块样式。 */
  codeBlockStyle?: "indented" | "fenced";
  /** 代码围栏字符。 */
  fence?: "```" | "~~~";
}

/** 提取 code-lang-* 标记中的语言。 */
function readCodeLanguage(node: HTMLElement): string {
  const id = node.getAttribute("id") ?? "";
  const match = id.match(/^code-lang-(.+)$/);
  return match?.[1] ?? "";
}

/** 将 Readability 前置保护的 br-keep 还原为换行文本。 */
function readCodeText(node: HTMLElement): string {
  const html = node.innerHTML.replaceAll("<br-keep></br-keep>", "\n").replaceAll("<br-keep>", "\n");
  const ownerDocument = node.ownerDocument;
  const container = ownerDocument.createElement("div");
  container.innerHTML = html.replaceAll("<br>", "\n").replaceAll("<br/>", "\n").replaceAll("<br />", "\n");
  return container.textContent ?? "";
}

/** 重复单字符。 */
function repeatCharacter(character: string, count: number): string {
  return character.repeat(count);
}

/** 按正文行首 fence 扫描结果扩展围栏长度。 */
function resolveFence(code: string, fenceOption: string | undefined): string {
  const fenceCharacter = (fenceOption ?? "```").charAt(0);
  const fenceInCodePattern = new RegExp(`^\\${fenceCharacter}{3,}`, "gm");
  let fenceSize = 3;
  let match = fenceInCodePattern.exec(code);

  while (match !== null) {
    if (match[0].length >= fenceSize) {
      fenceSize = match[0].length + 1;
    }
    match = fenceInCodePattern.exec(code);
  }

  return repeatCharacter(fenceCharacter, fenceSize);
}

/** 将节点转换为 fenced code block。 */
function convertToFencedCodeBlock(node: HTMLElement, options: FencedCodeOptions): string {
  const language = readCodeLanguage(node);
  const code = readCodeText(node);
  const fence = resolveFence(code, options.fence);
  const codeWithoutTrailingNewline = code.replace(/\n$/, "");

  return `\n\n${fence}${language}\n${codeWithoutTrailingNewline}\n${fence}\n\n`;
}

/** 判断节点是否是不含图片的裸 PRE。 */
function isBarePreNode(node: HTMLElement): boolean {
  const firstChild = node.firstChild;
  const imageCount = node.getElementsByTagName("img").length;
  return node.nodeName === "PRE" && (!firstChild || firstChild.nodeName !== "CODE") && imageCount === 0;
}

/** 注册 PRE>CODE 与裸 PRE 的 fenced code 规则。 */
export function installCodeRules(service: TurndownService): void {
  service.addRule("conversionFencedCodeBlock", {
    filter(node, options) {
      return (
        options.codeBlockStyle === "fenced" &&
        node.nodeName === "PRE" &&
        node.firstChild !== null &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement(_content, node, options) {
      return convertToFencedCodeBlock(node.firstChild as HTMLElement, options);
    }
  });

  service.addRule("conversionBarePre", {
    filter(node) {
      return isBarePreNode(node);
    },
    replacement(_content, node, options) {
      return convertToFencedCodeBlock(node, options);
    }
  });
}
