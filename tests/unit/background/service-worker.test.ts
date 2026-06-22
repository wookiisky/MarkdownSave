/// <reference types="chrome" />

import { describe, expect, it } from "vitest";

import { BATCH_JOBS_STORAGE_KEY } from "../../../src/background/batch-jobs";
import { contextMenuDefinitions } from "../../../src/background/context-menus";
import { registerServiceWorkerListeners, type ServiceWorkerRegistrationApis } from "../../../src/background/service-worker";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";

/** runtime message listener 类型。 */
type RuntimeMessageListener = Parameters<ServiceWorkerRegistrationApis["runtime"]["onMessage"]["addListener"]>[0];

/** 测试用 listener 事件。 */
interface TestEventTarget<Listener> {
  /** 已注册 listener。 */
  listeners: Listener[];
  /** 注册 listener。 */
  addListener(listener: Listener): void;
}

/** 创建测试用 listener 事件。 */
function createEventTarget<Listener>(): TestEventTarget<Listener> {
  return {
    listeners: [],
    addListener(listener) {
      this.listeners.push(listener);
    }
  };
}

/** 延迟解析 Promise，模拟乱序 storage 读取。 */
function createDeferred<Value>(): {
  /** 受控 Promise。 */
  promise: Promise<Value>;
  /** 解析 Promise。 */
  resolve(value: Value): void;
} {
  let resolvePromise: ((value: Value) => void) | null = null;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(value) {
      if (resolvePromise === null) {
        throw new Error("deferred 未初始化");
      }

      resolvePromise(value);
    }
  };
}

/** 等待 service worker 异步重建菜单。 */
function flushAsyncListeners(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** 创建 service worker 注册依赖。 */
function createApis(): ServiceWorkerRegistrationApis & {
  installedEvent: TestEventTarget<(details: chrome.runtime.InstalledDetails) => void>;
  startupEvent: TestEventTarget<() => void>;
  messageEvent: TestEventTarget<RuntimeMessageListener>;
  commandEvent: TestEventTarget<(command: string) => void>;
  contextMenuClickEvent: TestEventTarget<(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void>;
  downloadEvent: TestEventTarget<(downloadDelta: chrome.downloads.DownloadDelta) => void>;
  storageEvent: TestEventTarget<(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void>;
  tabActivatedEvent: TestEventTarget<(activeInfo: chrome.tabs.OnActivatedInfo) => void>;
  tabUpdatedEvent: TestEventTarget<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void>;
  tabRemovedEvent: TestEventTarget<(tabId: number, removeInfo: chrome.tabs.OnRemovedInfo) => void>;
  menuCreates: unknown[];
  menuRemoveAllCount: number;
  batchStorageState: Record<string, unknown>;
  batchBackgroundTasks: Array<Promise<void>>;
} {
  const installedEvent = createEventTarget<(details: chrome.runtime.InstalledDetails) => void>();
  const startupEvent = createEventTarget<() => void>();
  const messageEvent = createEventTarget<RuntimeMessageListener>();
  const commandEvent = createEventTarget<(command: string) => void>();
  const contextMenuClickEvent = createEventTarget<(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void>();
  const downloadEvent = createEventTarget<(downloadDelta: chrome.downloads.DownloadDelta) => void>();
  const storageEvent = createEventTarget<(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void>();
  const tabActivatedEvent = createEventTarget<(activeInfo: chrome.tabs.OnActivatedInfo) => void>();
  const tabUpdatedEvent = createEventTarget<(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void>();
  const tabRemovedEvent = createEventTarget<(tabId: number, removeInfo: chrome.tabs.OnRemovedInfo) => void>();
  const menuCreates: unknown[] = [];
  const batchStorageState: Record<string, unknown> = {};
  const batchBackgroundTasks: Array<Promise<void>> = [];
  let menuRemoveAllCount = 0;

  return {
    installedEvent,
    startupEvent,
    messageEvent,
    commandEvent,
    contextMenuClickEvent,
    downloadEvent,
    storageEvent,
    tabActivatedEvent,
    tabUpdatedEvent,
    tabRemovedEvent,
    menuCreates,
    batchStorageState,
    batchBackgroundTasks,
    get menuRemoveAllCount() {
      return menuRemoveAllCount;
    },
    runtime: {
      onInstalled: installedEvent,
      onStartup: startupEvent,
      onMessage: messageEvent
    },
    commands: {
      onCommand: commandEvent
    },
    contextMenus: {
      create(properties) {
        menuCreates.push(properties);
      },
      removeAll() {
        menuRemoveAllCount += 1;
        menuCreates.splice(0, menuCreates.length);
      },
      update() {
        return undefined;
      },
      onClicked: contextMenuClickEvent
    },
    markdownActions: {
      clip: {
        readActiveTab: () => Promise.resolve({ id: 1, url: "https://example.com", restricted: false }),
        captureTab: () => {
          throw new Error("不应执行剪藏");
        },
        ensureOffscreenDocument: () => {
          throw new Error("不应创建 offscreen");
        },
        sendRuntimeMessage: () => {
          throw new Error("不应发送 runtime 消息");
        }
      },
      download: {
        download: () => {
          throw new Error("不应下载");
        }
      },
      tabs: {
        query: () => Promise.resolve([])
      },
      readStoredOptions: () => Promise.resolve(DEFAULT_MARKDOWN_SAVE_OPTIONS),
      writeStoredOptions: () => Promise.resolve(),
      writeClipboard: () => Promise.resolve(),
      openUri: () => Promise.resolve(),
      reportActionFailure: () => Promise.resolve(),
      startBatchDownload: () =>
        Promise.resolve({
          ok: true,
          requestId: "req_batch",
          data: {
            jobId: "job_batch",
            status: "queued",
            totalTabs: 0,
            completedTabs: 0,
            failedTabs: 0
          }
        }),
      createBatchActionId: () => "batch-test"
    },
    batchJobs: {
      storage: {
        get: () => Promise.resolve(batchStorageState),
        set(items) {
          Object.assign(batchStorageState, items);
          return Promise.resolve();
        },
        remove(keys) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            delete batchStorageState[String(key)];
          }
          return Promise.resolve();
        }
      },
      tabs: {
        query: () => Promise.resolve([]),
        get: () => Promise.reject(new Error("不应读取 tab"))
      },
      clip: {
        readActiveTab: () => Promise.resolve({ id: 1, url: "https://example.com", restricted: false }),
        captureTab: () => {
          throw new Error("不应执行 batch 剪藏");
        },
        ensureOffscreenDocument: () => {
          throw new Error("不应创建 batch offscreen");
        },
        sendRuntimeMessage: () => {
          throw new Error("不应发送 batch runtime 消息");
        }
      },
      download: {
        download: () => {
          throw new Error("不应执行 batch 下载");
        }
      },
      readStoredOptions: () => Promise.resolve(DEFAULT_MARKDOWN_SAVE_OPTIONS),
      now: () => 10,
      runInBackground(task) {
        batchBackgroundTasks.push(task());
      },
      concurrency: 2,
      ttlMs: 86_400_000
    },
    downloads: {
      onChanged: downloadEvent
    },
    storage: {
      onChanged: storageEvent
    },
    tabs: {
      onActivated: tabActivatedEvent,
      onUpdated: tabUpdatedEvent,
      onRemoved: tabRemovedEvent
    }
  };
}

describe("service worker registration", () => {
  it("重复调用注册函数不会重复注册监听器", () => {
    const apis = createApis();

    registerServiceWorkerListeners(apis);
    registerServiceWorkerListeners(apis);

    expect(apis.installedEvent.listeners).toHaveLength(1);
    expect(apis.startupEvent.listeners).toHaveLength(1);
    expect(apis.messageEvent.listeners).toHaveLength(1);
    expect(apis.commandEvent.listeners).toHaveLength(1);
    expect(apis.downloadEvent.listeners).toHaveLength(1);
    expect(apis.storageEvent.listeners).toHaveLength(1);
    expect(apis.tabActivatedEvent.listeners).toHaveLength(1);
    expect(apis.tabUpdatedEvent.listeners).toHaveLength(1);
    expect(apis.tabRemovedEvent.listeners).toHaveLength(1);
  });

  it("安装事件重建 context menu", async () => {
    const apis = createApis();

    registerServiceWorkerListeners(apis);
    await flushAsyncListeners();
    apis.installedEvent.listeners[0]?.({ reason: "install" });
    await flushAsyncListeners();

    expect(apis.menuCreates).toHaveLength(contextMenuDefinitions.length);
    expect(apis.menuCreates).toEqual(contextMenuDefinitions);
    expect(apis.menuRemoveAllCount).toBeGreaterThanOrEqual(1);
  });

  it("service worker 唤醒时恢复可恢复 batch job", async () => {
    const apis = createApis();
    apis.batchStorageState[BATCH_JOBS_STORAGE_KEY] = {
      schemaVersion: 1,
      jobs: {
        job_resume: {
          schemaVersion: 1,
          jobId: "job_resume",
          requestIds: ["req_resume"],
          status: "running",
          createdAt: 1,
          updatedAt: 1,
          expiresAt: 99,
          totalTabs: 1,
          completedTabs: 0,
          failedTabs: 0,
          tabs: {
            "1": {
              tabId: 1,
              url: "https://example.com",
              status: "downloading",
              requestId: null,
              downloadId: null,
              error: null,
              startedAt: 1,
              finishedAt: null
            }
          }
        }
      }
    };

    registerServiceWorkerListeners(apis);
    await flushAsyncListeners();
    await Promise.all(apis.batchBackgroundTasks);

    const store = apis.batchStorageState[BATCH_JOBS_STORAGE_KEY] as {
      jobs: Record<string, { status: string; tabs: Record<string, { status: string }> }>;
    };
    expect(store.jobs.job_resume?.status).toBe("failed");
    expect(store.jobs.job_resume?.tabs["1"]?.status).toBe("failed");
  });

  it("旧 options 读取慢返回时不会覆盖新菜单", async () => {
    const apis = createApis();
    const firstRead = createDeferred<unknown>();
    const secondRead = createDeferred<unknown>();
    const reads = [firstRead.promise, secondRead.promise];
    const markdownActions = apis.markdownActions;
    if (markdownActions === undefined) {
      throw new Error("缺少 markdown action 测试依赖");
    }
    markdownActions.readStoredOptions = () => reads.shift() ?? Promise.resolve(DEFAULT_MARKDOWN_SAVE_OPTIONS);

    registerServiceWorkerListeners(apis);
    apis.storageEvent.listeners[0]?.({}, "sync");

    secondRead.resolve({
      ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
      includeTemplate: true,
      downloadImages: true
    });
    await flushAsyncListeners();

    firstRead.resolve({
      ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
      includeTemplate: false,
      downloadImages: false
    });
    await flushAsyncListeners();

    expect(apis.menuCreates.find((item) => (item as { id: string }).id === "toggle-includeTemplate")).toMatchObject({
      checked: true
    });
    expect(apis.menuCreates.find((item) => (item as { id: string }).id === "toggle-downloadImages")).toMatchObject({
      checked: true
    });
  });

  it("storage.sync 关闭 contextMenus 后重建为空菜单", async () => {
    const apis = createApis();
    const markdownActions = apis.markdownActions;
    if (markdownActions === undefined) {
      throw new Error("缺少 markdown action 测试依赖");
    }
    markdownActions.readStoredOptions = () =>
      Promise.resolve({
        ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
        contextMenus: false
      });

    registerServiceWorkerListeners(apis);
    apis.storageEvent.listeners[0]?.({}, "sync");
    await flushAsyncListeners();

    expect(apis.menuRemoveAllCount).toBeGreaterThanOrEqual(1);
    expect(apis.menuCreates).toEqual([]);
  });
});
