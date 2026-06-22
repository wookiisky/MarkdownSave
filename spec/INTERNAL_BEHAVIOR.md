# 内部行为

## 职责

本文档记录内部模块协作、消息协议目标、状态不变量、并发规则、缓存和恢复约束。

M12 范围包含 MV3 runtime、当前页剪藏、选区剪藏、下载、复制、菜单命令、Obsidian 当前页流程、可恢复批量下载 job、完整 options 页面、导入导出、storage 迁移、fixture 合同、representative snapshot 和 Chrome 发布产物审计。

## 消息协议目标

- 所有跨运行时通信使用显式 message type。
- 每个请求消息必须带 `requestId`。
- 批量任务消息必须带 `jobId`。
- 响应统一包含 `ok`、`requestId`、`data` 或 `error`。
- 错误对象统一包含 `code`、`message`、`recoverable` 和可选 `details`。
- message type 必须稳定命名。
- content 返回原始采集结果，不返回最终 Markdown。
- offscreen 返回转换结果、图片清单、文章元数据和警告信息。
- background 对 popup 和 options 隐藏浏览器 API 细节，只返回业务状态。

## M2 消息协议事实

- 稳定 message type 定义在 `/Users/air/woo/MarkdownSave/src/shared/messages.ts`。
- M2 已定义 `runtime.ping.request` 和 `runtime.ping.result`。
- M2 已定义 `clip.capture.request` 和 `clip.capture.result`。
- M2 已定义 `markdown.convert.request` 和 `markdown.convert.result`。
- M2 已定义 `download.markdown.request` 和 `download.markdown.result`。
- M2 已定义 `batch.start.request` 和 `batch.start.result`。
- `validateExtensionRequest` 负责在路由前识别未知 message、缺失 `requestId`、批量请求缺失 `jobId` 和把 result 当 request 路由的无效请求。
- `/Users/air/woo/MarkdownSave/src/shared/request-id.ts` 只提供纯 id 格式化和非空 id 判断，不依赖 Chrome API、时间或随机数。
- `/Users/air/woo/MarkdownSave/src/background/router.ts` 当前只对 `runtime.ping.request` 返回成功响应。
- background 对已知但未实现的请求返回 `not_implemented` 错误。
- background 对未知消息返回 `unknown_message` 错误。
- background 对缺少 `requestId` 的已知请求返回 `missing_request_id` 错误。
- background 对缺少 `jobId` 的批量请求返回 `missing_job_id` 错误。
- `/Users/air/woo/MarkdownSave/src/offscreen/offscreen.ts` 当前只实现可测消息 handler 和最小 runtime 注册。
- offscreen 对 `runtime.ping.request` 返回成功响应和 ready 事实，对已知但未实现请求返回 `not_implemented` 错误。
- `/Users/air/woo/MarkdownSave/src/content/capture-types.ts` 定义 content 原始采集结果类型，包含页面 HTML、选区 HTML、标题、base URL、页面 URL、meta 信息和是否有选区。
- content 原始采集结果不包含最终 Markdown。

## M9 runtime 协作事实

- platform adapters 位于 `/Users/air/woo/MarkdownSave/src/platform/`，只隔离平台 API，不包含 MarkDownload 业务规则。
- service worker 在顶层同步注册 runtime、commands、contextMenus、downloads、storage 和 tabs 监听入口。
- command handler 解析 MarkDownload command id 并分发到 Markdown action。
- context menu 创建由 `storage.sync` options 派生，重建时先移除旧菜单再创建新菜单。
- context menu 点击 handler 解析 MarkDownload menu id 并分发到 Markdown action。
- Markdown action 层集中处理下载、复制、tab 链接、链接、图片、checkbox 和 Obsidian 行为。
- Markdown action 读取 storage 前先通过 options schema 清洗，非法配置 fallback 默认配置。
- tabs helper 将缺失、非法和受限协议 URL 识别为受限页面。
- offscreen client 通过 `runtime.getContexts()` 查询既有 `OFFSCREEN_DOCUMENT`，复用已存在文档。
- offscreen client 对并发 `ensureOffscreenDocument` 使用同一个 pending promise，避免重复创建。
- offscreen document 当前只依赖 `chrome.runtime` message，支持 ping ready。
- offscreen lifecycle 当前只维护 ready、creating 和 idle close scheduled 三个事实。
- page context bridge 当前只清洗来源、requestId 和 kind，不读取 DOM。
- content script 处理 runtime ping、初始化 bridge 和当前页采集。

## M10 options 协作事实

- options 页面负责用户配置展示、编辑、导入、导出、迁移失败恢复入口和重置默认配置入口。
- options 页面覆盖 MarkDownload 默认配置中的全部 26 个字段。
- options 页面读取 `storage.sync` 时必须使用 `get(null)` 获取完整旧配置。
- 旧配置进入核心 options 前必须经过 shared options schema 清洗。
- shared options schema 对缺字段补默认值，对未知未来字段隔离，核心 options 只接收已知字段。
- `storage.sync` 是用户配置主事实，写入 options 时只写清洗后的已知字段。
- `storage.local` 只用于批量任务，不作为 options 主事实或迁移备份事实。
- 导入 JSON 的 parse、schema 校验和默认值补齐在写 storage 前完成。
- 导入失败、schema 失败或迁移失败时不写任何 storage，不覆盖旧配置。
- 迁移失败后 options 页面进入受限或只读状态，只允许导入有效 JSON 或显式重置默认配置。
- 导出从当前已知 options 生成稳定 JSON，不包含隔离的未知未来字段。
- 导出文件名由当前日期生成，格式是 `MarkdownSave-export-YYYY-MM-DD.json`。
- options 页面不启动剪藏任务，不处理批量下载进度，不访问网页 DOM。
- background 已监听 `storage.sync` 变化，配置变化后重建 context menu。
- `contextMenus=false` 时 background 执行 `removeAll` 后不创建菜单。

## M11 snapshot 协作事实

- popup/runtime 剪藏读取 `storage.sync` options，经 shared schema 清洗后传给 offscreen。
- popup 当前会话 Download Images 开关覆盖 `options.downloadImages`，不写回持久配置。
- representative snapshot 使用真实 popup、background 和 offscreen flow，不用 fake DOMParser 冒充 parity。
- expected Markdown 是人工审查后的代表 fixture 基线。
- commands、context menu 和 Obsidian URI 真实入口不在 M11 E2E 中冒充覆盖；对应映射、菜单定义和 action 顺序由单元测试覆盖。

## M12 发布审计协作事实

- `scripts/chrome-build-audit.ts` 是发布审计纯逻辑入口。
- `scripts/audit-chrome-build.ts` 是 `npm run audit:chrome` 命令入口。
- 发布审计只读取 `dist/chrome` 和 `dist/markdownsave-chrome.zip`，不修改产物。
- 发布审计先清洗 manifest JSON，再执行权限精确集合、host permissions、background、action、options 入口字段、禁止静态 content scripts、禁止 MV2 `browser_action`、文件、CSP directive、资源暴露和 locale 规则。
- zip 根目录必须直接包含 `manifest.json`，不能多包一层 `dist` 或 `chrome`。
- zip 文件清单必须与 `dist/chrome` 完全一致。
- zip 文件内容 hash 必须与 `dist/chrome` 完全一致。
- 远程 URL 字符串可以作为 Markdown 内容或业务数据存在；远程脚本加载和远程静态 import 不允许存在。
- `eval`、`Function` 动态执行和间接 eval 不允许存在。
- manifest 未声明 `default_locale` 时不允许包含 `_locales`；声明 `default_locale` 时必须包含对应 messages 文件。
- 当前 source map 随 `dist/chrome` 一起进入 zip，审计把它们作为发布包一致性的一部分。

## 状态主事实

- 用户配置主事实是 `storage.sync`。
- 批量任务主事实是 `storage.local`。
- `storage.local` 不保存 options 主事实。
- 临时进度、错误记录、大对象缓存和恢复状态保存在 `storage.local`。
- 单次剪藏结果是会话状态。
- popup 编辑内容是 UI 临时状态。
- 导入配置失败时旧配置保持不变。

## M4 shared 领域事实

- M4 shared options 模块只定义默认配置、schema 校验和迁移，不读写 `storage.sync`。
- M4 options 校验入口只接受普通对象；非对象、字段类型错误和枚举非法返回结构化错误。
- M4 options 迁移会补齐缺字段，并隔离未知未来字段。
- M4 template 模块只做字符串和 meta 数据处理，不访问 DOM 以外的运行时 API。
- M4 URL helper 保留 MarkDownload 的旧 `validateUri` 拼接语义，不替换为标准相对 URL resolution。
- M4 filename helper 负责非法字符清洗、路径分段清洗、图片文件名规划和重复名编号。
- M4 Obsidian helper 只构造 Advanced URI，不写剪贴板，不打开 tab。
- M4 conversion factory 只创建 TurndownService 并注册规则，不读取 storage，不下载图片，不访问 Chrome API。
- M4 Readability wrapper 对 `parse()` 返回 null 显式返回失败，不在 shared 层做 content fallback。

## 调度约束

- background 统一注册 runtime、commands、contextMenus、downloads、storage 和 tabs 监听器。
- background 负责创建和恢复批量任务。
- background 不直接访问 DOM。
- background 不直接执行转换。
- background 不直接写剪贴板。
- background 通过页面注入执行剪贴板写入。
- content 不写 storage。
- offscreen 不注册菜单。
- offscreen 不决定用户配置。
- options 不启动剪藏任务。
- options 不处理批量下载进度。
- options 不访问网页 DOM。

## 幂等与顺序

- 单次请求以 `requestId` 作为幂等识别基础。
- 批量任务以 `jobId` 作为任务识别基础。
- 同一 `jobId` 或全局重复 `requestId` 返回既有 batch 摘要，不重复下载。
- 批量任务中每个 tab 的结果必须能独立记录成功、失败或跳过。
- 下载副作用需要在任务状态中记录，避免 worker 重启后重复下载。
- batch store 对 `storage.local.markdownSaveBatchJobs` 的读改写通过模块级 mutex 串行化。
- batch job 调度通过 job id 去重，重复 start 和 resume 不创建第二个执行循环。
- 批量并发上限为 2。
- 批量任务 24 小时过期。

## 缓存与恢复

- 大对象缓存只进入 `storage.local`。
- service worker 重启后从 `storage.local` 读取可恢复任务状态。
- batch storage 使用 schema 版本清洗；损坏 job 被忽略，未知 tab 状态收敛为 failed。
- `queued`、`capturing`、`converting` 和 `download_ready` 可恢复为 `queued`。
- `downloading` 恢复时标记为 failed，原因是 `unknown_after_worker_suspend`，不自动重试。
- 已过期任务标记为 `expired`，未终态 tab 标记为 failed。
- 恢复任务不能覆盖用户配置。
- 恢复任务不能把未知状态当作成功。

## 边界破坏风险

- shared 依赖浏览器 API 会污染纯逻辑测试边界。
- conversion 读取 storage 会导致转换输出不可预测。
- content 直接下载或写配置会破坏权限和职责边界。
- popup 复制 background 编排会产生行为分叉。
- offscreen 持有批量主状态会增加 worker 恢复复杂度。
- MarkSnip reader、highlight、native bridge、agent bridge 或通知中心进入首版会扩大产品面并破坏 parity 优先级。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/src/shared/errors.ts`
- `/Users/air/woo/MarkdownSave/src/shared/messages.ts`
- `/Users/air/woo/MarkdownSave/src/shared/request-id.ts`
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
- `/Users/air/woo/MarkdownSave/src/shared/url/components.ts`
- `/Users/air/woo/MarkdownSave/src/shared/filename/sanitize.ts`
- `/Users/air/woo/MarkdownSave/src/shared/filename/image-path.ts`
- `/Users/air/woo/MarkdownSave/src/shared/obsidian/advanced-uri.ts`
- `/Users/air/woo/MarkdownSave/src/shared/conversion/turndown-factory.ts`
- `/Users/air/woo/MarkdownSave/src/shared/conversion/readability.ts`
- `/Users/air/woo/MarkdownSave/src/background/router.ts`
- `/Users/air/woo/MarkdownSave/src/background/service-worker.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-jobs.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-job-store.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/commands.ts`
- `/Users/air/woo/MarkdownSave/src/background/context-menus.ts`
- `/Users/air/woo/MarkdownSave/src/background/markdown-actions.ts`
- `/Users/air/woo/MarkdownSave/src/background/download-markdown.ts`
- `/Users/air/woo/MarkdownSave/src/background/page-capture-scripting.ts`
- `/Users/air/woo/MarkdownSave/src/background/tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/offscreen-client.ts`
- `/Users/air/woo/MarkdownSave/src/platform/browser.ts`
- `/Users/air/woo/MarkdownSave/src/platform/storage.ts`
- `/Users/air/woo/MarkdownSave/src/platform/downloads.ts`
- `/Users/air/woo/MarkdownSave/src/platform/scripting.ts`
- `/Users/air/woo/MarkdownSave/src/platform/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/platform/clipboard.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-types.ts`
- `/Users/air/woo/MarkdownSave/src/content/content-script.ts`
- `/Users/air/woo/MarkdownSave/src/content/page-context.ts`
- `/Users/air/woo/MarkdownSave/src/content/page-context-bridge.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/lifecycle.ts`
- `/Users/air/woo/MarkdownSave/plan.md`
- `/Users/air/woo/MarkdownSave/tasks.md`
- `/Users/air/woo/MarkdownSave/markdownload/src/background/background.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/contentScript/contentScript.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/shared/default-options.js`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/service-worker.js`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/offscreen/offscreen.js`

## 测试入口

M2 已建立协议、错误对象、路由边界、offscreen handler 和 content 类型测试。M3 已建立 runtime adapter、offscreen ensure、service worker 注册、tabs 受限 URL、offscreen lifecycle 和 page context bridge 测试。M4 已建立 shared options、template、URL、filename、Obsidian 和 conversion 单元测试。

- `/Users/air/woo/MarkdownSave/tests/unit/shared/errors.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/messages.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/options/options-migrate.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/template/template-replace.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/url/resolve.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/filename/image-path.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/obsidian/advanced-uri.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/conversion/turndown-factory.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/router.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-types.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/platform/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/offscreen-client.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/service-worker.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/tabs.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/lifecycle.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/page-context-bridge.test.ts`

M11 已建立：

- `/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- `/Users/air/woo/MarkdownSave/tests/fixtures/`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`

M12 已建立：

- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `npm run audit:chrome`
