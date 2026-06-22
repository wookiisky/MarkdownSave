import { coerceMarkdownSaveOptionsFromUnknown, type OptionsValidationResult } from "./schema";

/** 从未知导入配置迁移为当前 MarkdownSave option。 */
export function migrateOptionsFromUnknown(input: unknown): OptionsValidationResult {
  return coerceMarkdownSaveOptionsFromUnknown(input);
}
