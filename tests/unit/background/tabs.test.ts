/// <reference types="chrome" />

import { describe, expect, it } from "vitest";

import { isRestrictedTabUrl, readActiveTab } from "../../../src/background/tabs";

describe("background tabs", () => {
  it("识别 Chrome 受限 URL", () => {
    expect(isRestrictedTabUrl("chrome://extensions")).toBe(true);
    expect(isRestrictedTabUrl("chrome-extension://abc/options.html")).toBe(true);
    expect(isRestrictedTabUrl("edge://settings")).toBe(true);
    expect(isRestrictedTabUrl("about:blank")).toBe(true);
    expect(isRestrictedTabUrl("file:///tmp/a.html")).toBe(true);
    expect(isRestrictedTabUrl("https://example.com")).toBe(false);
    expect(isRestrictedTabUrl("http://example.com")).toBe(false);
    expect(isRestrictedTabUrl("not a url")).toBe(true);
  });

  it("active tab 查询返回清洗后的边界对象", async () => {
    const tab = await readActiveTab({
      query() {
        return Promise.resolve([
          {
            id: 12,
            url: "https://example.com",
            index: 0,
            pinned: false,
            highlighted: true,
            windowId: 1,
            active: true,
            frozen: false,
            incognito: false,
            selected: true,
            discarded: false,
            autoDiscardable: true,
            groupId: -1
          }
        ]);
      }
    });

    expect(tab).toEqual({
      id: 12,
      url: "https://example.com",
      restricted: false
    });
  });
});
