/** 下载参数边界，直接复用 Chrome 类型但不暴露全局 chrome 对象。 */
export type BrowserDownloadOptions = chrome.downloads.DownloadOptions;

/** 下载 id，用于关联 Chrome 下载项。 */
export type BrowserDownloadId = number;

/** downloads adapter，只提供最小 wrapper，不承载命名和内容规则。 */
export interface DownloadsAdapter {
  /** 调用 Chrome downloads.download。 */
  download(options: BrowserDownloadOptions): Promise<BrowserDownloadId>;
}

/** 从 chrome.downloads 创建 downloads adapter。 */
export function createDownloadsAdapter(downloadsApi: typeof chrome.downloads = chrome.downloads): DownloadsAdapter {
  return {
    download(options) {
      return downloadsApi.download(options);
    }
  };
}
