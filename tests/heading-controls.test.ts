import { afterEach, describe, expect, it } from "vitest";
import { CollapseEngine } from "../src/core/collapse-engine";
import { buildDocument } from "../src/parsing/document-parser";
import { HeadingControls } from "../src/ui/heading-controls";
import { githubReadmeMarkdownFixture } from "./fixtures";

const cleanup: Array<() => void> = [];

afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

function mountControls() {
  document.body.innerHTML = githubReadmeMarkdownFixture;
  const element = document.querySelector<HTMLElement>(".markdown-body")!;
  const pageDocument = buildDocument([{
    key: "github:readme",
    label: "README",
    kind: "markdown",
    element
  }]);
  const engine = new CollapseEngine(pageDocument, []);
  const controls = new HeadingControls(pageDocument, engine);
  const controller = new AbortController();
  controls.mount(controller.signal);
  controls.sync(engine.getSnapshots());
  const unsubscribe = engine.subscribe(() => controls.sync(engine.getSnapshots()));
  cleanup.push(() => {
    unsubscribe();
    controller.abort();
    controls.destroy();
  });
  return { controls, engine, pageDocument };
}

describe("heading controls", () => {
  it("exposes the expanded state on the button and updates it without toggling twice", () => {
    const { pageDocument } = mountControls();
    const binding = pageDocument.getBinding(pageDocument.headings[1].key)!;
    const button = binding.headingEl.querySelector<HTMLButtonElement>(".ghcm-heading-toggle")!;

    expect(button.type).toBe("button");
    expect(button.textContent).toBe("");
    expect(binding.headingEl.textContent).toBe("Support");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Collapse section: Support");
    expect(button.title).toBe("Collapse section: Support");
    expect(binding.blockEl.hasAttribute("aria-expanded")).toBe(false);

    button.click();

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("Expand section: Support");
    expect(button.title).toBe("Expand section: Support");
    expect(button.textContent).toBe("");
    expect(document.querySelector("#support-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);

    button.click();

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#support-copy")?.classList.contains("ghcm-section-hidden")).toBe(false);
  });

  it("keeps Markdown content unchanged when fold state and accessible labels change", () => {
    const { controls, engine, pageDocument } = mountControls();
    const binding = pageDocument.getBinding(pageDocument.headings[1].key)!;
    const observer = new MutationObserver(() => {});
    observer.observe(binding.blockEl, { childList: true, subtree: true });
    cleanup.push(() => observer.disconnect());

    controls.sync(engine.getSnapshots());

    expect(observer.takeRecords()).toHaveLength(0);

    engine.toggle(pageDocument.headings[1].key);

    expect(observer.takeRecords()).toHaveLength(0);

    controls.sync(engine.getSnapshots().map((heading) => ({ ...heading, text: `${heading.text} updated` })));

    expect(observer.takeRecords()).toHaveLength(0);
    expect(binding.headingEl.querySelector("button")?.getAttribute("aria-label"))
      .toBe("Expand section: Support updated");
    expect(binding.headingEl.textContent).toBe("Support");
  });

  it("preserves native anchors and text selection while allowing the rest of a wrapped heading to toggle", () => {
    const { engine, pageDocument } = mountControls();
    const heading = pageDocument.headings[1];
    const binding = pageDocument.getBinding(heading.key)!;
    const nativeAnchor = binding.blockEl.querySelector("a.anchor svg")!;
    const anchorClick = new MouseEvent("click", { bubbles: true, cancelable: true });

    nativeAnchor.dispatchEvent(anchorClick);

    expect(anchorClick.defaultPrevented).toBe(false);
    expect(engine.isCollapsed(heading.key)).toBe(false);

    const range = document.createRange();
    range.selectNodeContents(binding.headingEl);
    window.getSelection()?.addRange(range);
    binding.blockEl.click();

    expect(engine.isCollapsed(heading.key)).toBe(false);

    window.getSelection()?.removeAllRanges();
    binding.blockEl.click();

    expect(engine.isCollapsed(heading.key)).toBe(true);
  });

  it("applies Shift-click on a toggle button to its sibling headings", () => {
    const { engine, pageDocument } = mountControls();
    const siblings = pageDocument.headings.filter((heading) => heading.level === 2);
    const binding = pageDocument.getBinding(siblings[0].key)!;
    const button = binding.headingEl.querySelector<HTMLButtonElement>(".ghcm-heading-toggle")!;

    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));

    expect(siblings.every((heading) => engine.isCollapsed(heading.key))).toBe(true);
    expect(engine.isCollapsed(pageDocument.headings[0].key)).toBe(false);

    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));

    expect(siblings.every((heading) => !engine.isCollapsed(heading.key))).toBe(true);
  });
});
