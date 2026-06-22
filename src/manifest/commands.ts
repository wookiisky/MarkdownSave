/** Chrome command suggested key contract. */
export interface CommandSuggestedKey {
  /** Default Chrome shortcut shown to users. */
  readonly default: string;
}

/** Chrome MV3 command declaration used by manifest. */
export interface ManifestCommand {
  /** Optional keyboard shortcut. */
  readonly suggested_key?: CommandSuggestedKey;
  /** Optional user-visible command description. */
  readonly description?: string;
}

/** Stable command ids retained from MarkDownload parity. */
export type ManifestCommandId =
  | "_execute_action"
  | "download_tab_as_markdown"
  | "copy_tab_as_markdown"
  | "copy_selection_as_markdown"
  | "copy_tab_as_markdown_link"
  | "copy_selected_tab_as_markdown_link"
  | "copy_selection_to_obsidian"
  | "copy_tab_to_obsidian";

/** Commands retained for MarkDownload parity and routed by the background action layer. */
export const manifestCommands: Readonly<Record<ManifestCommandId, ManifestCommand>> = {
  _execute_action: {
    suggested_key: {
      default: "Alt+Shift+M"
    }
  },
  download_tab_as_markdown: {
    suggested_key: {
      default: "Alt+Shift+D"
    },
    description: "Save current tab as Markdown"
  },
  copy_tab_as_markdown: {
    suggested_key: {
      default: "Alt+Shift+C"
    },
    description: "Copy current tab as Markdown to the clipboard"
  },
  copy_selection_as_markdown: {
    description: "Copy current selection as Markdown to the clipboard"
  },
  copy_tab_as_markdown_link: {
    suggested_key: {
      default: "Alt+Shift+L"
    },
    description: "Copy current tab URL as Markdown link to the clipboard"
  },
  copy_selected_tab_as_markdown_link: {
    description: "Copy selected tabs URL as Markdown link to the clipboard"
  },
  copy_selection_to_obsidian: {
    description: "Copy current selection as Markdown to Obsidian"
  },
  copy_tab_to_obsidian: {
    description: "Copy current tab as Markdown to Obsidian"
  }
} as const;
