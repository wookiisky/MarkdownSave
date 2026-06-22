import { describe, expect, it } from "vitest";

import { buildAdvancedObsidianUri, formatObsidianFolder } from "../../../../src/shared/obsidian/advanced-uri";

describe("shared obsidian advanced uri", () => {
  it("构造 MarkDownload 兼容 Advanced URI，vault 和 folder 不做 URL encode", () => {
    const uri = buildAdvancedObsidianUri({
      vault: "My Vault",
      folder: "Clips Folder/",
      title: "A/B? C:D"
    });

    expect(uri).toBe(
      "obsidian://advanced-uri?vault=My Vault&clipboard=true&mode=new&filepath=Clips Folder/AB CD"
    );
  });

  it("folder helper 分段清洗并补齐末尾斜杠", () => {
    expect(formatObsidianFolder({ folder: " Clips / A:B ", disallowedChars: ":" })).toBe("Clips/AB/");
    expect(formatObsidianFolder({ folder: "", disallowedChars: ":" })).toBe("");
  });

  it("title 最后整体清洗，title 中 / 不作为 filepath 分隔符", () => {
    const uri = buildAdvancedObsidianUri({
      vault: "",
      folder: "Inbox/",
      title: "Folder/Note"
    });

    expect(uri).toBe("obsidian://advanced-uri?vault=&clipboard=true&mode=new&filepath=Inbox/FolderNote");
  });
});
