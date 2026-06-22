import { createSyncStorageAdapter, type StorageAdapter } from "../platform/storage";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../shared/options/defaults";
import { coerceMarkdownSaveOptionsFromUnknown } from "../shared/options/schema";

/** popup 需要的最小持久配置。 */
export interface PopupStoredOptions {
  /** 是否包含 front/back 模板。 */
  includeTemplate: boolean;
  /** 是否默认下载图片。 */
  downloadImages: boolean;
}

/** popup 读取 storage.sync 的最小依赖。 */
export interface PopupOptionsStorageDependencies {
  /** sync storage adapter。 */
  storage: StorageAdapter<Record<string, unknown>> | null;
}

/** 创建 popup 默认 storage 依赖。 */
export function createDefaultPopupOptionsStorageDependencies(): PopupOptionsStorageDependencies {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;

  if (chromeApi?.storage?.sync === undefined) {
    return { storage: null };
  }

  return {
    storage: createSyncStorageAdapter<Record<string, unknown>>(chromeApi.storage.sync)
  };
}

/** 读取 popup 初始 toggle 状态。 */
export async function readPopupStoredOptions(
  dependencies: PopupOptionsStorageDependencies = createDefaultPopupOptionsStorageDependencies()
): Promise<PopupStoredOptions> {
  if (dependencies.storage === null) {
    return {
      includeTemplate: DEFAULT_MARKDOWN_SAVE_OPTIONS.includeTemplate,
      downloadImages: DEFAULT_MARKDOWN_SAVE_OPTIONS.downloadImages
    };
  }

  const result = coerceMarkdownSaveOptionsFromUnknown(await dependencies.storage.get(null));
  const options = result.ok ? result.options : DEFAULT_MARKDOWN_SAVE_OPTIONS;

  return {
    includeTemplate: options.includeTemplate,
    downloadImages: options.downloadImages
  };
}

/** 持久化 popup 会写回 storage.sync 的字段。 */
export async function savePopupStoredOption(
  field: "includeTemplate",
  value: boolean,
  dependencies: PopupOptionsStorageDependencies = createDefaultPopupOptionsStorageDependencies()
): Promise<void> {
  if (dependencies.storage === null) {
    throw new Error("storage.sync unavailable");
  }

  await dependencies.storage.set({
    [field]: value
  });
}
