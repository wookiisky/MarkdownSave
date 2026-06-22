import type { ExtensionError } from "../shared/errors";

/** 默认诊断状态，供 popup 或排障工具读取。 */
interface MarkdownActionFailureDiagnostic {
  /** 稳定错误码。 */
  code: ExtensionError["code"];
  /** 用户可理解错误信息。 */
  message: string;
  /** 是否可重试。 */
  recoverable: boolean;
  /** 已清洗错误细节。 */
  details?: Readonly<Record<string, unknown>>;
  /** 发生时间。 */
  occurredAt: string;
}

/** 通过扩展 badge 和 storage.local 暴露最近一次后台动作失败。 */
export async function reportChromeActionFailure(error: ExtensionError): Promise<void> {
  const diagnostic = createFailureDiagnostic(error, new Date().toISOString());

  await Promise.allSettled([
    chrome.action.setBadgeText({ text: "!" }),
    chrome.action.setBadgeBackgroundColor({ color: "#a33a2a" }),
    chrome.storage.local.set({ markdownSaveLastActionError: diagnostic })
  ]);
}

/** 创建可序列化诊断对象。 */
function createFailureDiagnostic(error: ExtensionError, occurredAt: string): MarkdownActionFailureDiagnostic {
  const diagnostic: MarkdownActionFailureDiagnostic = {
    code: error.code,
    message: error.message,
    recoverable: error.recoverable,
    occurredAt
  };

  if (error.details !== undefined) {
    return {
      ...diagnostic,
      details: error.details
    };
  }

  return diagnostic;
}
