import { describe, expect, it } from "vitest";

import {
  isImageStyleChoiceDisabled,
  isOptionFieldVisible,
  OPTION_FIELD_DEFINITIONS
} from "../../../src/options/options-fields";
import {
  BulletListMarker,
  CodeBlockStyle,
  CodeFence,
  DEFAULT_MARKDOWN_SAVE_OPTIONS,
  DownloadMode,
  EmDelimiter,
  HeadingStyle,
  HorizontalRuleStyle,
  ImageReferenceStyle,
  ImageStyle,
  LinkReferenceStyle,
  LinkStyle,
  StrongDelimiter
} from "../../../src/shared/options/defaults";

describe("options field definitions", () => {
  it("覆盖 MarkDownload 默认配置中的全部 26 个字段且不重复", () => {
    const fields = OPTION_FIELD_DEFINITIONS.map((definition) => definition.field);

    expect(fields).toHaveLength(26);
    expect(new Set(fields).size).toBe(26);
    expect([...fields].sort()).toEqual(Object.keys(DEFAULT_MARKDOWN_SAVE_OPTIONS).sort());
  });

  it("覆盖所有 MarkDownload 单选枚举值", () => {
    expect(readChoiceValues("headingStyle")).toEqual(Object.values(HeadingStyle));
    expect(readChoiceValues("hr")).toEqual(Object.values(HorizontalRuleStyle));
    expect(readChoiceValues("bulletListMarker")).toEqual(Object.values(BulletListMarker));
    expect(readChoiceValues("codeBlockStyle")).toEqual(Object.values(CodeBlockStyle));
    expect(readChoiceValues("fence")).toEqual(Object.values(CodeFence));
    expect(readChoiceValues("emDelimiter")).toEqual(Object.values(EmDelimiter));
    expect(readChoiceValues("strongDelimiter")).toEqual(Object.values(StrongDelimiter));
    expect(readChoiceValues("linkStyle")).toEqual(Object.values(LinkStyle));
    expect(readChoiceValues("linkReferenceStyle")).toEqual(Object.values(LinkReferenceStyle));
    expect(readChoiceValues("imageStyle")).toEqual(Object.values(ImageStyle));
    expect(readChoiceValues("imageRefStyle")).toEqual(Object.values(ImageReferenceStyle));
    expect(readChoiceValues("downloadMode")).toEqual(Object.values(DownloadMode));
  });

  it("按 MarkDownload 逻辑显示依赖字段", () => {
    expect(isOptionFieldVisible(DEFAULT_MARKDOWN_SAVE_OPTIONS, "linkReferenceStyle")).toBe(false);
    expect(
      isOptionFieldVisible(
        {
          ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
          linkStyle: LinkStyle.REFERENCED
        },
        "linkReferenceStyle"
      )
    ).toBe(true);

    expect(
      isOptionFieldVisible(
        {
          ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
          codeBlockStyle: CodeBlockStyle.INDENTED
        },
        "fence"
      )
    ).toBe(false);

    expect(
      isOptionFieldVisible(
        {
          ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
          downloadMode: DownloadMode.CONTENT_LINK
        },
        "downloadImages"
      )
    ).toBe(false);

    expect(
      isOptionFieldVisible(
        {
          ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
          imageStyle: ImageStyle.OBSIDIAN
        },
        "imageRefStyle"
      )
    ).toBe(false);
  });

  it("不因默认 downloadImages=false 自动改写默认 imageStyle", () => {
    expect(DEFAULT_MARKDOWN_SAVE_OPTIONS.imageStyle).toBe(ImageStyle.MARKDOWN);
    expect(isImageStyleChoiceDisabled(DEFAULT_MARKDOWN_SAVE_OPTIONS, ImageStyle.MARKDOWN)).toBe(true);
    expect(isImageStyleChoiceDisabled(DEFAULT_MARKDOWN_SAVE_OPTIONS, ImageStyle.ORIGINAL_SOURCE)).toBe(false);
  });
});

/** 读取指定字段的 choice 值。 */
function readChoiceValues(field: string): ReadonlyArray<string> {
  return OPTION_FIELD_DEFINITIONS.find((definition) => definition.field === field)?.choices?.map((choice) => choice.value) ?? [];
}
