import { describe, expect, it } from "vitest";

import { cleanInvisibleCharacters } from "../../../../src/shared/conversion/clean-markdown";
import { createTurndownService } from "../../../../src/shared/conversion/turndown-factory";

describe("shared conversion turndown factory", () => {
  it("传入默认 Turndown 配置并只关闭当前实例 escape", () => {
    const plainService = createTurndownService({ turndownEscape: false });
    const escapedService = createTurndownService({ turndownEscape: true });
    const doubleUnderscoreEmService = createTurndownService({ emDelimiter: "__" });

    expect(plainService.turndown("<p>*literal*</p>")).toBe("*literal*");
    expect(escapedService.turndown("<p>*literal*</p>")).toBe("\\*literal\\*");
    expect(doubleUnderscoreEmService.turndown("<p><em>x</em></p>")).toBe("__x__");
    expect(createTurndownService({ headingStyle: "setext" }).turndown("<h1>Title</h1>")).toBe("Title\n=====");
  });

  it("保留 MarkDownload 允许的 HTML 标签并启用 GFM 表格和任务列表", () => {
    const service = createTurndownService();
    const html = [
      "<p><sub>2</sub><sup>3</sup><u>u</u><ins>i</ins><small>s</small><big>b</big></p>",
      "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>",
      '<ul><li><input checked="" disabled="" type="checkbox"> Done</li><li><input disabled="" type="checkbox"> Todo</li></ul>'
    ].join("");

    const markdown = service.turndown(html);

    expect(markdown).toContain("<sub>2</sub>");
    expect(markdown).toContain("<sup>3</sup>");
    expect(markdown).toContain("<u>u</u>");
    expect(markdown).toContain("<ins>i</ins>");
    expect(markdown).toContain("<small>s</small>");
    expect(markdown).toContain("<big>b</big>");
    expect(markdown).toContain("| A | B |");
    expect(markdown).toContain("| 1 | 2 |");
    expect(markdown).toContain("[x]  Done");
    expect(markdown).toContain("[ ]  Todo");
  });

  it("stripLinks 时只保留链接内容，普通链接先按 MarkDownload baseURI 规则解析", () => {
    const stripped = createTurndownService({ linkStyle: "stripLinks" }, { baseURI: "https://example.com/docs/page" });
    const normal = createTurndownService({ linkStyle: "inlined" }, { baseURI: "https://example.com/docs/" });

    expect(stripped.turndown('<p><a href="/guide">Guide</a></p>')).toBe("Guide");
    expect(normal.turndown('<p><a href="next">Next</a></p>')).toBe("[Next](https://example.com/docs//next)");
  });

  it("输出 PRE > CODE fenced code，并按正文行首 fence 扩展围栏长度", () => {
    const service = createTurndownService({ fence: "```", codeBlockStyle: "fenced" });
    const html = '<pre><code id="code-lang-js">const a = 1;\n```inner\n</code></pre>';

    expect(service.turndown(html)).toBe("````js\nconst a = 1;\n```inner\n````");
  });

  it("输出裸 PRE fenced code 并恢复 br-keep 换行", () => {
    const service = createTurndownService({ fence: "~~~", codeBlockStyle: "fenced" });
    const html = "<pre id=\"code-lang-text\">alpha<br-keep></br-keep>beta\n</pre>";

    expect(service.turndown(html)).toBe("~~~text\nalpha\nbeta\n~~~");
  });

  it("按 article.math id 输出 inline 和 block 数学骨架", () => {
    const service = createTurndownService({}, {
      math: {
        inline_math: { tex: " a\n+ b\u00a0", inline: true },
        block_math: { tex: " x = y\u00a0", inline: false }
      }
    });

    expect(service.turndown('<p><i id="inline_math">fallback</i></p><p id="block_math">fallback</p>')).toBe(
      "$a + b$\n\n$$\nx = y\n$$"
    );
  });

  it("按图片样式输出纯 Markdown 骨架", () => {
    const resolver = (src: string) => `assets/${src.slice(src.lastIndexOf("/") + 1)}`;
    const noImage = createTurndownService({ imageStyle: "noImage" });
    const obsidian = createTurndownService({ imageStyle: "obsidian", downloadImages: true }, { imagePathResolver: resolver });
    const obsidianNoFolder = createTurndownService(
      { imageStyle: "obsidian-nofolder", downloadImages: true },
      { imagePathResolver: resolver }
    );
    const referenced = createTurndownService({ imageStyle: "markdown", imageRefStyle: "referenced" });
    const originalSource = createTurndownService({ imageStyle: "originalSource", downloadImages: true }, {
      imagePathResolver: resolver
    });
    const base64 = createTurndownService({ imageStyle: "base64", downloadImages: true }, {
      imagePathResolver: resolver
    });

    expect(noImage.turndown('<p><img src="https://example.com/a.png" alt="A"></p>')).toBe("");
    expect(obsidian.turndown('<p><img src="https://example.com/a.png" alt="A"></p>')).toBe("![[assets/a.png]]");
    expect(obsidianNoFolder.turndown('<p><img src="https://example.com/a.png" alt="A"></p>')).toBe("![[a.png]]");
    expect(referenced.turndown('<p><img src="https://example.com/a.png" alt="A" title="T"></p>')).toBe(
      "![A][fig1]\n\n[fig1]: https://example.com/a.png \"T\""
    );
    expect(originalSource.turndown('<p><img src="https://example.com/a.png" alt="A"></p>')).toBe(
      "![A](https://example.com/a.png)"
    );
    expect(base64.turndown('<p><img src="https://example.com/a.png" alt="A"></p>')).toBe("![A](https://example.com/a.png)");
  });

  it("清理 CodeMirror 会显示红点的不可见字符", () => {
    expect(cleanInvisibleCharacters("a\u0000b\u200bc\ufeffd")).toBe("abcd");
  });
});
