/// <reference types="chrome" />

import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { BATCH_JOBS_STORAGE_KEY } from "../../src/background/batch-job-store";
import { MessageType } from "../../src/shared/messages";

const extensionDirectory = resolve(import.meta.dirname, "../../dist/chrome");
const fixturesDirectory = resolve(import.meta.dirname, "../fixtures");

// 确认生产扩展目录存在，缺失时给出可操作错误。
async function assertExtensionBuildExists(): Promise<void> {
  try {
    const manifestStat = await stat(resolve(extensionDirectory, "manifest.json"));

    if (!manifestStat.isFile()) {
      throw new Error("manifest path is not a file");
    }
  } catch (error) {
    throw new Error(`dist/chrome/manifest.json 不存在或不可读，请先运行 npm run build。原始错误：${String(error)}`);
  }
}

// 启动带扩展的 Chromium persistent context。
async function launchExtensionContext(userDataDirectory: string): Promise<BrowserContext> {
  try {
    return await chromium.launchPersistentContext(userDataDirectory, {
      headless: false,
      acceptDownloads: true,
      args: [
        `--disable-extensions-except=${extensionDirectory}`,
        `--load-extension=${extensionDirectory}`
      ]
    });
  } catch (error) {
    throw new Error(
      `无法启动 Chromium 扩展测试。请确认 Playwright Chromium 已安装，必要时运行 npx playwright install chromium。原始错误：${String(error)}`
    );
  }
}

// 从 service worker URL 中读取扩展 id。
async function readExtensionId(context: BrowserContext): Promise<string> {
  let [worker] = context.serviceWorkers();

  if (worker === undefined) {
    worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  }

  const extensionUrl = new URL(worker.url());
  return extensionUrl.hostname;
}

// 收集扩展页面关键错误。
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  return errors;
}

// 读取最近一次 Chrome downloads 记录对应的文件内容。
async function readNewestDownloadedMarkdown(page: Page): Promise<{ filename: string; content: string }> {
  const files = await readRecentDownloadedFiles(page);
  return files.find((file) => file.content.includes("Selected download target") || file.content.includes("MarkdownSave")) ?? {
    filename: "",
    content: ""
  };
}

// 读取最近的下载文件集合；不存在或已被浏览器策略隐藏时跳过。
async function readRecentDownloadedFiles(page: Page): Promise<Array<{ filename: string; content: string }>> {
  const filenames = await page.evaluate(async () => {
    const downloads = await chrome.downloads.search({ orderBy: ["-startTime"], limit: 10 });
    return downloads.map((download) => download.filename ?? "").filter((filename) => filename.length > 0);
  });
  const files: Array<{ filename: string; content: string }> = [];

  for (const filename of filenames) {
    try {
      files.push({
        filename,
        content: await readFile(String(filename), "utf8")
      });
    } catch {
      continue;
    }
  }

  return files;
}

// 等待 batch job 进入目标状态。
async function waitForBatchJobStatus(page: Page, jobId: string, expectedStatus: string): Promise<unknown> {
  return expect
    .poll(async () => {
      return page.evaluate(
        async ({ storageKey, targetJobId }) => {
          const storage = await chrome.storage.local.get(storageKey);
          const store = storage[storageKey] as { jobs?: Record<string, unknown> } | undefined;
          return store?.jobs?.[targetJobId] ?? null;
        },
        { storageKey: BATCH_JOBS_STORAGE_KEY, targetJobId: jobId }
      );
    })
    .toMatchObject({ status: expectedStatus });
}

// 用键盘替换 CodeMirror 编辑器全文，验证 popup 的编辑状态同步到隐藏测试镜像。
async function replaceMarkdownEditorValue(page: Page, value: string): Promise<void> {
  await page.getByLabel("Markdown editor").click();
  const selectAllShortcut = process.platform === "darwin" ? "Meta+A" : "Control+A";
  await page.keyboard.press(selectAllShortcut);
  await page.keyboard.insertText(value);
  await expect(page.getByLabel("Markdown preview")).toHaveValue(value);
}

// 通过真实 DOM 选区选择 CodeMirror 中的一段文本，并等待 toolbar 识别选区。
async function selectMarkdownEditorText(page: Page, text: string): Promise<void> {
  const selected = await page.evaluate((targetText) => {
    const lines = Array.from(document.querySelectorAll(".cm-line"));
    const line = lines.find((element) => element.textContent?.includes(targetText));

    if (line === undefined) {
      return false;
    }

    const textNode = findTextNode(line, targetText);
    if (textNode === null) {
      return false;
    }

    const startOffset = textNode.textContent?.indexOf(targetText) ?? -1;
    if (startOffset < 0) {
      return false;
    }

    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, startOffset + targetText.length);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));

    return true;

    function findTextNode(root: Node, needle: string): Text | null {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();

      while (current !== null) {
        if (current.textContent?.includes(needle)) {
          return current as Text;
        }

        current = walker.nextNode();
      }

      return null;
    }
  }, text);

  expect(selected).toBe(true);
  await expect(page.getByRole("button", { name: "Download Selection" })).toBeEnabled();
}

// 读取 fixture 文件。
async function readFixture(relativePath: string): Promise<string> {
  return readFile(resolve(fixturesDirectory, relativePath), "utf8");
}

test("loads popup and options extension pages without critical errors", async () => {
  await assertExtensionBuildExists();

  const userDataDirectory = await mkdtemp(resolve(tmpdir(), "markdownsave-e2e-"));
  const context = await launchExtensionContext(userDataDirectory);

  try {
    const extensionId = await readExtensionId(context);

    const popupPage = await context.newPage();
    const popupErrors = collectPageErrors(popupPage);
    await popupPage.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await expect(popupPage.getByRole("heading", { name: "MarkdownSave" })).toBeVisible();
    await expect(popupPage.getByText("Runtime ready")).toBeVisible();
    expect(popupErrors).toEqual([]);

    const optionsPage = await context.newPage();
    const optionsErrors = collectPageErrors(optionsPage);
    await optionsPage.goto(`chrome-extension://${extensionId}/options/index.html`);
    await expect(optionsPage.getByRole("heading", { name: "MarkdownSave Options" })).toBeVisible();
    await expect(optionsPage.getByText("Options are saved to storage.sync")).toBeVisible();
    await expect(optionsPage.getByLabel("Template for title / filename")).toBeVisible();
    expect(optionsErrors).toEqual([]);

    const backgroundPing = await popupPage.evaluate((messageType) => {
      return chrome.runtime.sendMessage({
        type: messageType,
        requestId: "req_e2e_background_ping"
      });
    }, MessageType.RUNTIME_PING_REQUEST);

    expect(backgroundPing).toEqual({
      ok: true,
      requestId: "req_e2e_background_ping",
      data: { pong: true }
    });
  } finally {
    await context.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});

test("persists, imports, exports, and protects options storage", async () => {
  await assertExtensionBuildExists();

  const userDataDirectory = await mkdtemp(resolve(tmpdir(), "markdownsave-e2e-"));
  const context = await launchExtensionContext(userDataDirectory);

  try {
    const extensionId = await readExtensionId(context);
    const controlPage = await context.newPage();
    await controlPage.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await controlPage.evaluate(async () => {
      await chrome.storage.sync.clear();
    });

    const optionsPage = await context.newPage();
    const optionsErrors = collectPageErrors(optionsPage);
    await optionsPage.goto(`chrome-extension://${extensionId}/options/index.html`);
    await expect(optionsPage.getByRole("heading", { name: "MarkdownSave Options" })).toBeVisible();
    await expect(optionsPage.getByLabel("Template for title / filename")).toHaveValue("{pageTitle}");

    await optionsPage.getByLabel("Template for title / filename").fill("{title}");
    await optionsPage.getByLabel("Template for title / filename").blur();
    await expect
      .poll(async () => optionsPage.evaluate(async () => (await chrome.storage.sync.get(null)).title))
      .toBe("{title}");

    await optionsPage.getByText("Append front/back template to clipped text").click();
    await expect
      .poll(async () => optionsPage.evaluate(async () => (await chrome.storage.sync.get(null)).includeTemplate))
      .toBe(true);

    const downloadPromise = optionsPage.waitForEvent("download");
    await optionsPage.getByRole("button", { name: "Export" }).click();
    const exportDownload = await downloadPromise;
    expect(exportDownload.suggestedFilename()).toMatch(/^MarkdownSave-export-\d{4}-\d{2}-\d{2}\.json$/);
    const exportPath = await exportDownload.path();
    expect(exportPath).not.toBeNull();
    const exportedOptions = JSON.parse(await readFile(String(exportPath), "utf8")) as Record<string, unknown>;
    expect(exportedOptions.title).toBe("{title}");
    expect(exportedOptions.includeTemplate).toBe(true);

    await optionsPage.getByLabel("Import options file").setInputFiles({
      name: "missing-fields.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ title: "{pageTitle}-{date:YYYY}", includeTemplate: false }))
    });
    await expect
      .poll(async () => optionsPage.evaluate(async () => (await chrome.storage.sync.get(null)).title))
      .toBe("{pageTitle}-{date:YYYY}");
    await expect
      .poll(async () => optionsPage.evaluate(async () => (await chrome.storage.sync.get(null)).headingStyle))
      .toBe("atx");

    const beforeInvalidImport = await optionsPage.evaluate(async () => chrome.storage.sync.get(null));
    await optionsPage.getByLabel("Import options file").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{")
    });
    await expect(optionsPage.getByText("配置导入失败，旧配置未覆盖")).toBeVisible();
    await expect.poll(async () => optionsPage.evaluate(async () => chrome.storage.sync.get(null))).toEqual(beforeInvalidImport);

    await optionsPage.evaluate(async () => {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set({ headingStyle: "markdown" });
    });
    await optionsPage.reload();
    await expect(optionsPage.getByText("配置只读")).toBeVisible();
    await expect(optionsPage.getByLabel("Template for title / filename")).toBeDisabled();
    await expect(optionsPage.getByRole("button", { name: "Export" })).toBeDisabled();
    await expect(optionsPage.getByLabel("Import options file")).toBeEnabled();
    await expect(optionsPage.getByRole("button", { name: "Reset defaults" })).toBeEnabled();
    await expect
      .poll(async () => optionsPage.evaluate(async () => (await chrome.storage.sync.get(null)).headingStyle))
      .toBe("markdown");
    expect(optionsErrors).toEqual([]);
  } finally {
    await context.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});

test("matches representative markdown parity snapshot through real extension flow", async () => {
  await assertExtensionBuildExists();

  const userDataDirectory = await mkdtemp(resolve(tmpdir(), "markdownsave-e2e-"));
  const context = await launchExtensionContext(userDataDirectory);

  try {
    const extensionId = await readExtensionId(context);
    const fixtureHtml = await readFixture("html/representative-article.html");
    const fixtureOptions = JSON.parse(await readFixture("options/representative-options.json")) as Record<string, unknown>;
    const expectedMarkdown = (await readFixture("expected-markdown/representative-article.md")).replace(/\n$/u, "");

    const articlePage = await context.newPage();
    await articlePage.route("https://snapshot.example.test/article", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: fixtureHtml
      });
    });
    await articlePage.goto("https://snapshot.example.test/article");

    const popupPage = await context.newPage();
    const popupErrors = collectPageErrors(popupPage);
    await popupPage.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await expect(popupPage.getByText("Runtime ready")).toBeVisible();
    await popupPage.evaluate((options) => chrome.storage.sync.set(options), fixtureOptions);
    await popupPage.getByRole("button", { name: "Download Images" }).click();
    await articlePage.bringToFront();
    await popupPage.evaluate(() => {
      const clipButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Clip");
      clipButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await expect(popupPage.getByLabel("Markdown preview")).toHaveValue(expectedMarkdown);
    expect(await popupPage.getByLabel("Markdown preview").inputValue()).not.toContain("Hidden fixture text");
    await articlePage.bringToFront();
    const clipResponse = await popupPage.evaluate((messageType) => {
      return chrome.runtime.sendMessage({
        type: messageType,
        requestId: "req_e2e_snapshot_clip",
        clipMode: "page",
        downloadImages: true
      });
    }, MessageType.CLIP_CAPTURE_REQUEST);
    expect(clipResponse).toMatchObject({
      ok: true,
      requestId: "req_e2e_snapshot_clip",
      data: {
        markdown: expectedMarkdown,
        title: "Ignored Browser Title"
      }
    });
    const clipData = (clipResponse as {
      data: {
        downloadSettings: { mdClipsFolder: string | null; downloadMode: string };
        imageDownloads: Array<{ filename: string; originalSrc: string }>;
      };
    }).data;
    expect(clipData.downloadSettings).toMatchObject({
      downloadMode: "downloadsApi",
      mdClipsFolder: "clips/snapshot.example.test/",
      saveAs: false,
      disallowedChars: "[]#^"
    });
    expect(clipData.imageDownloads).toMatchObject([
      {
        filename: "Ignored Browser Title/hero.png",
        originalSrc: "https://snapshot.example.test/images/hero.png"
      }
    ]);
    expect(popupErrors).toEqual([]);
  } finally {
    await context.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});

test("clips selection from popup and supports editor copy and selected download", async () => {
  await assertExtensionBuildExists();

  const userDataDirectory = await mkdtemp(resolve(tmpdir(), "markdownsave-e2e-"));
  const context = await launchExtensionContext(userDataDirectory);

  try {
    const extensionId = await readExtensionId(context);
    await context.addInitScript(() => {
      const originalWriteText = Clipboard.prototype.writeText;
      Clipboard.prototype.writeText = function writeTextProbe(text: string) {
        (window as unknown as { __markdownSaveLastClipboardText?: string }).__markdownSaveLastClipboardText = text;
        return originalWriteText.call(this, text);
      };
    });

    const articlePage = await context.newPage();
    await articlePage.route("https://example.test/article", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: [
          "<!doctype html>",
          '<html lang="en"><head>',
          "<title>Fixture Article</title>",
          '<meta name="description" content="Fixture description">',
          '<base href="https://assets.example.test/base/">',
          "</head><body>",
          "<main>",
          "<h1>Fixture Article</h1>",
          '<p id="selected-fragment">Hello <strong>MarkdownSave</strong>.</p>',
          '<p id="outside-fragment">Outside article paragraph.</p>',
          '<p><img src="data:image/png;base64,aW1hZ2UtYnl0ZXM=" alt="Hero"></p>',
          "</main>",
          '<div id="hidden-template" style="display:none">Hidden Template</div>',
          "</body></html>"
        ].join("")
      });
    });
    await articlePage.goto("https://example.test/article");
    await articlePage.evaluate(() => {
      const paragraph = document.querySelector("#selected-fragment");
      if (paragraph === null) {
        throw new Error("selection fixture missing");
      }

      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    const originalDomState = await articlePage.evaluate(() => ({
      baseHref: document.querySelector("base")?.getAttribute("href"),
      hiddenTemplateExists: document.querySelector("#hidden-template") !== null
    }));
    await articlePage.bringToFront();

    const popupPage = await context.newPage();
    const popupErrors = collectPageErrors(popupPage);
    await popupPage.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await expect(popupPage.getByText("Runtime ready")).toBeVisible();

    await articlePage.bringToFront();
    await popupPage.evaluate(() => {
      const clipButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Clip");
      clipButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const preview = popupPage.getByLabel("Markdown preview");
    await expect(preview).toHaveValue(/Hello \*\*MarkdownSave\*\*\./);
    await expect(preview).not.toHaveValue(/Outside article paragraph/);
    await expect(preview).not.toHaveValue(/Hidden Template/);
    await expect(popupPage.getByRole("group", { name: "Clip mode" })).toBeVisible();
    await expect.poll(() => articlePage.evaluate(() => ({
      baseHref: document.querySelector("base")?.getAttribute("href"),
      hiddenTemplateExists: document.querySelector("#hidden-template") !== null
    }))).toEqual(originalDomState);

    await popupPage.bringToFront();
    await popupPage.getByRole("button", { name: "Download Images" }).click();
    await popupPage.getByRole("button", { name: "Entire Document" }).click();
    await articlePage.bringToFront();
    await popupPage.evaluate(() => {
      const clipButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Clip");
      clipButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(preview).toHaveValue(/Outside article paragraph/);
    await expect(preview).toHaveValue(/Fixture%20Article\/image\.png/);

    await popupPage.bringToFront();
    await popupPage.getByRole("button", { name: "Download", exact: true }).click();
    await expect
      .poll(async () => {
        const files = await readRecentDownloadedFiles(popupPage);
        return files.map((file) => file.content).join("\n---download---\n");
      })
      .toContain("Fixture%20Article/image.png");
    const editedMarkdown = [
      "Edited **MarkdownSave**.",
      "",
      "Selected download target",
      "",
      "Outside download target"
    ].join("\n");
    await replaceMarkdownEditorValue(popupPage, editedMarkdown);

    await popupPage.getByRole("button", { name: "Copy" }).click();
    await expect(popupPage.getByText("Copied")).toBeVisible();
    await expect
      .poll(async () =>
        popupPage.evaluate(() => (window as unknown as { __markdownSaveLastClipboardText?: string }).__markdownSaveLastClipboardText)
      )
      .toContain("Edited **MarkdownSave**.");

    await popupPage.getByRole("button", { name: "Download", exact: true }).click();
    await expect(popupPage.getByText("Downloaded")).toBeVisible();
    await expect
      .poll(async () =>
        popupPage.evaluate(async () => {
          const [download] = await chrome.downloads.search({ orderBy: ["-startTime"], limit: 1 });
          return download?.filename ?? null;
        })
      )
      .not.toBeNull();
    const fullDownload = await readNewestDownloadedMarkdown(popupPage);
    expect(fullDownload.content).toContain("Selected download target");
    expect(fullDownload.content).toContain("Outside download target");

    await selectMarkdownEditorText(popupPage, "Selected download target");
    await popupPage.getByRole("button", { name: "Download Selection" }).click();
    await expect
      .poll(async () => {
        const selectedDownload = await readNewestDownloadedMarkdown(popupPage);
        return selectedDownload.filename === fullDownload.filename ? null : selectedDownload.content;
      })
      .toBe("Selected download target");
    expect(popupErrors).toEqual([]);
  } finally {
    await context.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});

test("runs batch download job with idempotency, restricted tabs, and recovery state", async () => {
  await assertExtensionBuildExists();

  const userDataDirectory = await mkdtemp(resolve(tmpdir(), "markdownsave-e2e-"));
  const context = await launchExtensionContext(userDataDirectory);

  try {
    const extensionId = await readExtensionId(context);
    const firstPage = await context.newPage();
    await firstPage.route("https://batch.example.test/one", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Batch One</title><main><h1>Batch One</h1><p>MarkdownSave batch one.</p></main>"
      });
    });
    await firstPage.goto("https://batch.example.test/one");

    const secondPage = await context.newPage();
    await secondPage.route("https://batch.example.test/two", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Batch Two</title><main><h1>Batch Two</h1><p>MarkdownSave batch two.</p></main>"
      });
    });
    await secondPage.goto("https://batch.example.test/two");

    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/popup/index.html`);
    const tabIds = await extensionPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return {
        first: tabs.find((tab) => tab.url === "https://batch.example.test/one")?.id ?? null,
        second: tabs.find((tab) => tab.url === "https://batch.example.test/two")?.id ?? null,
        missing: 999_999
      };
    });

    expect(tabIds.first).not.toBeNull();
    expect(tabIds.second).not.toBeNull();

    const batchResponse = await extensionPage.evaluate(
      async ({ first, second, missing }) => {
        return chrome.runtime.sendMessage({
          type: "batch.start.request",
          requestId: "req_e2e_batch_start",
          jobId: "job_e2e_batch",
          tabIds: [first, second, missing]
        });
      },
      tabIds
    );
    expect(batchResponse).toMatchObject({
      ok: true,
      requestId: "req_e2e_batch_start",
      data: {
        jobId: "job_e2e_batch",
        totalTabs: 3
      }
    });

    await waitForBatchJobStatus(extensionPage, "job_e2e_batch", "completed");
    const filesAfterFirstRun = await readRecentDownloadedFiles(extensionPage);
    expect(filesAfterFirstRun.filter((file) => file.content.includes("MarkdownSave batch"))).toHaveLength(2);

    await extensionPage.evaluate(async () => {
      return chrome.runtime.sendMessage({
        type: "batch.start.request",
        requestId: "req_e2e_batch_start",
        jobId: "job_e2e_batch_duplicate",
        tabIds: []
      });
    });
    const filesAfterDuplicate = await readRecentDownloadedFiles(extensionPage);
    expect(filesAfterDuplicate.filter((file) => file.content.includes("MarkdownSave batch"))).toHaveLength(2);

    await extensionPage.evaluate(
      async ({ storageKey, first, second }) => {
        await chrome.storage.local.set({
          [storageKey]: {
            schemaVersion: 1,
            jobs: {
              job_e2e_resume: {
                schemaVersion: 1,
                jobId: "job_e2e_resume",
                requestIds: ["req_e2e_resume_seed"],
                status: "running",
                createdAt: Date.now(),
                updatedAt: Date.now(),
                expiresAt: Date.now() + 86_400_000,
                totalTabs: 2,
                completedTabs: 1,
                failedTabs: 0,
                tabs: {
                  [String(first)]: {
                    tabId: first,
                    url: "https://batch.example.test/one",
                    status: "downloaded",
                    requestId: null,
                    downloadId: 101,
                    error: null,
                    startedAt: Date.now(),
                    finishedAt: Date.now()
                  },
                  [String(second)]: {
                    tabId: second,
                    url: "https://batch.example.test/two",
                    status: "queued",
                    requestId: null,
                    downloadId: null,
                    error: null,
                    startedAt: null,
                    finishedAt: null
                  }
                }
              }
            }
          }
        });
        return chrome.runtime.sendMessage({
          type: "batch.start.request",
          requestId: "req_e2e_resume_start",
          jobId: "job_e2e_resume"
        });
      },
      { storageKey: BATCH_JOBS_STORAGE_KEY, first: tabIds.first, second: tabIds.second }
    );
    await waitForBatchJobStatus(extensionPage, "job_e2e_resume", "completed");
    const filesAfterResume = await readRecentDownloadedFiles(extensionPage);
    expect(filesAfterResume.filter((file) => file.content.includes("MarkdownSave batch"))).toHaveLength(3);
  } finally {
    await context.close();
    await rm(userDataDirectory, { recursive: true, force: true });
  }
});
