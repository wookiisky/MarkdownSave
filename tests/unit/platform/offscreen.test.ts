/// <reference types="chrome" />

import { describe, expect, it } from "vitest";

import {
  createOffscreenDocument,
  defaultOffscreenCreateOptions,
  getExistingOffscreenDocuments,
  isOffscreenSupported,
  type OffscreenPlatformAdapter
} from "../../../src/platform/offscreen";

/** 构造可测 extension context。 */
function createExtensionContext(documentUrl: string): chrome.runtime.ExtensionContext {
  return {
    contextId: "ctx_offscreen",
    contextType: "OFFSCREEN_DOCUMENT",
    documentUrl,
    frameId: -1,
    incognito: false,
    tabId: -1,
    windowId: -1
  };
}

describe("platform offscreen adapter", () => {
  it("创建前通过 runtime.getContexts 查询既有 offscreen document", async () => {
    const documentUrl = "chrome-extension://extension-id/offscreen/offscreen.html";
    const contexts = [createExtensionContext(documentUrl)];
    const platform: OffscreenPlatformAdapter = {
      runtime: {
        getURL() {
          return documentUrl;
        },
        getContexts(filter) {
          expect(filter).toEqual({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
            documentUrls: [documentUrl]
          });

          return Promise.resolve(contexts);
        }
      },
      offscreen: {
        createDocument() {
          return Promise.resolve();
        },
        closeDocument() {
          return Promise.resolve();
        }
      },
      offscreenContextType: "OFFSCREEN_DOCUMENT"
    };

    await expect(getExistingOffscreenDocuments(platform)).resolves.toEqual(contexts);
  });

  it("只在平台支持 offscreen 时创建 document", async () => {
    const createdParameters: chrome.offscreen.CreateParameters[] = [];
    const platform: OffscreenPlatformAdapter = {
      runtime: {
        getURL(path) {
          return `chrome-extension://extension-id/${path}`;
        },
        getContexts() {
          return Promise.resolve([]);
        }
      },
      offscreen: {
        createDocument(parameters) {
          createdParameters.push(parameters);

          return Promise.resolve();
        },
        closeDocument() {
          return Promise.resolve();
        }
      },
      offscreenContextType: "OFFSCREEN_DOCUMENT"
    };

    expect(isOffscreenSupported(platform)).toBe(true);

    await createOffscreenDocument(platform);

    expect(createdParameters).toEqual([
      {
        url: defaultOffscreenCreateOptions.path,
        reasons: [...defaultOffscreenCreateOptions.reasons],
        justification: defaultOffscreenCreateOptions.justification
      }
    ]);
  });

  it("缺少 runtime.getContexts 时不支持 offscreen ensure 能力", async () => {
    const platform: OffscreenPlatformAdapter = {
      runtime: {
        getURL(path) {
          return `chrome-extension://extension-id/${path}`;
        }
      },
      offscreen: {
        createDocument() {
          return Promise.resolve();
        },
        closeDocument() {
          return Promise.resolve();
        }
      },
      offscreenContextType: "OFFSCREEN_DOCUMENT"
    };

    expect(isOffscreenSupported(platform)).toBe(false);
    await expect(getExistingOffscreenDocuments(platform)).resolves.toEqual([]);
  });

  it("缺少 OFFSCREEN_DOCUMENT context type 时不支持 offscreen ensure 能力", () => {
    const platform: OffscreenPlatformAdapter = {
      runtime: {
        getURL(path) {
          return `chrome-extension://extension-id/${path}`;
        },
        getContexts() {
          return Promise.resolve([]);
        }
      },
      offscreen: {
        createDocument() {
          return Promise.resolve();
        },
        closeDocument() {
          return Promise.resolve();
        }
      }
    };

    expect(isOffscreenSupported(platform)).toBe(false);
  });

  it("非 OFFSCREEN_DOCUMENT context type 时不支持 offscreen ensure 能力", () => {
    const platform: OffscreenPlatformAdapter = {
      runtime: {
        getURL(path) {
          return `chrome-extension://extension-id/${path}`;
        },
        getContexts() {
          return Promise.resolve([]);
        }
      },
      offscreen: {
        createDocument() {
          return Promise.resolve();
        },
        closeDocument() {
          return Promise.resolve();
        }
      },
      offscreenContextType: "BACKGROUND"
    };

    expect(isOffscreenSupported(platform)).toBe(false);
  });
});
