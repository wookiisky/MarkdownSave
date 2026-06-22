# Chrome Web Store 权限说明

## 职责

本文档记录首版 Chrome MV3 权限、业务用途、最小使用边界、用户可见影响、审核风险和 M12 发布审计入口。

M12 当前 manifest、发布目录和发布 zip 已进入发布前审计范围。本文档只描述当前实现事实，不使用计划态口径。

## 平台范围

- 首版只支持 Chrome Manifest V3。
- Firefox 不进入首版。
- Safari 不进入首版。
- 权限说明面向 Chrome Web Store 审核。

## 权限清单

- `activeTab` 用于用户点击 popup、命令或菜单后访问当前活动页。
- `scripting` 用于用户触发后注入 content script 或 page context 脚本，采集 DOM、选区、标题、base URL 和页面元信息。
- `downloads` 用于保存 Markdown 文件和用户选择下载的图片。
- `storage` 用于保存用户配置、批量任务、临时进度、错误记录和恢复状态。
- `contextMenus` 用于提供 MarkDownload parity 的页面、选区、链接、图片和 tab 菜单入口。
- `clipboardWrite` 用于复制 Markdown、Markdown 链接、Markdown 图片，以及 Obsidian 流程中的前置剪贴板写入。
- `offscreen` 用于 MV3 下执行 service worker 不能直接完成的转换、剪贴板和 Blob 相关工作。
- `host_permissions` 使用 `<all_urls>`，用于任意网页剪藏、选区剪藏、链接和图片菜单，以及所有标签页批量下载。

## 最小使用边界

- `<all_urls>` 只服务用户主动触发的剪藏、选区、链接、图片和批量任务。
- manifest 不声明静态 `<all_urls>` content script。
- content 只采集页面 DOM、选区、标题、base URL 和必要元信息。
- content 不写用户配置。
- background 不直接访问 DOM。
- offscreen 不保存用户配置主事实。
- `web_accessible_resources` 只暴露 `content/page-context.js`，matches 为 `<all_urls>`。
- 扩展页 CSP 是 `script-src 'self'; object-src 'self';`。
- 发布产物不加载远程脚本，不使用 `eval`，不使用 `new Function`。
- 发布产物不申请 `nativeMessaging`、`notifications`、reader、highlight、native bridge 或 agent bridge 相关能力。

## 用户可见影响

- 用户可以在任意可访问网页触发当前页剪藏。
- 用户可以在任意可访问网页触发选区剪藏。
- 用户可以通过菜单复制链接和图片 Markdown。
- 用户可以批量下载当前窗口所有可访问标签页。
- 用户可以保存 Markdown 和图片到下载目录。
- 用户可以复制 Markdown 到剪贴板。
- 用户可以配置 Obsidian Advanced URI 行为。

## 审核风险

- `<all_urls>` 是高敏感权限，必要性来自 MarkDownload 任意网页剪藏和批量下载 parity。
- `scripting` 只在用户主动触发后注入，不做后台静默扫描。
- `clipboardWrite` 只用于用户触发复制或 Obsidian 流程。
- `downloads` 只用于用户触发保存 Markdown 和图片。
- `offscreen` 是 MV3 对转换、剪贴板和 Blob 相关工作的运行时要求。
- CSP 不声明远程脚本源，不声明 `unsafe-eval`，不声明 `unsafe-inline`。
- 远程 URL 字符串可以作为 Markdown 链接内容存在，但不能作为脚本加载源存在。

## Locales

- 当前 manifest 未声明 `default_locale`。
- 当前发布产物不包含 `_locales`。
- 当前不创建空 `_locales` 目录，因为没有 `default_locale` 时空目录不是有效能力。
- 如果未来 Chrome Web Store 发布要求多语言文案，必须同时新增 `default_locale`、`_locales` 内容、manifest 测试、发布审计和本文档记录。

## 发布产物

- `dist/chrome/manifest.json` 是可加载 Chrome MV3 manifest。
- `dist/chrome` 包含 background service worker、content scripts、page context、offscreen、popup、options 和 manifest 引用 icons。
- `dist/markdownsave-chrome.zip` 根目录直接包含 `manifest.json`，不额外包裹 `dist` 或 `chrome` 目录。
- 当前 zip 包含 source map，用于本地发布前排障。
- M12 审计会校验 manifest 权限精确集合、host permissions、background、action、options 入口字段、禁止静态 content scripts、禁止 MV2 `browser_action`、web accessible resources、CSP directive、远程脚本加载、动态执行、zip 与 `dist/chrome` 文件清单和内容 hash 完全一致。

## 代码事实入口

- `/Users/air/woo/MarkdownSave/src/manifest/manifest.config.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/permissions.ts`
- `/Users/air/woo/MarkdownSave/src/manifest/resources.ts`
- `/Users/air/woo/MarkdownSave/scripts/package-chrome.ts`
- `/Users/air/woo/MarkdownSave/scripts/chrome-build-audit.ts`
- `/Users/air/woo/MarkdownSave/scripts/audit-chrome-build.ts`
- `/Users/air/woo/MarkdownSave/package.json`
- `/Users/air/woo/MarkdownSave/plan.md`
- `/Users/air/woo/MarkdownSave/tasks.md`
- `/Users/air/woo/MarkdownSave/markdownload/src/manifest.json`
- `/Users/air/woo/MarkdownSave/MarkSnip/src/manifest.json`

## 测试入口

- `/Users/air/woo/MarkdownSave/tests/unit/manifest/manifest.test.ts`
- `/Users/air/woo/MarkdownSave/tests/unit/scripts/chrome-build-audit.test.ts`
- `/Users/air/woo/MarkdownSave/tests/e2e/extension-smoke.spec.ts`
- `npm run build`
- `npm run package:chrome`
- `npm run audit:chrome`
