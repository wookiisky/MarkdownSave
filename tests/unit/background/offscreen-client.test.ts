/// <reference types="chrome" />

import { describe, expect, it } from "vitest";

import {
  ensureOffscreenDocument,
  type OffscreenClientDependencies
} from "../../../src/background/offscreen-client";
import { defaultOffscreenCreateOptions, type OffscreenPlatformAdapter } from "../../../src/platform/offscreen";
import { toSuccessResponse } from "../../../src/shared/errors";
import { MessageTarget, MessageType } from "../../../src/shared/messages";

/** 创建 offscreen client 测试依赖。 */
function createDependencies(existingContexts: chrome.runtime.ExtensionContext[]): {
  dependencies: OffscreenClientDependencies;
  createCalls: chrome.offscreen.CreateParameters[];
  getContextCalls: chrome.runtime.ContextFilter[];
} {
  const createCalls: chrome.offscreen.CreateParameters[] = [];
  const getContextCalls: chrome.runtime.ContextFilter[] = [];
  const platform: OffscreenPlatformAdapter = {
    runtime: {
      getURL(path) {
        return `chrome-extension://extension-id/${path}`;
      },
      getContexts(filter) {
        getContextCalls.push(filter);

        return Promise.resolve(existingContexts);
      }
    },
    offscreen: {
      async createDocument(parameters) {
        createCalls.push(parameters);
      },
      async closeDocument() {
        return undefined;
      }
    },
    offscreenContextType: "OFFSCREEN_DOCUMENT"
  };

  return {
    dependencies: {
      platform,
      createOptions: defaultOffscreenCreateOptions,
      sendRuntimeMessage(message) {
        expect(message).toEqual({
          target: MessageTarget.OFFSCREEN,
          type: MessageType.RUNTIME_PING_REQUEST,
          requestId: "req_offscreen-ready"
        });

        return Promise.resolve(toSuccessResponse("req_offscreen-ready", { pong: true, ready: true }));
      }
    },
    createCalls,
    getContextCalls
  };
}

/** 构造 offscreen context。 */
function createContext(): chrome.runtime.ExtensionContext {
  return {
    contextId: "ctx_existing",
    contextType: "OFFSCREEN_DOCUMENT",
    documentUrl: "chrome-extension://extension-id/offscreen/offscreen.html",
    frameId: -1,
    incognito: false,
    tabId: -1,
    windowId: -1
  };
}

describe("background offscreen client", () => {
  it("offscreen 不存在时才创建 document 并 ping ready", async () => {
    const { dependencies, createCalls } = createDependencies([]);

    const result = await ensureOffscreenDocument(dependencies);

    expect(result).toEqual({
      supported: true,
      available: true,
      created: true,
      ready: true
    });
    expect(createCalls).toHaveLength(1);
  });

  it("offscreen 已存在时复用，不重复创建", async () => {
    const { dependencies, createCalls } = createDependencies([createContext()]);

    const result = await ensureOffscreenDocument(dependencies);

    expect(result.created).toBe(false);
    expect(result.ready).toBe(true);
    expect(createCalls).toHaveLength(0);
  });

  it("并发 ensure 共享同一个创建流程", async () => {
    let releaseCreate: (() => void) | undefined;
    let notifyCreateStarted: (() => void) | undefined;
    const createStarted = new Promise<void>((resolve) => {
      notifyCreateStarted = resolve;
    });
    const { dependencies, createCalls } = createDependencies([]);
    dependencies.platform.offscreen = {
      createDocument(parameters) {
        createCalls.push(parameters);
        notifyCreateStarted?.();

        return new Promise<void>((resolve) => {
          releaseCreate = resolve;
        });
      },
      closeDocument() {
        return Promise.resolve();
      }
    };

    const firstEnsure = ensureOffscreenDocument(dependencies);
    const secondEnsure = ensureOffscreenDocument(dependencies);

    await createStarted;

    const resolveCreate = releaseCreate;
    if (resolveCreate === undefined) {
      throw new Error("createDocument 未进入等待状态。");
    }

    resolveCreate();

    const [firstResult, secondResult] = await Promise.all([firstEnsure, secondEnsure]);

    expect(firstResult).toEqual(secondResult);
    expect(createCalls).toHaveLength(1);
  });

  it("offscreen ping 无响应时不伪造成 ready", async () => {
    const { dependencies } = createDependencies([]);
    dependencies.sendRuntimeMessage = () => Promise.resolve(undefined);

    const result = await ensureOffscreenDocument(dependencies);

    expect(result.ready).toBe(false);
  });

  it("offscreen ping 拒绝时返回 not ready", async () => {
    const { dependencies } = createDependencies([]);
    dependencies.sendRuntimeMessage = () => Promise.reject(new Error("offscreen not ready"));

    const result = await ensureOffscreenDocument(dependencies);

    expect(result.ready).toBe(false);
  });

  it("offscreen ping 响应 requestId 不匹配时返回 not ready", async () => {
    const { dependencies } = createDependencies([]);
    dependencies.sendRuntimeMessage = () =>
      Promise.resolve(toSuccessResponse("req_other", { pong: true, ready: true }));

    const result = await ensureOffscreenDocument(dependencies);

    expect(result.ready).toBe(false);
  });
});
