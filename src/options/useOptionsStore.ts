import { useCallback, useEffect, useState } from "react";
import { createSyncStorageAdapter } from "../platform/storage";
import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../shared/options/defaults";
import type { MarkdownSaveOptionField, MarkdownSaveOptions } from "../shared/options/schema";
import {
  exportOptionsToJson,
  importOptionsJsonToSyncStorage,
  readOptionsFromSyncStorage,
  resetDefaultOptionsInSyncStorage,
  saveOptionsToSyncStorage,
  type OptionsStorageError,
  type OptionsSyncStorage
} from "./options-storage";

/** options store 状态文案类型。 */
export type OptionsStoreNoticeKind = "idle" | "success" | "warning" | "error";

/** options store 状态文案。 */
export interface OptionsStoreNotice {
  /** 状态类型。 */
  kind: OptionsStoreNoticeKind;
  /** 状态文本。 */
  text: string;
}

/** options store 依赖。 */
export interface OptionsStoreDependencies {
  /** storage.sync adapter。 */
  storage: OptionsSyncStorage | null;
}

/** options store 返回值。 */
export interface OptionsStore {
  /** 是否正在读取。 */
  loading: boolean;
  /** 是否正在保存。 */
  saving: boolean;
  /** 当前表单是否因迁移失败进入受限模式。 */
  restricted: boolean;
  /** 当前展示 options。 */
  options: MarkdownSaveOptions;
  /** 被隔离的未知字段。 */
  ignoredFields: ReadonlyArray<string>;
  /** 当前错误集合。 */
  errors: ReadonlyArray<OptionsStorageError>;
  /** 当前状态文案。 */
  notice: OptionsStoreNotice;
  /** 保存单个字段。 */
  saveOptionField<Field extends MarkdownSaveOptionField>(
    field: Field,
    value: MarkdownSaveOptions[Field]
  ): Promise<void>;
  /** 导入 JSON。 */
  importJson(jsonText: string): Promise<void>;
  /** 显式重置为默认配置。 */
  resetToDefaults(): Promise<void>;
  /** 导出 JSON 文本。 */
  exportJson(): string;
}

/** 创建默认 options store 依赖。 */
export function createDefaultOptionsStoreDependencies(): OptionsStoreDependencies {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;

  if (chromeApi?.storage?.sync === undefined) {
    return { storage: null };
  }

  return {
    storage: createSyncStorageAdapter(chromeApi.storage.sync)
  };
}

/** 管理 options 页面配置状态。 */
export function useOptionsStore(dependencies?: OptionsStoreDependencies): OptionsStore {
  const [storage] = useState<OptionsSyncStorage | null>(() => {
    return dependencies?.storage ?? createDefaultOptionsStoreDependencies().storage;
  });
  const storageUnavailable = storage === null;
  const [loading, setLoading] = useState(!storageUnavailable);
  const [saving, setSaving] = useState(false);
  const [restricted, setRestricted] = useState(storageUnavailable);
  const [options, setOptions] = useState<MarkdownSaveOptions>({ ...DEFAULT_MARKDOWN_SAVE_OPTIONS });
  const [ignoredFields, setIgnoredFields] = useState<ReadonlyArray<string>>([]);
  const [errors, setErrors] = useState<ReadonlyArray<OptionsStorageError>>(() => {
    return storageUnavailable ? [createStorageUnavailableError("保存配置")] : [];
  });
  const [notice, setNotice] = useState<OptionsStoreNotice>(() => {
    return storageUnavailable ? { kind: "error", text: "无法访问 storage.sync" } : { kind: "idle", text: "准备就绪" };
  });

  useEffect(() => {
    let active = true;

    if (storage !== null) {
      readOptionsFromSyncStorage(storage)
      .then((result) => {
        if (!active) {
          return;
        }

        setLoading(false);
        setOptions(result.options);
        setIgnoredFields(result.ignoredFields);

        if (result.ok) {
          setRestricted(false);
          setErrors([]);
          setNotice(readIgnoredFieldsNotice(result.ignoredFields));
          return;
        }

        setRestricted(true);
        setErrors(result.errors);
        setNotice({ kind: "error", text: "旧配置迁移失败，表单已进入只读模式" });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setLoading(false);
        setRestricted(true);
        setErrors([
          {
            code: "storage_read_failed",
            message: "读取配置失败，表单已进入只读模式",
            details: error instanceof Error ? error.message : String(error)
          }
        ]);
        setNotice({ kind: "error", text: "读取配置失败" });
      });
    }

    return () => {
      active = false;
    };
  }, [storage]);

  const saveOptionField = useCallback(
    async <Field extends MarkdownSaveOptionField>(field: Field, value: MarkdownSaveOptions[Field]): Promise<void> => {
      if (storage === null || restricted) {
        setErrors([
          createRestrictedWriteError()
        ]);
        setNotice({ kind: "error", text: "配置未保存" });
        return;
      }

      const nextOptions = {
        ...options,
        [field]: value
      };

      setSaving(true);
      const result = await saveOptionsToSyncStorage(storage, nextOptions);
      setSaving(false);

      if (!result.ok) {
        setErrors(result.errors);
        setNotice({ kind: "error", text: "配置保存失败" });
        return;
      }

      setOptions(result.options);
      setIgnoredFields(result.ignoredFields);
      setErrors([]);
      setNotice({ kind: "success", text: "配置已保存" });
    },
    [options, restricted, storage]
  );

  const importJson = useCallback(
    async (jsonText: string): Promise<void> => {
      if (storage === null) {
        setErrors([
          createStorageUnavailableError("导入配置")
        ]);
        setNotice({ kind: "error", text: "配置导入失败" });
        return;
      }

      setSaving(true);
      const result = await importOptionsJsonToSyncStorage(storage, jsonText);
      setSaving(false);

      if (!result.ok) {
        setErrors(result.errors);
        setNotice({ kind: "error", text: "配置导入失败，旧配置未覆盖" });
        return;
      }

      setOptions(result.options);
      setIgnoredFields(result.ignoredFields);
      setErrors([]);
      setRestricted(false);
      setNotice(readIgnoredFieldsNotice(result.ignoredFields, "配置已导入"));
    },
    [storage]
  );

  const resetToDefaults = useCallback(async (): Promise<void> => {
    if (storage === null) {
      setErrors([
        createStorageUnavailableError("重置配置")
      ]);
      setNotice({ kind: "error", text: "配置重置失败" });
      return;
    }

    setSaving(true);
    const result = await resetDefaultOptionsInSyncStorage(storage);
    setSaving(false);

    if (!result.ok) {
      setErrors(result.errors);
      setNotice({ kind: "error", text: "配置重置失败" });
      return;
    }

    setOptions(result.options);
    setIgnoredFields([]);
    setErrors([]);
    setRestricted(false);
    setNotice({ kind: "success", text: "已重置为默认配置" });
  }, [storage]);

  const exportJson = useCallback((): string => {
    return exportOptionsToJson(options);
  }, [options]);

  return {
    loading,
    saving,
    restricted,
    options,
    ignoredFields,
    errors,
    notice,
    saveOptionField,
    importJson,
    resetToDefaults,
    exportJson
  };
}

/** 根据未知字段生成状态文案。 */
function readIgnoredFieldsNotice(ignoredFields: ReadonlyArray<string>, successText = "配置已加载"): OptionsStoreNotice {
  if (ignoredFields.length === 0) {
    return {
      kind: successText === "配置已加载" ? "idle" : "success",
      text: successText
    };
  }

  return {
    kind: "warning",
    text: `${successText}，已隔离 ${ignoredFields.length} 个未知字段`
  };
}

/** storage.sync 不可用错误。 */
function createStorageUnavailableError(action: string): OptionsStorageError {
  return {
    code: "storage_write_failed",
    message: `当前运行环境没有 storage.sync，无法${action}`
  };
}

/** 迁移失败只读状态写入错误。 */
function createRestrictedWriteError(): OptionsStorageError {
  return {
    code: "storage_write_failed",
    message: "当前配置不可写，请先导入有效配置或重置为默认配置"
  };
}
