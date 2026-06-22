import { describe, expect, it } from "vitest";

import { mergeArticleWithExtractedMeta } from "../../../../src/shared/template/meta";

describe("shared template meta", () => {
  it("从 meta-like 数据提取 name/property content", () => {
    const result = mergeArticleWithExtractedMeta(
      {
        title: "Article Title"
      },
      [
        { name: "description", content: "Desc" },
        { property: "og:image", content: "https://example.com/image.png" },
        { name: "keywords", content: " alpha, beta ,, gamma " }
      ]
    );

    expect(result).toEqual({
      title: "Article Title",
      description: "Desc",
      "og:image": "https://example.com/image.png",
      keywords: ["alpha", "beta", "", "gamma"]
    });
  });

  it("meta 不覆盖既有 article 字段", () => {
    const result = mergeArticleWithExtractedMeta(
      {
        description: "Article Desc",
        keywords: ["article"]
      },
      [
        { name: "description", content: "Meta Desc" },
        { name: "keywords", content: "meta" }
      ]
    );

    expect(result.description).toBe("Article Desc");
    expect(result.keywords).toEqual(["article"]);
  });

  it("从 HTML Document 提取 meta", () => {
    const document = {
      querySelectorAll: () => [
        {
          getAttribute: (name: string) => (name === "name" ? "author" : name === "content" ? "Ada" : null)
        },
        {
          getAttribute: (name: string) => (name === "property" ? "og:title" : name === "content" ? "OG" : null)
        }
      ]
    } as unknown as Document;

    expect(mergeArticleWithExtractedMeta({}, document)).toEqual({
      author: "Ada",
      "og:title": "OG"
    });
  });
});
