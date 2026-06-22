/** storage 读取键类型。 */
export type StorageReadKeys<Shape extends Record<string, unknown>> =
  | keyof Shape
  | Array<keyof Shape>
  | Partial<Shape>
  | null
  | undefined;

/** storage adapter，只暴露当前运行时骨架需要的最小能力。 */
export interface StorageAdapter<Shape extends Record<string, unknown> = Record<string, unknown>> {
  /** 读取 local storage。 */
  get(keys?: StorageReadKeys<Shape>): Promise<Shape>;
  /** 写入 local storage。 */
  set(items: Partial<Shape>): Promise<void>;
  /** 删除 local storage 键。 */
  remove(keys: keyof Shape | Array<keyof Shape>): Promise<void>;
}

/** 从指定 chrome storage area 创建最小 storage adapter。 */
export function createStorageAdapter<Shape extends Record<string, unknown> = Record<string, unknown>>(
  storageArea: chrome.storage.StorageArea
): StorageAdapter<Shape> {
  return {
    get(keys) {
      return storageArea.get<Shape>(keys);
    },
    set(items) {
      return storageArea.set<Shape>(items);
    },
    remove(keys) {
      return storageArea.remove<Shape>(keys);
    }
  };
}

/** 从 chrome.storage.local 创建最小 storage adapter。 */
export function createLocalStorageAdapter<Shape extends Record<string, unknown> = Record<string, unknown>>(
  storageArea: chrome.storage.StorageArea = chrome.storage.local
): StorageAdapter<Shape> {
  return createStorageAdapter<Shape>(storageArea);
}

/** 从 chrome.storage.sync 创建最小 storage adapter。 */
export function createSyncStorageAdapter<Shape extends Record<string, unknown> = Record<string, unknown>>(
  storageArea: chrome.storage.StorageArea = chrome.storage.sync
): StorageAdapter<Shape> {
  return createStorageAdapter<Shape>(storageArea);
}
