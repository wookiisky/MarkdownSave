import type { JSX } from "react";
import { ImportExport } from "./ImportExport";
import { OptionsForm } from "./OptionsForm";
import { ValidationMessage } from "./ValidationMessage";
import { useOptionsStore } from "./useOptionsStore";
import "./options.css";

/** MarkdownSave options 页面。 */
export function OptionsApp(): JSX.Element {
  const store = useOptionsStore();
  const formDisabled = store.loading || store.saving || store.restricted;
  const commandDisabled = store.loading || store.saving;

  return (
    <main className="options-shell">
      <header className="options-header">
        <div>
          <h1>MarkdownSave Options</h1>
          <p>Options are saved to storage.sync and used by popup clipping, context menus, and command actions.</p>
        </div>
        <div className="save-indicator" aria-live="polite">
          {store.saving ? "Saving" : store.loading ? "Loading" : "Ready"}
        </div>
      </header>

      <ValidationMessage errors={store.errors} ignoredFields={store.ignoredFields} notice={store.notice} />

      {store.restricted ? (
        <section className="restricted-banner" aria-label="Restricted mode">
          <h2>配置只读</h2>
          <p>旧配置暂时无法安全迁移。导入有效 JSON 或重置默认配置前，普通字段修改不会写入 storage.sync。</p>
        </section>
      ) : null}

      <OptionsForm disabled={formDisabled} options={store.options} onSaveField={store.saveOptionField} />

      <ImportExport
        disabled={commandDisabled}
        restricted={store.restricted}
        onExportJson={store.exportJson}
        onImportJson={store.importJson}
        onResetDefaults={store.resetToDefaults}
      />
    </main>
  );
}
