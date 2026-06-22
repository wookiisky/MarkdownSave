# 测试

## 职责

本文档记录测试目标、测试分层、资源隔离规则、公共测试支撑层、断言模型、测试定位入口和验收口径。

M12 已建立 Vitest、Playwright、runtime、当前页剪藏、选区剪藏、popup 编辑器、图片路径改写、下载计划、options、批量任务、集成 fixture 合同、真实浏览器 representative snapshot 和 Chrome 发布产物审计入口。

## 测试目标

- 锁定 MarkDownload parity。
- 锁定消息协议成功和失败语义。
- 锁定模板替换行为。
- 锁定 Readability 与 Turndown 转换行为。
- 锁定图片路径、MIME 推断、重复名去重和 base64 行为。
- 锁定 downloads API 与 contentLink 降级行为。
- 锁定 popup 编辑器选中内容下载行为。
- 锁定 options 导入导出和配置迁移行为。
- 锁定 context menu、commands 和 Obsidian 行为。
- 锁定批量任务的幂等、恢复、失败项和取消语义。
- 锁定 Chrome 发布目录和发布 zip 的 manifest、权限、资源暴露、CSP、远程脚本加载、`eval`、`_locales` 和 zip 一致性。

## 测试分层

- M1 单元测试覆盖 manifest、commands、权限、host permissions、web accessible resources、CSP 和无静态 `<all_urls>` content script。
- M1 E2E 测试覆盖生产 build 后 Chromium 扩展加载、popup 页面和 options 页面基础渲染。
- M1 Chrome 打包脚本校验 zip 根目录直接包含 `manifest.json`，避免多包一层目录。
- M3 单元测试覆盖 platform offscreen 查询和创建 wrapper。
- M3 单元测试覆盖 offscreen client 只在不存在时创建 document，以及并发 ensure 不重复创建。
- M3 单元测试覆盖 service worker 注册函数重复调用不会重复注册监听器。
- M3 单元测试覆盖受限 URL 判断。
- M3 单元测试覆盖 page context bridge 事件名和 payload 清洗。
- M3 E2E smoke 覆盖 popup、options runtime ready 状态和 background runtime ping。
- M4 单元测试覆盖 options 默认值迁移、未知字段隔离、非法字段失败和缺字段补齐。
- M4 单元测试覆盖模板 date、keywords、meta、参数化后缀、未知占位符置空和文件名模式清洗。
- M4 单元测试覆盖 MarkDownload 兼容 URL 解析、URL 组件、文件名清洗、图片路径规划和 Obsidian Advanced URI。
- M4 单元测试覆盖 Turndown factory、GFM、保留 HTML 标签、链接、图片、代码块、数学和不可见字符清理 helper。
- M6 单元测试覆盖空选区、single range、multi range 和复杂嵌套选区采集。
- M6 单元测试覆盖 selection 模式覆盖正文、page 模式全文转换和空选区 fallback。
- M6 单元测试覆盖 popup 选区事实清洗。
- M6 E2E 测试覆盖真实页面选区剪藏、CodeMirror 编辑、复制编辑后 Markdown、完整下载和编辑器选中 Markdown 下载。
- M7 单元测试覆盖 Markdown 下载计划、图片下载计划、`mdClipsFolder` 清洗、MIME 扩展修正和 Markdown 图片路径替换。
- M7 单元测试覆盖 offscreen 图片路径改写、`originalSource` 下载计划和图片下载计划输出。
- M7 单元测试覆盖 popup 下载前过滤当前 Markdown 已不再引用的旧图片计划。
- M7 单元测试覆盖 background 下载前 MIME 修正、图片失败不破坏 Markdown、base64 替换和 contentLink 降级。
- M7 E2E 测试覆盖 popup 开启 Download Images 后的图片路径改写和下载后 Markdown 内容。
- M8 单元测试覆盖 command id 到 action 的映射，以及 command action 失败诊断上报。
- M8 单元测试覆盖 context menu 动态定义、checkbox 初始状态、Obsidian 菜单开关、菜单 id 到 action 的映射、点击失败诊断上报和并发重建串行化。
- M8 单元测试覆盖 Markdown action 的下载、链接复制、图片复制、选中 tab 链接列表、Obsidian 先复制再打开 URI、checkbox 写回和失败响应上报。
- M9 单元测试覆盖 batch job 创建、全局 requestId 幂等、重复 jobId、并发 start 幂等、tab 跳过、取消竞态、恢复、contentLink 目标 tab、storage 脏数据清洗和脏 URL 恢复收口。
- M9 router 和 service worker 测试覆盖 batch start、batch cancel 和 worker 唤醒恢复入口。
- M9 E2E 测试覆盖真实扩展 batch start、多 tab 下载、缺失 tab 跳过、重复消息不重复下载和持久化恢复状态。
- M10 单元测试覆盖 MarkDownload 全部 26 个 options 字段的渲染模型、保存模型和默认值补齐。
- M10 单元测试覆盖 `storage.sync.get(null)` 读取旧配置、shared schema 清洗、未知字段隔离和非法配置失败。
- M10 单元测试覆盖导入 JSON 的 parse、schema 校验、缺字段补默认、未知字段隔离和失败不写 storage。
- M10 单元测试覆盖迁移失败不写 storage、旧配置不覆盖、页面进入受限或只读状态。
- M10 单元测试覆盖受限或只读状态只允许导入有效 JSON 或显式重置默认配置。
- M10 单元测试覆盖导出当前已知 options 的稳定 JSON 和 `MarkdownSave-export-YYYY-MM-DD.json` 文件名。
- M10 单元测试覆盖 options 页面不启动剪藏、不处理批量下载进度、不访问网页 DOM。
- M10 单元测试覆盖 `storage.sync` 变化后 background 重建菜单，以及 `contextMenus=false` 时 `removeAll` 后不创建菜单。
- M11 Vitest include 覆盖 `tests/unit` 和 `tests/integration` 下的测试。
- M11 集成测试覆盖 representative fixture 的 options schema、HTML fixture 表面、expected Markdown 基线和 snapshot provenance 规则。
- M11 E2E 测试通过真实 popup、background 和 offscreen 路径把 representative fixture 转为 Markdown，并与 expected Markdown 逐字比较。
- M11 E2E snapshot 同时断言标题、下载设置、图片下载计划和隐藏内容不出现在 Markdown 中。
- M11 representative options 不使用动态 date token，保证 snapshot 不随运行日期漂移。
- M11 修复并锁定 popup 和 runtime 剪藏读取 `storage.sync` options；popup 当前会话 Download Images 开关覆盖持久配置中的 `downloadImages`。
- M12 单元测试覆盖 Chrome 发布审计规则，包括合法包、manifest 权限精确集合、host permissions、background、action、options 入口字段、禁止静态 content scripts、禁止 MV2 `browser_action`、zip 多包一层、zip 与 dist 内容不一致、CSP directive 精确集合、远程 script src、远程静态 import、普通 URL 字符串不误报、`eval`、`Function`、间接 eval 和 `_locales` 规则。
- M12 `audit:chrome` 校验 `dist/chrome` 与 `dist/markdownsave-chrome.zip` 的完整文件清单和内容 hash 一致。
- M12 `audit:chrome` 校验 manifest、权限精确集合、service worker、content scripts、offscreen、popup、options 和 manifest 引用 icons。
- M12 `audit:chrome` 校验发布产物无远程脚本加载、无远程静态 import、无 `eval`、无 `Function` 动态执行、无间接 eval，但不禁止 Markdown 链接等普通 URL 字符串。
- Playwright Chromium extension 启动由 `npm run test:e2e`、`playwright.config.ts` 和 `tests/e2e/extension-smoke.spec.ts` helper 共同承担。
- Chrome commands、context menu 和 Obsidian URI 真实入口在 Playwright 中不能稳定直接触发，M11 不冒充 E2E 覆盖；对应映射和 action 顺序由单元测试覆盖。
- 单元测试覆盖 shared 纯逻辑。
- 集成测试覆盖 fixture 合同和 snapshot provenance；真实转换路径由 Playwright E2E 覆盖。
- E2E 测试覆盖 Chromium 扩展运行时、popup、options、downloads、剪贴板、批量任务和 representative Markdown snapshot。
- 发布审计覆盖 `dist/chrome` 和 `dist/markdownsave-chrome.zip`。
- fixture 优先使用本地确定性页面。
- 不依赖公网作为 CI 必需条件。
- 不在测试中复制生产逻辑。
- 行为复杂时先抽取可导入 helper，再直接测试 helper。

## 资源隔离

- storage 测试必须隔离 `storage.sync` 和 `storage.local`。
- options 测试必须断言用户配置主事实只在 `storage.sync`，批量任务事实只在 `storage.local`。
- downloads 测试必须使用独立下载目录。
- 剪贴板测试必须有可控前置和清理。
- E2E fixture 必须可重复。
- expected Markdown fixture 必须是人工审查后的基线，不能用自动更新覆盖审查。
- 批量任务测试必须隔离任务 id 和恢复状态。
- 测试不得依赖用户真实浏览器配置。

## 断言模型

- 协议断言关注 message type、`requestId`、`jobId`、`ok`、`data` 和 `error`。
- 错误断言关注 `code`、`message`、`recoverable` 和 `details`。
- Markdown 断言关注稳定输出，不依赖无意义空白波动。
- Snapshot 差异必须说明来源；依赖升级导致的输出差异必须更新 parity checklist 或决策记录。
- parity 断言关注用户可见功能。
- 下载断言关注文件名、目录、saveAs、图片路径和降级。
- 批量断言关注单项成功、单项失败、取消、恢复和幂等。

## 禁止方式

- 不为通过类型检查改变运行时语义。
- 不用公网 live 页面作为唯一验收。
- 不在测试里镜像实现逻辑。
- 不只测成功路径。
- 不只运行最小测试。
- 不把配置参数快照作为核心行为测试。

## 发布验证命令

- `npm run build` 必须先生成最新 `dist/chrome`。
- `npm run package:chrome` 必须基于当前 `dist/chrome` 生成 `dist/markdownsave-chrome.zip`。
- `npm run audit:chrome` 必须在 package 后运行，避免审计陈旧 zip。
- `npm run typecheck`、`npm run lint`、`npm test` 和 `npm run test:e2e` 仍是最终交付门禁。
- spec 格式扫描必须确认 `spec/` 不含代码块、表格、流程图和表情符号。

## M0 到 M12 测试衔接

- M0 建立测试事实文档。
- M1 建立工程测试命令、manifest 单元测试、扩展页面 smoke 测试和 zip 根目录校验。
- M2 已建立协议、错误对象、background router、offscreen handler 和 content 原始采集类型测试。
- M3 建立 runtime 适配测试。
- M4 已建立 shared 单元测试。
- M5 建立单页剪藏集成和 E2E 测试。
- M6 已建立选区和 editor 测试。
- M7 已建立图片和下载测试。
- M8 建立菜单、命令和 Obsidian 测试。
- M9 建立批量测试。
- M10 建立 options 测试。
- M11 建立集成 fixture、snapshot parity、真实浏览器 representative 输出测试和 snapshot 更新规则。
- M12 建立发布审计脚本、审计脚本单元测试、打包验证和最终 parity review。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/package.json`
- `/Users/air/woo/MarkdownSave/vitest.config.ts`
- `/Users/air/woo/MarkdownSave/playwright.config.ts`
- `/Users/air/woo/MarkdownSave/src/shared/errors.ts`
- `/Users/air/woo/MarkdownSave/src/shared/messages.ts`
- `/Users/air/woo/MarkdownSave/src/shared/request-id.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/defaults.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/schema.ts`
- `/Users/air/woo/MarkdownSave/src/shared/options/migrate.ts`
- `/Users/air/woo/MarkdownSave/src/options/App.tsx`
- `/Users/air/woo/MarkdownSave/src/options/options-fields.ts`
- `/Users/air/woo/MarkdownSave/src/options/options-storage.ts`
- `/Users/air/woo/MarkdownSave/src/shared/template/replace.ts`
- `/Users/air/woo/MarkdownSave/src/shared/url/resolve.ts`
- `/Users/air/woo/MarkdownSave/src/shared/filename/image-path.ts`
- `/Users/air/woo/MarkdownSave/src/shared/download/download-plan.ts`
- `/Users/air/woo/MarkdownSave/src/shared/download/mime-extension.ts`
- `/Users/air/woo/MarkdownSave/src/shared/conversion/turndown-factory.ts`
- `/Users/air/woo/MarkdownSave/src/background/router.ts`
- `/Users/air/woo/MarkdownSave/src/background/service-worker.ts`
- `/Users/air/woo/MarkdownSave/src/background/offscreen-client.ts`
- `/Users/air/woo/MarkdownSave/src/background/tabs.ts`
- `/Users/air/woo/MarkdownSave/src/platform/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/lifecycle.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-types.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-selection.ts`
- `/Users/air/woo/MarkdownSave/src/content/capture-page.ts`
- `/Users/air/woo/MarkdownSave/src/content/page-context-bridge.ts`
- `/Users/air/woo/MarkdownSave/src/popup/App.tsx`
- `/Users/air/woo/MarkdownSave/src/popup/MarkdownEditor.tsx`
- `/Users/air/woo/MarkdownSave/src/popup/popup-state.ts`
- `/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/manifest.config.ts`
- `/Users/air/woo/MarkdownSave/src/background/commands.ts`
- `/Users/air/woo/MarkdownSave/src/background/context-menus.ts`
- `/Users/air/woo/MarkdownSave/src/background/markdown-actions.ts`
- `/Users/air/woo/MarkdownSave/src/background/markdown-action-diagnostics.ts`
- `/Users/air/woo/MarkdownSave/src/background/download-markdown.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-jobs.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-job-store.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/page-capture-scripting.ts`
- `/Users/air/woo/MarkdownSave/tasks.md`
- `/Users/air/woo/MarkdownSave/SPEC_DOC.md`
- `/Users/air/woo/MarkdownSave/markdownload/src/background/background.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/popup/popup.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/options/options.js`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/tests/README.md`

## 测试入口

- `/Users/air/woo/MarkdownSave/tests/unit/shared/errors.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/messages.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/options/options-migrate.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/template/template-replace.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/template/template-date.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/template/template-meta.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/url/resolve.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/url/components.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/filename/sanitize.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/filename/image-path.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/download/download-plan.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/download/mime-extension.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/obsidian/advanced-uri.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/conversion/turndown-factory.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/conversion/readability.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/router.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/offscreen-client.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/service-worker.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/commands.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/context-menus.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/markdown-actions.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/batch-jobs.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/tabs.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/lifecycle.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-types.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-selection.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-page.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/page-context-bridge.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/popup/popup-state.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/platform/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/manifest/manifest.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- `/Users/air/woo/MarkdownSave/tests/fixtures/README.md`
- `/Users/air/woo/MarkdownSave/tests/fixtures/html/representative-article.html`
- `/Users/air/woo/MarkdownSave/tests/fixtures/options/representative-options.json`
- `/Users/air/woo/MarkdownSave/tests/fixtures/expected-markdown/representative-article.md`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`
- `/Users/air/woo/MarkdownSave/playwright.config.ts`
- `/Users/air/woo/MarkdownSave/vitest.config.ts`
