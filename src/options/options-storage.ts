import { DEFAULT_MARKDOWN_SAVE_OPTIONS } from "../shared/options/defaults";
import { migrateOptionsFromUnknown } from "../shared/options/migrate";
import type { MarkdownSaveOptions, OptionValidationError } from "../shared/options/schema";
import type { StorageAdapter } from "../platform/storage";

/** options storage 读写依赖。 */
export type OptionsSyncStorage = Pick<StorageAdapter<Record<string, unknown>>, "get" | "set">;

/** options storage 错误码。 */
export type OptionsStorageErrorCode =
  | "storage_read_failed"
  | "storage_write_failed"
  | "json_parse_failed"
  | "options_validation_failed";

/** options storage 错误。 */
export interface OptionsStorageError {
  /** 稳定错误码。 */
  code: OptionsStorageErrorCode;
  /** 面向 UI 和日志的中文说明。 */
  message: string;
  /** schema 校验错误。 */
  validationErrors?: ReadonlyArray<OptionValidationError>;
  /** 原始错误文本。 */
  details?: string;
}

/** options storage 读取成功。 */
export interface OptionsStorageReadSuccess {
  /** 成功固定为 true。 */
  ok: true;
  /** 已迁移、已补齐默认值的配置。 */
  options: MarkdownSaveOptions;
  /** 被隔离的未知未来字段。 */
  ignoredFields: ReadonlyArray<string>;
}

/** options storage 读取失败。 */
export interface OptionsStorageReadFailure {
  /** 失败固定为 false。 */
  ok: false;
  /** 供页面只读展示的默认配置，不代表已写入 storage。 */
  options: MarkdownSaveOptions;
  /** 被隔离的未知未来字段。 */
  ignoredFields: ReadonlyArray<string>;
  /** 结构化错误。 */
  errors: ReadonlyArray<OptionsStorageError>;
}

/** options storage 读取结果。 */
export type OptionsStorageReadResult = OptionsStorageReadSuccess | OptionsStorageReadFailure;

/** options 导入成功。 */
export interface OptionsImportSuccess {
  /** 成功固定为 true。 */
  ok: true;
  /** 写入 storage.sync 的完整配置。 */
  options: MarkdownSaveOptions;
  /** 被隔离的未知未来字段。 */
  ignoredFields: ReadonlyArray<string>;
}

/** options 导入失败。 */
export interface OptionsImportFailure {
  /** 失败固定为 false。 */
  ok: false;
  /** 结构化错误。 */
  errors: ReadonlyArray<OptionsStorageError>;
  /** 被隔离的未知未来字段。 */
  ignoredFields: ReadonlyArray<string>;
}

/** options 导入结果。 */
export type OptionsImportResult = OptionsImportSuccess | OptionsImportFailure;

/** 读取 storage.sync 中的完整旧配置并迁移。 */
export async function readOptionsFromSyncStorage(storage: OptionsSyncStorage): Promise<OptionsStorageReadResult> {
  let rawOptions: unknown;

  try {
    rawOptions = await storage.get(null);
  } catch (error) {
    return {
      ok: false,
      options: { ...DEFAULT_MARKDOWN_SAVE_OPTIONS },
      ignoredFields: [],
      errors: [
        {
          code: "storage_read_failed",
          message: "读取 storage.sync 配置失败，当前仅展示默认配置，尚未覆盖旧配置",
          details: stringifyUnknownError(error)
        }
      ]
    };
  }

  const migration = migrateOptionsFromUnknown(rawOptions);
  if (!migration.ok) {
    return {
      ok: false,
      options: { ...DEFAULT_MARKDOWN_SAVE_OPTIONS },
      ignoredFields: migration.ignoredFields,
      errors: [
        {
          code: "options_validation_failed",
          message: "旧配置无法迁移，当前仅展示默认配置，尚未覆盖旧配置",
          validationErrors: migration.errors
        }
      ]
    };
  }

  return {
    ok: true,
    options: migration.options,
    ignoredFields: migration.ignoredFields
  };
}

/** 将完整已知 options 写入 storage.sync。 */
export async function saveOptionsToSyncStorage(
  storage: OptionsSyncStorage,
  options: MarkdownSaveOptions
): Promise<OptionsImportResult> {
  try {
    await storage.set(toStorageRecord(options));
  } catch (error) {
    return {
      ok: false,
      ignoredFields: [],
      errors: [
        {
          code: "storage_write_failed",
          message: "保存配置失败，旧配置保持不变",
          details: stringifyUnknownError(error)
        }
      ]
    };
  }

  return {
    ok: true,
    options,
    ignoredFields: []
  };
}

/** 导入 JSON，校验成功后才写入 storage.sync。 */
export async function importOptionsJsonToSyncStorage(
  storage: OptionsSyncStorage,
  jsonText: string
): Promise<OptionsImportResult> {
  const parsed = parseOptionsJson(jsonText);

  if (!parsed.ok) {
    return parsed;
  }

  const migration = migrateOptionsFromUnknown(parsed.value);
  if (!migration.ok) {
    return {
      ok: false,
      ignoredFields: migration.ignoredFields,
      errors: [
        {
          code: "options_validation_failed",
          message: "导入配置不符合当前 schema，已取消写入",
          validationErrors: migration.errors
        }
      ]
    };
  }

  return saveOptionsToSyncStorage(storage, migration.options).then((result) => {
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      options: migration.options,
      ignoredFields: migration.ignoredFields
    };
  });
}

/** 显式重置为默认 options 并写入 storage.sync。 */
export function resetDefaultOptionsInSyncStorage(storage: OptionsSyncStorage): Promise<OptionsImportResult> {
  return saveOptionsToSyncStorage(storage, { ...DEFAULT_MARKDOWN_SAVE_OPTIONS });
}

/** 导出当前 options 为稳定 JSON。 */
export function exportOptionsToJson(options: MarkdownSaveOptions): string {
  return `${JSON.stringify(options, null, 2)}\n`;
}

/** 生成导出文件名。 */
export function createOptionsExportFilename(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");

  return `MarkdownSave-export-${year}-${month}-${date}.json`;
}

/** JSON parse 成功。 */
interface OptionsJsonParseSuccess {
  /** 成功固定为 true。 */
  ok: true;
  /** 解析后的未知 JSON。 */
  value: unknown;
}

/** JSON parse 结果。 */
type OptionsJsonParseResult = OptionsJsonParseSuccess | OptionsImportFailure;

/** 解析 options JSON。 */
function parseOptionsJson(jsonText: string): OptionsJsonParseResult {
  try {
    return {
      ok: true,
      value: JSON.parse(jsonText) as unknown
    };
  } catch (error) {
    return {
      ok: false,
      ignoredFields: [],
      errors: [
        {
          code: "json_parse_failed",
          message: "导入文件不是合法 JSON，已取消写入",
          details: stringifyUnknownError(error)
        }
      ]
    };
  }
}

/** 转换为 storage 可写入的普通对象，只包含已知字段。 */
function toStorageRecord(options: MarkdownSaveOptions): Record<string, unknown> {
  return { ...options };
}

/** 将未知错误转为稳定字符串。 */
function stringifyUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
