/** Chrome MV3 web accessible resource declaration. */
export interface WebAccessibleResource {
  /** Extension package resources exposed to matching pages. */
  readonly resources: readonly string[];
  /** Page match patterns allowed to load the exposed resources. */
  readonly matches: readonly string[];
}

/** M1 exposes only the page context bundle required by later injection. */
export const webAccessibleResources: readonly WebAccessibleResource[] = [
  {
    resources: ["content/page-context.js"],
    matches: ["<all_urls>"]
  }
] as const;
