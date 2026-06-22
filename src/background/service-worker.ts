import { registerCommandListeners, type CommandsRegistrationApi } from "./commands";
import { queueRebuildContextMenus, registerContextMenuClickListener, type ContextMenusRegistrationApi } from "./context-menus";
import { createBatchJobDependencies, resumeRecoverableBatchJobs, type BatchJobDependencies } from "./batch-jobs";
import {
  createMarkdownActionDependencies,
  readOptions,
  type MarkdownActionDependencies
} from "./markdown-actions";
import { handleBackgroundRuntimeMessage } from "./router";

/** 可注册事件的最小形状。 */
interface ListenerEventTarget<Listener> {
  /** 注册监听器。 */
  addListener(listener: Listener): void;
}

/** runtime 注册所需最小 API。 */
interface RuntimeRegistrationApi {
  /** 安装事件。 */
  onInstalled: ListenerEventTarget<(details: chrome.runtime.InstalledDetails) => void>;
  /** 浏览器启动事件。 */
  onStartup: ListenerEventTarget<() => void>;
  /** runtime message 事件。 */
  onMessage: ListenerEventTarget<typeof handleBackgroundRuntimeMessage>;
}

/** downloads 注册所需最小 API。 */
interface DownloadsRegistrationApi {
  /** 下载状态变化事件。 */
  onChanged: ListenerEventTarget<(downloadDelta: chrome.downloads.DownloadDelta) => void>;
}

/** storage 注册所需最小 API。 */
interface StorageRegistrationApi {
  /** storage 变化事件。 */
  onChanged: ListenerEventTarget<(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void>;
}

/** tabs 注册所需最小 API。 */
interface TabsRegistrationApi {
  /** tab 激活事件。 */
  onActivated: ListenerEventTarget<(activeInfo: chrome.tabs.OnActivatedInfo) => void>;
  /** tab 更新事件。 */
  onUpdated: ListenerEventTarget<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void>;
  /** tab 移除事件。 */
  onRemoved: ListenerEventTarget<(tabId: number, removeInfo: chrome.tabs.OnRemovedInfo) => void>;
}

/** service worker 注册依赖。 */
export interface ServiceWorkerRegistrationApis {
  /** runtime API。 */
  runtime: RuntimeRegistrationApi;
  /** commands API。 */
  commands: CommandsRegistrationApi;
  /** contextMenus API。 */
  contextMenus: ContextMenusRegistrationApi;
  /** downloads API。 */
  downloads: DownloadsRegistrationApi;
  /** storage API。 */
  storage: StorageRegistrationApi;
  /** tabs API。 */
  tabs: TabsRegistrationApi;
  /** M8 Markdown 动作依赖。 */
  markdownActions?: MarkdownActionDependencies;
  /** M9 批量任务依赖。 */
  batchJobs?: BatchJobDependencies;
}

/** 已注册事件，防止同一 worker 实例重复挂监听器。 */
const registeredEvents = new WeakSet<object>();

/** context menu 重建触发序号，防止旧 options 慢返回后覆盖新菜单。 */
let latestMenuRebuildRequestSequence = 0;

/** 创建 Markdown action 依赖，测试可注入。 */
function readMarkdownActionDependencies(apis: ServiceWorkerRegistrationApis): MarkdownActionDependencies {
  return apis.markdownActions ?? createMarkdownActionDependencies();
}

/** 创建 batch job 依赖，测试可注入。 */
function readBatchJobDependencies(apis: ServiceWorkerRegistrationApis): BatchJobDependencies {
  return apis.batchJobs ?? createBatchJobDependencies();
}

/** 按 storage.sync 当前配置重建 context menu。 */
async function rebuildMenusFromStorage(
  contextMenusApi: ContextMenusRegistrationApi,
  actionDependencies: MarkdownActionDependencies
): Promise<void> {
  latestMenuRebuildRequestSequence += 1;
  const requestSequence = latestMenuRebuildRequestSequence;
  const options = await readOptions(actionDependencies);
  if (requestSequence !== latestMenuRebuildRequestSequence) {
    return;
  }

  await queueRebuildContextMenus(contextMenusApi, options);
}

/** 安装事件重建 context menu。 */
function handleInstalled(
  contextMenusApi: ContextMenusRegistrationApi,
  actionDependencies: MarkdownActionDependencies
): void {
  void rebuildMenusFromStorage(contextMenusApi, actionDependencies);
}

/** 启动事件重建 context menu。 */
function handleStartup(
  contextMenusApi: ContextMenusRegistrationApi,
  actionDependencies: MarkdownActionDependencies
): void {
  void rebuildMenusFromStorage(contextMenusApi, actionDependencies);
}

/** 空下载变化 handler，M3 不实现下载业务。 */
function handleDownloadsChanged(_downloadDelta: chrome.downloads.DownloadDelta): void {
  void _downloadDelta;

  return undefined;
}

/** storage.sync 变化后重建 context menu。 */
function handleStorageChanged(
  _changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
  contextMenusApi: ContextMenusRegistrationApi,
  actionDependencies: MarkdownActionDependencies
): void {
  void _changes;
  if (areaName !== "sync") {
    return;
  }

  void rebuildMenusFromStorage(contextMenusApi, actionDependencies);
}

/** 空 tab 激活 handler，M3 只建立监听入口。 */
function handleTabActivated(_activeInfo: chrome.tabs.OnActivatedInfo): void {
  void _activeInfo;

  return undefined;
}

/** 空 tab 更新 handler，M3 只建立监听入口。 */
function handleTabUpdated(_tabId: number, _changeInfo: chrome.tabs.OnUpdatedInfo, _tab: chrome.tabs.Tab): void {
  void _tabId;
  void _changeInfo;
  void _tab;

  return undefined;
}

/** 空 tab 移除 handler，M3 只建立监听入口。 */
function handleTabRemoved(_tabId: number, _removeInfo: chrome.tabs.OnRemovedInfo): void {
  void _tabId;
  void _removeInfo;

  return undefined;
}

/** 顶层同步调用的 service worker 注册入口。 */
export function registerServiceWorkerListeners(apis: ServiceWorkerRegistrationApis): void {
  const actionDependencies = readMarkdownActionDependencies(apis);
  const batchDependencies = readBatchJobDependencies(apis);

  registerEventOnce(apis.runtime.onInstalled, (details: chrome.runtime.InstalledDetails) => {
    handleInstalled(apis.contextMenus, actionDependencies);
    void details;
  });
  registerEventOnce(apis.runtime.onStartup, () => {
    handleStartup(apis.contextMenus, actionDependencies);
  });
  registerEventOnce(apis.runtime.onMessage, handleBackgroundRuntimeMessage);
  registerCommandListeners(apis.commands, actionDependencies);
  registerContextMenuClickListener(apis.contextMenus, actionDependencies);
  registerEventOnce(apis.downloads.onChanged, handleDownloadsChanged);
  registerEventOnce(apis.storage.onChanged, (changes, areaName) => {
    handleStorageChanged(changes, areaName, apis.contextMenus, actionDependencies);
  });
  registerEventOnce(apis.tabs.onActivated, handleTabActivated);
  registerEventOnce(apis.tabs.onUpdated, handleTabUpdated);
  registerEventOnce(apis.tabs.onRemoved, handleTabRemoved);
  void rebuildMenusFromStorage(apis.contextMenus, actionDependencies);
  void resumeRecoverableBatchJobs(batchDependencies);
}

/** 对单个事件目标做幂等注册。 */
function registerEventOnce<Listener>(
  eventTarget: ListenerEventTarget<Listener>,
  listener: Listener
): void {
  if (registeredEvents.has(eventTarget)) {
    return;
  }

  eventTarget.addListener(listener);
  registeredEvents.add(eventTarget);
}

const chromeApi = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;

if (chromeApi !== undefined) {
  registerServiceWorkerListeners({
    runtime: chromeApi.runtime,
    commands: chromeApi.commands,
    contextMenus: chromeApi.contextMenus,
    downloads: chromeApi.downloads,
    storage: chromeApi.storage,
    tabs: chromeApi.tabs
  });
}
