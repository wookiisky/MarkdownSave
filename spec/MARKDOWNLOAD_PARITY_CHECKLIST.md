# MarkDownload Parity Checklist

## 职责

本文档记录首版必须等价覆盖的 MarkDownload 用户可见 parity 项。

M12 已建立根目录 Chrome MV3 工程、核心剪藏、下载、复制、批量、options、representative snapshot、发布产物审计和最终 parity review 事实。

## 产品定位

- 根目录建立正式 Chrome MV3 扩展。
- MarkDownload 是功能基线。
- MarkSnip 仅参考 MV3、offscreen、测试分层和 helper 拆分。
- 不引入 MarkSnip reader、highlight、native bridge、agent bridge、通知中心和营销发布功能。
- Obsidian Advanced URI 属于 MarkDownload 自身 parity 功能，首版保留。

## 平台 parity

- 首版只支持 Chrome Manifest V3。
- Firefox 不进入首版。
- Safari 不进入首版。
- M1 已将 `_execute_browser_action` 迁移为 `_execute_action`。

## 核心剪藏 parity

- 当前页剪藏为 Markdown。
- 选区剪藏为 Markdown。
- Readability 提取文章。
- Turndown 转换 Markdown。
- GFM 插件行为。
- 代码块转换。
- MathJax 和 KaTeX 相关转换。
- 隐藏节点过滤。
- base URL 修正相对链接。
- popup 预览 Markdown。
- popup 编辑 Markdown。
- popup 在网页存在选区时显示选区和全文切换入口。
- popup 选中 Markdown 后只下载选中内容。
- M5 已实现 popup 发起当前页全文剪藏、Markdown 预览和 textarea 编辑。
- M5 已接入 Readability、Turndown、GFM、隐藏节点过滤、base URL 修正、保留标签和不可见字符清理。
- M5 已实现 Readability 空内容 fallback，优先 fallback 到 body 或 documentElement 可转换内容。
- M6 已实现选区剪藏、popup 选区和全文切换、CodeMirror Markdown 编辑、编辑器选中内容下载。
- M6 已实现 multi range 选区采集。
- M6 页面选区为空时 fallback 到全文转换。
- M11 representative fixture 中没有 page context math 数据时 MathJax fallback 文本保留，这是当前真实浏览器路径的已审查基线；MathJax id 映射规则由 conversion 单元测试覆盖。

## 下载和复制 parity

- 下载 Markdown。
- 复制 Markdown 到剪贴板。
- 批量下载所有标签页为 Markdown。
- 复制当前 tab URL 为 Markdown 链接。
- 复制所有 tab URL 为 Markdown 链接列表。
- 复制选中 tab URL 为 Markdown 链接列表。
- 复制链接为 Markdown 链接。
- 复制图片为 Markdown 图片。
- downloads API 下载。
- contentLink 降级。
- saveAs。
- downloadMode。
- mdClipsFolder。
- M5 已实现 popup 当前 Markdown 复制到剪贴板。
- M5 已实现 popup 请求 background 下载当前 Markdown 文本。
- M6 已实现 popup 复制当前编辑器完整 Markdown。
- M6 已实现 popup 下载当前编辑器完整 Markdown。
- M6 已实现 popup 下载编辑器当前选中的 Markdown。
- M5 下载使用 data URL 和默认文件名清洗；完整 `downloadMode`、`saveAs`、`mdClipsFolder` 和图片计划属于 M7/M10。
- M7 已实现 `downloadMode`、`saveAs`、`mdClipsFolder`、Markdown 文件名计划和 contentLink 降级的核心路径。
- M9 已实现批量下载 job 协议、`storage.local` 恢复状态、并发上限 2、24 小时过期、取消协议、重复 `jobId` 和全局重复 `requestId` 幂等。
- M9 批量任务对已下载 tab 不重复下载；对结果未知的 `downloading` tab 标记失败，不自动重试。

## 模板 parity

- frontmatter。
- backmatter。
- 标题模板。
- 保存目录模板。
- 图片目录模板。
- article 字段：`title`、`pageTitle`、`byline`、`excerpt`、`siteName`、`baseURI`、`length`、`dir`。
- URL 字段：`origin`、`host`、`hostname`、`port`、`protocol`、`pathname`、`search`、`hash`。
- `meta[name]`。
- `meta[property]`。
- `date` 格式化。
- `keywords` 和自定义分隔符。
- 参数化后缀：`lower`、`upper`、`kebab`、`mixed-kebab`、`snake`、`mixed_snake`、`obsidian-cal`、`camel`、`pascal`。
- 未知占位符置空。
- 文件名非法字符清理。
- options 源码默认 `title={pageTitle}`。
- options 源码默认 `imagePrefix={pageTitle}/`。
- M12 已核对 MarkDownload 用户指南和源码默认值：`title={pageTitle}`、`imagePrefix={pageTitle}/`、frontmatter、backmatter、`mdClipsFolder` 空值和 `downloadMode=downloadsApi` 以源码默认配置为事实源。
- M4 已用 shared 单元测试覆盖模板字段替换、date、keywords、meta、参数化后缀、未知占位符置空和文件名清洗。

## 图片 parity

- `imageStyle` 的 `originalSource`。
- `imageStyle` 的 `noImage`。
- `imageStyle` 的 `markdown`。
- `imageStyle` 的 `base64`。
- `imageStyle` 的 `obsidian`。
- `imageStyle` 的 `obsidian-nofolder`。
- `imageRefStyle` 的 inline。
- `imageRefStyle` 的 referenced。
- downloadImages。
- base64。
- 本地路径。
- MIME 推断。
- 重复名去重。
- 图片下载与 Markdown 路径改写。
- M4 已用 shared 单元测试覆盖图片文件名、前缀、重复名、Obsidian 路径和 Markdown 路径规划。
- M7 已接入 `downloadImages` 当前会话切换、图片路径改写和图片下载计划。
- M7 `originalSource` 保留 Markdown 原 URL，同时在开启 `downloadImages` 时保留图片下载计划。
- M7 已接入 MIME 可识别时的 `.idunno` 扩展替换。
- M7 已接入 base64 图片 Markdown 替换，不额外落盘图片文件。

## Commands parity

- `_execute_action` 默认 `Alt+Shift+M`，来自 MarkDownload `_execute_browser_action` 的 MV3 迁移。
- `download_tab_as_markdown` 默认 `Alt+Shift+D`。
- `copy_tab_as_markdown` 默认 `Alt+Shift+C`。
- `copy_selection_as_markdown` 无默认快捷键。
- `copy_tab_as_markdown_link` 默认 `Alt+Shift+L`。
- `copy_selected_tab_as_markdown_link` 无默认快捷键。
- `copy_selection_to_obsidian` 无默认快捷键。
- `copy_tab_to_obsidian` 无默认快捷键。
- M8 已把 command id 映射到下载、复制、链接复制和 Obsidian action。
- M11 未把真实 command 快捷键作为 E2E 覆盖项；Playwright 和 Chrome 扩展环境不能稳定触发 `chrome.commands.onCommand`，commands 入口由 manifest、映射和 action 单元测试覆盖。

## Context menu parity

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
- M8 已保留 MarkDownload context menu id 和 contexts。
- M8 菜单创建受 `contextMenus` 配置控制。
- M8 Obsidian 菜单受 `obsidianIntegration` 配置控制。
- M8 checkbox 初始状态来自 `includeTemplate` 和 `downloadImages`。
- M8 菜单点击已映射到下载、复制、链接、图片、tab 链接和 Obsidian action。
- M11 未把真实 Chrome context menu 作为 E2E 覆盖项；Playwright 不能稳定打开和点击扩展 context menu，菜单入口由定义、映射、checkbox、重建和 action 单元测试覆盖。

## Options parity

- options 页面。
- 配置保存。
- includeTemplate。
- downloadImages。
- turndownEscape。
- contextMenus。
- Obsidian integration。
- Obsidian vault。
- Obsidian folder。
- frontmatter。
- backmatter。
- title。
- disallowedChars。
- imagePrefix。
- mdClipsFolder。
- saveAs。
- headingStyle。
- hr。
- bulletListMarker。
- codeBlockStyle。
- fence。
- emDelimiter。
- strongDelimiter。
- linkStyle。
- linkReferenceStyle。
- imageStyle。
- imageRefStyle。
- downloadMode。
- 导入配置。
- 导出配置。
- M4 已迁移默认 options，并用 shared 单元测试覆盖缺字段补齐、未知字段隔离和非法字段失败。
- M10 options 页面覆盖 MarkDownload 默认配置中的全部 26 个字段。
- M10 用户配置主事实是 `storage.sync`；`storage.local` 只用于批量任务。
- M10 options 读取 `storage.sync` 时使用 `get(null)` 获取完整旧配置，再通过 shared schema 清洗。
- M10 缺字段配置补默认值，未知未来字段隔离且不进入核心 options。
- M10 迁移失败时不写 storage，不覆盖旧配置，页面进入受限或只读状态。
- M10 受限或只读状态只允许导入有效 JSON 或显式重置默认配置。
- M10 导入 JSON 先 parse 和 schema 校验；非法 JSON 或非法 schema 不写 storage，不覆盖当前用户数据。
- M10 缺字段导入补默认值，未知字段被忽略或隔离。
- M10 导出当前已知 options 为稳定 JSON，文件名格式是 `MarkdownSave-export-YYYY-MM-DD.json`。
- M10 options 页面不启动剪藏，不处理批量下载进度，不访问网页 DOM。
- M10 background 已监听 `storage.sync` 变化后重建菜单；`contextMenus=false` 时 `removeAll` 后不创建菜单。

## Obsidian parity

- 保留 Obsidian Advanced URI。
- 保留先复制 Markdown 到剪贴板再打开 URI 的流程。
- 支持选区发送到 Obsidian。
- 支持当前页发送到 Obsidian。
- 支持 vault 配置。
- 支持 folder 模板。
- 不使用 MarkSnip native bridge。
- 不使用 MarkSnip agent bridge。
- M4 已实现 Advanced URI 构造纯函数，并用单元测试覆盖 vault、folder 和 title 清洗行为。
- M8 已接入选区和当前页 Obsidian 流程，顺序是先复制 Markdown，再打开 Advanced URI。
- M11 未把真实 Obsidian URI 打开作为 E2E 覆盖项；真实外部协议跳转在 Playwright 中不可稳定断言，Obsidian 流程由 URI 构造和 action 顺序单元测试覆盖。

## Conversion helper parity

- M4 已建立 Turndown factory。
- M4 已启用 GFM 插件。
- M4 已保留 `iframe`、`sub`、`sup`、`u`、`ins`、`del`、`small` 和 `big`。
- M4 已实现 strip links 规则骨架。
- M4 已实现图片输出规则骨架。
- M4 已实现 fenced code 规则骨架。
- M4 已实现 MathJax id 映射输出规则骨架。
- M4 已实现不可见字符清理 helper。
- M5 已把 conversion helper 接入 offscreen 当前页剪藏闭环。
- M6 已把 selection HTML 覆盖正文的 MarkDownload 语义接入 offscreen 转换闭环。

## Snapshot parity

- M11 已建立 representative fixture。
- HTML fixture 入口是 `/Users/air/woo/MarkdownSave/tests/fixtures/html/representative-article.html`。
- Options fixture 入口是 `/Users/air/woo/MarkdownSave/tests/fixtures/options/representative-options.json`。
- Expected Markdown 入口是 `/Users/air/woo/MarkdownSave/tests/fixtures/expected-markdown/representative-article.md`。
- Snapshot 更新规则入口是 `/Users/air/woo/MarkdownSave/tests/fixtures/README.md`。
- Representative expected Markdown 由真实 MarkdownSave Chrome MV3 popup、background 和 offscreen flow 产出，并按已记录 MarkDownload 规则人工审查。
- 该 expected Markdown 是代表 fixture 的 reviewed parity baseline，不声明所有页面 byte-for-byte 完全等价。
- M11 snapshot 发现并修复 popup/runtime 剪藏未读取 `storage.sync` options 的问题。
- popup/runtime 剪藏现在读取 `storage.sync` options，经 shared schema 清洗后传给 offscreen；popup 会话 Download Images 开关覆盖 `options.downloadImages`。
- 依赖升级导致 expected Markdown 差异时，不能直接覆盖 snapshot，必须审查差异并更新本文档或决策记录。

## 已确认差异

- 用户在 2026-06-08 已确认继续且无需再次用户确认；M12 对首版可接受差异和自动化限制按本文档记录收口。
- MarkDownload 原版 content selection 代码在 multi range 循环中实际重复读取第一个 range。
- MarkdownSave M6 按任务要求正确遍历每个 range，并按 range 顺序拼接 HTML fragment。
- 该差异会让少数浏览器 multi range 选区输出不同于 MarkDownload 原版 bug 行为；本项目以正确 multi range 采集作为首版行为。
- MarkDownload 原版在 MIME 表缺失时可能把 `.idunno` 替换为 `.undefined`。
- MarkdownSave M7 对未知或缺失 MIME 保留 `.idunno`，避免生成无意义扩展名。
- Playwright 会重写扩展下载 artifact 文件名，E2E 不断言最终落盘文件名；文件名、目录和路径规则由单元测试覆盖。
- M11 representative fixture 中跨 origin `base` 被安全重置为页面 URL，这是 content 采集安全策略导致的可解释差异。
- M11 representative fixture 中没有 page context math 数据时 MathJax fallback 文本保留，这是当前真实浏览器路径的已审查基线；MathJax id 映射规则仍由 conversion 单元测试覆盖。

## M12 已收口口径

- 剪贴板写入失败收敛为结构化错误，popup 显示错误文案；command 和 menu 入口通过 badge 和 `storage.local.markdownSaveLastActionError` 暴露最近一次失败。
- Obsidian URI 打开失败收敛为结构化错误，通过 badge 和 `storage.local.markdownSaveLastActionError` 暴露最近一次失败。
- downloads API 失败使用 `download_failed` 错误码；主 Markdown 下载支持 `contentLink` 降级，单张图片失败不回滚主 Markdown。
- 受限页面、Chrome Web Store 页面、PDF、file URL、扩展页和无 URL 页面在 tab 清洗边界收敛为 `restricted_page`。
- Markdown 输出因依赖升级变化时不能直接覆盖 snapshot，必须先审查差异，再更新 expected Markdown、本文档或决策日志。
- Chrome context menu 真实点击不作为 Playwright E2E 门禁；菜单定义、开关、重建、映射和 action 顺序由单元测试覆盖。
- Chrome commands 真实快捷键不作为 Playwright E2E 门禁；manifest、命令映射和 action 顺序由单元测试覆盖。
- Obsidian 外部协议真实打开不作为 Playwright E2E 门禁；Advanced URI 构造和先复制再打开顺序由单元测试覆盖。
- MarkDownload 用户指南与源码默认值已在 M12 核对；本项目以 `markdownload/src/shared/default-options.js` 和当前 `src/shared/options/defaults.ts` 为默认值事实源。

## M12 发布审计

- `npm run build` 生成 `dist/chrome`。
- `npm run package:chrome` 生成 `dist/markdownsave-chrome.zip`。
- `npm run audit:chrome` 校验 manifest、关键入口文件、manifest 引用 icons、CSP、web accessible resources、`_locales` 规则、远程脚本加载、`eval`、zip 根目录和 zip 与 `dist/chrome` 清单及内容 hash 一致性。
- 当前 manifest 未声明 `default_locale`，发布产物不包含 `_locales`。
- 当前 zip 包含 source map，用于本地发布前排障；审计要求 zip 与 `dist/chrome` 完全一致。

## M0 到 M12 衔接

- M0 建文档系统。
- M1 工程。
- M2 协议。
- M3 runtime。
- M4 shared。
- M5 单页。
- M6 选区和 editor。
- M7 图片和下载。
- M8 菜单、命令和 Obsidian。
- M9 批量。
- M10 options。
- M11 测试。
- M12 打包、发布审计和最终 parity review。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/src/manifest/manifest.config.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/commands.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/permissions.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/defaults.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/schema.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/migrate.ts`
- `/Users/air/woo/MarkdownSave/src/options/App.tsx`
- `/Users/air/woo/MarkdownSave/src/options/options-fields.ts`
- `/Users/air/woo/MarkdownSave/src/options/options-storage.ts`
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
- `/Users/air/woo/MarkdownSave/markdownload/src/contentScript/contentScript.js`

## 测试入口

- `/Users/air/woo/MarkdownSave/tests/unit/manifest/manifest.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- `/Users/air/woo/MarkdownSave/tests/fixtures/`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`
- `/Users/air/woo/MarkdownSave/src/shared/`
- `/Users/air/woo/MarkdownSave/src/background/`
- `/Users/air/woo/MarkdownSave/src/popup/`
- `/Users/air/woo/MarkdownSave/src/options/`
