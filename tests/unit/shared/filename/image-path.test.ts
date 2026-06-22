import { describe, expect, it } from "vitest";

import {
  buildMarkDownloadImageFilename,
  ImageStyle,
  MarkdownImageReferenceKind,
  planImagePath
} from "../../../../src/shared/filename/image-path";

describe("shared filename image path", () => {
  it("生成图片文件名时支持 imagePrefix、query 截断和文件名清洗", () => {
    expect(
      buildMarkDownloadImageFilename(
        "https://example.com/assets/My Image:1.png?width=200",
        "Article",
        "Article Images/",
        ":",
        false
      )
    ).toBe("Article Images/My Image1.png");
  });

  it("无扩展名图片追加 .idunno，data URI 使用 image.<type> 命名", () => {
    expect(buildMarkDownloadImageFilename("https://example.com/assets/photo", "Article", "", null, false)).toBe(
      "photo.idunno"
    );
    expect(buildMarkDownloadImageFilename("data:image/png;base64,AAAA", "Article", "", null, false)).toBe(
      "image.png"
    );
  });

  it("重复下载文件名按 MarkDownload 规则追加和递增编号", () => {
    const plan = planImagePath({
      src: "https://example.com/assets/photo.png",
      title: "Article",
      imagePrefix: "Article/",
      disallowedChars: null,
      imageStyle: ImageStyle.MARKDOWN,
      existingFilenames: ["Article/photo.png", "Article/photo.1.png"],
      prependFilePath: false
    });

    expect(plan.downloadFilename).toBe("Article/photo.2.png");
    expect(plan.markdownPath).toBe("Article/photo.2.png");
  });

  it("非 Obsidian Markdown 路径逐段 encodeURI", () => {
    const plan = planImagePath({
      src: "https://example.com/assets/My Image.png",
      title: "Article",
      imagePrefix: "Article Images/",
      disallowedChars: null,
      imageStyle: ImageStyle.MARKDOWN,
      existingFilenames: [],
      prependFilePath: false
    });

    expect(plan).toMatchObject({
      downloadFilename: "Article Images/My Image.png",
      markdownPath: "Article%20Images/My%20Image.png",
      referenceKind: MarkdownImageReferenceKind.MARKDOWN
    });
  });

  it("Obsidian nofolder 只在 Markdown 内保留 basename，普通 Obsidian 保留文件夹且不 encode", () => {
    const noFolderPlan = planImagePath({
      src: "https://example.com/assets/My Image.png",
      title: "Article",
      imagePrefix: "Article Images/",
      disallowedChars: null,
      imageStyle: ImageStyle.OBSIDIAN_NOFOLDER,
      existingFilenames: [],
      prependFilePath: false
    });
    const obsidianPlan = planImagePath({
      src: "https://example.com/assets/My Image.png",
      title: "Article",
      imagePrefix: "Article Images/",
      disallowedChars: null,
      imageStyle: ImageStyle.OBSIDIAN,
      existingFilenames: [],
      prependFilePath: false
    });

    expect(noFolderPlan).toMatchObject({
      downloadFilename: "Article Images/My Image.png",
      markdownPath: "My Image.png",
      referenceKind: MarkdownImageReferenceKind.OBSIDIAN
    });
    expect(obsidianPlan).toMatchObject({
      downloadFilename: "Article Images/My Image.png",
      markdownPath: "Article Images/My Image.png",
      referenceKind: MarkdownImageReferenceKind.OBSIDIAN
    });
  });

  it("显式建模 originalSource、base64 和 noImage 行为", () => {
    const originalSourcePlan = planImagePath({
      src: "https://example.com/assets/photo.png",
      title: "Article",
      imagePrefix: "Article/",
      disallowedChars: null,
      imageStyle: ImageStyle.ORIGINAL_SOURCE,
      existingFilenames: [],
      prependFilePath: false
    });
    const base64Plan = planImagePath({
      src: "https://example.com/assets/photo.png",
      title: "Article",
      imagePrefix: "Article/",
      disallowedChars: null,
      imageStyle: ImageStyle.BASE64,
      existingFilenames: [],
      prependFilePath: false
    });
    const noImagePlan = planImagePath({
      src: "https://example.com/assets/photo.png",
      title: "Article",
      imagePrefix: "Article/",
      disallowedChars: null,
      imageStyle: ImageStyle.NO_IMAGE,
      existingFilenames: [],
      prependFilePath: false
    });

    expect(originalSourcePlan).toMatchObject({
      downloadFilename: null,
      markdownPath: "https://example.com/assets/photo.png",
      referenceKind: MarkdownImageReferenceKind.MARKDOWN
    });
    expect(base64Plan).toMatchObject({
      downloadFilename: "Article/photo.png",
      markdownPath: "https://example.com/assets/photo.png",
      referenceKind: MarkdownImageReferenceKind.MARKDOWN
    });
    expect(noImagePlan).toMatchObject({
      downloadFilename: null,
      markdownPath: null,
      referenceKind: MarkdownImageReferenceKind.STRIP
    });
  });
});
