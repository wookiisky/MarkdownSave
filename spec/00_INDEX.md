# MarkdownSave 文档索引

## 职责

本文档是 `spec/` 的唯一导航入口。

文档系统记录当前稳定事实、已确认范围和已知差异。M12 范围包含 Chrome MV3 runtime、当前页剪藏、选区剪藏、popup 编辑、复制、Markdown 下载、图片下载、菜单命令、Obsidian 当前页闭环、可恢复批量下载 job、完整 options 页面、导入导出、storage 迁移、集成 fixture 合同、真实浏览器 representative snapshot、Chrome 发布包审计和最终 MarkDownload parity review。

## 全局规则

- 全程使用中文。
- 文档只记录稳定事实，不复制实现细节。
- 文档不使用表格。
- 文档不使用图形化流程表达。
- 文档不使用表情符号。
- 文档不粘贴实现代码片段。
- 每篇文档必须写明代码事实入口和测试入口。
- 字段、协议、状态和默认值以代码入口为事实源。
- `MarkDownload` 是功能基线。
- `MarkSnip` 仅作为 MV3、offscreen、测试分层和 helper 拆分参考。
- 不引入 `MarkSnip` 的 reader、highlight、native bridge、agent bridge、通知中心和营销发布功能。

## 当前项目结构

- `/Users/air/woo/MarkdownSave/plan.md` 记录已确认开发方案。
- `/Users/air/woo/MarkdownSave/tasks.md` 记录里程碑任务和暂停点。
- `/Users/air/woo/MarkdownSave/SPEC_DOC.md` 记录文档系统规范。
- `/Users/air/woo/MarkdownSave/markdownload/` 是 MarkDownload 功能基线参考。
- `/Users/air/woo/MarkdownSave/MarkSnip/` 是有限参考实现。
- `/Users/air/woo/MarkdownSave/spec/` 是 M0 文档系统。
- `/Users/air/woo/MarkdownSave/package.json` 是 M1 工程脚本入口。
- `/Users/air/woo/MarkdownSave/src/manifest/` 是 M1 Chrome MV3 manifest 主事实入口。
- `/Users/air/woo/MarkdownSave/src/shared/errors.ts`、`/Users/air/woo/MarkdownSave/src/shared/messages.ts` 和 `/Users/air/woo/MarkdownSave/src/shared/request-id.ts` 是 M2 协议主事实入口。
- `/Users/air/woo/MarkdownSave/src/platform/` 是 M3 platform adapters 主事实入口。
- `/Users/air/woo/MarkdownSave/src/background/router.ts` 是 M2 background 最小路由入口。
- `/Users/air/woo/MarkdownSave/src/background/service-worker.ts`、`/Users/air/woo/MarkdownSave/src/background/commands.ts`、`/Users/air/woo/MarkdownSave/src/background/context-menus.ts`、`/Users/air/woo/MarkdownSave/src/background/markdown-actions.ts`、`/Users/air/woo/MarkdownSave/src/background/download-markdown.ts`、`/Users/air/woo/MarkdownSave/src/background/batch-jobs.ts`、`/Users/air/woo/MarkdownSave/src/background/batch-job-store.ts`、`/Users/air/woo/MarkdownSave/src/background/batch-tabs.ts`、`/Users/air/woo/MarkdownSave/src/background/page-capture-scripting.ts`、`/Users/air/woo/MarkdownSave/src/background/tabs.ts` 和 `/Users/air/woo/MarkdownSave/src/background/offscreen-client.ts` 是 M9 background runtime、下载、批量、采集注入和菜单命令入口。
- `/Users/air/woo/MarkdownSave/src/content/page-context-bridge.ts` 是 M3 page context bridge 事件和 payload 清洗入口。
- `/Users/air/woo/MarkdownSave/src/offscreen/lifecycle.ts` 是 M3 offscreen 生命周期入口。
- `/Users/air/woo/MarkdownSave/src/content/capture-types.ts`、`/Users/air/woo/MarkdownSave/src/content/capture-selection.ts` 和 `/Users/air/woo/MarkdownSave/src/content/capture-page.ts` 是 M6 content 原始采集入口。
- `/Users/air/woo/MarkdownSave/src/background/clip-flow.ts` 和 `/Users/air/woo/MarkdownSave/src/offscreen/convert-runner.ts` 是 M6 剪藏转换闭环入口；下载执行和页面采集注入已拆到独立 background 模块。
- `/Users/air/woo/MarkdownSave/src/popup/App.tsx`、`/Users/air/woo/MarkdownSave/src/popup/MarkdownEditor.tsx` 和 `/Users/air/woo/MarkdownSave/src/popup/popup-state.ts` 是 M6 popup 编辑器入口。
- `/Users/air/woo/MarkdownSave/src/background/`、`/Users/air/woo/MarkdownSave/src/content/`、`/Users/air/woo/MarkdownSave/src/offscreen/`、`/Users/air/woo/MarkdownSave/src/popup/` 和 `/Users/air/woo/MarkdownSave/src/options/` 是 M3 最小运行时入口。
- `/Users/air/woo/MarkdownSave/src/options/App.tsx`、`/Users/air/woo/MarkdownSave/src/options/main.tsx`、`/Users/air/woo/MarkdownSave/src/options/options-fields.ts` 和 `/Users/air/woo/MarkdownSave/src/options/options-storage.ts` 是 M10 options 页面、字段定义、导入导出和 storage 迁移入口。
- `/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`、`/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts` 和 `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts` 是 M12 Chrome 发布包和发布审计入口。
- `/Users/air/woo/MarkdownSave/dist/chrome/manifest.json` 和 `/Users/air/woo/MarkdownSave/dist/markdownsave-chrome.zip` 是 M12 build/package 生成的本地发布产物路径，默认不提交。
- `/Users/air/woo/MarkdownSave/tests/unit/shared/`、`/Users/air/woo/MarkdownSave/tests/unit/background/`、`/Users/air/woo/MarkdownSave/tests/unit/offscreen/`、`/Users/air/woo/MarkdownSave/tests/unit/content/`、`/Users/air/woo/MarkdownSave/tests/unit/manifest/`、`/Users/air/woo/MarkdownSave/tests/integration/`、`/Users/air/woo/MarkdownSave/tests/fixtures/` 和 `/Users/air/woo/MarkdownSave/tests/e2e/` 是当前测试入口。

## 文档索引

- `/Users/air/woo/MarkdownSave/spec/SYSTEM_OVERVIEW.md`：回答系统定位、运行时分层、模块边界和技术栈约束。
- `/Users/air/woo/MarkdownSave/spec/SYSTEM_FLOWS.md`：回答剪藏、转换、下载、复制、批量和恢复流程如何收口。
- `/Users/air/woo/MarkdownSave/spec/EXTERNAL_BEHAVIOR.md`：回答用户可见功能、命令、菜单、配置、下载和限制边界。
- `/Users/air/woo/MarkdownSave/spec/INTERNAL_BEHAVIOR.md`：回答消息协议、状态主事实、并发、幂等和内部协作约束。
- `/Users/air/woo/MarkdownSave/spec/ERROR_HANDLING.md`：回答错误分类、降级、补偿、重试、恢复和用户侧表现。
- `/Users/air/woo/MarkdownSave/spec/DECISION_LOG.md`：回答当前生效的产品和技术决策。
- `/Users/air/woo/MarkdownSave/spec/TEST.md`：回答测试目标、测试分层、fixture、断言模型和验收入口。
- `/Users/air/woo/MarkdownSave/spec/CHROME_WEB_STORE_PERMISSIONS.md`：回答 Chrome Web Store 权限用途、最小边界和审核风险。
- `/Users/air/woo/MarkdownSave/spec/MARKDOWNLOAD_PARITY_CHECKLIST.md`：回答首版需要等价覆盖的 MarkDownload 用户可见行为。

## 模块划分原则

- `background` 是调度层，负责浏览器事件、权限内 API 调用和任务编排。
- `content` 是采集层，负责读取页面 DOM、选区和页面上下文。
- `offscreen` 是转换和浏览器受限能力执行层，负责 DOM 转换、剪贴板和 Blob。
- `popup` 和 `options` 是 UI 层，负责用户交互和展示。
- `shared` 是纯逻辑层，负责模板、转换规则、URL、文件名、错误对象和配置模型。
- `platform adapters` 隔离 `chrome.*`、`browser.*`、downloads、storage、scripting 和 offscreen API。

## 代码事实入口

- 当前方案入口：`/Users/air/woo/MarkdownSave/plan.md`
- 当前任务入口：`/Users/air/woo/MarkdownSave/tasks.md`
- 文档规范入口：`/Users/air/woo/MarkdownSave/SPEC_DOC.md`
- MarkDownload manifest 入口：`/Users/air/woo/MarkdownSave/markdownload/src/manifest.json`
- MarkDownload 默认配置入口：`/Users/air/woo/MarkdownSave/markdownload/src/shared/default-options.js`
- MarkDownload 菜单入口：`/Users/air/woo/MarkdownSave/markdownload/src/shared/context-menus.js`
- MarkDownload 后台行为入口：`/Users/air/woo/MarkdownSave/markdownload/src/background/background.js`
- MarkDownload popup 入口：`/Users/air/woo/MarkdownSave/markdownload/src/popup/popup.html`
- MarkDownload popup 行为入口：`/Users/air/woo/MarkdownSave/markdownload/src/popup/popup.js`
- MarkDownload options 入口：`/Users/air/woo/MarkdownSave/markdownload/src/options/options.html`
- MarkDownload options 行为入口：`/Users/air/woo/MarkdownSave/markdownload/src/options/options.js`
- MarkDownload content 入口：`/Users/air/woo/MarkdownSave/markdownload/src/contentScript/contentScript.js`
- MarkSnip MV3 manifest 参考入口：`/Users/air/woo/MarkdownSave/MarkSnip/src/manifest.json`
- MarkSnip service worker 参考入口：`/Users/air/woo/MarkdownSave/MarkSnip/src/service-worker.js`
- MarkSnip offscreen 参考入口：`/Users/air/woo/MarkdownSave/MarkSnip/src/offscreen/offscreen.js`
- MarkSnip 测试分层参考入口：`/Users/air/woo/MarkdownSave/MarkSnip/src/tests/README.md`
- package 脚本入口：`/Users/air/woo/MarkdownSave/package.json`
- Vite 构建入口：`/Users/air/woo/MarkdownSave/vite.config.ts`
- Chrome 打包脚本入口：`/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`
- Chrome 发布审计纯逻辑入口：`/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- Chrome 发布审计命令入口：`/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- manifest 主事实入口：`/Users/air/woo/MarkdownSave/src/manifest/manifest.config.ts`
- commands 事实入口：`/Users/air/woo/MarkdownSave/src/manifest/commands.ts`
- 权限事实入口：`/Users/air/woo/MarkdownSave/src/manifest/permissions.ts`
- web accessible resources 事实入口：`/Users/air/woo/MarkdownSave/src/manifest/resources.ts`
- M2 错误协议入口：`/Users/air/woo/MarkdownSave/src/shared/errors.ts`
- M2 消息协议入口：`/Users/air/woo/MarkdownSave/src/shared/messages.ts`
- M2 requestId 和 jobId 入口：`/Users/air/woo/MarkdownSave/src/shared/request-id.ts`
- M2 background router 入口：`/Users/air/woo/MarkdownSave/src/background/router.ts`
- M3 platform browser adapter 入口：`/Users/air/woo/MarkdownSave/src/platform/browser.ts`
- M3 platform storage adapter 入口：`/Users/air/woo/MarkdownSave/src/platform/storage.ts`
- M3 platform downloads adapter 入口：`/Users/air/woo/MarkdownSave/src/platform/downloads.ts`
- M3 platform scripting adapter 入口：`/Users/air/woo/MarkdownSave/src/platform/scripting.ts`
- M3 platform offscreen adapter 入口：`/Users/air/woo/MarkdownSave/src/platform/offscreen.ts`
- M3 platform clipboard adapter 入口：`/Users/air/woo/MarkdownSave/src/platform/clipboard.ts`
- M3 background service worker 入口：`/Users/air/woo/MarkdownSave/src/background/service-worker.ts`
- M3 background commands 入口：`/Users/air/woo/MarkdownSave/src/background/commands.ts`
- M3 background context menus 入口：`/Users/air/woo/MarkdownSave/src/background/context-menus.ts`
- M8 background Markdown action 入口：`/Users/air/woo/MarkdownSave/src/background/markdown-actions.ts`
- M8 background Markdown 下载入口：`/Users/air/woo/MarkdownSave/src/background/download-markdown.ts`
- M9 background batch 入口：`/Users/air/woo/MarkdownSave/src/background/batch-jobs.ts`
- M9 background batch store 入口：`/Users/air/woo/MarkdownSave/src/background/batch-job-store.ts`
- M9 background batch tab 清洗入口：`/Users/air/woo/MarkdownSave/src/background/batch-tabs.ts`
- M8 background 页面采集注入入口：`/Users/air/woo/MarkdownSave/src/background/page-capture-scripting.ts`
- M3 background tabs 入口：`/Users/air/woo/MarkdownSave/src/background/tabs.ts`
- M3 background offscreen client 入口：`/Users/air/woo/MarkdownSave/src/background/offscreen-client.ts`
- M2 content 原始采集类型入口：`/Users/air/woo/MarkdownSave/src/content/capture-types.ts`
- M3 content 入口：`/Users/air/woo/MarkdownSave/src/content/content-script.ts`
- M3 page context 入口：`/Users/air/woo/MarkdownSave/src/content/page-context.ts`
- M3 page context bridge 入口：`/Users/air/woo/MarkdownSave/src/content/page-context-bridge.ts`
- M3 offscreen html 入口：`/Users/air/woo/MarkdownSave/src/offscreen/offscreen.html`
- M3 offscreen runtime 入口：`/Users/air/woo/MarkdownSave/src/offscreen/offscreen.ts`
- M3 offscreen lifecycle 入口：`/Users/air/woo/MarkdownSave/src/offscreen/lifecycle.ts`
- M1 popup 入口：`/Users/air/woo/MarkdownSave/src/popup/index.html`
- M1 options 入口：`/Users/air/woo/MarkdownSave/src/options/index.html`
- M10 options 页面入口：`/Users/air/woo/MarkdownSave/src/options/App.tsx`
- M10 options bootstrap 入口：`/Users/air/woo/MarkdownSave/src/options/main.tsx`
- M10 options 字段定义入口：`/Users/air/woo/MarkdownSave/src/options/options-fields.ts`
- M10 options storage 迁移入口：`/Users/air/woo/MarkdownSave/src/options/options-storage.ts`
- M11 fixture 合同入口：`/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- M11 representative HTML fixture：`/Users/air/woo/MarkdownSave/tests/fixtures/html/representative-article.html`
- M11 representative options fixture：`/Users/air/woo/MarkdownSave/tests/fixtures/options/representative-options.json`
- M11 representative expected Markdown：`/Users/air/woo/MarkdownSave/tests/fixtures/expected-markdown/representative-article.md`
- M11 snapshot 更新规则：`/Users/air/woo/MarkdownSave/tests/fixtures/README.md`

## 测试入口

M1 已建立：

- `/Users/air/woo/MarkdownSave/vitest.config.ts`
- `/Users/air/woo/MarkdownSave/playwright.config.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/manifest/manifest.test.ts`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`

M2 已建立：

- `/Users/air/woo/MarkdownSave/tests/unit/shared/errors.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/shared/messages.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/router.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/capture-types.test.ts`

M3 已建立：

- `/Users/air/woo/MarkdownSave/tests/unit/platform/offscreen.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/offscreen-client.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/service-worker.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/background/tabs.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/offscreen/lifecycle.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/content/page-context-bridge.test.ts`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`

M11 已建立：

- `/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- `/Users/air/woo/MarkdownSave/tests/fixtures/`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`

M12 已建立：

- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `npm run audit:chrome`

## M0 到 M12 衔接

- M0 建立文档系统。
- M1 建立工程。
- M2 建立协议。
- M3 建立 runtime。
- M4 迁移 shared。
- M5 建立单页剪藏。
- M6 建立选区和 editor。
- M7 建立图片和下载。
- M8 建立菜单、命令和 Obsidian。
- M9 建立批量。
- M10 建立 options。
- M11 建立集成 fixture、snapshot parity 和真实浏览器代表性输出测试。
- M12 建立发布审计、打包验证和最终 parity review。
