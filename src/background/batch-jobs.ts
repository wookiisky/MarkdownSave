import {
  createExtensionError,
  ExtensionErrorCode,
  toErrorResponse,
  toSuccessResponse,
  type ExtensionError,
  type ExtensionResponse
} from "../shared/errors";
import {
  BatchJobStatus,
  MessageType,
  type BatchCancelRequest,
  type BatchJobSummaryData,
  type BatchStartRequest,
  type ClipCaptureResultData
} from "../shared/messages";
import { formatRequestId, type JobId } from "../shared/request-id";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../shared/options/defaults";
import { coerceMarkdownSaveOptionsFromUnknown, type MarkdownSaveOptions } from "../shared/options/schema";
import { createLocalStorageAdapter, type StorageAdapter } from "../platform/storage";
import {
  clipTabAsMarkdown,
  createClipCurrentPageDependencies,
  createDownloadMarkdownDependencies,
  downloadMarkdownFromRequest,
  type ClipCurrentPageDependencies,
  type DownloadMarkdownDependencies
} from "./clip-flow";
import { isRestrictedTabUrl, type ActiveTabInfo } from "./tabs";
import {
  appendUniqueRequestId,
  canCancelTab,
  canResumeTab,
  expireJob,
  findJobByRequestId,
  isActiveTabStatus,
  isTerminalJobStatus,
  isTerminalTabStatus,
  readBatchJobStore,
  refreshJobCounters,
  summarizeJob,
  updateBatchStore,
  type BatchJobRecord,
  type BatchJobsStorageShape,
  type BatchTabRecord,
  type BatchTabStatus
} from "./batch-job-store";
import { resolveRequestedTabs, type BatchTabsApi } from "./batch-tabs";

export {
  BATCH_JOBS_STORAGE_KEY,
  coerceBatchJobStoreFromUnknown,
  readBatchJobStore
} from "./batch-job-store";
export type { BatchJobStatus } from "../shared/messages";
export type { BatchJobRecord, BatchJobStore, BatchTabRecord, BatchTabStatus } from "./batch-job-store";

/** M9 默认并发上限。 */
const DEFAULT_BATCH_CONCURRENCY = 2;

/** M9 默认任务过期时间。 */
const DEFAULT_BATCH_TTL_MS = 24 * 60 * 60 * 1000;

/** batch job 依赖。 */
export interface BatchJobDependencies {
  /** storage.local adapter。 */
  storage: StorageAdapter<BatchJobsStorageShape>;
  /** tabs API。 */
  tabs: BatchTabsApi;
  /** 剪藏依赖。 */
  clip: ClipCurrentPageDependencies;
  /** 下载依赖。 */
  download: DownloadMarkdownDependencies;
  /** 读取 storage.sync options。 */
  readStoredOptions(): Promise<unknown>;
  /** 当前时间，毫秒。 */
  now(): number;
  /** 后台启动异步任务。 */
  runInBackground(task: () => Promise<void>): void;
  /** 并发上限。 */
  concurrency: number;
  /** 任务过期毫秒数。 */
  ttlMs: number;
}

/** 创建默认 batch 依赖。 */
export function createBatchJobDependencies(): BatchJobDependencies {
  return {
    storage: createLocalStorageAdapter<BatchJobsStorageShape>(),
    tabs: chrome.tabs,
    clip: createClipCurrentPageDependencies(),
    download: createDownloadMarkdownDependencies(),
    readStoredOptions() {
      return chrome.storage.sync.get(null);
    },
    now() {
      return Date.now();
    },
    runInBackground(task) {
      void task();
    },
    concurrency: DEFAULT_BATCH_CONCURRENCY,
    ttlMs: DEFAULT_BATCH_TTL_MS
  };
}

/** 正在运行的 job，防止重复调度。 */
const runningJobIds = new Set<string>();

/** 正在创建的 start 摘要，防止解析 tabIds 期间并发重复创建。 */
const pendingStartSummaries = new Map<string, Promise<BatchJobSummaryData>>();

/** 启动 batch 下载 job。 */
export async function startBatchDownloadJob(
  request: BatchStartRequest,
  dependencies: BatchJobDependencies = createBatchJobDependencies()
): Promise<ExtensionResponse<BatchJobSummaryData>> {
  const pendingKeys = readPendingStartKeys(request);
  const pending = readPendingStartSummary(pendingKeys);
  if (pending !== undefined) {
    return createBatchStartResponse(request, dependencies, pending);
  }

  const started = startBatchDownloadJobOnce(request, dependencies).finally(() => {
    for (const key of pendingKeys) {
      pendingStartSummaries.delete(key);
    }
  });
  for (const key of pendingKeys) {
    pendingStartSummaries.set(key, started);
  }

  return createBatchStartResponse(request, dependencies, started);
}

/** 把 pending start 摘要包装为当前请求响应。 */
async function createBatchStartResponse(
  request: BatchStartRequest,
  dependencies: BatchJobDependencies,
  pending: Promise<BatchJobSummaryData>
): Promise<ExtensionResponse<BatchJobSummaryData>> {
  try {
    const summary = await pending;
    await recordBatchRequestId(summary.jobId, request.requestId, dependencies);
    return toSuccessResponse(request.requestId, summary);
  } catch (error) {
    if (isExtensionError(error)) {
      return toErrorResponse(request.requestId, error);
    }

    return toErrorResponse(
      request.requestId,
      createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, {
        details: { reason: "batch_start_failed" }
      })
    );
  }
}

/** 单次执行 batch start。 */
async function startBatchDownloadJobOnce(
  request: BatchStartRequest,
  dependencies: BatchJobDependencies
): Promise<BatchJobSummaryData> {
  const existing = await readExistingBatchSummary(request, dependencies);
  if (existing !== null) {
    scheduleBatchJob(existing.jobId, dependencies);
    return existing;
  }

  const tabResolution = await resolveRequestedTabs(request.tabIds, dependencies);
  if (!tabResolution.ok) {
    throw createExtensionError(ExtensionErrorCode.INVALID_REQUEST, { details: tabResolution.details });
  }

  const summary = await updateBatchStore(dependencies, (store) => {
    const existingAfterResolve = findJobByRequestId(store, request.requestId) ?? store.jobs[request.jobId] ?? null;
    if (existingAfterResolve !== null) {
      existingAfterResolve.requestIds = appendUniqueRequestId(existingAfterResolve.requestIds, request.requestId);
      existingAfterResolve.updatedAt = dependencies.now();
      return summarizeJob(existingAfterResolve);
    }

    const job = createBatchJobRecord(request, tabResolution.tabs, dependencies);
    store.jobs[job.jobId] = job;
    return summarizeJob(job);
  });

  scheduleBatchJob(summary.jobId, dependencies);
  return summary;
}

/** 取消 batch 下载 job。 */
export async function cancelBatchDownloadJob(
  request: BatchCancelRequest,
  dependencies: BatchJobDependencies = createBatchJobDependencies()
): Promise<ExtensionResponse<BatchJobSummaryData>> {
  const summary = await updateBatchStore(dependencies, (store) => {
    const job = store.jobs[request.jobId];
    if (job === undefined) {
      return {
        jobId: request.jobId,
        status: BatchJobStatus.FAILED,
        totalTabs: 0,
        completedTabs: 0,
        failedTabs: 0
      };
    }

    job.requestIds = appendUniqueRequestId(job.requestIds, request.requestId);
    if (!isTerminalJobStatus(job.status)) {
      job.status = "canceled";
      job.updatedAt = dependencies.now();
      for (const tab of Object.values(job.tabs)) {
        if (canCancelTab(tab.status)) {
          tab.status = "canceled";
          tab.finishedAt = dependencies.now();
        }
      }
      refreshJobCounters(job);
    }

    return summarizeJob(job);
  });

  return toSuccessResponse(request.requestId, summary);
}

/** 恢复可恢复 batch job。 */
export async function resumeRecoverableBatchJobs(
  dependencies: BatchJobDependencies = createBatchJobDependencies()
): Promise<void> {
  const jobIds = await updateBatchStore(dependencies, (store) => {
    const recoverableJobIds: string[] = [];
    const now = dependencies.now();

    for (const job of Object.values(store.jobs)) {
      if (isTerminalJobStatus(job.status)) {
        continue;
      }

      if (job.expiresAt <= now) {
        expireJob(job, now);
        continue;
      }

      job.status = "queued";
      job.updatedAt = now;
      for (const tab of Object.values(job.tabs)) {
        if (canResumeTab(tab.status)) {
          tab.status = "queued";
          tab.startedAt = null;
          tab.finishedAt = null;
          continue;
        }

        if (tab.status === "downloading") {
          tab.status = "failed";
          tab.error = createExtensionError(ExtensionErrorCode.DOWNLOAD_FAILED, {
            details: { reason: "unknown_after_worker_suspend" }
          });
          tab.finishedAt = now;
        }
      }
      refreshJobCounters(job);
      recoverableJobIds.push(job.jobId);
    }

    return recoverableJobIds;
  });

  for (const jobId of jobIds) {
    scheduleBatchJob(jobId, dependencies);
  }
}

/** 执行单个 batch job。 */
export async function runBatchJob(jobId: JobId, dependencies: BatchJobDependencies = createBatchJobDependencies()): Promise<void> {
  try {
    while (true) {
      const tabIds = await claimQueuedTabs(jobId, dependencies);
      if (tabIds.length === 0) {
        await finalizeJobIfIdle(jobId, dependencies);
        return;
      }

      await Promise.all(tabIds.map((tabId) => processBatchTab(jobId, tabId, dependencies)));
    }
  } finally {
    runningJobIds.delete(jobId);
  }
}

/** 后台调度 job，按 jobId 去重。 */
function scheduleBatchJob(jobId: JobId, dependencies: BatchJobDependencies): void {
  if (runningJobIds.has(jobId)) {
    return;
  }

  runningJobIds.add(jobId);
  dependencies.runInBackground(() => runBatchJob(jobId, dependencies));
}

/** 领取 queued tabs。 */
async function claimQueuedTabs(jobId: JobId, dependencies: BatchJobDependencies): Promise<number[]> {
  return updateBatchStore(dependencies, (store) => {
    const job = store.jobs[jobId];
    if (job === undefined || isTerminalJobStatus(job.status) || job.expiresAt <= dependencies.now()) {
      if (job !== undefined && !isTerminalJobStatus(job.status)) {
        expireJob(job, dependencies.now());
      }
      return [];
    }

    const runningCount = Object.values(job.tabs).filter((tab) => isActiveTabStatus(tab.status)).length;
    const available = Math.max(0, dependencies.concurrency - runningCount);
    if (available === 0) {
      return [];
    }

    const claimed: number[] = [];
    for (const tab of Object.values(job.tabs)) {
      if (tab.status !== "queued") {
        continue;
      }

      tab.status = "capturing";
      tab.startedAt = dependencies.now();
      claimed.push(tab.tabId);
      if (claimed.length >= available) {
        break;
      }
    }

    if (claimed.length > 0) {
      job.status = "running";
      job.updatedAt = dependencies.now();
    }

    return claimed;
  });
}

/** 处理单个 batch tab。 */
async function processBatchTab(jobId: JobId, tabId: number, dependencies: BatchJobDependencies): Promise<void> {
  const activeTab = await readBatchTab(jobId, tabId, dependencies);
  if (activeTab === null) {
    await failBatchTab(
      jobId,
      tabId,
      createExtensionError(ExtensionErrorCode.INVALID_REQUEST, {
        details: { reason: "invalid_or_restricted_recovered_tab" }
      }),
      dependencies
    );
    return;
  }

  if (!(await shouldContinueTab(jobId, tabId, dependencies))) {
    return;
  }

  const options = await readOptions(dependencies);
  const clip = await clipTabAsMarkdown(
    formatRequestId(`batch-${jobId}-${tabId}-clip`),
    activeTab,
    dependencies.clip,
    "page",
    options.downloadImages,
    options
  );
  if (!(await shouldContinueTab(jobId, tabId, dependencies))) {
    return;
  }

  if (!clip.ok) {
    await failBatchTab(jobId, tabId, clip.error, dependencies);
    return;
  }

  await markBatchTabStatus(jobId, tabId, "download_ready", dependencies);
  if (!(await shouldContinueTab(jobId, tabId, dependencies))) {
    return;
  }

  await markBatchTabStatus(jobId, tabId, "downloading", dependencies);
  await waitBeforeDownloadSideEffect();
  if (!(await shouldContinueTab(jobId, tabId, dependencies))) {
    return;
  }

  const download = await downloadClipForBatchTab(jobId, tabId, activeTab, clip.data, dependencies);
  if (!download.ok) {
    await failBatchTab(jobId, tabId, download.error, dependencies);
    return;
  }

  await markBatchTabDownloaded(jobId, tabId, download.data.downloadId, dependencies);
}

/** 读取并发 start 的 pending keys。 */
function readPendingStartKeys(request: BatchStartRequest): string[] {
  return [`request:${request.requestId}`, `job:${request.jobId}`];
}

/** 读取已有 pending start。 */
function readPendingStartSummary(keys: string[]): Promise<BatchJobSummaryData> | undefined {
  for (const key of keys) {
    const pending = pendingStartSummaries.get(key);
    if (pending !== undefined) {
      return pending;
    }
  }

  return undefined;
}

/** 先按全局 requestId 或 jobId 命中既有 job，保持重放幂等。 */
async function readExistingBatchSummary(
  request: BatchStartRequest,
  dependencies: BatchJobDependencies
): Promise<BatchJobSummaryData | null> {
  return updateBatchStore(dependencies, (store) => {
    const requestOwner = findJobByRequestId(store, request.requestId);
    if (requestOwner !== null) {
      return summarizeJob(requestOwner);
    }

    const existingJob = store.jobs[request.jobId];
    if (existingJob === undefined) {
      return null;
    }

    existingJob.requestIds = appendUniqueRequestId(existingJob.requestIds, request.requestId);
    existingJob.updatedAt = dependencies.now();
    return summarizeJob(existingJob);
  });
}

/** 下载副作用前让出事件循环，让 cancel 请求有机会先写入持久化状态。 */
async function waitBeforeDownloadSideEffect(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** 把当前 requestId 记录到实际 job，保证并发共享 pending 后仍可按 requestId 重放。 */
async function recordBatchRequestId(jobId: JobId, requestId: string, dependencies: BatchJobDependencies): Promise<void> {
  await updateBatchStore(dependencies, (store) => {
    const job = store.jobs[jobId];
    if (job === undefined) {
      return undefined;
    }

    job.requestIds = appendUniqueRequestId(job.requestIds, requestId);
    job.updatedAt = dependencies.now();
    return undefined;
  });
}

/** 下载单个 batch tab 的剪藏结果。 */
async function downloadClipForBatchTab(
  jobId: JobId,
  tabId: number,
  activeTab: ActiveTabInfo,
  clip: ClipCaptureResultData,
  dependencies: BatchJobDependencies
): Promise<ExtensionResponse<{ downloaded: true; downloadId: number }>> {
  return downloadMarkdownFromRequest(
    {
      type: MessageType.DOWNLOAD_MARKDOWN_REQUEST,
      requestId: formatRequestId(`batch-${jobId}-${tabId}-download`),
      markdown: clip.markdown,
      title: clip.title,
      imageDownloads: clip.imageDownloads,
      downloadSettings: clip.downloadSettings
    },
    {
      ...dependencies.download,
      readActiveTab: () => Promise.resolve(activeTab)
    }
  );
}

/** 判断 tab 是否仍可继续执行。 */
async function shouldContinueTab(jobId: JobId, tabId: number, dependencies: BatchJobDependencies): Promise<boolean> {
  const store = await readBatchJobStore(dependencies);
  const job = store.jobs[jobId];
  const tab = job?.tabs[String(tabId)];

  return job !== undefined && tab !== undefined && !isTerminalJobStatus(job.status) && !isTerminalTabStatus(tab.status);
}

/** 读取 batch tab 对应 active tab 信息。 */
async function readBatchTab(
  jobId: JobId,
  tabId: number,
  dependencies: BatchJobDependencies
): Promise<ActiveTabInfo | null> {
  const store = await readBatchJobStore(dependencies);
  const tab = store.jobs[jobId]?.tabs[String(tabId)];
  if (tab === undefined || tab.url === null || isRestrictedTabUrl(tab.url)) {
    return null;
  }

  return { id: tab.tabId, url: tab.url, restricted: false };
}

/** 标记 tab 状态。 */
async function markBatchTabStatus(
  jobId: JobId,
  tabId: number,
  status: BatchTabStatus,
  dependencies: BatchJobDependencies
): Promise<void> {
  await updateBatchStore(dependencies, (store) => {
    const tab = store.jobs[jobId]?.tabs[String(tabId)];
    if (tab === undefined || isTerminalTabStatus(tab.status)) {
      return undefined;
    }

    tab.status = status;
    store.jobs[jobId].updatedAt = dependencies.now();
    return undefined;
  });
}

/** 标记 tab 下载成功。 */
async function markBatchTabDownloaded(
  jobId: JobId,
  tabId: number,
  downloadId: number,
  dependencies: BatchJobDependencies
): Promise<void> {
  await updateBatchStore(dependencies, (store) => {
    const job = store.jobs[jobId];
    const tab = job?.tabs[String(tabId)];
    if (job === undefined || tab === undefined || isTerminalTabStatus(tab.status)) {
      return undefined;
    }

    tab.status = "downloaded";
    tab.downloadId = downloadId;
    tab.finishedAt = dependencies.now();
    job.updatedAt = dependencies.now();
    refreshJobCounters(job);
    return undefined;
  });
}

/** 标记 tab 失败。 */
async function failBatchTab(
  jobId: JobId,
  tabId: number,
  error: ExtensionError,
  dependencies: BatchJobDependencies
): Promise<void> {
  await updateBatchStore(dependencies, (store) => {
    const job = store.jobs[jobId];
    const tab = job?.tabs[String(tabId)];
    if (job === undefined || tab === undefined || isTerminalTabStatus(tab.status)) {
      return undefined;
    }

    tab.status = "failed";
    tab.error = error;
    tab.finishedAt = dependencies.now();
    job.updatedAt = dependencies.now();
    refreshJobCounters(job);
    return undefined;
  });
}

/** job 空闲时收口终态。 */
async function finalizeJobIfIdle(jobId: JobId, dependencies: BatchJobDependencies): Promise<void> {
  await updateBatchStore(dependencies, (store) => {
    const job = store.jobs[jobId];
    if (job === undefined || isTerminalJobStatus(job.status)) {
      return undefined;
    }

    if (Object.values(job.tabs).some((tab) => !isTerminalTabStatus(tab.status))) {
      return undefined;
    }

    refreshJobCounters(job);
    job.status = job.completedTabs > 0 ? "completed" : "failed";
    job.updatedAt = dependencies.now();
    return undefined;
  });
}

/** 读取 options。 */
async function readOptions(dependencies: Pick<BatchJobDependencies, "readStoredOptions">): Promise<MarkdownSaveOptions> {
  const result = coerceMarkdownSaveOptionsFromUnknown(await dependencies.readStoredOptions());
  return result.ok ? result.options : DEFAULT_MARKDOWN_SAVE_OPTIONS;
}

/** 创建 job。 */
function createBatchJobRecord(
  request: BatchStartRequest,
  tabs: BatchTabRecord[],
  dependencies: BatchJobDependencies
): BatchJobRecord {
  const now = dependencies.now();
  const tabMap: Record<string, BatchTabRecord> = {};
  for (const tab of tabs) {
    tabMap[String(tab.tabId)] = tab;
  }

  const job: BatchJobRecord = {
    schemaVersion: 1,
    jobId: request.jobId,
    requestIds: [request.requestId],
    status: "queued",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + dependencies.ttlMs,
    totalTabs: tabs.length,
    completedTabs: 0,
    failedTabs: 0,
    tabs: tabMap
  };
  refreshJobCounters(job);
  return job;
}

/** 判断值是否为统一错误对象。 */
function isExtensionError(value: unknown): value is ExtensionError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    "recoverable" in value
  );
}
