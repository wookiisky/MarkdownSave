import { useEffect, useRef, useState, type JSX } from "react";
import {
  DEFAULT_CLIP_CAPTURE_MODE,
  MessageType,
  type ClipCaptureMode,
  type ClipCaptureResultData,
  type MarkdownDownloadSettingsData,
  type MarkdownImageDownloadItem
} from "../shared/messages";
import { formatRequestId } from "../shared/request-id";
import type { ExtensionResponse } from "../shared/errors";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { readPopupStoredOptions, savePopupStoredOption } from "./popup-options";
import { filterImageDownloadsForMarkdown, POPUP_CLIP_CAPTURE_MODE_LABEL, readPageHasSelection } from "./popup-state";
import "./popup.css";

/** runtime 状态文案。 */
type RuntimeStatusText = "Runtime checking" | "Runtime ready" | "Runtime unavailable";

/** 剪藏流程状态。 */
type ClipStatusText = "idle" | "clipping" | "ready" | "copying" | "copied" | "downloading" | "downloaded" | "failed";

/** 发送最小 runtime ping。 */
async function readRuntimeStatus(): Promise<RuntimeStatusText> {
  const runtime = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome?.runtime;

  if (runtime === undefined) {
    return "Runtime unavailable";
  }

  const response = await runtime.sendMessage({
    type: MessageType.RUNTIME_PING_REQUEST,
    requestId: formatRequestId("popup-runtime")
  });

  if (response !== null && typeof response === "object" && "ok" in response && response.ok === true) {
    return "Runtime ready";
  }

  return "Runtime unavailable";
}

/** 向 background 请求当前页剪藏。 */
async function requestCurrentPageClip(clipMode: ClipCaptureMode, downloadImages: boolean): Promise<ClipCaptureResultData> {
  const response = (await chrome.runtime.sendMessage({
    type: MessageType.CLIP_CAPTURE_REQUEST,
    requestId: formatRequestId("popup-clip"),
    clipMode,
    downloadImages
  })) as ExtensionResponse<ClipCaptureResultData>;

  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

/** 请求 background 下载 Markdown。 */
async function requestMarkdownDownload(
  markdown: string,
  title: string,
  imageDownloads: ReadonlyArray<MarkdownImageDownloadItem>,
  downloadSettings: MarkdownDownloadSettingsData
): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
    requestId: formatRequestId("popup-download"),
    markdown,
    title,
    imageDownloads,
    downloadSettings
  })) as ExtensionResponse<{ downloaded: true; downloadId: number }>;

  if (!response.ok) {
    throw new Error(response.error.message);
  }
}

/** 渲染 popup 剪藏和 Markdown 编辑入口。 */
export function PopupApp(): JSX.Element {
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatusText>("Runtime checking");
  const [clipStatus, setClipStatus] = useState<ClipStatusText>("idle");
  const [markdown, setMarkdown] = useState("");
  const [title, setTitle] = useState("MarkdownSave");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [clipMode, setClipMode] = useState<ClipCaptureMode>(DEFAULT_CLIP_CAPTURE_MODE);
  const [pageHasSelection, setPageHasSelection] = useState(false);
  const [editorHasSelection, setEditorHasSelection] = useState(false);
  const [downloadImages, setDownloadImages] = useState(false);
  const [includeTemplate, setIncludeTemplate] = useState(false);
  const [imageDownloads, setImageDownloads] = useState<ReadonlyArray<MarkdownImageDownloadItem>>([]);
  const [downloadSettings, setDownloadSettings] = useState<MarkdownDownloadSettingsData>(DEFAULT_DOWNLOAD_SETTINGS);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);

  useEffect(() => {
    let active = true;

    readRuntimeStatus()
      .then((status) => {
        if (active) {
          setRuntimeStatus(status);
        }
      })
      .catch(() => {
        if (active) {
          setRuntimeStatus("Runtime unavailable");
        }
      });

    readPopupStoredOptions()
      .then((options) => {
        if (!active) {
          return;
        }

        setIncludeTemplate(options.includeTemplate);
        setDownloadImages(options.downloadImages);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setErrorText("读取 popup 配置失败。");
      });

    return () => {
      active = false;
    };
  }, []);

  const canUseMarkdown = markdown.trim().length > 0;
  const canDownloadEditorSelection = canUseMarkdown && editorHasSelection;
  const showSpinner = clipStatus === "clipping";

  async function handleClip(): Promise<void> {
    setClipStatus("clipping");
    setErrorText(null);

    try {
      const result = await requestCurrentPageClip(clipMode, downloadImages);
      setMarkdown(result.markdown);
      setTitle(result.title || result.article.pageTitle || "MarkdownSave");
      setImageDownloads(result.imageDownloads);
      setDownloadSettings(result.downloadSettings);
      setPageHasSelection(readPageHasSelection(result));
      setEditorHasSelection(false);
      setClipStatus("ready");
    } catch (error) {
      setPageHasSelection(false);
      setImageDownloads([]);
      setErrorText(error instanceof Error ? error.message : "当前页面剪藏失败。");
      setClipStatus("failed");
    }
  }

  async function handleCopy(): Promise<void> {
    if (!canUseMarkdown) {
      return;
    }

    setClipStatus("copying");
    setErrorText(null);

    try {
      await navigator.clipboard.writeText(markdown);
      setClipStatus("copied");
    } catch {
      setErrorText("复制到剪贴板失败。");
      setClipStatus("failed");
    }
  }

  async function handleDownload(): Promise<void> {
    if (!canUseMarkdown) {
      return;
    }

    setClipStatus("downloading");
    setErrorText(null);

    try {
      const referencedImageDownloads = filterImageDownloadsForMarkdown(markdown, imageDownloads);
      await requestMarkdownDownload(markdown, title, referencedImageDownloads, downloadSettings);
      setClipStatus("downloaded");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Markdown 下载失败。");
      setClipStatus("failed");
    }
  }

  async function handleDownloadSelection(): Promise<void> {
    const selectedMarkdown = editorRef.current?.readSelectedText() ?? "";

    if (selectedMarkdown.trim().length === 0) {
      setEditorHasSelection(false);
      return;
    }

    setClipStatus("downloading");
    setErrorText(null);

    try {
      await requestMarkdownDownload(selectedMarkdown, title, [], downloadSettings);
      setClipStatus("downloaded");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "选中 Markdown 下载失败。");
      setClipStatus("failed");
    }
  }

  async function handleIncludeTemplateToggle(): Promise<void> {
    const nextValue = !includeTemplate;
    setIncludeTemplate(nextValue);
    setErrorText(null);

    try {
      await savePopupStoredOption("includeTemplate", nextValue);

      if (clipStatus !== "idle") {
        await handleClip();
      }
    } catch {
      setIncludeTemplate(!nextValue);
      setErrorText("更新 includeTemplate 配置失败。");
    }
  }

  return (
    <main className="popup-shell">
      <div className="popup-panel">
        <h1 className="sr-only">MarkdownSave</h1>
        <button
          aria-pressed={downloadImages}
          className={readToggleClassName(downloadImages)}
          id="downloadImages"
          type="button"
          onClick={() => {
            setDownloadImages((enabled) => !enabled);
          }}
        >
          <span aria-hidden="true" className="popup-toggle-indicator" />
          <span>Download Images</span>
        </button>

        <a className="popup-settings-link" href="/options/index.html" id="options" target="_blank" rel="noreferrer">
          <span className="sr-only">Open options</span>
        </a>

        {pageHasSelection ? (
          <div aria-label="Clip mode" className="popup-mode-row" id="clipOption" role="group">
            {(["selection", "page"] as const).map((mode) => (
              <button
                aria-pressed={clipMode === mode}
                className={readToggleClassName(clipMode === mode)}
                id={mode === "selection" ? "selected" : "document"}
                key={mode}
                type="button"
                onClick={() => {
                  setClipMode(mode);
                }}
              >
                <span aria-hidden="true" className="popup-toggle-indicator" />
                <span>{POPUP_CLIP_CAPTURE_MODE_LABEL[mode]}</span>
              </button>
            ))}
          </div>
        ) : null}

        <button
          aria-pressed={includeTemplate}
          className={readToggleClassName(includeTemplate)}
          id="includeTemplate"
          type="button"
          onClick={() => {
            void handleIncludeTemplateToggle();
          }}
        >
          <span aria-hidden="true" className="popup-toggle-indicator" />
          <span>Include front/back template</span>
        </button>

        <label className="sr-only" htmlFor="popup-title-input">
          Markdown title
        </label>
        <input
          className="popup-title-input"
          id="popup-title-input"
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.currentTarget.value);
          }}
        />

        <MarkdownEditor
          ariaLabel="Markdown editor"
          className="popup-editor"
          onChange={(value) => {
            setMarkdown(value);
            setClipStatus("ready");
          }}
          onSelectionChange={setEditorHasSelection}
          placeholder="Markdown preview"
          ref={editorRef}
          value={markdown}
        />

        <textarea
          aria-label="Markdown preview"
          className="popup-preview-mirror"
          readOnly
          tabIndex={-1}
          value={markdown}
        />

        <div className="popup-actions">
          <button
            className="popup-primary-button"
            disabled={clipStatus === "clipping"}
            type="button"
            onClick={() => {
              void handleClip();
            }}
          >
            Clip
          </button>
          <button
            className="popup-primary-button"
            disabled={!canUseMarkdown}
            type="button"
            onClick={() => {
              void handleCopy();
            }}
          >
            Copy
          </button>
          <button
            className="popup-primary-button"
            disabled={!canUseMarkdown}
            type="button"
            onClick={() => {
              void handleDownload();
            }}
          >
            Download
          </button>
          <button
            className={canDownloadEditorSelection ? "popup-secondary-button" : "popup-secondary-button popup-secondary-button-hidden"}
            disabled={!canDownloadEditorSelection}
            id="downloadSelection"
            type="button"
            onClick={() => {
              void handleDownloadSelection();
            }}
          >
            Download Selection
          </button>
        </div>

        <p className={`popup-status${errorText === null ? "" : " popup-status-error"}`}>{errorText ?? readClipStatusText(clipStatus)}</p>
        <p className="popup-runtime-status">{runtimeStatus}</p>
      </div>

      {showSpinner ? <div aria-hidden="true" className="popup-spinner" id="spinner" /> : null}
    </main>
  );
}

/** 读取 toggle class。 */
function readToggleClassName(checked: boolean): string {
  return checked ? "popup-toggle-button popup-toggle-button-checked" : "popup-toggle-button";
}

/** popup 操作状态文案。 */
function readClipStatusText(status: ClipStatusText): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "clipping":
      return "Clipping current page";
    case "ready":
      return "Markdown ready";
    case "copying":
      return "Copying";
    case "copied":
      return "Copied";
    case "downloading":
      return "Downloading";
    case "downloaded":
      return "Downloaded";
    case "failed":
      return "Failed";
  }
}

/** popup 下载设置默认值，缺少转换结果时仍保持可下载。 */
const DEFAULT_DOWNLOAD_SETTINGS: MarkdownDownloadSettingsData = {
  downloadMode: "downloadsApi",
  saveAs: false,
  mdClipsFolder: null,
  disallowedChars: "[]#^"
};
