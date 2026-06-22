/** Chrome MV3 extension permission required by the release manifest. */
export type ManifestPermission =
  | "activeTab"
  | "scripting"
  | "downloads"
  | "storage"
  | "contextMenus"
  | "clipboardWrite"
  | "offscreen";

/** Chrome host permission required for user-triggered clipping and batch downloads. */
export type ManifestHostPermission = "<all_urls>";

/** Permission set retained for MarkDownload parity. */
export const manifestPermissions: readonly ManifestPermission[] = [
  "activeTab",
  "scripting",
  "downloads",
  "storage",
  "contextMenus",
  "clipboardWrite",
  "offscreen"
] as const;

/** Host permission set retained for MarkDownload parity. */
export const manifestHostPermissions: readonly ManifestHostPermission[] = ["<all_urls>"] as const;
