import { describe, expect, it } from "vitest";

import {
  DownloadPlanMode,
  planImageDownload,
  planMarkdownDownload,
  replaceMarkdownImageFilename
} from "../../../../src/shared/download/download-plan";

describe("shared download plan", () => {
  it("清洗 mdClipsFolder 每个路径段，并为 downloadsApi Markdown 文件名补尾斜杠", () => {
    const plan = planMarkdownDownload({
      title: "Article/Raw:Title",
      mdClipsFolder: " Inbox / A:B ",
      downloadMode: DownloadPlanMode.DOWNLOADS_API,
      saveAs: true,
      disallowedChars: ":"
    });

    expect(plan).toEqual({
      downloadMode: DownloadPlanMode.DOWNLOADS_API,
      filename: "Inbox/AB/Article/Raw:Title.md",
      saveAs: true
    });
  });

  it("contentLink 模式清洗 Markdown title，并显式关闭 saveAs", () => {
    const plan = planMarkdownDownload({
      title: "Article/Raw:Title",
      mdClipsFolder: " Clips:Box ",
      downloadMode: DownloadPlanMode.CONTENT_LINK,
      saveAs: true,
      disallowedChars: ":"
    });

    expect(plan).toEqual({
      downloadMode: DownloadPlanMode.CONTENT_LINK,
      filename: "ClipsBox/ArticleRawTitle.md",
      saveAs: false
    });
  });

  it("图片下载目标使用 mdClipsFolder 加 Markdown 标题目录部分，并固定 saveAs=false", () => {
    const plan = planImageDownload({
      mdClipsFolder: " Clips:Box ",
      title: "Articles/2026/Raw:Title",
      imageFilename: "Images/My Image.png",
      disallowedChars: ":"
    });

    expect(plan).toEqual({
      filename: "ClipsBox/Articles/2026/Images/My Image.png",
      saveAs: false
    });
  });

  it("非 Obsidian Markdown 按 encoded path 替换图片文件名", () => {
    const markdown = "![hero](Article/My%20Image.idunno)\n\n[hero]: Article/My%20Image.idunno";

    expect(
      replaceMarkdownImageFilename(markdown, "Article/My Image.idunno", "Article/My Image.png", false)
    ).toBe("![hero](Article/My%20Image.png)\n\n[hero]: Article/My%20Image.png");
  });

  it("Obsidian Markdown 按 raw path 替换图片文件名", () => {
    const markdown = "![[Article/My Image.idunno]]";

    expect(
      replaceMarkdownImageFilename(markdown, "Article/My Image.idunno", "Article/My Image.png", true)
    ).toBe("![[Article/My Image.png]]");
  });
});
