import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateMarkdownSaveOptionsFromUnknown } from "../../src/shared/options/schema";

const fixturesDirectory = resolve(import.meta.dirname, "../fixtures");

describe("M11 fixture contract", () => {
  it("representative options fixture is valid current schema", async () => {
    const optionsJson = await readFixture("options/representative-options.json");
    const validation = validateMarkdownSaveOptionsFromUnknown(JSON.parse(optionsJson) as unknown);

    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      throw new Error("代表 options fixture 必须通过 schema 校验");
    }
    expect(validation.ignoredFields).toEqual([]);
    expect(validation.options.includeTemplate).toBe(true);
    expect(validation.options.linkStyle).toBe("referenced");
    expect(validation.options.downloadImages).toBe(true);
  });

  it("representative html fixture includes the parity surfaces used by E2E", async () => {
    const html = await readFixture("html/representative-article.html");

    expect(html).toContain("<base");
    expect(html).toContain('meta name="keywords"');
    expect(html).toContain("<pre><code");
    expect(html).toContain('style="display: none"');
    expect(html).toContain("<img");
    expect(html).toContain("math-inline");
  });

  it("representative expected markdown records the reviewed browser output", async () => {
    const markdown = await readFixture("expected-markdown/representative-article.md");

    expect(markdown).toContain("title: Ignored Browser Title");
    expect(markdown).toContain("Intro with a [relative guide][1]");
    expect(markdown).toContain("![Hero image](Ignored%20Browser%20Title/hero.png)");
    expect(markdown).toContain("[1]: https://snapshot.example.test/guide");
    expect(markdown).not.toContain("Hidden fixture text");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("fixture README documents snapshot provenance and update rules", async () => {
    const readme = await readFixture("README.md");

    expect(readme).toContain("Snapshot update rule");
    expect(readme).toContain("Current provenance");
    expect(readme).toContain("real MarkdownSave Chrome MV3 popup/background/offscreen flow");
    expect(readme).toContain("not a claim that every MarkDownload page output is byte-for-byte identical");
  });
});

/** 读取 fixture 文本。 */
function readFixture(relativePath: string): Promise<string> {
  return readFile(resolve(fixturesDirectory, relativePath), "utf8");
}
