import { MessageType } from "../shared/messages";
import type { ManifestCommandId } from "../manifest/commands";
import { executeMarkdownActionAndReport, type MarkdownActionDependencies, type MarkdownActionKind } from "./markdown-actions";

/** Chrome command id 到 M2 请求边界的映射结果。 */
export interface CommandBoundary {
  /** 原始 command id。 */
  commandId: string;
  /** 已知 M2 请求类型；M3 不执行业务。 */
  requestType: typeof MessageType.DOWNLOAD_MARKDOWN_REQUEST | typeof MessageType.CLIP_CAPTURE_REQUEST;
}

/** command 监听事件最小形状。 */
export interface CommandEventTarget {
  /** 注册 command 监听器。 */
  addListener(listener: (command: string) => void): void;
}

/** commands API 最小形状。 */
export interface CommandsRegistrationApi {
  /** Chrome commands.onCommand 事件。 */
  onCommand: CommandEventTarget;
}

/** MarkDownload parity command 中当前 M3 识别的业务边界。 */
const knownCommandBoundaries: Readonly<Partial<Record<ManifestCommandId, CommandBoundary>>> = {
  download_tab_as_markdown: {
    commandId: "download_tab_as_markdown",
    requestType: MessageType.DOWNLOAD_MARKDOWN_REQUEST
  },
  copy_tab_as_markdown: {
    commandId: "copy_tab_as_markdown",
    requestType: MessageType.CLIP_CAPTURE_REQUEST
  },
  copy_selection_as_markdown: {
    commandId: "copy_selection_as_markdown",
    requestType: MessageType.CLIP_CAPTURE_REQUEST
  },
  copy_tab_as_markdown_link: {
    commandId: "copy_tab_as_markdown_link",
    requestType: MessageType.CLIP_CAPTURE_REQUEST
  },
  copy_selected_tab_as_markdown_link: {
    commandId: "copy_selected_tab_as_markdown_link",
    requestType: MessageType.CLIP_CAPTURE_REQUEST
  },
  copy_selection_to_obsidian: {
    commandId: "copy_selection_to_obsidian",
    requestType: MessageType.CLIP_CAPTURE_REQUEST
  },
  copy_tab_to_obsidian: {
    commandId: "copy_tab_to_obsidian",
    requestType: MessageType.CLIP_CAPTURE_REQUEST
  }
};

/** 已注册 command event，避免同一 worker 实例重复挂监听器。 */
const registeredCommandEvents = new WeakSet<CommandEventTarget>();

/** 解析 command id 到当前里程碑允许暴露的请求边界。 */
export function resolveCommandBoundary(commandId: string): CommandBoundary | null {
  const boundary = knownCommandBoundaries[commandId as ManifestCommandId];

  if (boundary === undefined) {
    return null;
  }

  return boundary;
}

/** 将 command id 映射到 M8 action。 */
export function readCommandAction(commandId: string): MarkdownActionKind | null {
  switch (commandId) {
    case "download_tab_as_markdown":
      return "downloadTab";
    case "copy_tab_as_markdown":
      return "copyTab";
    case "copy_selection_as_markdown":
      return "copySelection";
    case "copy_tab_as_markdown_link":
      return "copyTabLink";
    case "copy_selected_tab_as_markdown_link":
      return "copySelectedTabLinks";
    case "copy_selection_to_obsidian":
      return "copySelectionToObsidian";
    case "copy_tab_to_obsidian":
      return "copyTabToObsidian";
    default:
      return null;
  }
}

/** 执行 command 对应 action。 */
export function handleCommandBoundary(
  commandId: string,
  actionDependencies?: MarkdownActionDependencies
): void {
  const boundary = resolveCommandBoundary(commandId);
  const action = readCommandAction(commandId);

  if (boundary === null || action === null) {
    return;
  }

  void executeMarkdownActionAndReport(action, {}, actionDependencies);
}

/** 注册 Chrome command listener。 */
export function registerCommandListeners(
  commandsApi: CommandsRegistrationApi,
  actionDependencies?: MarkdownActionDependencies
): void {
  if (registeredCommandEvents.has(commandsApi.onCommand)) {
    return;
  }

  commandsApi.onCommand.addListener((command) => {
    handleCommandBoundary(command, actionDependencies);
  });
  registeredCommandEvents.add(commandsApi.onCommand);
}
