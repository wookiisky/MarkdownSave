import { describe, expect, it } from "vitest";

import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../../src/shared/options/defaults";
import { migrateOptionsFromUnknown } from "../../../../src/shared/options/migrate";
import { validateMarkdownSaveOptionsFromUnknown } from "../../../../src/shared/options/schema";

describe("shared options migrate", () => {
  it("迁移 MarkDownload 默认 option", () => {
    expect(DEFAULT_MARKDOWN_SAVE_OPTIONS).toEqual({
      headingStyle: "atx",
      hr: "___",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      fence: "```",
      emDelimiter: "_",
      strongDelimiter: "**",
      linkStyle: "inlined",
      linkReferenceStyle: "full",
      imageStyle: "markdown",
      imageRefStyle: "inlined",
      frontmatter:
        "---\ncreated: {date:YYYY-MM-DDTHH:mm:ss} (UTC {date:Z})\ntags: [{keywords}]\nsource: {baseURI}\nauthor: {byline}\n---\n\n# {pageTitle}\n\n> ## Excerpt\n> {excerpt}\n\n---",
      backmatter: "",
      title: "{pageTitle}",
      includeTemplate: false,
      saveAs: false,
      downloadImages: false,
      imagePrefix: "{pageTitle}/",
      mdClipsFolder: null,
      disallowedChars: "[]#^",
      downloadMode: "downloadsApi",
      turndownEscape: true,
      contextMenus: true,
      obsidianIntegration: false,
      obsidianVault: "",
      obsidianFolder: ""
    });
  });

  it("缺字段配置按默认值补齐", () => {
    const result = migrateOptionsFromUnknown({
      title: "{title}",
      includeTemplate: true,
      mdClipsFolder: "clips"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.options.title).toBe("{title}");
      expect(result.options.includeTemplate).toBe(true);
      expect(result.options.mdClipsFolder).toBe("clips");
      expect(result.options.headingStyle).toBe(DEFAULT_MARKDOWN_SAVE_OPTIONS.headingStyle);
    }
  });

  it("忽略未知未来字段，不污染核心 options", () => {
    const result = migrateOptionsFromUnknown({
      title: "{title}",
      futureOption: "future"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("futureOption" in result.options).toBe(false);
      expect(result.ignoredFields).toEqual(["futureOption"]);
    }
  });

  it("拒绝 JSON 非对象输入", () => {
    const result = migrateOptionsFromUnknown(null);

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: null,
          code: "options_not_object",
          message: "options 必须是普通对象"
        }
      ],
      ignoredFields: []
    });
  });

  it("拒绝字段类型错误和单选枚举非法", () => {
    const result = validateMarkdownSaveOptionsFromUnknown({
      includeTemplate: "true",
      headingStyle: "markdown"
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: "headingStyle",
          code: "invalid_enum",
          message: "headingStyle 不在允许范围内",
          value: "markdown",
          allowedValues: ["setext", "atx"]
        },
        {
          field: "includeTemplate",
          code: "invalid_type",
          message: "includeTemplate 类型必须是 boolean",
          value: "true",
          expectedType: "boolean"
        }
      ],
      ignoredFields: []
    });
  });
});
