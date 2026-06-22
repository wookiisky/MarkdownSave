import { describe, expect, it } from "vitest";

import {
  MarkDownloadUriResolutionStrategy,
  resolveMarkDownloadUri,
  resolveMarkDownloadUriOrOriginal,
  UrlResolveFailureReason
} from "../../../../src/shared/url/resolve";

describe("shared url resolve", () => {
  it("绝对 URL 保持原值，不做规范化改写", () => {
    const result = resolveMarkDownloadUri("https://example.com/a/../b?x=1", "https://base.example/path/");

    expect(result).toEqual({
      ok: true,
      href: "https://example.com/a/../b?x=1",
      strategy: MarkDownloadUriResolutionStrategy.ABSOLUTE_HREF
    });
  });

  it("以 / 开头的 href 使用 baseURI origin 拼接", () => {
    const result = resolveMarkDownloadUri("/asset/logo.png", "https://example.com/docs/page.html?x=1#top");

    expect(result).toEqual({
      ok: true,
      href: "https://example.com/asset/logo.png",
      strategy: MarkDownloadUriResolutionStrategy.ORIGIN_RELATIVE
    });
  });

  it("相对 href 直接追加到 baseURI.href，保留 MarkDownload 的双斜杠历史行为", () => {
    const result = resolveMarkDownloadUri("asset/logo.png", "https://example.com/docs/");

    expect(result).toEqual({
      ok: true,
      href: "https://example.com/docs//asset/logo.png",
      strategy: MarkDownloadUriResolutionStrategy.BASE_HREF_APPEND
    });
  });

  it("无效 baseURI 返回结构化失败，兼容 helper 回退原始 href", () => {
    const result = resolveMarkDownloadUri("asset/logo.png", "not a url");

    expect(result).toEqual({
      ok: false,
      reason: UrlResolveFailureReason.INVALID_BASE_URI,
      href: "asset/logo.png",
      baseURI: "not a url"
    });
    expect(resolveMarkDownloadUriOrOriginal("asset/logo.png", "not a url")).toBe("asset/logo.png");
  });
});
