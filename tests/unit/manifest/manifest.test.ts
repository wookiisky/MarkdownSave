import { describe, expect, it } from "vitest";
import manifest from "../../../src/manifest/manifest.config";
import { manifestCommands, type ManifestCommandId } from "../../../src/manifest/commands";
import { manifestHostPermissions, manifestPermissions } from "../../../src/manifest/permissions";

const commandIds: readonly ManifestCommandId[] = [
  "_execute_action",
  "download_tab_as_markdown",
  "copy_tab_as_markdown",
  "copy_selection_as_markdown",
  "copy_tab_as_markdown_link",
  "copy_selected_tab_as_markdown_link",
  "copy_selection_to_obsidian",
  "copy_tab_to_obsidian"
] as const;

// 读取 manifest 中可变形字段，避免测试使用 Any。
function readUnknownManifestField(fieldName: string): unknown {
  return Reflect.get(manifest, fieldName);
}

// 读取 commands 中可变形字段，避免测试使用 Any。
function readUnknownCommandField(fieldName: string): unknown {
  return Reflect.get(manifest.commands, fieldName);
}

describe("Chrome MV3 manifest", () => {
  it("uses MV3 action and service worker declarations", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("MarkdownSave");
    expect(manifest.action.default_popup).toBe("popup/index.html");
    expect(manifest.background.service_worker).toBe("background/service-worker.js");
    expect(manifest.background.type).toBe("module");
    expect(manifest.options_ui.page).toBe("options/index.html");
  });

  it("does not declare MV2 browser action fields", () => {
    expect(readUnknownManifestField("browser_action")).toBeUndefined();
  });

  it("declares the exact release permissions", () => {
    expect(manifest.permissions).toEqual(manifestPermissions);
    expect(manifest.permissions).toEqual([
      "activeTab",
      "scripting",
      "downloads",
      "storage",
      "contextMenus",
      "clipboardWrite",
      "offscreen"
    ]);
    expect(manifest.host_permissions).toEqual(manifestHostPermissions);
    expect(manifest.host_permissions).toEqual(["<all_urls>"]);
  });

  it("does not statically match all urls through content scripts", () => {
    expect(readUnknownManifestField("content_scripts")).toBeUndefined();
  });

  it("exposes only the page context resource", () => {
    expect(manifest.web_accessible_resources).toEqual([
      {
        resources: ["content/page-context.js"],
        matches: ["<all_urls>"]
      }
    ]);
  });

  it("keeps extension page CSP local and eval-free", () => {
    const csp = manifest.content_security_policy.extension_pages;

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("http:");
    expect(csp).not.toContain("https:");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("eval");
  });
});

describe("manifest commands", () => {
  it("declares only the MarkDownload parity command ids with MV3 action command", () => {
    expect(Object.keys(manifest.commands)).toEqual(commandIds);
    expect(readUnknownCommandField("_execute_browser_action")).toBeUndefined();
    expect(manifest.commands).toBe(manifestCommands);
  });

  it("declares command shortcuts and descriptions", () => {
    expect(manifest.commands._execute_action).toEqual({
      suggested_key: {
        default: "Alt+Shift+M"
      }
    });
    expect(manifest.commands.download_tab_as_markdown).toEqual({
      suggested_key: {
        default: "Alt+Shift+D"
      },
      description: "Save current tab as Markdown"
    });
    expect(manifest.commands.copy_tab_as_markdown).toEqual({
      suggested_key: {
        default: "Alt+Shift+C"
      },
      description: "Copy current tab as Markdown to the clipboard"
    });
    expect(manifest.commands.copy_selection_as_markdown).toEqual({
      description: "Copy current selection as Markdown to the clipboard"
    });
    expect(manifest.commands.copy_tab_as_markdown_link).toEqual({
      suggested_key: {
        default: "Alt+Shift+L"
      },
      description: "Copy current tab URL as Markdown link to the clipboard"
    });
    expect(manifest.commands.copy_selected_tab_as_markdown_link).toEqual({
      description: "Copy selected tabs URL as Markdown link to the clipboard"
    });
    expect(manifest.commands.copy_selection_to_obsidian).toEqual({
      description: "Copy current selection as Markdown to Obsidian"
    });
    expect(manifest.commands.copy_tab_to_obsidian).toEqual({
      description: "Copy current tab as Markdown to Obsidian"
    });
  });
});
