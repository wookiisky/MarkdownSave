# 外部行为

## 职责

本文档记录用户可观察行为、命令、菜单、配置、下载语义、错误语义和限制边界。

M12 范围包含当前页全文剪藏、选区剪藏、popup Markdown 编辑、复制、Markdown 下载、图片下载计划、菜单命令、Obsidian 当前页流程、可恢复批量下载 job、完整 options 页面、导入导出、storage 迁移、发布包审计和最终 parity review。本文档记录首版已收口的用户可见行为和已知差异。

## 用户可见功能基线

- 当前页剪藏为 Markdown。
- 选区剪藏为 Markdown。
- popup 预览 Markdown。
- popup 编辑 Markdown。
- popup 编辑器中选中 Markdown 后只下载选中内容。
- 下载 Markdown 文件。
- 复制 Markdown 到剪贴板。
- 批量下载所有标签页为 Markdown。
- 复制当前 tab 链接为 Markdown 链接。
- 复制所有 tab 链接为 Markdown 链接列表。
- 复制选中 tab 链接为 Markdown 链接列表。
- 复制链接为 Markdown 链接。
- 复制图片为 Markdown 图片。
- 图片下载与路径改写。
- frontmatter 模板。
- backmatter 模板。
- 标题模板。
- 保存目录模板。
- context menu。
- commands。
- options。
- options 导入导出。
- Obsidian Advanced URI。
- downloads API。
- contentLink 降级。

## 平台边界

- 首版只支持 Chrome Manifest V3。
- Firefox 不进入首版。
- Safari 不进入首版。
- 不建立 Firefox 或 Safari 隐藏兼容层。

## Commands

- MarkDownload `_execute_browser_action` 默认快捷键是 `Alt+Shift+M`。
- M1 根目录工程已迁移为 `_execute_action`，默认快捷键是 `Alt+Shift+M`。
- `download_tab_as_markdown` 默认快捷键是 `Alt+Shift+D`。
- `copy_tab_as_markdown` 默认快捷键是 `Alt+Shift+C`。
- `copy_selection_as_markdown` 无默认快捷键。
- `copy_tab_as_markdown_link` 默认快捷键是 `Alt+Shift+L`。
- `copy_selected_tab_as_markdown_link` 无默认快捷键。
- `copy_selection_to_obsidian` 无默认快捷键。
- `copy_tab_to_obsidian` 无默认快捷键。
- M8 commands 已映射到当前页下载、当前页复制、选区复制、当前 tab 链接复制、选中 tab 链接复制和 Obsidian 当前页或选区流程。

## Context menu

首版需要盘点并保留 MarkDownload 中的 tab、all、selection、link、image、checkbox 和 Obsidian 菜单项。

当前 MarkDownload 参考入口包含以下菜单 id：

- `download-markdown-tab`
- `tab-download-markdown-alltabs`
- `copy-tab-as-markdown-link-tab`
- `copy-tab-as-markdown-link-all-tab`
- `copy-tab-as-markdown-link-selected-tab`
- `tab-separator-1`
- `tabtoggle-includeTemplate`
- `tabtoggle-downloadImages`
- `download-markdown-alltabs`
- `separator-0`
- `download-markdown-selection`
- `download-markdown-all`
- `separator-1`
- `copy-markdown-selection`
- `copy-markdown-link`
- `copy-markdown-image`
- `copy-markdown-all`
- `copy-tab-as-markdown-link`
- `copy-tab-as-markdown-link-all`
- `copy-tab-as-markdown-link-selected`
- `separator-2`
- `copy-markdown-obsidian`
- `copy-markdown-obsall`
- `separator-3`
- `toggle-includeTemplate`
- `toggle-downloadImages`

真实 Chrome context menu 点击不作为 Playwright E2E 门禁；菜单定义、开关、重建、映射和 action 顺序由单元测试覆盖。无法由自动化稳定触发的入口已记录到 parity checklist。

M8 context menu 行为：

- 菜单在安装、启动、service worker 唤醒和 `storage.sync` 变化时重建。
- `contextMenus=false` 时移除旧菜单且不创建新菜单。
- `includeTemplate` 和 `downloadImages` checkbox 初始状态来自用户配置。
- `obsidianIntegration=false` 时不创建 Obsidian 菜单项。
- 下载、复制、选区复制、链接复制、图片复制、tab 链接复制、选中 tab 链接复制和 Obsidian 菜单已接入 background action。

## Options 行为

- 用户配置保存到 `storage.sync`。
- `storage.sync` 是用户配置主事实。
- `storage.local` 只用于批量任务、临时进度、错误记录和恢复状态，不保存 options 主事实。
- options 支持导入配置。
- options 支持导出配置。
- options 页面实现 MarkDownload 默认配置中的全部 26 个字段。
- options 字段包含 `includeTemplate`、`downloadImages`、`turndownEscape`、`contextMenus`、`obsidianIntegration`、`obsidianVault`、`obsidianFolder`、`frontmatter`、`backmatter`、`title`、`disallowedChars`、`imagePrefix`、`mdClipsFolder`、`saveAs`、`headingStyle`、`hr`、`bulletListMarker`、`codeBlockStyle`、`fence`、`emDelimiter`、`strongDelimiter`、`linkStyle`、`linkReferenceStyle`、`imageStyle`、`imageRefStyle` 和 `downloadMode`。
- options 支持 frontmatter、backmatter、标题模板、保存目录模板和图片目录模板。
- options 支持菜单开关。
- options 支持 Obsidian Advanced URI 配置。
- options 支持 downloads API 和 contentLink 下载模式。
- options 读取 `storage.sync` 时使用 `get(null)` 获取完整旧配置，再通过 shared schema 清洗。
- options 清洗后缺字段补默认值，未知未来字段隔离且不进入核心 options。
- 迁移失败时不写 `storage.sync` 或 `storage.local`，不覆盖旧配置。
- 迁移失败后 options 页面进入受限或只读状态，只允许导入有效 JSON 或显式重置默认配置。
- 导入 JSON 先 parse，再走 schema 校验。
- 非法 JSON 或非法 schema 导入不写 storage，不覆盖当前用户数据。
- 缺字段导入按默认值补齐。
- 未知字段导入被忽略或隔离，不进入核心 options。
- 导出只导出当前已知 options，JSON 字段和格式保持稳定。
- 导出文件名使用 `MarkdownSave-export-YYYY-MM-DD.json`。
- options 页面不启动剪藏。
- options 页面不处理批量下载进度。
- options 页面不访问网页 DOM。
- 源码默认 `title={pageTitle}`。
- 源码默认 `imagePrefix={pageTitle}/`。
- M12 已核对 MarkDownload 用户指南和源码默认值；本项目以 MarkDownload 源码默认配置和当前 shared defaults 为默认值事实源。
- M4 已迁移 MarkDownload 默认配置到 shared 纯逻辑层。
- M4 配置导入边界先校验未知 JSON，缺字段按默认值补齐，未知未来字段隔离，已知字段类型错误或枚举非法时返回结构化错误。

## 模板语义

- 模板支持 article 字段。
- 模板支持 URL 字段。
- 模板支持 `meta[name]` 和 `meta[property]` 进入 article 后的字段。
- 模板支持 date。
- 模板支持 keywords。
- 模板支持参数化后缀。
- 未知占位符置空。
- 文档不复制完整字段清单，字段权威入口是代码中的类型或 schema。
- M4 已实现模板纯替换 helper，支持 `content` 字段跳过、date 本地时间格式化、keywords 自定义分隔符、九类参数化后缀和未知占位符置空。
- M4 已实现 meta 提取 helper，`meta[name]` 和 `meta[property]` 可进入 article 字段，已有 article 字段优先。
- M4 已实现 MarkDownload 兼容 URL helper，相对 URL 拼接保留旧实现的非标准行为。

## 图片行为

- `imageStyle` 有六类用户可见取值：`originalSource`、`noImage`、`markdown`、`base64`、`obsidian`、`obsidian-nofolder`。
- `imageRefStyle` 支持 inline 和 referenced 两类输出。
- `downloadImages` 控制是否下载图片。
- base64 图片写入 Markdown。
- 本地路径由标题、保存目录、图片前缀和图片文件名共同决定。
- MIME 用于无扩展名图片的扩展名推断。
- 重复名必须去重。
- M4 已实现图片路径规划纯函数，不执行网络请求，不调用 downloads API，不做 MIME fetch。

## 下载行为

- `downloadMode` 支持 `downloadsApi` 和 `contentLink`。
- `downloadsApi` 使用 Chrome downloads API。
- `contentLink` 是降级设计。
- `saveAs` 控制是否弹出保存对话框。
- `mdClipsFolder` 控制 downloads API 模式下 Markdown 文件保存目录。
- 图片下载路径需要与 Markdown 中改写后的图片路径保持一致。
- M4 已实现 Obsidian Advanced URI 构造纯函数，vault、folder 和 filepath 保留 MarkDownload 未编码行为。
- M7 `downloadImages` 可在 popup 当前会话中切换，暂不写入用户配置。
- M7 转换结果带出图片下载计划，background 在下载前执行图片 fetch、MIME 扩展修正和 Markdown 路径替换。
- M7 普通 Markdown 图片路径按 `/` 分段编码。
- M7 `originalSource` 保留 Markdown 中的原始图片 URL；开启 `downloadImages` 时仍生成图片下载计划。
- M7 Obsidian 图片路径保留原始路径，`obsidian-nofolder` 只保留 basename。
- M7 base64 图片模式下载前把 Markdown 中的图片 URL 替换为 data URI，不额外落盘图片文件。
- M7 MIME 可识别时把 `.idunno` 替换为推断扩展；MIME 未知时保留 `.idunno`。
- M8 command 和 context menu 下载当前页或选区时读取 `storage.sync` options。
- M9 `download all tabs` 启动可恢复 batch job，返回 `jobId`、状态、总数、完成数和失败数摘要。
- M9 batch job 记录到 `storage.local.markdownSaveBatchJobs`。
- M9 batch `completedTabs` 统计 `downloaded` 和 `skipped`；`failedTabs` 只统计 `failed`。
- M9 batch 对缺失、受限或不可访问 tab 记录为 `skipped`，继续处理其它 tab。
- M9 batch 24 小时过期，过期后未完成 tab 记录失败。
- M9 batch 支持 `batch.cancel.request` 取消运行中任务。
- M9 batch 恢复时不会重复下载已 `downloaded` 的 tab。
- M8 contentLink 模式或 downloads API 降级成功后仍尝试下载已规划图片。
- M6 popup 使用 CodeMirror 6 展示和编辑 Markdown。
- M6 popup `Copy` 复制当前编辑器完整 Markdown。
- M6 popup `Download` 下载当前编辑器完整 Markdown。
- M7 popup `Download` 会按当前编辑器 Markdown 过滤图片下载计划，不下载已被用户删掉的旧图片。
- M6 popup `Download Selection` 只下载编辑器中当前选中的 Markdown；没有编辑器选区时按钮禁用。
- M6 popup 编辑状态不写入用户配置。

## 复制和 Obsidian 行为

- M8 复制当前页和选区 Markdown 时复用剪藏转换流程。
- M8 复制当前 tab 链接时复用剪藏后的标题模板和文章 URL。
- M8 复制所有 tab 或选中 tab 链接列表时按当前窗口 tab 查询结果顺序输出。
- M8 复制链接菜单输出 Markdown 链接。
- M8 复制图片菜单输出 Markdown 图片。
- M8 Obsidian 当前页和选区流程先复制 Markdown 到剪贴板，再打开 Advanced URI。
- M8 service worker 不直接写剪贴板，剪贴板写入通过页面注入执行。

## 选区行为

- M6 默认剪藏模式是 `selection`，表示页面存在非空选区时优先转换选区 HTML。
- M6 全文模式是 `page`，表示强制转换完整页面正文。
- M6 popup 仅在当前页面采集结果包含非空选区时展示 `Selected Text` 和 `Entire Document` 切换入口。
- M6 页面选区为空时不伪造内容，转换流程 fallback 到全文 Readability。
- M6 多 range 选区按浏览器 `Selection` 的 range 顺序逐段采集 HTML。
- MarkDownload 原版多 range 代码实际重复第一个 range；M6 按任务要求修正为采集每个 range，此差异已记录到 parity checklist。

## 外部错误语义

- 用户应看到可理解错误，不暴露底层异常堆栈作为唯一反馈。
- 错误对象包含 `code`、`message`、`recoverable` 和可选 `details`。
- 批量任务中单页失败时，用户应看到失败项和剩余任务状态。
- 受限页面、权限不足、downloads API 失败、剪贴板失败和 Obsidian 失败都通过 popup 错误、badge 或 `storage.local.markdownSaveLastActionError` 暴露。

## 发布行为

- 首版发布目录是 `dist/chrome`。
- 首版发布 zip 是 `dist/markdownsave-chrome.zip`。
- zip 根目录直接包含 `manifest.json`，不额外包裹 `dist` 或 `chrome` 目录。
- 当前 manifest 未声明 `default_locale`，发布产物不包含 `_locales`。
- 当前 zip 包含 source map，用于本地发布前排障。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/src/manifest/commands.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/manifest.config.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/defaults.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/schema.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/migrate.ts`
- `/Users/air/woo/MarkdownSave/src/options/App.tsx`
- `/Users/air/woo/MarkdownSave/src/options/main.tsx`
- `/Users/air/woo/MarkdownSave/src/options/options-fields.ts`
- `/Users/air/woo/MarkdownSave/src/options/options-storage.ts`
- `/Users/air/woo/MarkdownSave/src/shared/template/replace.ts`
- `/Users/air/woo/MarkdownSave/src/shared/template/date.ts`
- `/Users/air/woo/MarkdownSave/src/shared/template/meta.ts`
- `/Users/air/woo/MarkdownSave/src/shared/url/resolve.ts`
- `/Users/air/woo/MarkdownSave/src/shared/filename/sanitize.ts`
- `/Users/air/woo/MarkdownSave/src/shared/filename/image-path.ts`
- `/Users/air/woo/MarkdownSave/src/shared/obsidian/advanced-uri.ts`
- `/Users/air/woo/MarkdownSave/src/shared/download/download-plan.ts`
- `/Users/air/woo/MarkdownSave/src/shared/download/mime-extension.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-selection.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-page.ts`
- `/Users/air/woo/MarkdownSave/src/background/clip-flow.ts`
- `/Users/air/woo/MarkdownSave/src/background/download-markdown.ts`
- `/Users/air/woo/MarkdownSave/src/background/page-capture-scripting.ts`
- `/Users/air/woo/MarkdownSave/src/background/markdown-actions.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/convert-runner.ts`
- `/Users/air/woo/MarkdownSave/src/popup/App.tsx`
- `/Users/air/woo/MarkdownSave/src/popup/MarkdownEditor.tsx`
- `/Users/air/woo/MarkdownSave/src/popup/popup-state.ts`
- `/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `/Users/air/woo/MarkdownSave/plan.md`
- `/Users/air/woo/MarkdownSave/tasks.md`
- `/Users/air/woo/MarkdownSave/markdownload/src/manifest.json`
- `/Users/air/woo/MarkdownSave/markdownload/src/shared/default-options.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/shared/context-menus.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/background/background.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/popup/popup.html`
- `/Users/air/woo/MarkdownSave/markdownload/src/popup/popup.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/options/options.html`
- `/Users/air/woo/MarkdownSave/markdownload/src/options/options.js`

## 测试入口

- `/Users/air/woo/MarkdownSave/tests/unit/manifest/manifest.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/options/options-migrate.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/template/template-replace.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/template/template-date.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/template/template-meta.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/url/resolve.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/filename/sanitize.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/filename/image-path.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/obsidian/advanced-uri.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/download/download-plan.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/download/mime-extension.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-selection.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-page.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/clip-flow.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/convert-runner.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/popup/popup-state.test.ts`
- `/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- `/Users/air/woo/MarkdownSave/tests/fixtures/`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`
