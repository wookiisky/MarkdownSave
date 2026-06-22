import { describe, expect, it } from "vitest";

import { generateValidFileName, sanitizePathSegments } from "../../../../src/shared/filename/sanitize";

describe("shared filename sanitize", () => {
  it("兼容 MarkDownload generateValidFileName 的固定清洗规则", () => {
    const title = "  A/B? C<D>E\\F:G*H|I\"J\u00A0  K\t\nL  ";

    expect(generateValidFileName(title)).toBe("AB CDEFGHIJ K L");
  });

  it("额外 disallowedChars 逐字符移除，并支持正则特殊字符", () => {
    expect(generateValidFileName("a.b[c](d)+e$ f^g|h?i*j\\k", ".[]()+$^|?*\\")).toBe("abcde fghijk");
  });

  it("按 / 分段清洗并保留模板输出路径分隔符", () => {
    expect(sanitizePathSegments("/ Inbox / A:B /  C\u00A0\tD  /", ":")).toBe("/Inbox/AB/C D/");
  });
});
