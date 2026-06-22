/** fake DOM 元素初始化参数。 */
export interface FakeElementOptions {
  /** 元素属性。 */
  attributes?: Readonly<Record<string, string>>;
  /** 元素文本。 */
  textContent?: string;
}

/** fake document 初始化参数。 */
export interface FakeDocumentOptions {
  /** document.title 初始值。 */
  title: string;
  /** document.characterSet 初始值。 */
  characterSet?: string;
  /** html lang 属性。 */
  language?: string;
}

/** 单元测试用最小 DOM 元素，只实现采集逻辑依赖的契约。 */
export class FakeElement {
  /** 大写标签名，兼容真实 Element.tagName。 */
  readonly tagName: string;
  /** 元素文本内容。 */
  textContent: string | null;
  /** 当前元素属性表。 */
  private readonly attributes: Map<string, string>;
  /** 子元素列表。 */
  private readonly childElements: Array<FakeElement | { html: string }> = [];
  /** 父元素引用，用于 remove。 */
  private parentElement: FakeElement | null = null;

  /** 创建 fake 元素。 */
  constructor(tagName: string, options: FakeElementOptions = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map(Object.entries(options.attributes ?? {}));
    this.textContent = options.textContent ?? null;
  }

  /** 兼容 Element.children。 */
  get children(): readonly FakeElement[] {
    return this.childElements.filter((child): child is FakeElement => child instanceof FakeElement);
  }

  /** 兼容 HTMLElement.innerHTML。 */
  get innerHTML(): string {
    const text = this.textContent === null ? "" : escapeHtml(this.textContent);
    const children = this.childElements.map((child) => serializeChild(child)).join("");

    return `${text}${children}`;
  }

  /** 兼容 HTMLBaseElement.href 和 HTMLLinkElement.href。 */
  get href(): string {
    return this.getAttribute("href") ?? "";
  }

  /** 写入 href 属性。 */
  set href(value: string) {
    this.setAttribute("href", value);
  }

  /** 序列化当前元素和子树。 */
  get outerHTML(): string {
    const tagName = this.tagName.toLowerCase();
    const attributes = Array.from(this.attributes.entries())
      .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
      .join("");
    return `<${tagName}${attributes}>${this.innerHTML}</${tagName}>`;
  }

  /** 添加子元素。 */
  appendChild(child: FakeElement): FakeElement;
  appendChild<T extends { html: string }>(child: T): T;
  appendChild(child: FakeElement | { html: string }): FakeElement | { html: string } {
    if (child instanceof FakeElement) {
      child.parentElement = this;
    }

    this.childElements.push(child);
    return child;
  }

  /** 深拷贝当前元素。 */
  clone(): FakeElement {
    const clone = new FakeElement(this.tagName.toLowerCase(), {
      attributes: Object.fromEntries(this.attributes.entries()),
      textContent: this.textContent ?? undefined
    });

    for (const child of this.children) {
      clone.appendChild(child.clone());
    }

    return clone;
  }

  /** 从父元素中删除当前元素。 */
  remove(): void {
    if (this.parentElement === null) {
      return;
    }

    const index = this.parentElement.childElements.indexOf(this);

    if (index >= 0) {
      this.parentElement.childElements.splice(index, 1);
    }

    this.parentElement = null;
  }

  /** 读取属性。 */
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  /** 写入属性。 */
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  /** 按采集测试需要支持简单 tag 和 tag[attr='value'] 选择器。 */
  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) {
        return child;
      }

      const descendant = child.querySelector(selector);

      if (descendant !== null) {
        return descendant;
      }
    }

    return null;
  }

  /** 判断当前元素是否匹配简单选择器。 */
  private matches(selector: string): boolean {
    const attributeSelector = selector.match(/^([a-z]+)\[([a-z]+)='([^']+)'\]$/u);

    if (attributeSelector !== null) {
      const [, tagName, attributeName, attributeValue] = attributeSelector;
      return this.tagName === tagName.toUpperCase() && this.getAttribute(attributeName) === attributeValue;
    }

    return this.tagName === selector.toUpperCase();
  }
}

/** 序列化 fake 子节点，支持测试里的 fragment HTML。 */
function serializeChild(child: FakeElement | { html: string }): string {
  if (child instanceof FakeElement) {
    return child.outerHTML;
  }

  return child.html;
}

/** 单元测试用最小 document。 */
export class FakeDocument {
  /** html 根元素。 */
  readonly documentElement: FakeElement;
  /** head 元素。 */
  readonly head: FakeElement;
  /** body 元素。 */
  readonly body: FakeElement;
  /** document.title。 */
  title: string;
  /** document.characterSet。 */
  readonly characterSet: string;

  /** 创建 fake document。 */
  constructor(options: FakeDocumentOptions) {
    this.title = options.title;
    this.characterSet = options.characterSet ?? "UTF-8";
    this.documentElement = new FakeElement("html");
    this.head = new FakeElement("head");
    this.body = new FakeElement("body");

    if (options.language !== undefined) {
      this.documentElement.setAttribute("lang", options.language);
    }

    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  /** 创建 fake 元素。 */
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  /** 深拷贝当前 fake document。 */
  cloneNode(deep: boolean): FakeDocument {
    const clone = new FakeDocument({
      title: this.title,
      characterSet: this.characterSet,
      language: this.documentElement.getAttribute("lang") ?? undefined
    });

    if (!deep) {
      return clone;
    }

    clone.head.children.slice().forEach((child) => child.remove());
    clone.body.children.slice().forEach((child) => child.remove());

    for (const child of this.head.children) {
      clone.head.appendChild(child.clone());
    }

    for (const child of this.body.children) {
      clone.body.appendChild(child.clone());
    }

    return clone;
  }

  /** Document 节点类型常量。 */
  readonly DOCUMENT_NODE = 9;

  /** 当前节点类型。 */
  readonly nodeType = 9;
}

/** 创建 fake 元素。 */
export function createFakeElement(tagName: string, options: FakeElementOptions = {}): FakeElement {
  return new FakeElement(tagName, options);
}

/** 转成生产代码期望的 Element 类型。 */
export function asElement(element: FakeElement): Element {
  return element as unknown as Element;
}

/** 转成生产代码期望的 Document 类型。 */
export function asDocument(document: FakeDocument): Document {
  return document as unknown as Document;
}

/** 转义 HTML 文本。 */
function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
