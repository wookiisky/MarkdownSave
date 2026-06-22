import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARKDOWN_CONVERT_OPTIONS,
  runMarkdownConvert,
  type MarkdownConvertDomParser,
  type MarkdownConvertRunnerDependencies
} from "../../../src/offscreen/convert-runner";
import type { ReadabilityArticle, ReadabilityResult } from "../../../src/shared/conversion/readability";
import { toReadabilityFailure } from "../../../src/shared/conversion/readability";
import type { ClipCaptureMode, MarkdownConvertCapturePayload } from "../../../src/shared/messages";

/** 构造测试用 content capture。 */
function createCapture(
  pageHtml: string,
  baseUrl = "https://example.com/docs/page",
  clipMode: ClipCaptureMode = "page"
): MarkdownConvertCapturePayload {
  return {
    pageHtml,
    selectionHtml: null,
    title: "页面标题",
    baseUrl,
    pageUrl: baseUrl,
    hasSelection: false,
    clipMode,
    metadata: {
      language: "zh-CN",
      charset: "utf-8",
      canonicalUrl: null,
      description: "页面描述",
      siteName: "Example"
    }
  };
}

/** 构造完整 Readability article。 */
function createArticle(overrides: Partial<ReadabilityArticle> = {}): ReadabilityArticle {
  return {
    title: "Article Title",
    content: "<p>Article body</p>",
    textContent: "Article body",
    length: 12,
    excerpt: "Excerpt",
    byline: "Ada",
    dir: "ltr",
    siteName: "Readable Site",
    lang: "en",
    publishedTime: "2026-06-08",
    ...overrides
  };
}

/** fake DOM element，只覆盖 runner 需要的面。 */
class FakeElement {
  /** HTML 内容。 */
  innerHTML: string;
  /** 外层 HTML。 */
  outerHTML: string;
  /** 文本标签名。 */
  readonly tagName: string;
  /** DOM 节点名。 */
  readonly nodeName: string;
  /** 属性表。 */
  private readonly attributes: Readonly<Record<string, string | null>>;

  /** 创建 fake element。 */
  constructor(tagName: string, innerHTML = "", attributes: Readonly<Record<string, string | null>> = {}) {
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.innerHTML = innerHTML;
    this.outerHTML = `<${tagName}>${innerHTML}</${tagName}>`;
    this.attributes = attributes;
  }

  /** 读取属性。 */
  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  /** 移除属性。 */
  removeAttribute(name: string): void {
    void name;
    return;
  }

  /** 替换节点。 */
  replaceWith(element: FakeElement): void {
    void element;
    return;
  }
}

/** fake Document，只覆盖 runner 和 meta helper 需要的面。 */
class FakeDocument {
  /** Document 节点类型常量。 */
  readonly DOCUMENT_NODE = 9;
  /** 当前节点类型。 */
  readonly nodeType = 9;
  /** 页面标题。 */
  readonly title = "Fake Document Title";
  /** 文档 body。 */
  readonly body: FakeElement;
  /** 文档根元素。 */
  readonly documentElement: FakeElement;
  /** meta 元素。 */
  private readonly metas: ReadonlyArray<FakeElement>;

  /** 创建 fake document。 */
  constructor(bodyHtml: string, metas: ReadonlyArray<FakeElement> = []) {
    this.body = new FakeElement("body", bodyHtml);
    this.documentElement = new FakeElement("html", bodyHtml);
    this.metas = metas;
  }

  /** 创建元素。 */
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  /** 查询元素。 */
  querySelectorAll(selector: string): ReadonlyArray<FakeElement> {
    if (selector === "meta[name][content], meta[property][content]") {
      return this.metas;
    }

    return [];
  }
}

/** fake DOMParser，直接把输入 HTML 放进 body。 */
class FakeDomParser implements MarkdownConvertDomParser {
  /** 将 HTML 字符串解析为 fake document。 */
  parseFromString(html: string, mimeType: DOMParserSupportedType): Document {
    void mimeType;
    const metas = [
      new FakeElement("meta", "", { name: "keywords", content: "alpha, beta" }),
      new FakeElement("meta", "", { property: "og:title", content: "OG Title" })
    ];

    return new FakeDocument(html, metas) as unknown as Document;
  }
}

/** 构造 runner 测试依赖。 */
function createDependencies(readabilityResult: ReadabilityResult): MarkdownConvertRunnerDependencies {
  return {
    createDomParser: () => new FakeDomParser(),
    parseReadableDocument: () => readabilityResult,
    now: new Date("2026-06-08T00:00:00.000Z")
  };
}

describe("offscreen convert runner", () => {
  it("selection 模式用 selectionHtml 覆盖正文内容", () => {
    const capture = createCapture("<main><p>全文正文</p></main>", "https://example.com/docs/page", "selection");
    const result = runMarkdownConvert(
      {
        capture: {
          ...capture,
          selectionHtml: '<p><a href="/selected">选区正文</a></p>',
          hasSelection: true
        },
        options: DEFAULT_MARKDOWN_CONVERT_OPTIONS
      },
      {
        createDomParser: () => new FakeDomParser(),
        parseReadableDocument: () => {
          throw new Error("selection 模式不应使用 Readability 正文。");
        },
        now: new Date("2026-06-08T00:00:00.000Z")
      }
    );

    expect(result.markdown).toBe("[选区正文](https://example.com/selected)");
    expect(result.article.pageTitle).toBe("页面标题");
  });

  it("page 模式忽略 selectionHtml 并保持 Readability 逻辑", () => {
    const result = runMarkdownConvert(
      {
        capture: {
          ...createCapture("<main><p>全文正文</p></main>", "https://example.com/docs/page", "page"),
          selectionHtml: "<p>选区正文</p>",
          hasSelection: true
        },
        options: DEFAULT_MARKDOWN_CONVERT_OPTIONS
      },
      createDependencies({
        ok: true,
        article: createArticle({ content: "<p>Readability 正文</p>", textContent: "Readability 正文", length: 16 })
      })
    );

    expect(result.markdown).toBe("Readability 正文");
  });

  it("Readability 空内容时 fallback 到 body.innerHTML", () => {
    const result = runMarkdownConvert(
      {
        capture: createCapture("<main><p>Fallback body</p></main>"),
        options: DEFAULT_MARKDOWN_CONVERT_OPTIONS
      },
      createDependencies({
        ok: true,
        article: createArticle({ content: "", textContent: "", length: 0 })
      })
    );

    expect(result.markdown).toBe("Fallback body");
    expect(result.article.pageTitle).toBe("页面标题");
    expect(result.article.baseURI).toBe("https://example.com/docs/page");
  });

  it("使用 baseURI 转换相对链接", () => {
    const result = runMarkdownConvert(
      {
        capture: createCapture('<p><a href="/guide">Guide</a></p>'),
        options: DEFAULT_MARKDOWN_CONVERT_OPTIONS
      },
      createDependencies(toReadabilityFailure())
    );

    expect(result.markdown).toBe("[Guide](https://example.com/guide)");
  });

  it("保留 iframe、sub、sup、u、ins、del、small、big 标签", () => {
    const html = [
      '<iframe src="https://example.com/embed"></iframe>',
      "<p><sub>2</sub><sup>3</sup><u>u</u><ins>i</ins><del>d</del><small>s</small><big>b</big></p>"
    ].join("");
    const result = runMarkdownConvert(
      {
        capture: createCapture(html),
        options: DEFAULT_MARKDOWN_CONVERT_OPTIONS
      },
      createDependencies(toReadabilityFailure())
    );

    expect(result.markdown).toContain('<iframe src="https://example.com/embed"></iframe>');
    expect(result.markdown).toContain("<sub>2</sub>");
    expect(result.markdown).toContain("<sup>3</sup>");
    expect(result.markdown).toContain("<u>u</u>");
    expect(result.markdown).toContain("<ins>i</ins>");
    expect(result.markdown).toContain("<del>d</del>");
    expect(result.markdown).toContain("<small>s</small>");
    expect(result.markdown).toContain("<big>b</big>");
  });

  it("清理不可见特殊字符", () => {
    const result = runMarkdownConvert(
      {
        capture: createCapture("<p>A\u200bB\ufeff</p>"),
        options: DEFAULT_MARKDOWN_CONVERT_OPTIONS
      },
      createDependencies(toReadabilityFailure())
    );

    expect(result.markdown).toBe("AB");
  });

  it("downloadImages 开启时改写图片路径并输出图片下载计划", () => {
    const result = runMarkdownConvert(
      {
        capture: createCapture('<p><img src="/assets/hero.png" alt="Hero"></p>', "https://example.com/docs/page"),
        options: {
          ...DEFAULT_MARKDOWN_CONVERT_OPTIONS,
          downloadImages: true,
          imagePrefix: "Images/"
        }
      },
      createDependencies(toReadabilityFailure())
    );

    expect(result.markdown).toBe("![Hero](Images/hero.png)");
    expect(result.imageDownloads).toEqual([
      {
        originalSrc: "https://example.com/assets/hero.png",
        sourceUrl: "https://example.com/assets/hero.png",
        filename: "Images/hero.png",
        isObsidian: false,
        outputStyle: "download"
      }
    ]);
    expect(result.downloadSettings).toMatchObject({
      downloadMode: "downloadsApi",
      saveAs: false,
      mdClipsFolder: null
    });
  });

  it("originalSource 开启下载时保留原始 URL 并输出图片下载计划", () => {
    const result = runMarkdownConvert(
      {
        capture: createCapture('<p><img src="/assets/hero.png" alt="Hero"></p>', "https://example.com/docs/page"),
        options: {
          ...DEFAULT_MARKDOWN_CONVERT_OPTIONS,
          downloadImages: true,
          imageStyle: "originalSource",
          imagePrefix: "Images/"
        }
      },
      createDependencies(toReadabilityFailure())
    );

    expect(result.markdown).toBe("![Hero](https://example.com/assets/hero.png)");
    expect(result.imageDownloads).toEqual([
      {
        originalSrc: "https://example.com/assets/hero.png",
        sourceUrl: "https://example.com/assets/hero.png",
        filename: "Images/hero.png",
        isObsidian: false,
        outputStyle: "download"
      }
    ]);
  });
});
