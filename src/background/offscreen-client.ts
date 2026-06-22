import type { ExtensionResponse } from "../shared/errors";
import { MessageTarget, MessageType, type RuntimePingData } from "../shared/messages";
import { formatRequestId } from "../shared/request-id";
import {
  createChromeOffscreenPlatformAdapter,
  createOffscreenDocument,
  defaultOffscreenCreateOptions,
  getExistingOffscreenDocuments,
  isOffscreenSupported,
  type OffscreenDocumentCreateOptions,
  type OffscreenPlatformAdapter
} from "../platform/offscreen";

/** offscreen ready ping 响应数据。 */
export interface OffscreenReadyData extends RuntimePingData {
  /** offscreen 文档已完成 runtime handler 注册。 */
  ready: true;
}

/** ensure offscreen 的可测结果。 */
export interface EnsureOffscreenDocumentResult {
  /** 当前平台是否支持 offscreen。 */
  supported: boolean;
  /** ensure 后是否存在 offscreen document。 */
  available: boolean;
  /** 是否在本次调用里创建了 document。 */
  created: boolean;
  /** runtime ping 是否返回 ready。 */
  ready: boolean;
}

/** offscreen client 依赖，测试可注入。 */
export interface OffscreenClientDependencies {
  /** offscreen 平台 adapter。 */
  platform: OffscreenPlatformAdapter;
  /** offscreen 创建参数。 */
  createOptions: OffscreenDocumentCreateOptions;
  /** 向 offscreen 发送 runtime message。 */
  sendRuntimeMessage(message: unknown): Promise<ExtensionResponse<OffscreenReadyData> | null | undefined>;
}

/** 正在进行的创建流程，用于防止并发重复创建。 */
let pendingEnsure: Promise<EnsureOffscreenDocumentResult> | null = null;

/** 创建默认 offscreen client 依赖。 */
export function createOffscreenClientDependencies(): OffscreenClientDependencies {
  return {
    platform: createChromeOffscreenPlatformAdapter(),
    createOptions: defaultOffscreenCreateOptions,
    sendRuntimeMessage(message) {
      return chrome.runtime.sendMessage(message) as Promise<ExtensionResponse<OffscreenReadyData>>;
    }
  };
}

/** 创建前查询既有 OFFSCREEN_DOCUMENT，并在创建后用 runtime ping 验证 ready。 */
export async function ensureOffscreenDocument(
  dependencies: OffscreenClientDependencies = createOffscreenClientDependencies()
): Promise<EnsureOffscreenDocumentResult> {
  if (pendingEnsure !== null) {
    return pendingEnsure;
  }

  pendingEnsure = ensureOffscreenDocumentOnce(dependencies).finally(() => {
    pendingEnsure = null;
  });

  return pendingEnsure;
}

/** 单次 ensure 流程，便于并发保护包裹。 */
async function ensureOffscreenDocumentOnce(
  dependencies: OffscreenClientDependencies
): Promise<EnsureOffscreenDocumentResult> {
  if (!isOffscreenSupported(dependencies.platform)) {
    return {
      supported: false,
      available: false,
      created: false,
      ready: false
    };
  }

  const existingContexts = await getExistingOffscreenDocuments(
    dependencies.platform,
    dependencies.createOptions.path
  );
  const created = existingContexts.length === 0;

  if (created) {
    await createOffscreenDocument(dependencies.platform, dependencies.createOptions);
  }

  const ready = await pingOffscreenReady(dependencies.sendRuntimeMessage);

  return {
    supported: true,
    available: true,
    created,
    ready
  };
}

/** 使用 M2 runtime ping 请求验证 offscreen runtime handler 已 ready。 */
async function pingOffscreenReady(
  sendRuntimeMessage: OffscreenClientDependencies["sendRuntimeMessage"]
): Promise<boolean> {
  const requestId = formatRequestId("offscreen-ready");

  try {
    const response = await sendRuntimeMessage({
      target: MessageTarget.OFFSCREEN,
      type: MessageType.RUNTIME_PING_REQUEST,
      requestId
    });

    if (response === null || response === undefined || !response.ok) {
      return false;
    }

    return response.requestId === requestId && response.data.pong === true && response.data.ready === true;
  } catch {
    return false;
  }
}
