import { createExtensionError, ExtensionErrorCode, type ExtensionError } from "../shared/errors";
import type { BatchJobStatus } from "../shared/messages";
import { formatRequestId, type JobId, type RequestId } from "../shared/request-id";
import type { StorageAdapter } from "../platform/storage";

/** batch storage key。 */
export const BATCH_JOBS_STORAGE_KEY = "markdownSaveBatchJobs";

/** batch storage schema 版本。 */
const BATCH_STORE_SCHEMA_VERSION = 1;

/** batch tab 状态。 */
export type BatchTabStatus =
  | "queued"
  | "capturing"
  | "converting"
  | "download_ready"
  | "downloading"
  | "downloaded"
  | "failed"
  | "skipped"
  | "canceled";

/** batch tab 记录。 */
export interface BatchTabRecord {
  /** tab id。 */
  tabId: number;
  /** tab URL。 */
  url: string | null;
  /** tab 当前状态。 */
  status: BatchTabStatus;
  /** 触发该 tab 的 requestId。 */
  requestId: RequestId | null;
  /** 下载 id。 */
  downloadId: number | null;
  /** 已清洗错误。 */
  error: ExtensionError | null;
  /** 开始时间。 */
  startedAt: number | null;
  /** 结束时间。 */
  finishedAt: number | null;
}

/** batch job 记录。 */
export interface BatchJobRecord {
  /** schema 版本。 */
  schemaVersion: 1;
  /** job id。 */
  jobId: JobId;
  /** 绑定到该 job 的 requestId 列表。 */
  requestIds: RequestId[];
  /** job 当前状态。 */
  status: BatchJobStatus;
  /** 创建时间。 */
  createdAt: number;
  /** 更新时间。 */
  updatedAt: number;
  /** 过期时间。 */
  expiresAt: number;
  /** tab 总数。 */
  totalTabs: number;
  /** 已完成 tab 数，包含 downloaded 和 skipped。 */
  completedTabs: number;
  /** 失败 tab 数，只包含 failed。 */
  failedTabs: number;
  /** tab 记录。 */
  tabs: Record<string, BatchTabRecord>;
}

/** batch job store。 */
export interface BatchJobStore {
  /** schema 版本。 */
  schemaVersion: 1;
  /** job map。 */
  jobs: Record<string, BatchJobRecord>;
}

/** batch storage 形状。 */
export type BatchJobsStorageShape = Record<string, unknown> & {
  /** batch job store。 */
  markdownSaveBatchJobs?: unknown;
};

/** storage 写入互斥，防止同 worker 内读改写交错。 */
let batchStoreMutex: Promise<void> = Promise.resolve();

/** 读取 batch store。 */
export async function readBatchJobStore(
  dependencies: Pick<{ storage: StorageAdapter<BatchJobsStorageShape> }, "storage">
): Promise<BatchJobStore> {
  const rawStorage = await dependencies.storage.get(null);
  return coerceBatchJobStoreFromUnknown(rawStorage[BATCH_JOBS_STORAGE_KEY]);
}

/** 更新 batch store。 */
export async function updateBatchStore<Result>(
  dependencies: Pick<{ storage: StorageAdapter<BatchJobsStorageShape> }, "storage">,
  updater: (store: BatchJobStore) => Result | Promise<Result>
): Promise<Result> {
  const run = batchStoreMutex.then(async () => {
    const rawStorage = await dependencies.storage.get(null);
    const store = coerceBatchJobStoreFromUnknown(rawStorage[BATCH_JOBS_STORAGE_KEY]);
    const result = await updater(store);
    await dependencies.storage.set({ [BATCH_JOBS_STORAGE_KEY]: store });
    return result;
  });

  batchStoreMutex = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

/** 清洗 storage.local 中的 batch store。 */
export function coerceBatchJobStoreFromUnknown(value: unknown): BatchJobStore {
  if (!isRecord(value) || value.schemaVersion !== BATCH_STORE_SCHEMA_VERSION || !isRecord(value.jobs)) {
    return createEmptyBatchJobStore();
  }

  const jobs: Record<string, BatchJobRecord> = {};
  for (const [jobId, rawJob] of Object.entries(value.jobs)) {
    const job = coerceBatchJobRecord(jobId, rawJob);
    if (job !== null) {
      jobs[job.jobId] = job;
    }
  }

  return { schemaVersion: BATCH_STORE_SCHEMA_VERSION, jobs };
}

/** 创建空 store。 */
export function createEmptyBatchJobStore(): BatchJobStore {
  return { schemaVersion: BATCH_STORE_SCHEMA_VERSION, jobs: {} };
}

/** 创建 queued tab。 */
export function createQueuedTab(tabId: number, url: string | null): BatchTabRecord {
  return {
    tabId,
    url,
    status: "queued",
    requestId: null,
    downloadId: null,
    error: null,
    startedAt: null,
    finishedAt: null
  };
}

/** 创建 skipped tab。 */
export function createSkippedTab(
  tabId: number,
  url: string | null,
  code: typeof ExtensionErrorCode.INVALID_REQUEST | typeof ExtensionErrorCode.RESTRICTED_PAGE,
  reason: string
): BatchTabRecord {
  return {
    ...createQueuedTab(tabId, url),
    status: "skipped",
    error: createExtensionError(code, { details: { reason } }),
    finishedAt: null
  };
}

/** 查找 requestId 绑定 job。 */
export function findJobByRequestId(store: BatchJobStore, requestId: RequestId): BatchJobRecord | null {
  return Object.values(store.jobs).find((job) => job.requestIds.includes(requestId)) ?? null;
}

/** 追加 requestId。 */
export function appendUniqueRequestId(requestIds: RequestId[], requestId: RequestId): RequestId[] {
  return requestIds.includes(requestId) ? requestIds : [...requestIds, requestId];
}

/** 摘要。 */
export function summarizeJob(
  job: Pick<BatchJobRecord, "jobId" | "status" | "totalTabs" | "completedTabs" | "failedTabs">
): {
  /** job id。 */
  jobId: JobId;
  /** 状态。 */
  status: BatchJobStatus;
  /** tab 总数。 */
  totalTabs: number;
  /** 完成 tab 数。 */
  completedTabs: number;
  /** 失败 tab 数。 */
  failedTabs: number;
} {
  return {
    jobId: job.jobId,
    status: job.status,
    totalTabs: job.totalTabs,
    completedTabs: job.completedTabs,
    failedTabs: job.failedTabs
  };
}

/** 刷新计数。 */
export function refreshJobCounters(job: BatchJobRecord): void {
  const tabs = Object.values(job.tabs);
  job.totalTabs = tabs.length;
  job.completedTabs = tabs.filter((tab) => tab.status === "downloaded" || tab.status === "skipped").length;
  job.failedTabs = tabs.filter((tab) => tab.status === "failed").length;
}

/** 过期 job。 */
export function expireJob(job: BatchJobRecord, now: number): void {
  job.status = "expired";
  job.updatedAt = now;
  for (const tab of Object.values(job.tabs)) {
    if (!isTerminalTabStatus(tab.status)) {
      tab.status = "failed";
      tab.error = createExtensionError(ExtensionErrorCode.DOWNLOAD_FAILED, {
        details: { reason: "batch_job_expired" }
      });
      tab.finishedAt = now;
    }
  }
  refreshJobCounters(job);
}

/** job 终态。 */
export function isTerminalJobStatus(status: BatchJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "canceled" || status === "expired";
}

/** tab 终态。 */
export function isTerminalTabStatus(status: BatchTabStatus): boolean {
  return status === "downloaded" || status === "failed" || status === "skipped" || status === "canceled";
}

/** 可取消 tab。 */
export function canCancelTab(status: BatchTabStatus): boolean {
  return status === "queued" || status === "capturing" || status === "converting" || status === "download_ready" || status === "downloading";
}

/** 可恢复 tab。 */
export function canResumeTab(status: BatchTabStatus): boolean {
  return status === "queued" || status === "capturing" || status === "converting" || status === "download_ready";
}

/** 活跃 tab 状态。 */
export function isActiveTabStatus(status: BatchTabStatus): boolean {
  return status === "capturing" || status === "converting" || status === "download_ready" || status === "downloading";
}

/** 清洗 job。 */
function coerceBatchJobRecord(jobId: string, value: unknown): BatchJobRecord | null {
  if (!isRecord(value) || value.schemaVersion !== BATCH_STORE_SCHEMA_VERSION || !isNonEmptyString(value.jobId)) {
    return null;
  }

  const status = readJobStatus(value.status);
  if (status === null || !isRecord(value.tabs)) {
    return null;
  }

  const tabs: Record<string, BatchTabRecord> = {};
  for (const [tabId, rawTab] of Object.entries(value.tabs)) {
    const tab = coerceBatchTabRecord(tabId, rawTab);
    if (tab !== null) {
      tabs[String(tab.tabId)] = tab;
    }
  }

  const job: BatchJobRecord = {
    schemaVersion: BATCH_STORE_SCHEMA_VERSION,
    jobId: value.jobId,
    requestIds: Array.isArray(value.requestIds) ? value.requestIds.filter(isNonEmptyString) : [],
    status,
    createdAt: readNumber(value.createdAt),
    updatedAt: readNumber(value.updatedAt),
    expiresAt: readNumber(value.expiresAt),
    totalTabs: 0,
    completedTabs: 0,
    failedTabs: 0,
    tabs
  };
  if (job.requestIds.length === 0) {
    job.requestIds = [formatRequestId(`batch-${jobId}`)];
  }
  refreshJobCounters(job);
  return job;
}

/** 清洗 tab。 */
function coerceBatchTabRecord(tabId: string, value: unknown): BatchTabRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const parsedTabId = typeof value.tabId === "number" ? value.tabId : Number(tabId);
  if (!Number.isInteger(parsedTabId) || parsedTabId <= 0) {
    return null;
  }

  const status = readTabStatus(value.status);
  return {
    tabId: parsedTabId,
    url: typeof value.url === "string" ? value.url : null,
    status: status ?? "failed",
    requestId: isNonEmptyString(value.requestId) ? value.requestId : null,
    downloadId: typeof value.downloadId === "number" ? value.downloadId : null,
    error:
      status === null
        ? createExtensionError(ExtensionErrorCode.INTERNAL_ERROR, { details: { reason: "unknown_tab_status" } })
        : readStoredExtensionError(value.error),
    startedAt: typeof value.startedAt === "number" ? value.startedAt : null,
    finishedAt: typeof value.finishedAt === "number" ? value.finishedAt : null
  };
}

/** 清洗持久化错误对象。 */
function readStoredExtensionError(value: unknown): ExtensionError | null {
  if (!isRecord(value) || !isExtensionErrorCode(value.code) || typeof value.message !== "string" || typeof value.recoverable !== "boolean") {
    return null;
  }

  if (isRecord(value.details)) {
    return {
      code: value.code,
      message: value.message,
      recoverable: value.recoverable,
      details: value.details
    };
  }

  return {
    code: value.code,
    message: value.message,
    recoverable: value.recoverable
  };
}

/** 读取 job 状态。 */
function readJobStatus(value: unknown): BatchJobStatus | null {
  return value === "queued" ||
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "canceled" ||
    value === "expired"
    ? value
    : null;
}

/** 读取 tab 状态。 */
function readTabStatus(value: unknown): BatchTabStatus | null {
  return value === "queued" ||
    value === "capturing" ||
    value === "converting" ||
    value === "download_ready" ||
    value === "downloading" ||
    value === "downloaded" ||
    value === "failed" ||
    value === "skipped" ||
    value === "canceled"
    ? value
    : null;
}

/** 判断稳定错误码。 */
function isExtensionErrorCode(value: unknown): value is ExtensionError["code"] {
  return Object.values(ExtensionErrorCode).includes(value as ExtensionError["code"]);
}

/** 读取数字。 */
function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** 判断普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 判断非空字符串。 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
