# 系统流程

## 职责

本文档记录首版目标流程、恢复流程、补偿流程、异常收敛流程和副作用边界。

M12 已建立当前页全文剪藏、选区剪藏、offscreen 转换、popup CodeMirror 编辑、复制、Markdown 下载、图片下载、菜单命令、Obsidian 当前页流程、可恢复批量下载 job、完整 options 页面、representative snapshot 和 Chrome 发布产物审计。

## M2 当前协议入口

- background runtime 消息入口注册在 `/Users/air/woo/MarkdownSave/src/background/service-worker.ts`。
- background 可测路由入口是 `/Users/air/woo/MarkdownSave/src/background/router.ts`。
- offscreen 可测消息入口是 `/Users/air/woo/MarkdownSave/src/offscreen/offscreen.ts`。
- `runtime.ping.request` 当前返回结构化成功响应。
- `clip.capture.request` 在 background 默认入口执行当前页全文剪藏。
- `markdown.convert.request` 在 offscreen 入口执行 Markdown 转换。
- `download.markdown.request` 在 background 默认入口执行 Markdown 文本下载。
- `batch.start.request` 当前启动或复用 batch job 并返回任务摘要。
- `batch.cancel.request` 当前取消 batch job 并返回任务摘要。
- 未知 message 当前返回结构化未知消息错误。
- 缺少 `requestId` 的已知请求当前返回结构化缺失 requestId 错误。
- 缺少 `jobId` 的批量请求当前返回结构化缺失 jobId 错误。

## M9 当前 runtime 流程入口

- service worker 顶层同步注册 runtime、commands、contextMenus、downloads、storage 和 tabs 监听入口。
- popup 和 options 加载后发送 `runtime.ping.request`，只展示 runtime ready 状态。
- context menu 在安装、启动、service worker 唤醒和 `storage.sync` 变化时按当前 options 排队重建，避免 `removeAll` 和 `create` 并发交错。
- command 入口把 MarkDownload command id 映射到 Markdown action。
- context menu 点击入口把 MarkDownload menu id 映射到 Markdown action。
- command 和 context menu action 失败时写入扩展 badge 和 `storage.local.markdownSaveLastActionError`。
- offscreen ensure 先查询既有 `OFFSCREEN_DOCUMENT` context；存在则复用，不存在才创建。
- offscreen 创建后通过 runtime ping 验证 ready。
- content script 支持 runtime ping、page context bridge 初始化和当前页采集消息。
- page context bridge 只发送和清洗 runtime ready 类 payload。

## M5 到 M6 当前页剪藏流程

- 用户从 popup 发起当前页剪藏。
- background 校验 active tab，受限 URL 直接返回 `restricted_page`。
- background 确保 offscreen document ready。
- background 通过 `chrome.scripting.executeScript` 在当前 tab 的隔离环境采集页面。
- 页面采集在克隆 DOM 中补齐 `title` 和 `base`、移除隐藏节点，返回页面 DOM、页面标题、base URL、页面选区事实和必要元信息，不改写真实网页 DOM。
- background 将采集结果传给 offscreen。
- background 读取 `storage.sync` options，经 shared schema 清洗后传给 offscreen。
- popup 当前会话 Download Images 开关覆盖 `options.downloadImages`，不写回持久配置。
- offscreen 执行 Readability 和 Turndown 转换。
- offscreen 在 Readability 返回空内容时 fallback 到 body 或 documentElement 可转换内容。
- offscreen 返回 Markdown、标题和文章元信息。
- background 将页面是否存在选区和本次剪藏模式合并到剪藏结果，供 popup 展示切换入口。
- popup 使用 CodeMirror 展示 Markdown，并允许用户直接编辑内容。
- popup 可以把当前 Markdown 写入剪贴板。
- popup 可以请求 background 通过 downloads API 下载当前 Markdown。
- popup 可以请求 background 下载编辑器中选中的 Markdown。
- M11 已用 representative snapshot 锁定真实 popup、background 和 offscreen flow 的 options 驱动输出。

## 选区剪藏流程

- content 采集选区 HTML 和完整页面 DOM。
- popup 通过 `clipMode` 显式传递选区优先或全文模式。
- `selection` 表示有非空选区时用选区 HTML 覆盖正文内容。
- `page` 表示强制使用全文 Readability 和 fallback 逻辑。
- 非法或缺失 `clipMode` 在协议边界清洗为默认 `selection`。
- 选区为空时不能伪造内容，当前流程 fallback 到全文转换。
- 选区转换仍使用页面 base URL 和页面元信息。
- 多 range 选区按 range 顺序采集。
- MarkDownload 原版多 range 实际重复第一个 range；M6 选择按任务要求正确采集每个 range，并将差异记录到 parity checklist。

## 下载流程

- 下载触发方可以是 popup、command 或 context menu。
- background 负责生成标题、保存目录、图片下载计划和 Markdown 下载动作。
- M5 使用 downloads API 下载当前 Markdown 文本。
- M6 popup 普通下载使用当前编辑器完整 Markdown。
- M6 popup 选中下载只发送编辑器当前选中的 Markdown。
- `downloadsApi` 完整模式使用 Chrome downloads API。
- `contentLink` 是 downloads API 不可用或失败路径的降级设计，M7 已接入主 Markdown 下载失败后的降级路径。
- M7 已接入主 Markdown 下载失败后的 `contentLink` 降级；降级成功后仍尝试下载已准备好的图片文件。
- `saveAs` 由用户配置控制。
- `mdClipsFolder` 只影响 downloads API 模式下的 Markdown 保存目录。
- M7 Markdown 下载使用 data URL，并接入图片下载计划、MIME 扩展修正和 base64 替换。
- 下载失败必须转成统一错误对象并保留机器可测错误码。

## 图片流程

- 转换阶段根据 `downloadImages` 和图片样式决定图片 Markdown 输出。
- 图片源 URL 先基于页面 base URL 解析。
- 启用图片下载时，先规划本地图片路径，再根据下载结果修正 Markdown。
- base64 图片写入 Markdown，不产生图片下载动作。
- 无扩展名图片先按 MIME 推断扩展名。
- MIME 缺失或未知时保留 `.idunno`，避免生成 `.undefined`。
- 重复图片名必须去重，避免下载覆盖。

## 复制流程

- 复制当前页、选区、链接、图片和 tab 链接通过 command 或 context menu 进入 background Markdown action。
- service worker 不直接写剪贴板。
- 剪贴板写入由 popup 或页面注入执行。
- 当前 tab 链接会先剪藏当前页并使用模板标题生成 Markdown 链接。
- 所有 tab 和选中 tab 链接列表按当前窗口 tab 顺序生成。
- 链接 context menu 使用 `linkUrl` 和 `linkText` 或 `selectionText`。
- 图片 context menu 复制 `![](srcUrl)`。
- 复制失败通过扩展 badge 暴露，并在 `storage.local.markdownSaveLastActionError` 保留最近一次错误记录。

## Obsidian 流程

- Obsidian Advanced URI 是首版 parity 功能。
- 流程保留 MarkDownload 的语义：先复制 Markdown 到剪贴板，再打开 Obsidian Advanced URI。
- vault 和 folder 来自用户配置。
- folder 使用模板替换和文件名清洗。
- M8 当前页和选区 Obsidian 流程复用剪藏结果，先写剪贴板，再打开 Advanced URI。
- Obsidian URI 打开失败时通过扩展 badge 暴露，并在 `storage.local.markdownSaveLastActionError` 保留最近一次错误记录。

## 批量下载流程

- M9 background 为每次批量下载创建或复用 `jobId`。
- 每个 tab 的采集和转换请求带独立 `requestId`。
- `storage.local.markdownSaveBatchJobs` 记录任务状态、进度、错误和恢复状态。
- 批量 job 状态包括 `queued`、`running`、`completed`、`failed`、`canceled` 和 `expired`。
- 批量 tab 状态包括 `queued`、`capturing`、`converting`、`download_ready`、`downloading`、`downloaded`、`failed`、`skipped` 和 `canceled`。
- `completedTabs` 统计 `downloaded` 和 `skipped`；`failedTabs` 只统计 `failed`。
- 批量并发上限为 2。
- 批量任务 24 小时后过期。
- 单个 tab 失败不能中断整个批量任务。
- `batch.cancel.request` 可取消任务；取消后不再调度未开始的 tab。
- service worker 唤醒时恢复未过期且未触发下载副作用的任务。
- `downloading` 表示下载副作用已触发但结果未知；恢复时标记失败，不自动重复下载。
- 批量 contentLink 和 downloads API 降级使用当前 tab 任务的目标 tab，不读取当时 active tab。
- `download all tabs` action 进入 batch job，不再因触发页是受限页而阻断当前窗口其它可访问 tab。

## Options 导入导出流程

- options 读取用户导入文件。
- shared 对导入 JSON 做验证和迁移。
- 验证成功后一次性写入 `storage.sync`。
- 验证失败或迁移失败不能覆盖旧配置。
- 导出生成 JSON 文件，文件内容来自当前用户配置。

## 发布审计流程

- `npm run build` 生成最新 `dist/chrome`。
- `npm run package:chrome` 基于当前 `dist/chrome` 生成 `dist/markdownsave-chrome.zip`。
- `npm run audit:chrome` 读取 `dist/chrome` 和 zip，不修改产物。
- 审计校验 manifest 权限精确集合、host permissions、background、action、options 入口字段、禁止静态 content scripts、禁止 MV2 `browser_action`、关键入口文件、manifest 引用 icons、CSP directive、web accessible resources、`_locales` 规则、远程脚本加载、远程静态 import、动态执行、zip 根目录和 zip 与 `dist/chrome` 清单及内容 hash 一致性。
- manifest 未声明 `default_locale` 时不要求 `_locales`；如果声明 `default_locale`，必须包含对应 `_locales/<locale>/messages.json`。

## 异常收敛流程

- 权限、受限页面、tab 失效和 downloads API 失败收敛到 background 错误。
- DOM 不可访问、选区为空和页面上下文脚本失败收敛到 content 错误。
- Readability、Turndown、模板替换和图片路径生成失败收敛到 offscreen 或 conversion 错误。
- 配置 JSON 非法、schema 不兼容和迁移失败收敛到 options 错误。
- 所有错误响应使用统一 `ok/data/error` 结构。
- 可恢复错误记录到任务状态并继续可继续的流程。
- 不可恢复错误停止当前请求并向用户展示明确原因。
- M5 已收敛受限页面、offscreen 不可用、转换失败、采集失败和 downloads API 失败。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/src/shared/errors.ts`
- `/Users/air/woo/MarkdownSave/src/shared/messages.ts`
- `/Users/air/woo/MarkdownSave/src/shared/request-id.ts`
- `/Users/air/woo/MarkdownSave/src/background/router.ts`
- `/Users/air/woo/MarkdownSave/src/background/clip-flow.ts`
- `/Users/air/woo/MarkdownSave/src/background/download-markdown.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-jobs.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-job-store.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/page-capture-scripting.ts`
- `/Users/air/woo/MarkdownSave/src/background/service-worker.ts`
- `/Users/air/woo/MarkdownSave/src/background/commands.ts`
- `/Users/air/woo/MarkdownSave/src/background/context-menus.ts`
- `/Users/air/woo/MarkdownSave/src/background/tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/offscreen-client.ts`
- `/Users/air/woo/MarkdownSave/src/platform/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-types.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-selection.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-page.ts`
- `/Users/air/woo/MarkdownSave/src/content/remove-hidden.ts`
- `/Users/air/woo/MarkdownSave/src/content/content-script.ts`
- `/Users/air/woo/MarkdownSave/src/content/page-context.ts`
- `/Users/air/woo/MarkdownSave/src/content/page-context-bridge.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/convert-runner.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/lifecycle.ts`
- `/Users/air/woo/MarkdownSave/src/popup/index.html`
- `/Users/air/woo/MarkdownSave/src/popup/App.tsx`
- `/Users/air/woo/MarkdownSave/src/popup/MarkdownEditor.tsx`
- `/Users/air/woo/MarkdownSave/src/popup/popup-state.ts`
- `/Users/air/woo/MarkdownSave/src/options/index.html`
- `/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `/Users/air/woo/MarkdownSave/plan.md`
- `/Users/air/woo/MarkdownSave/tasks.md`
- `/Users/air/woo/MarkdownSave/markdownload/src/background/background.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/popup/popup.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/contentScript/contentScript.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/options/options.js`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/offscreen/offscreen.js`

## 测试入口

M2 已建立协议路由和错误收敛单元测试。M3 已建立 runtime 骨架测试。M5 已建立当前页剪藏、转换、下载和 popup E2E 测试。M6 已补充选区采集、选区转换、popup 编辑和选中下载测试。

- `/Users/air/woo/MarkdownSave/tests/unit/shared/errors.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/messages.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/router.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/clip-flow.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-types.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-selection.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-page.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/remove-hidden.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/platform/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/offscreen-client.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/service-worker.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/tabs.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/lifecycle.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/convert-runner.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/page-context-bridge.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/popup/popup-state.test.ts`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`

M11 已建立：

- `/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- `/Users/air/woo/MarkdownSave/tests/fixtures/`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`

M12 已建立：

- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `npm run audit:chrome`
