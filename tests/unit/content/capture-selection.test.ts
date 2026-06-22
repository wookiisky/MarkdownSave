import { describe, expect, it } from "vitest";

import { captureCurrentSelection } from "../../../src/content/capture-selection";

/** 测试用 fragment，只表达序列化后的 HTML。 */
interface FakeFragment {
  /** fragment HTML。 */
  html: string;
}

/** 测试用 range，只覆盖选区采集依赖的 cloneContents。 */
class FakeRange {
  /** range 对应的 HTML fragment。 */
  private readonly html: string;

  /** 创建测试 range。 */
  constructor(html: string) {
    this.html = html;
  }

  /** 克隆 range 内容。 */
  cloneContents(): FakeFragment {
    return { html: this.html };
  }
}

/** 测试用容器元素，appendChild 后更新 innerHTML。 */
class FakeSelectionContainer {
  /** 容器 HTML。 */
  innerHTML = "";

  /** 追加 fragment。 */
  appendChild(fragment: FakeFragment): FakeFragment {
    this.innerHTML += fragment.html;
    return fragment;
  }
}

/** 测试用 document，只覆盖 createElement。 */
class FakeSelectionDocument {
  /** 创建容器元素。 */
  createElement(tagName: string): FakeSelectionContainer {
    expect(tagName).toBe("div");
    return new FakeSelectionContainer();
  }
}

/** 构造测试选区。 */
function createSelection(ranges: ReadonlyArray<FakeRange>): Selection {
  return {
    rangeCount: ranges.length,
    getRangeAt(index: number): Range {
      const range = ranges[index];
      if (range === undefined) {
        throw new Error("range index out of bounds");
      }

      return range as unknown as Range;
    }
  } as Selection;
}

/** 构造测试运行环境。 */
function createEnvironment(ranges: ReadonlyArray<FakeRange>) {
  return {
    document: new FakeSelectionDocument() as unknown as Document,
    window: {
      getSelection: () => createSelection(ranges)
    } as Pick<Window, "getSelection">
  };
}

describe("captureCurrentSelection", () => {
  it("空选区返回 null 和 false", () => {
    const result = captureCurrentSelection(createEnvironment([]));

    expect(result).toEqual({
      selectionHtml: null,
      hasSelection: false
    });
  });

  it("采集 single range HTML fragment", () => {
    const result = captureCurrentSelection(createEnvironment([new FakeRange("<p>选中文本</p>")]));

    expect(result).toEqual({
      selectionHtml: "<p>选中文本</p>",
      hasSelection: true
    });
  });

  it("按 range 顺序采集 multi range，不重复第一个 range", () => {
    const result = captureCurrentSelection(
      createEnvironment([new FakeRange("<p>第一段</p>"), new FakeRange("<blockquote>第二段</blockquote>")])
    );

    expect(result).toEqual({
      selectionHtml: "<p>第一段</p><blockquote>第二段</blockquote>",
      hasSelection: true
    });
  });

  it("保留复杂嵌套选区的 cloneContents 结构", () => {
    const nestedHtml = '<section><h2>标题</h2><p>正文 <strong>重点</strong><a href="/x">链接</a></p></section>';
    const result = captureCurrentSelection(createEnvironment([new FakeRange(nestedHtml)]));

    expect(result.selectionHtml).toBe(nestedHtml);
    expect(result.hasSelection).toBe(true);
  });
});
