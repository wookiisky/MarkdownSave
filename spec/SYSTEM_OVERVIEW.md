# 系统总览

## 职责

根目录目标是建立正式 Chrome Manifest V3 扩展工程。

首版以 MarkDownload 为功能基线，保留其用户可见行为。MarkSnip 只作为 MV3 service worker、offscreen、测试分层和 helper 拆分参考。

首版只支持 Chrome Manifest V3。Firefox 和 Safari 不进入首版范围，也不建立隐藏兼容层。

M12 已建立当前页剪藏、选区剪藏、下载、复制、图片下载、context menu、commands、Obsidian 当前页流程、可恢复批量下载 job、完整 options 页面、fixture 合同、representative snapshot 测试、发布产物审计和最终 parity review。

## 技术栈

- 构建工具使用 Vite。
- 语言使用 TypeScript。
- popup 和 options 使用 React。
- Markdown 编辑器使用 CodeMirror 6。
- 浏览器 API 适配使用 `webextension-polyfill`。
- 正文提取使用 `@mozilla/readability`。
- Markdown 转换使用 `turndown` 和 `turndown-plugin-gfm`。
- 日期格式化使用 `dayjs`。
- MIME 推断使用 `mime`。
- 单元测试和集成测试使用 Vitest。
- E2E 测试使用 Playwright。

## 运行时分层

- `background` 负责调度，不直接访问 DOM，不直接执行 Readability，不直接写剪贴板。
- `content` 负责页面采集，只返回 DOM、选区、标题、base URL 和必要元信息。
- `offscreen` 负责转换、剪贴板和 Blob 相关工作，承载 service worker 不适合执行的 DOM 能力。
- `popup` 负责当前页交互、预览、编辑、复制和下载触发。
- `options` 负责用户配置、导入和导出。
- `shared` 负责纯逻辑，包含模板、URL、文件名、转换规则、配置模型和错误模型。
- `platform adapters` 隔离浏览器 API，避免核心逻辑反向依赖运行时协议。

## M12 runtime 当前事实

- platform adapters 已隔离 `chrome.runtime`、`chrome.storage.local`、`chrome.downloads`、`chrome.scripting`、`chrome.offscreen` 和 Web Clipboard API。
- M9 batch job 使用 `storage.local.markdownSaveBatchJobs` 保存可恢复任务状态。
- background service worker 在模块顶层同步注册 runtime、commands、contextMenus、downloads、storage 和 tabs 监听入口。
- background router 处理 runtime ping、当前页剪藏和 Markdown 下载请求。
- commands 入口把 MarkDownload command id 映射到下载、复制、链接复制和 Obsidian action。
- contextMenus 入口按 `storage.sync` options 重建 MarkDownload parity 菜单，并处理点击分发。
- context menu checkbox 状态来自 `includeTemplate` 和 `downloadImages`。
- Obsidian 菜单受 `obsidianIntegration` 控制。
- Markdown action 编排层复用剪藏、下载、剪贴板注入和 Obsidian URI helper，不直接访问 DOM。
- tabs 入口只提供受限 URL 判断和 active tab 查询清洗。
- offscreen client 创建前通过 `chrome.runtime.getContexts()` 查询既有 `OFFSCREEN_DOCUMENT`，不存在时才调用 `chrome.offscreen.createDocument()`。
- offscreen document 使用 `chrome.runtime` message 通信，支持 runtime ping 和 Markdown 转换。
- content script 支持 runtime ping、page context bridge 初始化和当前页采集。
- page context bridge 只定义事件名和 payload 清洗，不读取页面内容。
- popup 支持剪藏、编辑、复制、下载、编辑器选中下载和当前会话图片下载开关。
- popup/runtime 剪藏读取 `storage.sync` options，经 shared schema 清洗后传给 offscreen。
- popup 当前会话 Download Images 开关覆盖 `options.downloadImages`，不改变持久配置。
- M11 representative snapshot 通过真实 popup、background 和 offscreen flow 锁定 Markdown 输出。
- M12 发布审计校验 `dist/chrome` 和 `dist/markdownsave-chrome.zip` 的 manifest、入口文件、图标、CSP、web accessible resources、`_locales` 规则、远程脚本加载、`eval` 和内容一致性。

## 模块依赖边界

- `shared` 不依赖 Chrome 扩展 API。
- `conversion` 不读写 storage，配置由调用方显式传入。
- `downloads` 纯逻辑只生成下载计划，真实下载由 background adapter 执行。
- `background` 可以依赖 `shared`、任务编排和 platform adapters，不能依赖 React 组件。
- `content` 可以依赖轻量 shared helper，不能依赖 background、offscreen、popup、options。
- `offscreen` 可以依赖转换、模板、URL、文件名和剪贴板相关 shared 逻辑，不能处理菜单和命令注册。
- UI 页面不能复制后台编排逻辑。

## 数据主事实

- `storage.sync` 保存用户配置。
- `storage.sync` 保存 options、模板、下载设置、Obsidian 设置和菜单开关。
- `storage.local` 保存批量任务、临时进度、错误记录、大对象缓存和恢复状态。
- popup 中的 Markdown 编辑内容是临时 UI 状态，不自动写入用户配置。
- 导入配置必须先校验和迁移，成功后一次性写入 `storage.sync`。
- 导入或迁移失败不能覆盖旧配置。

## 权限和安全边界

- manifest 使用 `manifest_version: 3`。
- manifest 使用 `action`，不使用 `browser_action`。
- manifest 使用 `background.service_worker`。
- manifest 声明 `options_ui`。
- manifest 不声明静态 `<all_urls>` `content_scripts`。
- manifest 权限包含 `activeTab`、`scripting`、`downloads`、`storage`、`contextMenus`、`clipboardWrite`、`offscreen`。
- `host_permissions` 使用 `<all_urls>`，因为当前页剪藏、选区剪藏、链接和图片菜单、批量下载需要覆盖任意网页。
- `web_accessible_resources` 只暴露 `content/page-context.js`。
- MV3 CSP 是 `script-src 'self'; object-src 'self';`。
- 发布产物禁止远程脚本加载、`eval` 和 `new Function`。
- manifest 未声明 `default_locale`，发布产物不包含 `_locales`。

## MarkSnip 参考边界

- 可参考 MV3 manifest、service worker 初始化顺序、offscreen 创建和复用策略。
- 可参考测试分层、fixture 思路和 helper 拆分。
- 不引入 reader。
- 不引入 highlight。
- 不引入 native bridge。
- 不引入 agent bridge。
- 不引入通知中心。
- 不引入营销发布功能。
- Obsidian Advanced URI 是 MarkDownload 自身首版 parity 功能，不能因 MarkSnip 排除项而删除。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/package.json`
- `/Users/air/woo/MarkdownSave/vite.config.ts`
- `/Users/air/woo/MarkdownSave/scripts/build-extension.ts`
- `/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `/Users/air/woo/MarkdownSave/dist/chrome/manifest.json`
- `/Users/air/woo/MarkdownSave/dist/markdownsave-chrome.zip`
- `/Users/air/woo/MarkdownSave/src/manifest/manifest.config.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/commands.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/permissions.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/resources.ts`
- `/Users/air/woo/MarkdownSave/src/platform/browser.ts`
- `/Users/air/woo/MarkdownSave/src/platform/storage.ts`
- `/Users/air/woo/MarkdownSave/src/platform/downloads.ts`
- `/Users/air/woo/MarkdownSave/src/platform/scripting.ts`
- `/Users/air/woo/MarkdownSave/src/platform/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/platform/clipboard.ts`
- `/Users/air/woo/MarkdownSave/src/background/service-worker.ts`
- `/Users/air/woo/MarkdownSave/src/background/commands.ts`
- `/Users/air/woo/MarkdownSave/src/background/context-menus.ts`
- `/Users/air/woo/MarkdownSave/src/background/markdown-actions.ts`
- `/Users/air/woo/MarkdownSave/src/background/download-markdown.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-jobs.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-job-store.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/page-capture-scripting.ts`
- `/Users/air/woo/MarkdownSave/src/background/tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/offscreen-client.ts`
- `/Users/air/woo/MarkdownSave/src/content/content-script.ts`
- `/Users/air/woo/MarkdownSave/src/content/page-context.ts`
- `/Users/air/woo/MarkdownSave/src/content/page-context-bridge.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/offscreen.html`
- `/Users/air/woo/MarkdownSave/src/offscreen/offscreen.ts`
- `/Users/air/woo/MarkdownSave/src/offscreen/lifecycle.ts`
- `/Users/air/woo/MarkdownSave/src/popup/index.html`
- `/Users/air/woo/MarkdownSave/src/options/index.html`
- `/Users/air/woo/MarkdownSave/plan.md`
- `/Users/air/woo/MarkdownSave/tasks.md`
- `/Users/air/woo/MarkdownSave/markdownload/src/manifest.json`
- `/Users/air/woo/MarkdownSave/markdownload/src/shared/default-options.js`
- `/Users/air/woo/MarkdownSave/markdownload/src/background/background.js`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/manifest.json`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/service-worker.js`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/offscreen/offscreen.js`
- `/Users/air/woo/MarkdownSave/tests/fixtures/README.md`

## 测试入口

M1 已建立：

- `/Users/air/woo/MarkdownSave/tests/unit/`
- `/Users/air/woo/MarkdownSave/tests/e2e/`
- `/Users/air/woo/MarkdownSave/src/manifest/`
- `/Users/air/woo/MarkdownSave/vitest.config.ts`
- `/Users/air/woo/MarkdownSave/playwright.config.ts`

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
- `npm run build`
- `npm run package:chrome`
- `npm run audit:chrome`
