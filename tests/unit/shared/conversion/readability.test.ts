import { describe, expect, it } from "vitest";

import { parseReadableDocument, toReadabilityFailure } from "../../../../src/shared/conversion/readability";

/** 构造只覆盖 parseReadableDocument 所需面的 Document fake。 */
function createFakeDocument(clonedNodeType = 9): { document: Document; clonedDocument: Document } {
  const clonedDocument = {
    nodeType: clonedNodeType
  } as unknown as Document;
  const document = {
    DOCUMENT_NODE: 9,
    cloneNode: () => clonedDocument
  } as unknown as Document;

  return { document, clonedDocument };
}

describe("shared conversion readability", () => {
  it("构造 parse null 时的结构化失败结果", () => {
    expect(toReadabilityFailure()).toEqual({
      ok: false,
      code: "readability_parse_empty",
      message: "Readability 未能提取正文；conversion shared 层不做旧版 content fallback。"
    });
  });

  it("parseReadableDocument 成功时克隆文档并规整可空字段", () => {
    const { document, clonedDocument } = createFakeDocument();
    const result = parseReadableDocument(document, { keepClasses: true }, (receivedDocument, options) => {
      expect(receivedDocument).toBe(clonedDocument);
      expect(options.keepClasses).toBe(true);

      return {
        title: "Title",
        content: "<article>Body</article>",
        textContent: "Body",
        length: 4,
        excerpt: null,
        byline: undefined,
        dir: "ltr",
        siteName: "Site",
        lang: null,
        publishedTime: undefined
      };
    });

    expect(result).toEqual({
      ok: true,
      article: {
        title: "Title",
        content: "<article>Body</article>",
        textContent: "Body",
        length: 4,
        excerpt: "",
        byline: "",
        dir: "ltr",
        siteName: "Site",
        lang: "",
        publishedTime: ""
      }
    });
  });

  it("parseReadableDocument 在 parser 返回 null 时返回结构化失败", () => {
    const { document } = createFakeDocument();

    expect(parseReadableDocument(document, {}, () => null)).toEqual(toReadabilityFailure());
  });

  it("parseReadableDocument 在克隆结果不是 Document 时返回结构化失败", () => {
    const { document } = createFakeDocument(1);

    expect(parseReadableDocument(document, {}, () => null)).toEqual(toReadabilityFailure());
  });
});
