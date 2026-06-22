/** 脚本注入目标，复用 Chrome MV3 scripting 类型。 */
export type ScriptInjectionTarget = chrome.scripting.InjectionTarget;

/** 脚本注入结果，保留 Chrome 返回的 frame 与 document 事实。 */
export type ScriptInjectionResult<Result> = chrome.scripting.InjectionResult<Result>;

/** 文件脚本注入参数。 */
export interface FileScriptInjection {
  /** 注入目标。 */
  target: ScriptInjectionTarget;
  /** 需要注入的扩展包内脚本文件。 */
  files: string[];
  /** 执行 world，默认由 Chrome 决定。 */
  world?: `${chrome.scripting.ExecutionWorld}`;
}

/** scripting adapter，只隔离 chrome.scripting，不实现注入策略。 */
export interface ScriptingAdapter {
  /** 注入扩展包脚本文件。 */
  executeFileScript(injection: FileScriptInjection): Promise<Array<ScriptInjectionResult<unknown>>>;
}

/** 从 chrome.scripting 创建最小 scripting adapter。 */
export function createScriptingAdapter(scriptingApi: typeof chrome.scripting = chrome.scripting): ScriptingAdapter {
  return {
    executeFileScript(injection: FileScriptInjection) {
      return scriptingApi.executeScript<[], unknown>({
        target: injection.target,
        files: injection.files,
        world: injection.world
      });
    }
  };
}
