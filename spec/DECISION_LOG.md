# 决策记录

## 职责

本文档记录当前仍然生效的产品和技术决策。

M12 已建立根目录 Chrome MV3 工程、parity 功能、真实浏览器 snapshot 和发布审计。本文档记录当前仍然生效的产品和技术决策。

## 决策 1：根目录建立正式扩展工程

决策：根目录建立正式 Chrome MV3 扩展工程。

原因：根目录是新工程主线，`markdownload/` 和 `MarkSnip/` 都只是参考来源。

代码影响：M1 已在根目录创建 Vite、TypeScript、React 和 MV3 manifest 相关入口。

测试影响：M1 已建立 Vitest manifest 测试、Playwright 扩展页面 smoke 测试和 Chrome zip 根目录校验。M2-M12 继续补齐业务测试、snapshot 和发布审计。

排障影响：排障先看根目录工程，再回到 MarkDownload 或 MarkSnip 参考入口比对。

状态：生效。

## 决策 2：MarkDownload 是功能基线

决策：首版保留 MarkDownload 用户可见功能。

原因：项目目标是迁移并现代化 MarkDownload 行为，而不是重做一个新产品。

代码影响：实现必须以 MarkDownload manifest、默认配置、菜单、后台、popup、options 和 content 行为为参考。

测试影响：M11 已建立 representative snapshot、fixture 合同和真实浏览器输出测试。

排障影响：用户可见差异先进入 parity checklist，再判断是否为可接受差异。

状态：生效。

## 决策 3：MarkSnip 只做有限参考

决策：MarkSnip 只参考 MV3、offscreen、测试分层和 helper 拆分。

原因：MarkSnip 包含超出首版范围的 reader、highlight、native bridge、agent bridge、通知中心和营销发布功能。

代码影响：不得把 MarkSnip 新产品功能引入首版。

测试影响：可参考 MarkSnip 的 fixture 和 E2E 分层，不继承其 reader 或通知测试目标。

排障影响：使用 MarkSnip 代码前必须说明其服务 MarkDownload parity。

状态：生效。

## 决策 4：首版只支持 Chrome Manifest V3

决策：Firefox 和 Safari 不进入首版。

原因：首版优先降低平台变量，集中完成 Chrome MV3 parity。

代码影响：不建立 Firefox 或 Safari 隐藏兼容层。

测试影响：Playwright E2E 以 Chromium 扩展为目标。

排障影响：跨浏览器差异不作为首版缺陷处理。

状态：生效。

## 决策 5：采用现代化技术栈

决策：使用 Vite、TypeScript、React、CodeMirror 6、webextension-polyfill、@mozilla/readability、turndown、turndown-plugin-gfm、dayjs、mime、Vitest 和 Playwright。

原因：替换 vendored 依赖，提高可维护性、测试性和构建一致性。

代码影响：M1 建工程，M4 迁移 shared，M5-M10 接入运行时和 UI。

测试影响：日期模板、Markdown 输出、图片 MIME 和浏览器工作流需要回归测试；依赖升级导致的 expected Markdown 差异必须人工审查。

排障影响：依赖升级造成的输出差异必须进入 parity 差异确认。

状态：生效。

## 决策 6：按运行时分层

决策：background 调度，content 采集，offscreen 转换、剪贴板和 Blob，popup/options 负责 UI，shared 负责纯逻辑，platform adapters 隔离浏览器 API。

原因：MV3 service worker 生命周期要求副作用边界清晰，纯逻辑需要可测试。

代码影响：shared 不依赖 Chrome API，conversion 不读写 storage，UI 不复制后台编排。

测试影响：纯逻辑优先单测，运行时协作走集成和 E2E。

排障影响：先按运行时边界定位错误来源。

状态：生效。

## 决策 7：统一消息协议

决策：跨运行时通信使用显式 message type、`requestId`、`jobId` 和统一响应结构。

原因：批量、恢复和 MV3 worker 重启都需要可追踪、可幂等的协议。

代码影响：M2 建立协议类型和错误对象。

测试影响：协议测试必须覆盖成功、失败、重复请求和批量单项失败。

排障影响：日志和错误记录按 `requestId`、`jobId` 定位。

状态：生效。

## 决策 8：storage.sync 和 storage.local 分工

决策：`storage.sync` 保存用户配置，`storage.local` 保存批量任务、临时进度、错误记录、大对象缓存和恢复状态。

原因：用户配置和运行时任务状态生命周期不同。

代码影响：options 只写配置，batch 只写任务状态。

测试影响：配置导入失败不能覆盖旧值，批量恢复不能重复副作用。

排障影响：配置问题看 sync，任务恢复问题看 local。

状态：生效。

## 决策 9：保留 Obsidian Advanced URI

决策：首版保留 MarkDownload 的 Obsidian Advanced URI 集成。

原因：这是 MarkDownload 自身 parity 功能，不属于 MarkSnip 排除项。

代码影响：M8 需要建立 Obsidian URI 生成、剪贴板前置和错误处理。

测试影响：需要覆盖 vault、folder、标题模板和剪贴板失败路径。

排障影响：Obsidian 问题先区分剪贴板失败和 URI 打开失败。

状态：生效。

## 决策 10：批量任务并发、过期和恢复策略

决策：M9 batch job 并发上限为 2，过期时间为 24 小时，未过期且未触发下载副作用的 tab 自动恢复，已下载 tab 不重复下载，结果未知的 `downloading` tab 标记失败。

原因：Chrome MV3 service worker 可能挂起；批量下载必须优先避免重复下载，同时保持可恢复状态足够简单。

代码影响：`storage.local.markdownSaveBatchJobs` 是 batch 主事实；batch store 读改写串行化；batch contentLink 使用当前任务目标 tab。

测试影响：单元测试覆盖重复 `jobId`、重复 `requestId`、取消、过期、恢复、`downloading` 结果未知、contentLink 目标 tab 和 storage 脏数据清洗；E2E 覆盖多 tab batch、缺失 tab 跳过、重复消息和恢复状态。

排障影响：批量问题先看 `jobId`、tab 状态、`failedTabs` 和 tab 级错误 details；`unknown_after_worker_suspend` 表示下载副作用结果无法确认且不会自动重试。

状态：生效。

## 决策 11：snapshot parity 更新必须人工审查

决策：representative expected Markdown 是人工审查后的 parity 基线，不能用自动更新覆盖。

原因：Readability、Turndown、浏览器 DOM 和模板规则升级都可能改变输出；直接覆盖 snapshot 会掩盖真实 parity 退化。

代码影响：fixture 文件保存在 `/Users/air/woo/MarkdownSave/tests/fixtures/`，真实浏览器输出测试保存在 `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`。

测试影响：更新 expected Markdown 前必须运行真实扩展 E2E，审查差异来源，并在 parity checklist 或决策记录中说明可接受差异。

排障影响：Markdown 输出差异先对照 representative fixture、expected Markdown 和 parity checklist，再判断是依赖升级、浏览器安全策略还是业务回归。

状态：生效。

## 决策 12：Chrome 发布审计脚本固化为门禁

决策：M12 起使用 `npm run audit:chrome` 审计 `dist/chrome` 和 `dist/markdownsave-chrome.zip`。

原因：Chrome Web Store 发布包必须能重复验证 manifest 权限精确集合、host permissions、background、action、options 入口字段、CSP directive、资源暴露、远程脚本、动态执行、locale 规则和 zip 内容一致性，不能只依赖人工查看。

代码影响：发布审计逻辑位于 `scripts/chrome-build-audit.ts`，命令入口位于 `scripts/audit-chrome-build.ts`，`package.json` 暴露 `audit:chrome`。

测试影响：`tests/unit/scripts/chrome-build-audit.test.ts` 覆盖合法包、manifest 权限精确集合、host permissions、background、action、options 入口字段、禁止静态 content scripts、禁止 MV2 `browser_action`、zip 多包一层、zip 与 dist 内容不一致、CSP directive、远程 script src、远程静态 import、普通 URL 字符串不误报、`eval`、`Function`、间接 eval 和 `_locales` 规则。

排障影响：发布前必须按 `npm run build`、`npm run package:chrome`、`npm run audit:chrome` 顺序验证，避免审计陈旧 zip。

状态：生效。

## 决策 13：无 default_locale 时不创建空 _locales

决策：当前 manifest 未声明 `default_locale`，发布产物不包含 `_locales`。

原因：空 `_locales` 目录不提供用户能力，也不能替代 Chrome i18n 配置。只有声明 `default_locale` 且提供 messages 文件时，`_locales` 才是有效发布事实。

代码影响：发布审计在无 `default_locale` 时拒绝 `_locales`，在有 `default_locale` 时要求对应 `_locales/<locale>/messages.json`。

测试影响：审计脚本单元测试覆盖有无 `default_locale` 的两条 locale 规则。

排障影响：如果未来需要 Chrome Web Store 多语言文案，必须同步 manifest、`_locales`、审计测试和权限说明文档。

状态：生效。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/package.json`
- `/Users/air/woo/MarkdownSave/src/manifest/manifest.config.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/commands.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/permissions.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-jobs.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-job-store.ts`
- `/Users/air/woo/MarkdownSave/src/background/batch-tabs.ts`
- `/Users/air/woo/MarkdownSave/src/background/clip-flow.ts`
- `/Users/air/woo/MarkdownSave/scripts/build-extension.ts`
- `/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `/Users/air/woo/MarkdownSave/plan.md`
- `/Users/air/woo/MarkdownSave/tasks.md`
- `/Users/air/woo/MarkdownSave/markdownload/src/manifest.json`
- `/Users/air/woo/MarkdownSave/markdownload/src/shared/default-options.js`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/manifest.json`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/tests/README.md`

## 测试入口

M1 已建立：

- `/Users/air/woo/MarkdownSave/tests/unit/manifest/manifest.test.ts`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`

M11 已建立：

- `/Users/air/woo/MarkdownSave/tests/integration/fixture-contract.test.ts`
- `/Users/air/woo/MarkdownSave/tests/fixtures/`

M12 已建立：

- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `npm run audit:chrome`
