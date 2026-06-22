import { ExtensionErrorCode } from "../shared/errors";
import { isRestrictedTabUrl } from "./tabs";
import { createQueuedTab, createSkippedTab, type BatchTabRecord } from "./batch-job-store";

/** tabs API 最小依赖。 */
export interface BatchTabsApi {
  /** 查询 tab。 */
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  /** 按 id 读取 tab。 */
  get?(tabId: number): Promise<chrome.tabs.Tab>;
}

/** 解析请求 tab。 */
export async function resolveRequestedTabs(
  tabIds: unknown,
  dependencies: {
    /** tabs API。 */
    tabs: BatchTabsApi;
  }
): Promise<
  | { ok: true; tabs: BatchTabRecord[] }
  | { ok: false; details: Readonly<Record<string, unknown>> }
> {
  if (tabIds === undefined) {
    const tabs = await dependencies.tabs.query({ currentWindow: true });
    return { ok: true, tabs: tabs.map(toBatchTabRecord).filter((tab) => tab !== null) };
  }

  if (!Array.isArray(tabIds)) {
    return { ok: false, details: { reason: "tab_ids_invalid" } };
  }

  const ids = readUniquePositiveIntegerIds(tabIds);
  const tabs: BatchTabRecord[] = [];
  for (const id of ids) {
    const tab = await readTabById(id, dependencies);
    tabs.push(tab === null ? createSkippedTab(id, null, ExtensionErrorCode.INVALID_REQUEST, "tab_not_found") : tab);
  }

  return { ok: true, tabs };
}

/** 读取指定 tab。 */
async function readTabById(
  tabId: number,
  dependencies: {
    /** tabs API。 */
    tabs: BatchTabsApi;
  }
): Promise<BatchTabRecord | null> {
  try {
    const tab =
      dependencies.tabs.get !== undefined
        ? await dependencies.tabs.get(tabId)
        : (await dependencies.tabs.query({ currentWindow: true })).find((item) => item.id === tabId);

    return tab === undefined ? null : toBatchTabRecord(tab);
  } catch {
    return null;
  }
}

/** Chrome tab 转 batch tab。 */
function toBatchTabRecord(tab: chrome.tabs.Tab): BatchTabRecord | null {
  if (typeof tab.id !== "number") {
    return null;
  }

  const url = tab.url ?? null;
  if (isRestrictedTabUrl(url)) {
    return createSkippedTab(tab.id, url, ExtensionErrorCode.RESTRICTED_PAGE, "restricted_page");
  }

  return createQueuedTab(tab.id, url);
}

/** 读取去重正整数 id。 */
function readUniquePositiveIntegerIds(values: unknown[]): number[] {
  const ids: number[] = [];
  for (const value of values) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || ids.includes(value)) {
      continue;
    }
    ids.push(value);
  }
  return ids;
}
