/** active tab 查询结果，显式清洗 Chrome tab 的可用字段。 */
export interface ActiveTabInfo {
  /** Chrome tab id。 */
  id: number;
  /** 当前 URL，Chrome 受限页可能缺失。 */
  url: string | null;
  /** 当前 tab 是否为受限 URL。 */
  restricted: boolean;
}

/** tabs API 最小形状。 */
export interface TabsQueryApi {
  /** 查询 tabs。 */
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
}

/** Chrome 扩展不能直接处理的受限协议。 */
const restrictedProtocols = new Set(["about:", "chrome:", "chrome-extension:", "devtools:", "edge:", "file:"]);

/** 判断 URL 是否为受限页面，缺失或非法 URL 一律视为受限。 */
export function isRestrictedTabUrl(url: string | null | undefined): boolean {
  if (url === null || url === undefined || url.trim().length === 0) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);

    return restrictedProtocols.has(parsedUrl.protocol);
  } catch {
    return true;
  }
}

/** 查询当前窗口 active tab，并清洗为稳定边界类型。 */
export async function readActiveTab(tabsApi: TabsQueryApi = chrome.tabs): Promise<ActiveTabInfo | null> {
  const [tab] = await tabsApi.query({ active: true, currentWindow: true });

  if (tab === undefined || tab.id === undefined) {
    return null;
  }

  const url = tab.url ?? null;

  return {
    id: tab.id,
    url,
    restricted: isRestrictedTabUrl(url)
  };
}
