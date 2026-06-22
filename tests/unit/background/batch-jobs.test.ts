import { describe, expect, it } from "vitest";

import {
  BATCH_JOBS_STORAGE_KEY,
  cancelBatchDownloadJob,
  coerceBatchJobStoreFromUnknown,
  resumeRecoverableBatchJobs,
  startBatchDownloadJob,
  type BatchJobDependencies,
  type BatchJobStore
} from "../../../src/background/batch-jobs";
import { MessageType, type MarkdownConvertCapturePayload } from "../../../src/shared/messages";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../../../src/shared/options/defaults";

/** 受控 Promise。 */
function createDeferred<Value>(): {
  /** Promise。 */
  promise: Promise<Value>;
  /** 解析。 */
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

/** 等待异步任务推进。 */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** 构造 capture。 */
function createCapture(tabId: number): MarkdownConvertCapturePayload {
  return {
    pageHtml: `<html><body><main>Tab ${tabId}</main></body></html>`,
    selectionHtml: null,
    title: `Page ${tabId}`,
    baseUrl: `https://example.com/page-${tabId}`,
    pageUrl: `https://example.com/page-${tabId}`,
    hasSelection: false,
    clipMode: "page",
    metadata: {
      language: null,
      charset: null,
      canonicalUrl: null,
      description: null,
      siteName: null
    }
  };
}

/** 创建测试依赖。 */
function createDependencies(): BatchJobDependencies & {
  /** storage 原始对象。 */
  storageState: Record<string, unknown>;
  /** 下载请求。 */
  downloads: chrome.downloads.DownloadOptions[];
  /** 后台任务。 */
  backgroundTasks: Array<Promise<void>>;
  /** contentLink 目标 tab。 */
  contentLinkTabs: number[];
  /** capture 覆盖。 */
  captureOverride?: (tabId: number) => Promise<MarkdownConvertCapturePayload>;
} {
  const storageState: Record<string, unknown> = {};
  const downloads: chrome.downloads.DownloadOptions[] = [];
  const backgroundTasks: Array<Promise<void>> = [];
  const contentLinkTabs: number[] = [];
  let now = 1_000;
  const dependencies: BatchJobDependencies & {
    storageState: Record<string, unknown>;
    downloads: chrome.downloads.DownloadOptions[];
    backgroundTasks: Array<Promise<void>>;
    contentLinkTabs: number[];
    captureOverride?: (tabId: number) => Promise<MarkdownConvertCapturePayload>;
  } = {
    storageState,
    downloads,
    backgroundTasks,
    contentLinkTabs,
    storage: {
      get: () => Promise.resolve(storageState),
      set(items) {
        Object.assign(storageState, items);
        return Promise.resolve();
      },
      remove(keys) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          delete storageState[String(key)];
        }
        return Promise.resolve();
      }
    },
    tabs: {
      query: () =>
        Promise.resolve([
          { id: 1, url: "https://example.com/page-1" },
          { id: 2, url: "https://example.com/page-2" }
        ] as chrome.tabs.Tab[]),
      get(tabId) {
        if (tabId === 9) {
          return Promise.resolve({ id: 9, url: "chrome://extensions" } as chrome.tabs.Tab);
        }
        if (tabId === 404) {
          return Promise.reject(new Error("missing tab"));
        }
        return Promise.resolve({ id: tabId, url: `https://example.com/page-${tabId}` } as chrome.tabs.Tab);
      }
    },
    clip: {
      readActiveTab: () => Promise.resolve({ id: 1, url: "https://example.com/page-1", restricted: false }),
      captureTab(tabId) {
        return dependencies.captureOverride?.(tabId) ?? Promise.resolve(createCapture(tabId));
      },
      ensureOffscreenDocument: () =>
        Promise.resolve({
          supported: true,
          available: true,
          created: false,
          ready: true
        }),
      sendRuntimeMessage(message) {
        const capture = (message as { capture: MarkdownConvertCapturePayload }).capture;
        return Promise.resolve({
          ok: true,
          requestId: "req_convert",
          data: {
            markdown: `Markdown ${capture.title}`,
            title: `Title ${capture.title}`,
            article: {
              title: `Title ${capture.title}`,
              pageTitle: capture.title,
              byline: "",
              excerpt: "",
              siteName: "",
              baseURI: capture.baseUrl,
              length: 10,
              dir: "",
              lang: "",
              publishedTime: "",
              keywords: [],
              hash: "",
              host: "example.com",
              origin: "https://example.com",
              hostname: "example.com",
              pathname: "/",
              port: "",
              protocol: "https:",
              search: ""
            },
            imageDownloads: [],
            downloadSettings: {
              downloadMode:
                (DEFAULT_MARKDOWN_SAVE_OPTIONS.downloadMode as string) === "contentLink" ? "contentLink" : "downloadsApi",
              saveAs: false,
              mdClipsFolder: null,
              disallowedChars: "[]#^"
            }
          }
        });
      }
    },
    download: {
      download(options) {
        downloads.push(options);
        return Promise.resolve(downloads.length);
      },
      executeContentLinkDownload(tabId) {
        contentLinkTabs.push(tabId);
        return Promise.resolve();
      }
    },
    readStoredOptions: () => Promise.resolve(DEFAULT_MARKDOWN_SAVE_OPTIONS),
    now() {
      now += 1;
      return now;
    },
    runInBackground(task) {
      backgroundTasks.push(task());
    },
    concurrency: 2,
    ttlMs: 86_400_000
  };

  return dependencies;
}

/** 读取 store。 */
function readStore(dependencies: { storageState: Record<string, unknown> }): BatchJobStore {
  return coerceBatchJobStoreFromUnknown(dependencies.storageState[BATCH_JOBS_STORAGE_KEY]);
}

describe("background batch jobs", () => {
  it("创建 job 并按当前窗口 tabs 下载", async () => {
    const dependencies = createDependencies();

    const response = await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_batch_1", jobId: "job_batch_1" },
      dependencies
    );
    await Promise.all(dependencies.backgroundTasks);

    expect(response.ok).toBe(true);
    expect(dependencies.downloads).toHaveLength(2);
    expect(readStore(dependencies).jobs.job_batch_1).toMatchObject({
      status: "completed",
      completedTabs: 2,
      failedTabs: 0
    });
  });

  it("同一个 requestId 绑定到首个 job，不因不同 jobId 重复下载", async () => {
    const dependencies = createDependencies();
    const tasks: Array<() => Promise<void>> = [];
    dependencies.runInBackground = (task) => {
      tasks.push(task);
    };

    const first = await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_same", jobId: "job_first", tabIds: [1] },
      dependencies
    );
    const second = await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_same", jobId: "job_second", tabIds: [2] },
      dependencies
    );
    await Promise.all(tasks.map((task) => task()));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.jobId).toBe("job_first");
    }
    expect(dependencies.downloads).toHaveLength(1);
  });

  it("重复 requestId 即使携带非法 tabIds 也返回原 job 摘要", async () => {
    const dependencies = createDependencies();
    const tasks: Array<() => Promise<void>> = [];
    dependencies.runInBackground = (task) => {
      tasks.push(task);
    };

    await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_replay", jobId: "job_original", tabIds: [1] },
      dependencies
    );
    const replay = await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_replay", jobId: "job_other", tabIds: "bad" },
      dependencies
    );
    await Promise.all(tasks.map((task) => task()));

    expect(replay).toMatchObject({
      ok: true,
      data: {
        jobId: "job_original"
      }
    });
    expect(dependencies.downloads).toHaveLength(1);
  });

  it("并发相同 requestId 不创建重复 job", async () => {
    const dependencies = createDependencies();
    const first = startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_parallel_same", jobId: "job_parallel_first", tabIds: [1] },
      dependencies
    );
    const second = startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_parallel_same", jobId: "job_parallel_second", tabIds: [2] },
      dependencies
    );

    const responses = await Promise.all([first, second]);
    await Promise.all(dependencies.backgroundTasks);

    expect(responses[0]).toMatchObject({ ok: true, data: { jobId: "job_parallel_first" } });
    expect(responses[1]).toMatchObject({ ok: true, data: { jobId: "job_parallel_first" } });
    expect(Object.keys(readStore(dependencies).jobs)).toEqual(["job_parallel_first"]);
    expect(dependencies.downloads).toHaveLength(1);
  });

  it("并发相同 jobId 不覆盖 requestIds 和 tab 范围", async () => {
    const dependencies = createDependencies();
    const first = startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_parallel_first", jobId: "job_parallel_same", tabIds: [1] },
      dependencies
    );
    const second = startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_parallel_second", jobId: "job_parallel_same", tabIds: [2] },
      dependencies
    );

    await Promise.all([first, second]);
    await Promise.all(dependencies.backgroundTasks);

    const job = readStore(dependencies).jobs.job_parallel_same;
    expect(job?.requestIds).toEqual(["req_parallel_first", "req_parallel_second"]);
    expect(Object.keys(job?.tabs ?? {})).toEqual(["1"]);
    expect(dependencies.downloads).toHaveLength(1);
  });

  it("非法 tabIds 返回 invalid_request", async () => {
    const dependencies = createDependencies();

    const response = await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_bad_tabs", jobId: "job_bad_tabs", tabIds: "bad" },
      dependencies
    );

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("invalid_request");
      expect(response.error.details).toEqual({ reason: "tab_ids_invalid" });
    }
  });

  it("指定受限或不存在 tab 时跳过并继续可访问 tab", async () => {
    const dependencies = createDependencies();

    await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_tabs", jobId: "job_tabs", tabIds: [1, 9, 404] },
      dependencies
    );
    await Promise.all(dependencies.backgroundTasks);

    const job = readStore(dependencies).jobs.job_tabs;
    expect(dependencies.downloads).toHaveLength(1);
    expect(job?.tabs["9"]?.status).toBe("skipped");
    expect(job?.tabs["404"]?.status).toBe("skipped");
    expect(job).toMatchObject({ status: "completed", completedTabs: 3, failedTabs: 0 });
  });

  it("取消发生在 capture 期间时不触发下载副作用", async () => {
    const dependencies = createDependencies();
    const capture = createDeferred<MarkdownConvertCapturePayload>();
    dependencies.captureOverride = () => capture.promise;

    await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_cancel_start", jobId: "job_cancel", tabIds: [1] },
      dependencies
    );
    await flushAsync();
    await cancelBatchDownloadJob(
      { type: MessageType.BATCH_CANCEL_REQUEST, requestId: "req_cancel", jobId: "job_cancel" },
      dependencies
    );
    capture.resolve(createCapture(1));
    await Promise.all(dependencies.backgroundTasks);

    expect(dependencies.downloads).toHaveLength(0);
    expect(readStore(dependencies).jobs.job_cancel?.tabs["1"]?.status).toBe("canceled");
  });

  it("取消发生在 downloading 状态但下载副作用前时不触发下载", async () => {
    const dependencies = createDependencies();
    const originalSet = dependencies.storage.set;
    let cancelQueued = false;
    dependencies.download.download = () => {
      return Promise.resolve(1);
    };
    dependencies.storage.set = async (items) => {
      await originalSet(items);
      const job = readStore(dependencies).jobs.job_cancel_downloading;
      if (!cancelQueued && job?.tabs["1"]?.status === "downloading") {
        cancelQueued = true;
        void cancelBatchDownloadJob(
          { type: MessageType.BATCH_CANCEL_REQUEST, requestId: "req_cancel_downloading", jobId: "job_cancel_downloading" },
          dependencies
        );
      }
    };

    await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_cancel_downloading_start", jobId: "job_cancel_downloading", tabIds: [1] },
      dependencies
    );
    await Promise.all(dependencies.backgroundTasks);

    expect(dependencies.downloads).toHaveLength(0);
    expect(readStore(dependencies).jobs.job_cancel_downloading?.tabs["1"]?.status).toBe("canceled");
  });

  it("恢复 downloading tab 时标记失败且不重复下载", async () => {
    const dependencies = createDependencies();
    dependencies.storageState[BATCH_JOBS_STORAGE_KEY] = {
      schemaVersion: 1,
      jobs: {
        job_resume: {
          schemaVersion: 1,
          jobId: "job_resume",
          requestIds: ["req_resume"],
          status: "running",
          createdAt: 1,
          updatedAt: 1,
          expiresAt: 99_999,
          totalTabs: 1,
          completedTabs: 0,
          failedTabs: 0,
          tabs: {
            "1": {
              tabId: 1,
              url: "https://example.com/page-1",
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

    await resumeRecoverableBatchJobs(dependencies);
    await Promise.all(dependencies.backgroundTasks);

    const tab = readStore(dependencies).jobs.job_resume?.tabs["1"];
    expect(dependencies.downloads).toHaveLength(0);
    expect(tab?.status).toBe("failed");
    expect(tab?.error?.details).toEqual({ reason: "unknown_after_worker_suspend" });
  });

  it("恢复 URL 缺失的 queued tab 时标记失败并收口", async () => {
    const dependencies = createDependencies();
    dependencies.storageState[BATCH_JOBS_STORAGE_KEY] = {
      schemaVersion: 1,
      jobs: {
        job_dirty_url: {
          schemaVersion: 1,
          jobId: "job_dirty_url",
          requestIds: ["req_dirty_url"],
          status: "running",
          createdAt: 1,
          updatedAt: 1,
          expiresAt: 99_999,
          totalTabs: 1,
          completedTabs: 0,
          failedTabs: 0,
          tabs: {
            "1": {
              tabId: 1,
              url: null,
              status: "queued",
              requestId: null,
              downloadId: null,
              error: null,
              startedAt: null,
              finishedAt: null
            }
          }
        }
      }
    };

    await resumeRecoverableBatchJobs(dependencies);
    await Promise.all(dependencies.backgroundTasks);

    const job = readStore(dependencies).jobs.job_dirty_url;
    expect(job?.status).toBe("failed");
    expect(job?.tabs["1"]?.status).toBe("failed");
    expect(job?.tabs["1"]?.error?.details).toEqual({ reason: "invalid_or_restricted_recovered_tab" });
  });

  it("contentLink 批量下载注入目标 tab 而不是当前 active tab", async () => {
    const dependencies = createDependencies();
    dependencies.readStoredOptions = () =>
      Promise.resolve({
        ...DEFAULT_MARKDOWN_SAVE_OPTIONS,
        downloadMode: "contentLink"
      });
    dependencies.clip.sendRuntimeMessage = (message) => {
      const capture = (message as { capture: MarkdownConvertCapturePayload }).capture;
      return Promise.resolve({
        ok: true,
        requestId: "req_convert",
        data: {
          markdown: `Markdown ${capture.title}`,
          title: `Title ${capture.title}`,
          article: {
            title: `Title ${capture.title}`,
            pageTitle: capture.title,
            byline: "",
            excerpt: "",
            siteName: "",
            baseURI: capture.baseUrl,
            length: 10,
            dir: "",
            lang: "",
            publishedTime: "",
            keywords: [],
            hash: "",
            host: "example.com",
            origin: "https://example.com",
            hostname: "example.com",
            pathname: "/",
            port: "",
            protocol: "https:",
            search: ""
          },
          imageDownloads: [],
          downloadSettings: {
            downloadMode: "contentLink",
            saveAs: false,
            mdClipsFolder: null,
            disallowedChars: "[]#^"
          }
        }
      });
    };

    await startBatchDownloadJob(
      { type: MessageType.BATCH_START_REQUEST, requestId: "req_content_link", jobId: "job_content_link", tabIds: [5] },
      dependencies
    );
    await Promise.all(dependencies.backgroundTasks);

    expect(dependencies.contentLinkTabs).toEqual([5]);
  });

  it("清洗损坏 storage 和未知 tab 状态", () => {
    const store = coerceBatchJobStoreFromUnknown({
      schemaVersion: 1,
      jobs: {
        broken: null,
        job_dirty: {
          schemaVersion: 1,
          jobId: "job_dirty",
          requestIds: [],
          status: "running",
          createdAt: "bad",
          updatedAt: "bad",
          expiresAt: "bad",
          tabs: {
            "1": {
              tabId: 1,
              url: "https://example.com",
              status: "mystery"
            },
            bad: {
              tabId: "bad"
            }
          }
        }
      }
    });

    expect(Object.keys(store.jobs)).toEqual(["job_dirty"]);
    expect(store.jobs.job_dirty?.tabs["1"]).toMatchObject({
      status: "failed",
      error: {
        code: "internal_error"
      }
    });
  });
});
