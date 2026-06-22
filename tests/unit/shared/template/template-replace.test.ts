import { describe, expect, it } from "vitest";

import { replaceTemplateText } from "../../../../src/shared/template/replace";

describe("shared template replace", () => {
  it("替换 includeTemplate 需要的基础字段并跳过 content 字段", () => {
    const result = replaceTemplateText("source: {baseURI}\n# {pageTitle}\nbody: {content}", {
      baseURI: "https://example.com/post",
      content: "正文",
      pageTitle: "Page Title"
    });

    expect(result).toBe("source: https://example.com/post\n# Page Title\nbody: ");
  });

  it("支持 keywords 默认英文逗号和自定义分隔符", () => {
    const result = replaceTemplateText("{keywords}|{keywords: }|{keywords:\\n}", {
      keywords: ["alpha", "beta"]
    });

    expect(result).toBe("alpha,beta|alpha beta|alpha\nbeta");
  });

  it("清空未知占位符", () => {
    expect(replaceTemplateText("a{unknown}b", {})).toBe("ab");
  });

  it("支持 9 种参数化后缀", () => {
    const article = { title: "Hello Big  World" };

    expect(replaceTemplateText("{title:lower}", article)).toBe("hello big  world");
    expect(replaceTemplateText("{title:upper}", article)).toBe("HELLO BIG  WORLD");
    expect(replaceTemplateText("{title:kebab}", article)).toBe("hello-big--world");
    expect(replaceTemplateText("{title:mixed-kebab}", article)).toBe("Hello-Big--World");
    expect(replaceTemplateText("{title:snake}", article)).toBe("hello_big__world");
    expect(replaceTemplateText("{title:mixed_snake}", article)).toBe("Hello_Big__World");
    expect(replaceTemplateText("{title:obsidian-cal}", article)).toBe("Hello-Big-World");
    expect(replaceTemplateText("{title:camel}", article)).toBe("helloBigWorld");
    expect(replaceTemplateText("{title:pascal}", article)).toBe("HelloBigWorld");
  });

  it("文件名模式按 disallowedChars 清洗字段值", () => {
    const result = replaceTemplateText("{pageTitle}", { pageTitle: "A [bad]/name" }, { disallowedChars: "[]" });

    expect(result).toBe("A badname");
  });
});
