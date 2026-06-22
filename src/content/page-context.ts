import { formatRequestId } from "../shared/request-id";
import { dispatchPageContextReady } from "./page-context-bridge";

/** page context 初始化，不读取 DOM，只声明桥接 ready。 */
export function initializePageContext(): void {
  dispatchPageContextReady(window, formatRequestId("page-context-ready"));
}

if (typeof window !== "undefined") {
  initializePageContext();
}
