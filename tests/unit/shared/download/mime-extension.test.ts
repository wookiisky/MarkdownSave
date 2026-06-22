import { describe, expect, it } from "vitest";

import { replaceIdunnoExtensionByMimeType } from "../../../../src/shared/download/mime-extension";

describe("shared download mime extension", () => {
  it("已知 MIME 会替换 .idunno 扩展名", () => {
    expect(replaceIdunnoExtensionByMimeType("Article/photo.idunno", "image/png")).toBe("Article/photo.png");
  });

  it("未知、空 MIME 保留 .idunno", () => {
    expect(replaceIdunnoExtensionByMimeType("Article/photo.idunno", "application/x-unknown-type")).toBe(
      "Article/photo.idunno"
    );
    expect(replaceIdunnoExtensionByMimeType("Article/photo.idunno", "")).toBe("Article/photo.idunno");
    expect(replaceIdunnoExtensionByMimeType("Article/photo.idunno", null)).toBe("Article/photo.idunno");
  });

  it("非 .idunno 文件名不受 MIME 影响", () => {
    expect(replaceIdunnoExtensionByMimeType("Article/photo.jpeg", "image/png")).toBe("Article/photo.jpeg");
  });
});
