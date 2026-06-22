import { describe, expect, it } from "vitest";

import { removeHiddenNodes, type ElementVisibilityStyle } from "../../../src/content/remove-hidden";
import { asElement, createFakeElement } from "./fake-dom";

/** 按 data-display 和 data-visibility 属性模拟 computed style。 */
function readFakeStyle(element: Element): ElementVisibilityStyle {
  return {
    display: element.getAttribute("data-display") ?? "block",
    visibility: element.getAttribute("data-visibility") ?? "visible"
  };
}

describe("removeHiddenNodes", () => {
  it("删除 display:none 和 visibility:hidden 的普通元素", () => {
    const body = createFakeElement("body");
    const visible = createFakeElement("p", { textContent: "保留" });
    const displayHidden = createFakeElement("section", {
      attributes: { "data-display": "none" },
      textContent: "删除 display"
    });
    const wrapper = createFakeElement("article");
    const visibilityHidden = createFakeElement("span", {
      attributes: { "data-visibility": "hidden" },
      textContent: "删除 visibility"
    });

    body.appendChild(visible);
    body.appendChild(displayHidden);
    body.appendChild(wrapper);
    wrapper.appendChild(visibilityHidden);

    removeHiddenNodes(asElement(body), readFakeStyle);

    expect(body.outerHTML).toContain("保留");
    expect(body.outerHTML).not.toContain("删除 display");
    expect(body.outerHTML).not.toContain("删除 visibility");
  });

  it("跳过 script、style、noscript、math 节点", () => {
    const body = createFakeElement("body");
    const skippedTags = ["script", "style", "noscript", "math"];

    for (const tagName of skippedTags) {
      body.appendChild(
        createFakeElement(tagName, {
          attributes: { "data-display": "none" },
          textContent: `保留 ${tagName}`
        })
      );
    }

    removeHiddenNodes(asElement(body), readFakeStyle);

    for (const tagName of skippedTags) {
      expect(body.outerHTML).toContain(`保留 ${tagName}`);
    }
  });
});
