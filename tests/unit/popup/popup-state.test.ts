import { describe, expect, it } from "vitest";
import { DEFAULT_CLIP_CAPTURE_MODE } from "../../../src/shared/messages";
import {
  filterImageDownloadsForMarkdown,
  isPopupClipCaptureMode,
  POPUP_CLIP_CAPTURE_MODE_LABEL,
  readPageHasSelection
} from "../../../src/popup/popup-state";

describe("popup-state", () => {
  it("使用 selection 作为默认剪藏模式", () => {
    expect(DEFAULT_CLIP_CAPTURE_MODE).toBe("selection");
  });

  it("只接受 shared 契约中的剪藏模式", () => {
    expect(isPopupClipCaptureMode("selection")).toBe(true);
    expect(isPopupClipCaptureMode("page")).toBe(true);
    expect(isPopupClipCaptureMode("full")).toBe(false);
    expect(POPUP_CLIP_CAPTURE_MODE_LABEL.page).toBe("Entire Document");
  });

  it("只把明确 true 的 hasSelection 视为页面存在选区", () => {
    expect(readPageHasSelection({ hasSelection: true })).toBe(true);
    expect(readPageHasSelection({ hasSelection: false })).toBe(false);
    expect(readPageHasSelection({ hasSelection: "true" })).toBe(false);
    expect(readPageHasSelection(null)).toBe(false);
  });

  it("过滤当前 Markdown 已不再引用的图片下载计划", () => {
    const imageDownloads = [
      {
        originalSrc: "https://example.com/assets/keep.png",
        sourceUrl: "https://example.com/assets/keep.png",
        filename: "Images/keep image.png",
        isObsidian: false,
        outputStyle: "download"
      },
      {
        originalSrc: "https://example.com/assets/removed.png",
        sourceUrl: "https://example.com/assets/removed.png",
        filename: "Images/removed.png",
        isObsidian: false,
        outputStyle: "download"
      }
    ] as const;

    const filtered = filterImageDownloadsForMarkdown("![Keep](Images/keep%20image.png)", imageDownloads);

    expect(filtered).toEqual([imageDownloads[0]]);
  });

  it("原始 URL 图片样式仍按当前 Markdown 引用保留下载计划", () => {
    const imageDownloads = [
      {
        originalSrc: "https://example.com/assets/photo.png",
        sourceUrl: "https://example.com/assets/photo.png",
        filename: "Images/photo.png",
        isObsidian: false,
        outputStyle: "download"
      }
    ] as const;

    const filtered = filterImageDownloadsForMarkdown("![Photo](https://example.com/assets/photo.png)", imageDownloads);

    expect(filtered).toEqual(imageDownloads);
  });
});
