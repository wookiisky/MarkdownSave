import type { ClipCaptureMode, MarkdownConvertCapturePayload } from "../shared/messages";

/** 通过 scripting 在页面隔离环境采集当前页。 */
export async function captureTabWithScripting(
  tabId: number,
  clipMode: ClipCaptureMode
): Promise<MarkdownConvertCapturePayload> {
  const [result] = await chrome.scripting.executeScript<[ClipCaptureMode], MarkdownConvertCapturePayload>({
    target: { tabId },
    func: capturePageInTab,
    args: [clipMode]
  });

  if (result?.result === undefined) {
    throw new Error("content capture returned no result");
  }

  return result.result;
}

/** 在目标页面中执行的自包含采集函数，不能引用外层变量。 */
function capturePageInTab(clipMode: ClipCaptureMode): MarkdownConvertCapturePayload {
  const sourceDocument = document;
  const currentLocation = window.location;
  const selectionHtml = collectSelectionHtml(sourceDocument);
  const hiddenElementPaths = collectHiddenElementPaths(sourceDocument.body);
  const currentDocument = new DOMParser().parseFromString(sourceDocument.documentElement.outerHTML, "text/html");
  const head = currentDocument.head;
  const body = currentDocument.body;

  if (head === null || body === null || currentDocument.documentElement === null) {
    throw new Error("page document is not capturable");
  }

  if (head.querySelector("title") === null) {
    const titleElement = currentDocument.createElement("title");
    titleElement.textContent = currentDocument.title;
    head.appendChild(titleElement);
  }

  const baseElement = head.querySelector("base") ?? currentDocument.createElement("base");
  const currentBaseHref = typeof baseElement.href === "string" ? baseElement.href : baseElement.getAttribute("href") ?? "";
  if (!currentBaseHref.startsWith(currentLocation.origin)) {
    baseElement.setAttribute("href", currentLocation.href);
  }
  if (!baseElement.isConnected) {
    head.appendChild(baseElement);
  }

  removeHiddenNodesInClonedPage(body, hiddenElementPaths);

  return {
    pageHtml: currentDocument.documentElement.outerHTML,
    selectionHtml,
    title: currentDocument.title,
    baseUrl: typeof baseElement.href === "string" ? baseElement.href : baseElement.getAttribute("href") ?? currentLocation.href,
    pageUrl: currentLocation.href,
    hasSelection: selectionHtml !== null,
    clipMode,
    metadata: {
      language: currentDocument.documentElement.getAttribute("lang") || null,
      charset: sourceDocument.characterSet || null,
      canonicalUrl: readLinkHrefInPage("link[rel='canonical']"),
      description: readMetaContentInPage("meta[name='description']"),
      siteName: readMetaContentInPage("meta[property='og:site_name']")
    }
  };

  /** 采集当前页面选区 HTML fragment。 */
  function collectSelectionHtml(currentDocument: Document): string | null {
    const selection = window.getSelection();
    if (selection === null || selection.rangeCount === 0) {
      return null;
    }

    let content = "";
    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index);
      const container = currentDocument.createElement("div");
      container.appendChild(range.cloneContents());
      content += container.innerHTML;
    }

    return content.trim().length > 0 ? content : null;
  }

  /** 读取 link href。 */
  function readLinkHrefInPage(selector: string): string | null {
    const element = head.querySelector(selector);
    if (element === null) {
      return null;
    }

    const hrefElement = element as Element & { href?: unknown };
    return typeof hrefElement.href === "string" && hrefElement.href ? hrefElement.href : element.getAttribute("href");
  }

  /** 读取 meta content。 */
  function readMetaContentInPage(selector: string): string | null {
    const element = head.querySelector(selector);
    return element?.getAttribute("content") || null;
  }

  /** 删除 MarkDownload 兼容的隐藏节点。 */
  function collectHiddenElementPaths(root: HTMLElement): number[][] {
    const protectedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "MATH"]);
    const paths: number[][] = [];

    visitChildren(root, []);

    return paths;

    /** 深度遍历原页面，记录隐藏元素在元素子节点中的路径。 */
    function visitChildren(parent: Element, parentPath: number[]): void {
      const children = Array.from(parent.children);

      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        if (child === undefined || protectedTags.has(child.tagName)) {
          continue;
        }

        const childPath = [...parentPath, index];
        const style = window.getComputedStyle(child);
        if (style.visibility === "hidden" || style.display === "none") {
          paths.push(childPath);
          continue;
        }

        visitChildren(child, childPath);
      }
    }
  }

  /** 在克隆页面中按路径删除隐藏元素，不触碰原页面 DOM。 */
  function removeHiddenNodesInClonedPage(root: HTMLElement, paths: number[][]): void {
    for (const path of [...paths].reverse()) {
      const element = readElementByPath(root, path);
      element?.parentNode?.removeChild(element);
    }
  }

  /** 按元素子节点路径读取克隆元素。 */
  function readElementByPath(root: Element, path: number[]): Element | null {
    let current: Element = root;

    for (const index of path) {
      const next = current.children.item(index);
      if (next === null) {
        return null;
      }

      current = next;
    }

    return current;
  }
}
