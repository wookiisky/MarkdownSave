import { describe, expect, it } from "vitest";

import { formatLocalDate, replaceDatePlaceholders } from "../../../../src/shared/template/date";

describe("shared template date", () => {
  it("按本地时间格式替换 MarkDownload date 占位符", () => {
    const now = new Date(2026, 5, 8, 9, 10, 11);

    expect(formatLocalDate("YYYY-MM-DDTHH:mm:ss", now)).toBe("2026-06-08T09:10:11");
    expect(replaceDatePlaceholders("created: {date:YYYY-MM-DDTHH:mm:ss}", now)).toBe(
      "created: 2026-06-08T09:10:11"
    );
  });

  it("支持默认 frontmatter 使用的 Z offset", () => {
    const now = new Date(2026, 5, 8, 9, 10, 11);
    const result = replaceDatePlaceholders("UTC {date:Z}", now);

    expect(result).toMatch(/^UTC [+-]\d{2}:\d{2}$/);
  });
});
