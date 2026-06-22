/** 剪贴板 adapter，只封装 Web Clipboard API。 */
export interface ClipboardAdapter {
  /** 写入纯文本。 */
  writeText(text: string): Promise<void>;
}

/** 从 navigator.clipboard 创建最小剪贴板 adapter。 */
export function createClipboardAdapter(clipboardApi: Clipboard = navigator.clipboard): ClipboardAdapter {
  return {
    writeText(text) {
      return clipboardApi.writeText(text);
    }
  };
}
