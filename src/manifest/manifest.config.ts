import packageJson from "../../package.json";
import { manifestCommands } from "./commands";
import { manifestHostPermissions, manifestPermissions } from "./permissions";
import { webAccessibleResources } from "./resources";

/** Manifest icon path mapping. */
interface ManifestIcons {
  /** 16px toolbar icon. */
  readonly "16": string;
  /** 32px toolbar icon. */
  readonly "32": string;
  /** 48px extension management icon. */
  readonly "48": string;
  /** 128px Chrome Web Store icon. */
  readonly "128": string;
  /** 192px large extension icon. */
  readonly "192"?: string;
  /** 512px large extension icon. */
  readonly "512"?: string;
}

/** Chrome MV3 manifest subset used by the released Chrome build. */
export interface ChromeManifest {
  /** Chrome manifest major version. */
  readonly manifest_version: 3;
  /** Extension name. */
  readonly name: string;
  /** Extension version derived from package.json. */
  readonly version: string;
  /** Extension description aligned with MarkDownload. */
  readonly description: string;
  /** Extension icons copied from MarkDownload. */
  readonly icons: ManifestIcons;
  /** Chrome MV3 action declaration. */
  readonly action: {
    /** Popup title. */
    readonly default_title: string;
    /** Popup html page. */
    readonly default_popup: string;
    /** Action icons. */
    readonly default_icon: ManifestIcons;
  };
  /** Chrome MV3 background declaration. */
  readonly background: {
    /** Background service worker bundle. */
    readonly service_worker: string;
    /** Background worker module type. */
    readonly type: "module";
  };
  /** Options page declaration. */
  readonly options_ui: {
    /** Options html page. */
    readonly page: string;
    /** Keep options in extension popup-sized Chrome surface. */
    readonly open_in_tab: false;
  };
  /** Extension permissions. */
  readonly permissions: typeof manifestPermissions;
  /** Host permissions. */
  readonly host_permissions: typeof manifestHostPermissions;
  /** Keyboard command declarations. */
  readonly commands: typeof manifestCommands;
  /** Minimal web accessible resources. */
  readonly web_accessible_resources: typeof webAccessibleResources;
  /** MV3 content security policy. */
  readonly content_security_policy: {
    /** Extension page CSP. */
    readonly extension_pages: string;
  };
}

const actionIcons: ManifestIcons = {
  "16": "icons/favicon-16x16.png",
  "32": "icons/favicon-32x32.png",
  "48": "icons/favicon-48x48.png",
  "128": "icons/appicon-128x128.png"
};

const extensionIcons: ManifestIcons = {
  ...actionIcons,
  "192": "icons/favicon-192x192.png",
  "512": "icons/favicon-512x512.png"
};

/** Chrome MV3 manifest is the single source for the released extension manifest. */
const manifest: ChromeManifest = {
  manifest_version: 3,
  name: "MarkdownSave",
  version: packageJson.version,
  description: "This extension works like a web clipper, but it downloads articles in markdown format.",
  icons: extensionIcons,
  action: {
    default_title: "MarkdownSave",
    default_popup: "popup/index.html",
    default_icon: actionIcons
  },
  background: {
    service_worker: "background/service-worker.js",
    type: "module"
  },
  options_ui: {
    page: "options/index.html",
    open_in_tab: false
  },
  permissions: manifestPermissions,
  host_permissions: manifestHostPermissions,
  commands: manifestCommands,
  web_accessible_resources: webAccessibleResources,
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';"
  }
};

export default manifest;
