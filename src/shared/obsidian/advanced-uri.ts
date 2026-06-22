import { generateValidFileName, sanitizePathSegments } from "../filename/sanitize";

/** Obsidian Advanced URI 构造输入。 */
export interface AdvancedObsidianUriInput {
  /** Obsidian vault 名称；保持旧行为，不做 encodeURIComponent。 */
  vault: string;
  /** 已清洗且可选带末尾 / 的 folder；保持旧行为，不做 encodeURIComponent。 */
  folder: string;
  /** 已格式化标题；最终按 generateValidFileName(title) 清洗，不传 disallowedChars。 */
  title: string;
}

/** Obsidian folder 格式化输入。 */
export interface ObsidianFolderFormattingInput {
  /** 已完成模板替换的 folder 文本。 */
  folder: string;
  /** 额外不允许出现在 folder 分段中的字符。 */
  disallowedChars: string | null;
}

/** 清洗 Obsidian folder 分段，并按旧行为补齐末尾 /。 */
export function formatObsidianFolder(input: ObsidianFolderFormattingInput): string {
  if (input.folder.length === 0) {
    return "";
  }

  const folder = sanitizePathSegments(input.folder, input.disallowedChars);
  if (folder.endsWith("/")) {
    return folder;
  }

  return `${folder}/`;
}

/** 构造 MarkDownload 兼容的 Obsidian Advanced URI。 */
export function buildAdvancedObsidianUri(input: AdvancedObsidianUriInput): string {
  const filepath = input.folder + generateValidFileName(input.title);

  return `obsidian://advanced-uri?vault=${input.vault}&clipboard=true&mode=new&filepath=${filepath}`;
}
