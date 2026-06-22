# 错误处理

## 职责

本文档记录错误来源、错误分类、降级、补偿、重试、恢复、用户侧表现和排障入口。

M12 范围包含统一错误对象、当前页剪藏、选区剪藏、图片下载、菜单命令复制、Obsidian 当前页、批量任务、完整 options 页面、导入导出、storage 迁移和发布审计错误收敛。

## 统一错误对象

- 错误对象包含 `code`。
- 错误对象包含 `message`。
- 错误对象包含 `recoverable`。
- 错误对象可包含 `details`。
- 错误响应使用统一 `ok/data/error` 结构。
- 用户提示使用可理解文案。
- 机器断言使用稳定错误码。

## M2 稳定错误码

- `unknown_message` 表示无法识别 message type 或消息不是对象。
- `missing_request_id` 表示已知请求缺少 `requestId`。
- `missing_job_id` 表示批量请求缺少 `jobId`。
- `invalid_request` 表示消息类型已知，但不是当前入口可处理的请求。
- `not_implemented` 表示协议已定义，但当前里程碑不实现对应业务。
- `internal_error` 保留给未归类内部错误。

## M5 稳定错误码

- `restricted_page` 表示当前 active tab 是扩展不能剪藏的页面，或缺少可访问 URL。
- `offscreen_unavailable` 表示 offscreen document 不支持、不可用或 ready 校验失败。
- `download_failed` 表示 Chrome downloads API 拒绝 Markdown 下载请求。

## M2 收敛规则

- 错误对象由 `/Users/air/woo/MarkdownSave/src/shared/errors.ts` 构造。
- 成功响应使用 `ok`、`requestId` 和 `data`。
- 失败响应使用 `ok`、`requestId` 和 `error`。
- 原始请求缺失 `requestId` 时，失败响应中的 `requestId` 显式为 `null`。
- `/Users/air/woo/MarkdownSave/src/shared/messages.ts` 在核心路由前清洗未知输入。
- background 和 offscreen 不抛运行时断言来表达协议错误。
- 已知但未实现的请求统一返回 `not_implemented`，不执行真实剪藏、转换、下载、复制或批量副作用。

## M8 runtime 错误边界

- commands 对未知 command id 不执行副作用。
- context menu 对未知 menu id 不执行副作用。
- storage options 读取后先走 schema 清洗，非法配置 fallback 默认配置。
- tabs helper 把缺失 URL、非法 URL、Chrome 内部页、扩展页、devtools、Edge 内部页和 file URL 识别为受限。
- offscreen platform 不支持 `chrome.offscreen.createDocument` 或 `runtime.getContexts` 时，不尝试创建 document。
- offscreen client 并发 ensure 共享同一个 pending promise，避免重复创建导致平台错误。
- context menu 重建进入串行队列，避免多次唤醒、安装、启动和 storage 变化导致菜单删除创建交错。
- page context bridge 对非对象 payload、来源不匹配、缺少 requestId 和未知 kind 返回清洗失败结果。
- popup 和 options runtime ping 失败时只显示 runtime unavailable，不触发业务降级。

## M5 当前页剪藏错误边界

- background 在采集前检查 active tab，受限 URL 返回 `restricted_page`。
- background 在转换前确保 offscreen document ready，失败返回 `offscreen_unavailable`。
- content 采集缺少 document、head、body、documentElement 或 location 时收敛为 `internal_error`，details 中保留采集原因。
- offscreen 转换 payload 非法返回 `invalid_request`。
- Readability 返回空内容时 offscreen fallback 到 body 或 documentElement；fallback 仍为空时返回 `internal_error`。
- downloads API 拒绝时返回 `download_failed`。
- popup 剪藏、复制和下载失败时展示错误文案，不暴露堆栈作为唯一反馈。

## M7 图片和下载错误边界

- Markdown 主文件下载失败返回 `download_failed`。
- 单张图片 fetch 失败时跳过该图片，不破坏已生成 Markdown 下载。
- 单张图片 downloads API 失败时跳过该图片，不把 Markdown 主文件回滚为失败。
- MIME 可识别时替换 `.idunno`；MIME 缺失或未知时保留 `.idunno`。
- `contentLink` 降级需要 active tab；active tab 不可用时返回明确错误。
- `contentLink` 成功后图片下载仍按单张失败可跳过处理，不回滚主 Markdown 下载。

## M8 菜单命令和 Obsidian 错误边界

- command 和 context menu action 在执行前清洗 tab，受限页面返回 `restricted_page`。
- 链接和图片 context menu 缺少 URL 时只复制空 URL 结构，不抛未清洗异常。
- 复制当前页、选区、tab 链接和 Obsidian 前置内容时，service worker 不直接写剪贴板。
- 剪贴板写入由页面注入函数执行，注入或剪贴板失败收敛为 `internal_error`。
- Obsidian 流程先复制 Markdown，再打开 Advanced URI；打开 URI 失败收敛为 `internal_error`。
- command 和 context menu 没有直接响应 UI，失败响应会设置扩展 badge 为 `!`，并写入 `storage.local.markdownSaveLastActionError`。
- `storage.local.markdownSaveLastActionError` 只保存已清洗的错误码、信息、可恢复标记、细节和发生时间。
- `download all tabs` 进入 M9 batch job，受限或缺失 tab 记录为 `skipped`，失败 tab 记录为 `failed`。

## M10 options 错误边界

- options 读取 `storage.sync` 时使用 `get(null)` 获取完整旧配置，并在核心逻辑前通过 shared schema 清洗。
- 迁移失败时不写 `storage.sync` 或 `storage.local`，不覆盖旧配置。
- 迁移失败后 options 页面进入受限或只读状态。
- 受限或只读状态只允许导入有效 JSON 或显式重置默认配置。
- 导入配置先 parse JSON，再执行 schema 校验。
- 非法 JSON 不写 storage，不覆盖当前用户数据。
- 非法 schema 不写 storage，不覆盖当前用户数据。
- 缺字段导入补默认值后再写入。
- 未知字段导入被忽略或隔离，不进入核心 options。
- 导出失败不修改用户配置。
- options 页面不通过剪藏、批量下载进度或网页 DOM 访问做错误降级。
- `contextMenus=false` 时菜单重建错误边界是先 `removeAll`，再跳过创建菜单。

## 错误来源

- 权限不足属于 background 错误。
- 受限页面属于 background 错误。
- tab 失效属于 background 错误。
- downloads API 失败属于 background 错误。
- DOM 不可访问属于 content 错误。
- 选区为空属于 content 结果状态，不应伪造成系统异常。
- 页面上下文脚本失败属于 content 错误。
- Readability 失败属于 offscreen 或 conversion 错误。
- Turndown 失败属于 offscreen 或 conversion 错误。
- 模板替换失败属于 shared 或 conversion 错误。
- 图片路径生成失败属于 shared 或 conversion 错误。
- 配置 JSON 非法属于 options 错误。
- schema 不兼容属于 options 错误。
- 迁移失败属于 options 错误。
- 导入写入前校验失败属于 options 错误。

## 降级规则

- downloads API 不可用时使用 `contentLink` 降级。
- service worker 不直接写剪贴板，剪贴板能力交给 popup 或页面注入执行。
- 可恢复错误不应中断整个批量任务。
- 单个 tab 失败时记录失败原因，继续处理其他 tab。
- 批量任务过期时 job 标记为 `expired`，未终态 tab 标记为 `failed`。
- 批量恢复遇到 `downloading` 状态时标记为 `failed`，原因是 `unknown_after_worker_suspend`，不重复下载。
- `storage.local.markdownSaveBatchJobs` 损坏字段在 batch 边界清洗，未知 tab 状态收敛为 `failed`。
- batch contentLink 降级使用当前任务 tab，不使用当时 active tab。
- 图片 MIME 缺失或未知时保留 `.idunno`，不复制 MarkDownload 可能生成 `.undefined` 的历史行为。
- 无法等价 parity 的行为必须进入差异确认，不直接沉默降级。
- 发布审计失败时命令直接失败，不自动修改 manifest、dist 或 zip。

## 补偿与资源回收

- Blob URL 下载完成后释放。
- 失败下载需要记录错误，不把未知结果当作成功。
- 配置导入失败不能覆盖旧配置。
- 配置迁移失败不能覆盖旧配置，不能写入任何 storage。
- 批量任务取消需要写入任务状态。
- 取消发生在 capture、convert 或 download_ready 阶段时，执行器在进入下载副作用前重新读取 job 状态；已取消 tab 不调用 downloads API。
- worker 重启恢复不能重复执行已经确认完成的下载副作用。

## 重试边界

- 只对可恢复错误允许重试。
- 重试必须保留同一业务任务语义。
- 重复消息必须通过 `requestId` 或 `jobId` 收敛。
- 非幂等下载副作用不能盲目重试。
- 权限不足、受限页面和配置非法不应自动重试。

## 用户侧表现

- 剪贴板写入失败通过 popup 错误、badge 或最近一次 action error 暴露。
- Obsidian URI 打开失败通过 badge 和最近一次 action error 暴露。
- downloads API 失败通过 `download_failed` 错误码和用户可读 message 暴露。
- 受限页面、Chrome Web Store 页面、PDF、file URL、扩展页和无 URL 页面通过 `restricted_page` 暴露。
- 批量任务失败项需要能被用户定位。

## M12 已收口参数

- 批量下载并发上限为 2。
- 批量任务过期时间为 24 小时。
- worker 重启后恢复未过期且未进入下载副作用的 tab；结果未知的 `downloading` tab 标记失败。
- 重复消息通过 `requestId` 和 `jobId` 幂等收敛。
- 剪贴板、Obsidian、downloads API 和受限页面错误按用户侧表现章节收敛。
- MIME 缺失或未知时保留 `.idunno`。
- 无法等价 parity 差异进入 parity checklist。
- MarkDownload 用户指南与源码默认值以源码默认配置为事实源，M12 已核对。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/src/shared/errors.ts`
- `/Users/air/woo/MarkdownSave/src/shared/messages.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/schema.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/migrate.ts`
- `/Users/air/woo/MarkdownSave/src/options/App.tsx`
- `/Users/air/woo/MarkdownSave/src/options/options-storage.ts`
- `/Users/air/woo/MarkdownSave/src/shared/download/download-plan.ts`
- `/Users/air/woo/MarkdownSave/src/shared/download/mime-extension.ts`
- `/Users/air/woo/MarkdownSave/src/background/router.ts`
- `/Users/air/woo/MarkdownSave/src/background/clip-flow.ts`
- `/Users/air/woo/MarkdownSave/src/background/download-markdown.ts`
- `/Users/air/woo/MarkdownSave/src/background/page-capture-scripting.ts`
- `/Users/air/woo/MarkdownSave/src/background/commands.ts`
- `/Users/air/woo/MarkdownSave/src/background/tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/offscreen-client.ts`
- `/Users/air/woo/MarkdownSave/src/platform/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/content/page-context-bridge.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-page.ts`
- `/Users/air/woo/MarkdownSave/src/content/remove-hidden.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/convert-runner.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/lifecycle.ts`
- `/Users/air/woo/MarkdownSave/scripts/build-extension.ts`
- `/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`
- `/Users/air/woo/MarkdownSave/plan.md`
- `/Users/air/woo/MarkdownSave/tasks.md`
- `/Users/air/woo/MarkdownSave/markdownload/src/background/background.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/contentScript/contentScript.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/options/options.js`

## 测试入口

M2 已建立错误协议和协议失败路径测试。M5 已建立当前页剪藏、采集、转换和下载错误路径测试。

- `/Users/air/woo/MarkdownSave/tests/unit/shared/errors.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/messages.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/download/download-plan.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/download/mime-extension.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/router.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/clip-flow.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/offscreen-client.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/tabs.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-page.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/convert-runner.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/page-context-bridge.test.ts`
- `/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- `/Users/air/woo/MarkdownSave/tests/e2e/`
