import { useRef, type ChangeEvent, type JSX } from "react";
import { createOptionsExportFilename } from "./options-storage";

/** 导入导出组件属性。 */
export interface ImportExportProps {
  /** 控件是否禁用。 */
  disabled: boolean;
  /** 是否处于旧配置迁移失败只读模式。 */
  restricted: boolean;
  /** 导入 JSON 文本。 */
  onImportJson(jsonText: string): Promise<void>;
  /** 导出 JSON 文本。 */
  onExportJson(): string;
  /** 重置默认配置。 */
  onResetDefaults(): Promise<void>;
}

/** 渲染 options 导入、导出和显式重置。 */
export function ImportExport({
  disabled,
  restricted,
  onImportJson,
  onExportJson,
  onResetDefaults
}: ImportExportProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (file === undefined) {
      return;
    }

    await onImportJson(await file.text());
  };

  const handleExport = (): void => {
    const blob = new Blob([onExportJson()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = createOptionsExportFilename(new Date());
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 0);
  };

  return (
    <section aria-labelledby="import-export-heading" className="import-export-section">
      <hr />
      <h2 id="import-export-heading">Import / Export</h2>
      <div className="button-container">
        <input
          ref={fileInputRef}
          accept="application/json,.json"
          aria-label="Import options file"
          className="visually-hidden"
          type="file"
          onChange={(event) => {
            void handleImportFile(event);
          }}
        />
        <label htmlFor="import-options-trigger">Import from a previous backup</label>
        <div className="input-sizer">
          <button
            className="action-button"
            disabled={disabled}
            id="import-options-trigger"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose file...
          </button>
        </div>

        <label htmlFor="export-options-trigger">Export current options</label>
        <div className="input-sizer import-export-actions">
          <button
            className="action-button"
            disabled={disabled || restricted}
            id="export-options-trigger"
            type="button"
            onClick={handleExport}
          >
            Export
          </button>
          <button
            className="action-button action-button-danger"
            disabled={disabled}
            type="button"
            onClick={() => {
              void onResetDefaults();
            }}
          >
            Reset defaults
          </button>
        </div>
      </div>
    </section>
  );
}
