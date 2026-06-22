import { describe, expect, it } from "vitest";

import type { RawContentCaptureResult } from "../../../src/content/capture-types";

describe("content capture types", () => {
  it("表达原始采集结果，不返回最终 Markdown", () => {
    const capture: RawContentCaptureResult = {
      pageHtml: "<html><body><article>正文</article></body></html>",
      selectionHtml: "<article>正文</article>",
      title: "页面标题",
      baseUrl: "https://example.com/articles/1",
      pageUrl: "https://example.com/articles/1",
      hasSelection: true,
      clipMode: "selection",
      metadata: {
        language: "zh-CN",
        charset: "utf-8",
        canonicalUrl: "https://example.com/articles/1",
        description: "页面描述",
        siteName: "Example"
      }
    };

    expect(capture.pageHtml).toContain("<html>");
    expect(capture.selectionHtml).toContain("<article>");
    expect("markdown" in capture).toBe(false);
  });
});
