/** 请求 id 类型，跨运行时请求用它做响应关联。 */
export type RequestId = string;

/** 批量任务 id 类型，批量流程用它做任务关联。 */
export type JobId = string;

/** 稳定 id 前缀，避免 requestId 和 jobId 在日志中混淆。 */
export const ID_PREFIX = {
  /** 单次请求 id 前缀。 */
  REQUEST: "req",
  /** 批量任务 id 前缀。 */
  JOB: "job"
} as const;

/** 可格式化为稳定 id 的输入值。 */
export type StableIdSource = number | string;

/** 判断值是否为非空字符串 id。 */
export function isNonEmptyId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** 从调用方提供的确定性输入格式化 requestId。 */
export function formatRequestId(source: StableIdSource): RequestId {
  return formatStableId(ID_PREFIX.REQUEST, source);
}

/** 从调用方提供的确定性输入格式化 jobId。 */
export function formatJobId(source: StableIdSource): JobId {
  return formatStableId(ID_PREFIX.JOB, source);
}

/** 按前缀和值生成稳定 id，不读取时间、随机数或浏览器 API。 */
function formatStableId(prefix: string, source: StableIdSource): string {
  const body = typeof source === "number" ? formatNumberSource(source) : formatStringSource(source);

  return `${prefix}_${body}`;
}

/** 将数字输入转成稳定、紧凑且可读的正文。 */
function formatNumberSource(source: number): string {
  if (!Number.isFinite(source)) {
    return "invalid";
  }

  const normalized = Math.trunc(Math.abs(source));

  return normalized.toString(36);
}

/** 将字符串输入转成稳定、可嵌入 id 的正文。 */
function formatStringSource(source: string): string {
  const normalized = source.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (normalized.length === 0) {
    return "empty";
  }

  return normalized;
}
