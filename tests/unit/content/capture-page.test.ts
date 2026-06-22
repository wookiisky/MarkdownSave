import { describe, expect, it } from "vitest";

import { captureCurrentPage } from "../../../src/content/capture-page";
import type { ElementVisibilityStyle } from "../../../src/content/remove-hidden";
import { asDocument, createFakeElement, FakeDocument } from "./fake-dom";

const PAGE_LOCATION = {
  href: "https://example.com/articles/1",
  origin: "https://example.com"
};

/** 测试中默认所有元素可见。 */
function readVisibleStyle(): ElementVisibilityStyle {
  return {
    display: "block",
    visibility: "visible"
  };
}

describe("captureCurrentPage", () => {
  it("head 缺少 title 时使用 document.title 补齐", () => {
    const document = new FakeDocument({ title: "补齐标题", language: "zh-CN" });

    const result = captureCurrentPage({
      document: asDocument(document),
      location: PAGE_LOCATION,
      getElementStyle: readVisibleStyle
    });

    expect(result.title).toBe("补齐标题");
    expect(result.pageHtml).toContain("<title>补齐标题</title>");
    expect(result.metadata.language).toBe("zh-CN");
  });

  it("head 缺少 base 时使用当前页面 URL 补齐", () => {
    const document = new FakeDocument({ title: "页面标题" });

    const result = captureCurrentPage({
      document: asDocument(document),
      location: PAGE_LOCATION,
      getElementStyle: readVisibleStyle
    });

    expect(result.baseUrl).toBe(PAGE_LOCATION.href);
    expect(result.pageUrl).toBe(PAGE_LOCATION.href);
    expect(result.pageHtml).toContain(`<base href="${PAGE_LOCATION.href}"></base>`);
  });

  it("base 跨 origin 时重置为当前页面 URL", () => {
    const document = new FakeDocument({ title: "页面标题" });
    document.head.appendChild(createFakeElement("base", { attributes: { href: "https://other.example/base/" } }));

    const result = captureCurrentPage({
      document: asDocument(document),
      location: PAGE_LOCATION,
      getElementStyle: readVisibleStyle
    });

    expect(result.baseUrl).toBe(PAGE_LOCATION.href);
    expect(result.pageHtml).toContain(`<base href="${PAGE_LOCATION.href}"></base>`);
  });

  it("采集时只修改克隆 DOM，不改写原始页面 DOM", () => {
    const document = new FakeDocument({ title: "页面标题" });
    document.head.appendChild(createFakeElement("base", { attributes: { href: "https://other.example/base/" } }));
    const originalHtml = document.documentElement.outerHTML;

    const result = captureCurrentPage({
      document: asDocument(document),
      location: PAGE_LOCATION,
      getElementStyle: readVisibleStyle
    });

    expect(result.pageHtml).toContain(`<base href="${PAGE_LOCATION.href}"></base>`);
    expect(document.documentElement.outerHTML).toBe(originalHtml);
  });

  it("集成真实页面选区 HTML，但全文采集仍不修改原始 DOM", () => {
    const document = new FakeDocument({ title: "页面标题" });
    const originalHtml = document.documentElement.outerHTML;
    const result = captureCurrentPage({
      document: asDocument(document),
      location: PAGE_LOCATION,
      window: {
        getSelection: () =>
          ({
            rangeCount: 1,
            getRangeAt: () =>
              ({
                cloneContents: () => ({ html: "<p>选区正文</p>" })
              }) as unknown as Range
          }) as unknown as Selection
      },
      getElementStyle: readVisibleStyle
    });

    expect(result.selectionHtml).toBe("<p>选区正文</p>");
    expect(result.hasSelection).toBe(true);
    expect(document.documentElement.outerHTML).toBe(originalHtml);
  });
});
