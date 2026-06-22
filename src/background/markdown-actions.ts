import {
  createExtensionError,
  ExtensionErrorCode,
  toErrorResponse,
  toSuccessResponse,
  type ExtensionError,
  type ExtensionResponse
} from "../shared/errors";
import { formatRequestId } from "../shared/request-id";
import { buildAdvancedObsidianUri, formatObsidianFolder } from "../shared/obsidian/advanced-uri";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../shared/options/defaults";
import { coerceMarkdownSaveOptionsFromUnknown, type MarkdownSaveOptions } from "../shared/options/schema";
import { replaceTemplateText, type TemplateArticle } from "../shared/template/replace";
import {
  clipTabAsMarkdown,
  createClipCurrentPageDependencies,
  createDownloadMarkdownDependencies,
  downloadMarkdownFromRequest,
  type ClipCurrentPageDependencies,
  type DownloadMarkdownDependencies
} from "./clip-flow";
import { startBatchDownloadJob } from "./batch-jobs";
import { reportChromeActionFailure } from "./markdown-action-diagnostics";
import { isRestrictedTabUrl, readActiveTab, type ActiveTabInfo, type TabsQueryApi } from "./tabs";
import { MessageType, type BatchJobSummaryData, type BatchStartRequest, type ClipCaptureMode, type ClipCaptureResultData, type MarkdownConvertArticleMetadata } from "../shared/messages";
import { formatJobId } from "../shared/request-id";

/** Markdown 动作类型。 */
export type MarkdownActionKind =
  | "downloadTab"
  | "downloadSelection"
  | "downloadAllTabs"
  | "copyTab"
  | "copySelection"
  | "copyTabLink"
  | "copyAllTabLinks"
  | "copySelectedTabLinks"
  | "copyLink"
  | "copyImage"
  | "copySelectionToObsidian"
  | "copyTabToObsidian"
  | "toggleIncludeTemplate"
  | "toggleDownloadImages";

/** context menu 点击中 M8 需要的最小信息。 */
export interface MarkdownContextActionInfo {
  /** 菜单 id。 */
  menuItemId: string | number;
  /** 链接 URL。 */
  linkUrl?: string;
  /** 链接文本。 */
  linkText?: string;
  /** 页面选中文本。 */
  selectionText?: string;
  /** 图片 URL。 */
  srcUrl?: string;
}

/** Markdown action 依赖。 */
export interface MarkdownActionDependencies {
  /** 剪藏依赖。 */
  clip: ClipCurrentPageDependencies;
  /** 下载依赖。 */
  download: DownloadMarkdownDependencies;
  /** tabs 查询 API。 */
  tabs: TabsQueryApi;
  /** 读取 storage.sync 配置。 */
  readStoredOptions(): Promise<unknown>;
  /** 写入 storage.sync 配置。 */
  writeStoredOptions(options: MarkdownSaveOptions): Promise<void>;
  /** 通过页面或 offscreen 边界写剪贴板。 */
  writeClipboard(tabId: number, text: string): Promise<void>;
  /** 打开 Obsidian Advanced URI。 */
  openUri(uri: string): Promise<void>;
  /** 将 command/context menu 触发的失败写入可见诊断通道。 */
  reportActionFailure(error: ExtensionError): Promise<void>;
  /** 启动批量下载任务。 */
  startBatchDownload(request: BatchStartRequest): Promise<ExtensionResponse<BatchJobSummaryData>>;
  /** 创建单次 batch 触发 id。 */
  createBatchActionId(): string;
}

/** 创建默认 Markdown action 依赖。 */
export function createMarkdownActionDependencies(): MarkdownActionDependencies {
  return {
    clip: createClipCurrentPageDependencies(),
    download: createDownloadMarkdownDependencies(),
    tabs: chrome.tabs,
    readStoredOptions() {
      return chrome.storage.sync.get(null);
    },
    writeStoredOptions(options) {
      return chrome.storage.sync.set(options);
    },
    async writeClipboard(tabId, text) {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: writeTextToClipboardInPage,
        args: [text]
      });
    },
    async openUri(uri) {
      await chrome.tabs.update({ url: uri });
    },
    async reportActionFailure(error) {
      await reportChromeActionFailure(error);
    },
    startBatchDownload(request) {
      return startBatchDownloadJob(request);
    },
    createBatchActionId() {
      return createDefaultBatchActionId();
    }
  };
}

/** 执行 Markdown action，并把失败响应上报给用户可见诊断通道。 */
export async function executeMarkdownActionAndReport(
  kind: MarkdownActionKind,
  input: {
    /** 触发动作的 tab。 */
    tab?: chrome.tabs.Tab | ActiveTabInfo | null;
    /** context menu 点击信息。 */
    info?: MarkdownContextActionInfo;
  },
  dependencies: MarkdownActionDependencies = createMarkdownActionDependencies()
): Promise<ExtensionResponse<{ handled: true }>> {
  const response = await executeMarkdownAction(kind, input, dependencies);
  if (!response.ok) {
    await safelyReportActionFailure(response.error, dependencies);
  }

  return response;
}

/** 执行 Markdown action。 */
export async function executeMarkdownAction(
  kind: MarkdownActionKind,
  input: {
    /** 触发动作的 tab。 */
    tab?: chrome.tabs.Tab | ActiveTabInfo | null;
    /** context menu 点击信息。 */
    info?: MarkdownContextActionInfo;
  },
  dependencies: MarkdownActionDependencies = createMarkdownActionDependencies()
): Promise<ExtensionResponse<{ handled: true }>> {
  try {
    const options = await readOptions(dependencies);

    if (kind === "toggleIncludeTemplate") {
      await toggleBooleanOption("includeTemplate", options, dependencies);
      return toSuccessResponse(formatRequestId("markdown-action"), { handled: true });
    }

    if (kind === "toggleDownloadImages") {
      await toggleBooleanOption("downloadImages", options, dependencies);
      return toSuccessResponse(formatRequestId("markdown-action"), { handled: true });
    }

    if (kind === "downloadAllTabs") {
      const batch = await downloadAllTabs(dependencies);
      return batch.ok ? toSuccessResponse(formatRequestId("markdown-action"), { handled: true }) : batch;
    }

    const activeTab = await readActionTab(input.tab, dependencies);
    if (activeTab === null || activeTab.restricted) {
      return toErrorResponse(
        null,
        createExtensionError(ExtensionErrorCode.RESTRICTED_PAGE, {
          details: { url: activeTab?.url ?? null }
        })
      );
    }

    if (kind === "copyLink") {
      await copyContextLink(activeTab.id, input.info, dependencies);
      return toSuccessResponse(formatRequestId("markdown-action"), { handled: true });
    }

    if (kind === "copyImage") {
      await copyContextImage(activeTab.id, input.info, dependencies);
      return toSuccessResponse(formatRequestId("markdown-action"), { handled: true });
    }

    if (kind === "copyAllTabLinks" || kind === "copySelectedTabLinks") {
      await copyTabLinkList(kind, activeTab.id, options, dependencies);
      return toSuccessResponse(formatRequestId("markdown-action"), { handled: true });
    }

    if (kind === "copyTabLink") {
      const clip = await clipForAction(activeTab, "page", options, dependencies);
      if (!clip.ok) {
        return clip;
      }

      await dependencies.writeClipboard(activeTab.id, formatTabMarkdownLink(clip.data, activeTab.url));
      return toSuccessResponse(formatRequestId("markdown-action"), { handled: true });
    }

    if (kind === "downloadTab" || kind === "downloadSelection") {
      const clip = await clipForAction(activeTab, readClipMode(kind), options, dependencies);
      if (!clip.ok) {
        return clip;
      }

      const download = await downloadClip(clip.data, dependencies);
      return download.ok ? toSuccessResponse(formatRequestId("markdown-action"), { handled: true }) : download;
    }

    if (kind === "copyTab" || kind === "copySelection") {
      const clip = await clipForAction(activeTab, readClipMode(kind), withoutImageDownloads(options), dependencies);
      if (!clip.ok) {
        return clip;
      }

      await dependencies.writeClipboard(activeTab.id, clip.data.markdown);
      return toSuccessResponse(formatRequestId("markdown-action"), { handled: true });
    }

    if (kind === "copySelectionToObsidian" || kind === "copyTabToObsidian") {
      const clip = await clipForAction(activeTab, readClipMode(kind), withoutImageDownloads(options), dependencies);
      if (!clip.ok) {
        return clip;
      }

      await dependencies.writeClipboard(activeTab.id, clip.data.markdown);
      await dependencies.openUri(createObsidianUri(clip.data, options));
      return toSuccessResponse(formatRequestId("markdown-action"), { handled: true });
    }

    return toErrorResponse(
      null,
      createExtensionError(ExtensionErrorCode.NOT_IMPLEMENTED, {
        details: { action: kind }
      })
    );
  } catch (error) {
    return toErrorResponse(
      null,
      createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, {
        details: {
          reason: "markdown_action_failed",
          action: kind,
          errorName: error instanceof Error ? error.name : typeof error
        }
      })
    );
  }
}

/** 读取并清洗当前 options。 */
export async function readOptions(dependencies: Pick<MarkdownActionDependencies, "readStoredOptions">): Promise<MarkdownSaveOptions> {
  const result = coerceMarkdownSaveOptionsFromUnknown(await dependencies.readStoredOptions());

  return result.ok ? result.options : DEFAULT_MARKDOWN_SAVE_OPTIONS;
}

/** 将 Chrome tab 清洗为 action tab。 */
function toActiveTabInfo(tab: chrome.tabs.Tab | ActiveTabInfo | null | undefined): ActiveTabInfo | null {
  if (tab === null || tab === undefined) {
    return null;
  }

  if ("restricted" in tab) {
    return tab;
  }

  if (typeof tab.id !== "number") {
    return null;
  }

  const url = tab.url ?? null;
  return {
    id: tab.id,
    url,
    restricted: isRestrictedTabUrl(url)
  };
}

/** 读取触发动作的 tab，缺失时 fallback active tab。 */
async function readActionTab(
  tab: chrome.tabs.Tab | ActiveTabInfo | null | undefined,
  dependencies: MarkdownActionDependencies
): Promise<ActiveTabInfo | null> {
  const fromInput = toActiveTabInfo(tab);
  if (fromInput !== null) {
    return fromInput;
  }

  return readActiveTab(dependencies.tabs);
}

/** 读取 action 对应剪藏模式。 */
function readClipMode(kind: MarkdownActionKind): ClipCaptureMode {
  if (kind === "downloadSelection" || kind === "copySelection" || kind === "copySelectionToObsidian") {
    return "selection";
  }

  return "page";
}

/** 关闭图片下载后复制 Markdown。 */
function withoutImageDownloads(options: MarkdownSaveOptions): MarkdownSaveOptions {
  return {
    ...options,
    downloadImages: false
  };
}

/** 执行剪藏。 */
async function clipForAction(
  tab: ActiveTabInfo,
  clipMode: ClipCaptureMode,
  options: MarkdownSaveOptions,
  dependencies: MarkdownActionDependencies
): Promise<ExtensionResponse<ClipCaptureResultData>> {
  return clipTabAsMarkdown(formatRequestId("markdown-action-clip"), tab, dependencies.clip, clipMode, options.downloadImages, options);
}

/** 下载剪藏结果。 */
async function downloadClip(
  clip: ClipCaptureResultData,
  dependencies: MarkdownActionDependencies
): Promise<ExtensionResponse<{ downloaded: true; downloadId: number }>> {
  return downloadMarkdownFromRequest(
    {
      type: "download.markdown.request",
      requestId: formatRequestId("markdown-action-download"),
      markdown: clip.markdown,
      title: clip.title,
      imageDownloads: clip.imageDownloads,
      downloadSettings: clip.downloadSettings
    },
    dependencies.download
  );
}

/** 启动当前窗口批量下载 job。 */
async function downloadAllTabs(
  dependencies: MarkdownActionDependencies
): Promise<ExtensionResponse<BatchJobSummaryData>> {
  const batchId = dependencies.createBatchActionId();
  const jobId = formatJobId(batchId);
  return dependencies.startBatchDownload({
    type: MessageType.BATCH_START_REQUEST,
    requestId: formatRequestId(`markdown-action-batch-start-${batchId}`),
    jobId
  });
}

/** batch action 默认 id 序列，补足 Date.now 毫秒级碰撞。 */
let batchActionSequence = 0;

/** 创建默认 batch action id。 */
function createDefaultBatchActionId(): string {
  batchActionSequence += 1;
  return `${Date.now()}-${batchActionSequence}`;
}

/** 复制 context link。 */
async function copyContextLink(
  tabId: number,
  info: MarkdownContextActionInfo | undefined,
  dependencies: MarkdownActionDependencies
): Promise<void> {
  const url = typeof info?.linkUrl === "string" ? info.linkUrl : "";
  const text = typeof info?.linkText === "string" && info.linkText.length > 0 ? info.linkText : info?.selectionText ?? url;

  await dependencies.writeClipboard(tabId, `[${text}](${url})`);
}

/** 复制 context image。 */
async function copyContextImage(
  tabId: number,
  info: MarkdownContextActionInfo | undefined,
  dependencies: MarkdownActionDependencies
): Promise<void> {
  const srcUrl = typeof info?.srcUrl === "string" ? info.srcUrl : "";

  await dependencies.writeClipboard(tabId, `![](${srcUrl})`);
}

/** 复制当前窗口 tab 链接列表。 */
async function copyTabLinkList(
  kind: "copyAllTabLinks" | "copySelectedTabLinks",
  targetTabId: number,
  options: MarkdownSaveOptions,
  dependencies: MarkdownActionDependencies
): Promise<void> {
  const tabs = await dependencies.tabs.query(
    kind === "copySelectedTabLinks" ? { currentWindow: true, highlighted: true } : { currentWindow: true }
  );
  const links: string[] = [];

  for (const tab of tabs) {
    const activeTab = toActiveTabInfo(tab);
    if (activeTab === null || activeTab.restricted) {
      continue;
    }

    const clip = await clipForAction(activeTab, "page", withoutImageDownloads(options), dependencies);
    if (clip.ok) {
      links.push(`${options.bulletListMarker} ${formatTabMarkdownLink(clip.data, activeTab.url)}`);
    }
  }

  await dependencies.writeClipboard(targetTabId, links.join("\n"));
}

/** 格式化当前 tab Markdown 链接。 */
function formatTabMarkdownLink(clip: ClipCaptureResultData, tabUrl: string | null): string {
  return `[${clip.title}](${tabUrl ?? clip.article.baseURI})`;
}

/** 创建 Obsidian Advanced URI。 */
function createObsidianUri(clip: ClipCaptureResultData, options: MarkdownSaveOptions): string {
  const replacedFolder = replaceTemplateText(options.obsidianFolder, toTemplateArticle(clip.article), {
    disallowedChars: options.disallowedChars
  });
  const folder = formatObsidianFolder({
    folder: replacedFolder,
    disallowedChars: options.disallowedChars
  });

  return buildAdvancedObsidianUri({
    vault: options.obsidianVault,
    folder,
    title: clip.title
  });
}

/** 将转换 article 元数据显式转为模板输入。 */
function toTemplateArticle(article: MarkdownConvertArticleMetadata): TemplateArticle {
  return {
    title: article.title,
    pageTitle: article.pageTitle,
    byline: article.byline,
    excerpt: article.excerpt,
    siteName: article.siteName,
    baseURI: article.baseURI,
    length: article.length,
    dir: article.dir,
    lang: article.lang,
    publishedTime: article.publishedTime,
    keywords: article.keywords,
    hash: article.hash,
    host: article.host,
    origin: article.origin,
    hostname: article.hostname,
    pathname: article.pathname,
    port: article.port,
    protocol: article.protocol,
    search: article.search
  };
}

/** 切换布尔 options 并写回 storage。 */
async function toggleBooleanOption(
  field: "includeTemplate" | "downloadImages",
  options: MarkdownSaveOptions,
  dependencies: MarkdownActionDependencies
): Promise<void> {
  await dependencies.writeStoredOptions({
    ...options,
    [field]: !options[field]
  });
}

/** 页面执行上下文内写剪贴板，避免 service worker 直接访问 navigator.clipboard。 */
async function writeTextToClipboardInPage(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** 上报失败时不能反向打断 command/context menu 事件边界。 */
async function safelyReportActionFailure(
  error: ExtensionError,
  dependencies: MarkdownActionDependencies
): Promise<void> {
  try {
    await dependencies.reportActionFailure(error);
  } catch {
    return undefined;
  }
}
