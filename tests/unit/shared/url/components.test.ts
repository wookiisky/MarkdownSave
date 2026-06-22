import { describe, expect, it } from "vitest";

import { readUrlComponents, UrlComponentsFailureReason } from "../../../../src/shared/url/components";

describe("shared url components", () => {
  it("从 baseURI 提取 MarkDownload article URL 字段", () => {
    const result = readUrlComponents("https://example.com:8443/docs/page.html?x=1#top");

    expect(result).toEqual({
      ok: true,
      components: {
        baseURI: "https://example.com:8443/docs/page.html?x=1#top",
        hash: "#top",
        host: "example.com:8443",
        origin: "https://example.com:8443",
        hostname: "example.com",
        pathname: "/docs/page.html",
        port: "8443",
        protocol: "https:",
        search: "?x=1"
      }
    });
  });

  it("无效 baseURI 返回结构化失败", () => {
    expect(readUrlComponents("not a url")).toEqual({
      ok: false,
      reason: UrlComponentsFailureReason.INVALID_BASE_URI,
      baseURI: "not a url"
    });
  });
});
