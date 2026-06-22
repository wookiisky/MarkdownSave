import type { ExtensionResponse } from "../shared/errors";

/** runtime 消息发送器类型，隔离 Chrome 的 sender 结构。 */
export type BrowserRuntimeMessageSender = chrome.runtime.MessageSender;

/** runtime 消息监听器类型，业务入口只依赖该显式契约。 */
export type BrowserRuntimeMessageListener = (
  message: unknown,
  sender: BrowserRuntimeMessageSender,
  sendResponse: (response: ExtensionResponse) => void
) => boolean | void;

/** Chrome runtime 最小适配器，禁止向核心逻辑扩散 chrome.*。 */
export interface BrowserRuntimeAdapter {
  /** 获取扩展包内资源 URL。 */
  getURL(path: string): string;
  /** 发送 runtime message。 */
  sendMessage<Response>(message: unknown): Promise<Response>;
  /** 注册 runtime message listener。 */
  addMessageListener(listener: BrowserRuntimeMessageListener): void;
  /** 注册扩展安装事件。 */
  addInstalledListener(listener: (details: chrome.runtime.InstalledDetails) => void): void;
  /** 注册浏览器启动事件。 */
  addStartupListener(listener: () => void): void;
}

/** 从全局 chrome 对象创建 runtime adapter。 */
export function createBrowserRuntimeAdapter(runtime: typeof chrome.runtime = chrome.runtime): BrowserRuntimeAdapter {
  return {
    getURL(path: string) {
      return runtime.getURL(path);
    },
    sendMessage<Response>(message: unknown) {
      return runtime.sendMessage(message) as Promise<Response>;
    },
    addMessageListener(listener: BrowserRuntimeMessageListener) {
      runtime.onMessage.addListener(listener);
    },
    addInstalledListener(listener: (details: chrome.runtime.InstalledDetails) => void) {
      runtime.onInstalled.addListener(listener);
    },
    addStartupListener(listener: () => void) {
      runtime.onStartup.addListener(listener);
    }
  };
}
