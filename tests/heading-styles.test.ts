import { afterEach, describe, expect, it } from "vitest";
import { headingStyles } from "../src/ui/styles/headings";
import { styles } from "../src/ui/styles";
import { CollapseEngine } from "../src/core/collapse-engine";
import { buildDocument } from "../src/parsing/document-parser";
import { HeadingControls } from "../src/ui/heading-controls";
import { githubReadmeMarkdownFixture } from "./fixtures";

describe("heading styles", () => {
  afterEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it("visually hides wrapped descendant headings when their parent is collapsed", () => {
    document.body.innerHTML = githubReadmeMarkdownFixture;
    const style = document.createElement("style");
    style.textContent = styles;
    document.head.append(style);
    const page = buildDocument([{
      key: "github:readme", label: "README", kind: "markdown",
      element: document.querySelector<HTMLElement>("article")!
    }]);
    const parent = page.headings[0];
    const child = page.getBinding(page.headings[1].key)!.blockEl;
    const engine = new CollapseEngine(page, [parent.key]);
    const controls = new HeadingControls(page, engine);
    const controller = new AbortController();
    controls.mount(controller.signal);

    controls.sync(engine.getSnapshots());
    expect(window.getComputedStyle(child).display).toBe("none");

    engine.expandAll();
    controls.sync(engine.getSnapshots());
    expect(window.getComputedStyle(child).display).toBe("block");
    controller.abort();
    controls.destroy();
  });

  it("keeps inline headings full-width so GitHub heading dividers do not shrink", () => {
    expect(headingStyles).toMatch(/\.ghcm-heading-inline\s*\{[^}]*display:\s*flex;/s);
    expect(headingStyles).not.toMatch(/\.ghcm-heading-inline\s*\{[^}]*display:\s*inline-flex;/s);
  });
});
