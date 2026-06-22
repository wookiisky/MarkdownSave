import type { MarkdownSaveOptions } from "../shared/options/schema";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../shared/options/defaults";
import { executeMarkdownActionAndReport, type MarkdownActionDependencies, type MarkdownActionKind } from "./markdown-actions";

/** context menu 出现上下文非空列表。 */
type ContextMenuContextList = [`${chrome.contextMenus.ContextType}`, ...`${chrome.contextMenus.ContextType}`[]];

/** M3 context menu id，保留 MarkDownload parity 的用户入口边界。 */
export type MarkdownSaveContextMenuId =
  | "download-markdown-tab"
  | "tab-download-markdown-alltabs"
  | "copy-tab-as-markdown-link-tab"
  | "copy-tab-as-markdown-link-all-tab"
  | "copy-tab-as-markdown-link-selected-tab"
  | "tab-separator-1"
  | "tabtoggle-includeTemplate"
  | "tabtoggle-downloadImages"
  | "download-markdown-alltabs"
  | "separator-0"
  | "download-markdown-selection"
  | "download-markdown-all"
  | "separator-1"
  | "copy-markdown-selection"
  | "copy-markdown-link"
  | "copy-markdown-image"
  | "copy-markdown-all"
  | "copy-tab-as-markdown-link"
  | "copy-tab-as-markdown-link-all"
  | "copy-tab-as-markdown-link-selected"
  | "separator-2"
  | "copy-markdown-obsidian"
  | "copy-markdown-obsall"
  | "separator-3"
  | "toggle-includeTemplate"
  | "toggle-downloadImages";

/** contextMenus.create 最小参数。 */
export interface ContextMenuCreateProperties {
  /** 稳定菜单 id。 */
  id: MarkdownSaveContextMenuId;
  /** 菜单标题。 */
  title?: string;
  /** 菜单类型。 */
  type?: "normal" | "checkbox" | "separator";
  /** 菜单出现上下文。 */
  contexts: ContextMenuContextList;
  /** checkbox 初始状态。 */
  checked?: boolean;
}

/** contextMenus API 最小形状。 */
export interface ContextMenusRegistrationApi {
  /** 创建 Chrome context menu。 */
  create(properties: ContextMenuCreateProperties): unknown;
  /** 移除所有旧菜单。 */
  removeAll(): Promise<void> | void;
  /** 更新菜单状态。 */
  update(id: MarkdownSaveContextMenuId, properties: Partial<ContextMenuCreateProperties>): Promise<void> | void;
  /** 菜单点击事件。 */
  onClicked: {
    /** 注册点击监听器。 */
    addListener(listener: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void): void;
  };
}

/** M8 默认 context menu 定义，供 manifest parity 测试使用。 */
export const contextMenuDefinitions: readonly ContextMenuCreateProperties[] = createContextMenuDefinitions(
  DEFAULT_MARKDOWN_SAVE_OPTIONS
);

/** 按 options 创建 context menu 定义。 */
export function createContextMenuDefinitions(options: MarkdownSaveOptions): readonly ContextMenuCreateProperties[] {
  if (!options.contextMenus) {
    return [];
  }

  const definitions: ContextMenuCreateProperties[] = [
    {
      id: "download-markdown-tab",
      title: "Download Tab as Markdown",
      contexts: ["tab"]
    },
    {
      id: "tab-download-markdown-alltabs",
      title: "Download All Tabs as Markdown",
      contexts: ["tab"]
    },
    {
      id: "copy-tab-as-markdown-link-tab",
      title: "Copy Tab URL as Markdown Link",
      contexts: ["tab"]
    },
    {
      id: "copy-tab-as-markdown-link-all-tab",
      title: "Copy All Tab URLs as Markdown Link List",
      contexts: ["tab"]
    },
    {
      id: "copy-tab-as-markdown-link-selected-tab",
      title: "Copy Selected Tab URLs as Markdown Link List",
      contexts: ["tab"]
    },
    {
      id: "tab-separator-1",
      type: "separator",
      contexts: ["tab"]
    },
    {
      id: "tabtoggle-includeTemplate",
      type: "checkbox",
      title: "Include front/back template",
      contexts: ["tab"],
      checked: options.includeTemplate
    },
    {
      id: "tabtoggle-downloadImages",
      type: "checkbox",
      title: "Download Images",
      contexts: ["tab"],
      checked: options.downloadImages
    },
    {
      id: "download-markdown-alltabs",
      title: "Download All Tabs as Markdown",
      contexts: ["all"]
    },
    {
      id: "separator-0",
      type: "separator",
      contexts: ["all"]
    },
    {
      id: "download-markdown-selection",
      title: "Download Selection As Markdown",
      contexts: ["selection"]
    },
    {
      id: "download-markdown-all",
      title: "Download Tab As Markdown",
      contexts: ["all"]
    },
    {
      id: "separator-1",
      type: "separator",
      contexts: ["all"]
    },
    {
      id: "copy-markdown-selection",
      title: "Copy Selection As Markdown",
      contexts: ["selection"]
    },
    {
      id: "copy-markdown-link",
      title: "Copy Link As Markdown",
      contexts: ["link"]
    },
    {
      id: "copy-markdown-image",
      title: "Copy Image As Markdown",
      contexts: ["image"]
    },
    {
      id: "copy-markdown-all",
      title: "Copy Tab As Markdown",
      contexts: ["all"]
    },
    {
      id: "copy-tab-as-markdown-link",
      title: "Copy Tab URL as Markdown Link",
      contexts: ["all"]
    },
    {
      id: "copy-tab-as-markdown-link-all",
      title: "Copy All Tab URLs as Markdown Link List",
      contexts: ["all"]
    },
    {
      id: "copy-tab-as-markdown-link-selected",
      title: "Copy Selected Tab URLs as Markdown Link List",
      contexts: ["all"]
    },
    {
      id: "separator-2",
      type: "separator",
      contexts: ["all"]
    },
    ...(options.obsidianIntegration
      ? [
          {
            id: "copy-markdown-obsidian" as const,
            title: "Send Text selection to Obsidian",
            contexts: ["selection"] as ContextMenuContextList
          },
          {
            id: "copy-markdown-obsall" as const,
            title: "Send Tab to Obsidian",
            contexts: ["all"] as ContextMenuContextList
          }
        ]
      : []),
    {
      id: "separator-3",
      type: "separator",
      contexts: ["all"]
    },
    {
      id: "toggle-includeTemplate",
      type: "checkbox",
      title: "Include front/back template",
      contexts: ["all"],
      checked: options.includeTemplate
    },
    {
      id: "toggle-downloadImages",
      type: "checkbox",
      title: "Download Images",
      contexts: ["all"],
      checked: options.downloadImages
    }
  ];

  return definitions;
}

/** 已注册 context menu 点击事件。 */
const registeredContextMenuClickEvents = new WeakSet<ContextMenusRegistrationApi["onClicked"]>();

/** 串行化 context menu 重建，避免 removeAll/create 并发交错。 */
let contextMenuRebuildQueue: Promise<number> = Promise.resolve(0);

/** 最新重建请求序号，队列中尚未开始的旧请求会被跳过。 */
let latestContextMenuRebuildSequence = 0;

/** 重建 context menu。 */
export async function rebuildContextMenus(
  contextMenusApi: ContextMenusRegistrationApi,
  options: MarkdownSaveOptions
): Promise<number> {
  await contextMenusApi.removeAll();

  const definitions = createContextMenuDefinitions(options);
  for (const definition of definitions) {
    contextMenusApi.create(definition);
  }

  return definitions.length;
}

/** 排队重建 context menu，最终以最新 options 快照为准。 */
export function queueRebuildContextMenus(
  contextMenusApi: ContextMenusRegistrationApi,
  options: MarkdownSaveOptions
): Promise<number> {
  latestContextMenuRebuildSequence += 1;
  const rebuildSequence = latestContextMenuRebuildSequence;

  contextMenuRebuildQueue = contextMenuRebuildQueue
    .catch(() => 0)
    .then(() => {
      if (rebuildSequence !== latestContextMenuRebuildSequence) {
        return 0;
      }

      return rebuildContextMenus(contextMenusApi, options);
    });

  return contextMenuRebuildQueue;
}

/** M3 兼容入口：按默认 options 重建菜单。 */
export function ensureContextMenus(contextMenusApi: ContextMenusRegistrationApi): Promise<number> {
  return queueRebuildContextMenus(contextMenusApi, DEFAULT_MARKDOWN_SAVE_OPTIONS);
}

/** 注册 context menu 点击事件。 */
export function registerContextMenuClickListener(
  contextMenusApi: ContextMenusRegistrationApi,
  actionDependencies?: MarkdownActionDependencies
): void {
  if (registeredContextMenuClickEvents.has(contextMenusApi.onClicked)) {
    return;
  }

  contextMenusApi.onClicked.addListener((info, tab) => {
    const action = readContextMenuAction(String(info.menuItemId));
    if (action === null) {
      return;
    }

    void executeMarkdownActionAndReport(action, { info, tab }, actionDependencies);
  });
  registeredContextMenuClickEvents.add(contextMenusApi.onClicked);
}

/** 将 context menu id 映射到 action。 */
export function readContextMenuAction(menuItemId: string): MarkdownActionKind | null {
  switch (menuItemId) {
    case "download-markdown-tab":
    case "download-markdown-all":
      return "downloadTab";
    case "download-markdown-selection":
      return "downloadSelection";
    case "download-markdown-alltabs":
    case "tab-download-markdown-alltabs":
      return "downloadAllTabs";
    case "copy-markdown-all":
      return "copyTab";
    case "copy-markdown-selection":
      return "copySelection";
    case "copy-tab-as-markdown-link":
    case "copy-tab-as-markdown-link-tab":
      return "copyTabLink";
    case "copy-tab-as-markdown-link-all":
    case "copy-tab-as-markdown-link-all-tab":
      return "copyAllTabLinks";
    case "copy-tab-as-markdown-link-selected":
    case "copy-tab-as-markdown-link-selected-tab":
      return "copySelectedTabLinks";
    case "copy-markdown-link":
      return "copyLink";
    case "copy-markdown-image":
      return "copyImage";
    case "copy-markdown-obsidian":
      return "copySelectionToObsidian";
    case "copy-markdown-obsall":
      return "copyTabToObsidian";
    case "toggle-includeTemplate":
    case "tabtoggle-includeTemplate":
      return "toggleIncludeTemplate";
    case "toggle-downloadImages":
    case "tabtoggle-downloadImages":
      return "toggleDownloadImages";
    default:
      return null;
  }
}
