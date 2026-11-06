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

  it("keeps host typography and block dividers while giving every heading a compact control", () => {
    document.body.innerHTML = `
      <article class="markdown-body">
        <h1 style="font-size: 32px; line-height: 40px; margin: 24px 0 16px; border-bottom: 1px solid black; color: rgb(31, 35, 40)">Large heading</h1>
        <p>First section</p>
        <h6 style="font-size: 14px; line-height: 20px; margin: 24px 0 16px">Small heading</h6>
        <p>Second section</p>
      </article>
    `;
    const style = document.createElement("style");
    style.textContent = headingStyles;
    document.head.append(style);
    const page = buildDocument([{
      key: "github:readme", label: "README", kind: "markdown",
      element: document.querySelector<HTMLElement>("article")!
    }]);
    const engine = new CollapseEngine(page, []);
    const controls = new HeadingControls(page, engine);
    const controller = new AbortController();
    const headings = page.headings.map((heading) => page.getBinding(heading.key)!.headingEl);
    const originalStyles = headings.map((heading) => window.getComputedStyle(heading));
    controls.mount(controller.signal);

    for (const collapsed of [false, true]) {
      if (collapsed) engine.collapseAll();
      controls.sync(engine.getSnapshots());

      headings.forEach((heading, index) => {
        const headingStyle = window.getComputedStyle(heading);
        const button = heading.querySelector<HTMLButtonElement>(".ghcm-heading-toggle")!;
        const buttonStyle = window.getComputedStyle(button);

        const hiddenByParent = engine.getSnapshots()[index].hiddenByAncestor;
        expect(headingStyle.display).toBe(hiddenByParent ? "none" : "flex");
        for (const property of ["fontSize", "lineHeight", "marginTop", "marginBottom", "borderBottomWidth", "color", "opacity"] as const) {
          expect(headingStyle[property]).toBe(originalStyles[index][property]);
        }
        expect(buttonStyle.width).toBe("20px");
        expect(buttonStyle.height).toBe("20px");
      });
    }

    controller.abort();
    controls.destroy();
  });
});
