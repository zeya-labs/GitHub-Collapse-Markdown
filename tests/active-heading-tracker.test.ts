import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveHeadingTracker } from "../src/app/active-heading-tracker";
import { buildDocument } from "../src/parsing/document-parser";
import { CollapseEngine } from "../src/core/collapse-engine";
import type { ContentContainer } from "../src/core/types";

function createContainer(markup: string): ContentContainer {
  document.body.innerHTML = markup;
  return {
    key: "github:readme",
    label: "README",
    kind: "markdown",
    element: document.querySelector(".markdown-body") as HTMLElement
  };
}

describe("ActiveHeadingTracker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("remeasures later headings when a section without descendant headings is collapsed or expanded", () => {
    const container = createContainer(`
      <article class="markdown-body">
        <h2 id="first">First</h2>
        <p>Long section content</p>
        <h2 id="second">Second</h2>
        <p>Following section content</p>
      </article>
    `);
    const pageDocument = buildDocument([container]);
    const [first, second] = pageDocument.headings;
    const engine = new CollapseEngine(pageDocument, []);
    vi.spyOn(document.getElementById("first") as HTMLElement, "getBoundingClientRect")
      .mockImplementation(() => DOMRect.fromRect({ y: 100, width: 100, height: 24 }));
    vi.spyOn(document.getElementById("second") as HTMLElement, "getBoundingClientRect")
      .mockImplementation(() => DOMRect.fromRect({
        y: engine.isCollapsed(first.key) ? 200 : 500,
        width: 100,
        height: 24
      }));
    const tracker = new ActiveHeadingTracker({
      getStickyTop: () => 292,
      resolveBinding: (key) => pageDocument.getBinding(key)
    });

    tracker.sync(engine.getSnapshots());
    expect(tracker.getActiveHeadingKey()).toBe(first.key);

    engine.toggle(first.key);
    tracker.sync(engine.getSnapshots());
    expect(tracker.getActiveHeadingKey()).toBe(second.key);

    engine.toggle(first.key);
    tracker.sync(engine.getSnapshots());
    expect(tracker.getActiveHeadingKey()).toBe(first.key);
  });

  it("remeasures later headings when updated heading text wraps onto more lines", () => {
    const container = createContainer(`
      <article class="markdown-body">
        <h2 id="first">First</h2>
        <p>Section content</p>
        <h2 id="second">Second</h2>
        <p>Following content</p>
      </article>
    `);
    const pageDocument = buildDocument([container]);
    const [first, second] = pageDocument.headings;
    const engine = new CollapseEngine(pageDocument, []);
    const firstElement = document.getElementById("first") as HTMLElement;
    vi.spyOn(firstElement, "getBoundingClientRect")
      .mockImplementation(() => DOMRect.fromRect({ y: 100, width: 100, height: 24 }));
    vi.spyOn(document.getElementById("second") as HTMLElement, "getBoundingClientRect")
      .mockImplementation(() => DOMRect.fromRect({
        y: firstElement.textContent === "First" ? 280 : 360,
        width: 100,
        height: 24
      }));
    const tracker = new ActiveHeadingTracker({
      getStickyTop: () => 292,
      resolveBinding: (key) => pageDocument.getBinding(key)
    });

    tracker.sync(engine.getSnapshots());
    expect(tracker.getActiveHeadingKey()).toBe(second.key);

    firstElement.textContent = "An updated heading that wraps onto several additional lines";
    const updatedDocument = buildDocument([container]);
    tracker.sync(engine.getSnapshotsForHeadings(updatedDocument.headings), true);
    expect(tracker.getActiveHeadingKey()).toBe(first.key);
  });

  it("ignores hidden descendant headings when resolving the active heading", () => {
    const container = createContainer(`
      <article class="markdown-body">
        <div class="markdown-heading" id="intro-block"><h2 class="heading-element">Intro</h2><a class="anchor" href="#intro"></a></div>
        <p>alpha</p>
        <div class="markdown-heading" id="nested-block"><h3 class="heading-element">Nested</h3><a class="anchor" href="#nested"></a></div>
        <p>beta</p>
        <div class="markdown-heading" id="next-block"><h2 class="heading-element">Next</h2><a class="anchor" href="#next"></a></div>
        <p>gamma</p>
      </article>
    `);

    const pageDocument = buildDocument([container]);
    const engine = new CollapseEngine(pageDocument, [pageDocument.headings[0].key]);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.id === "intro-block") {
        return DOMRect.fromRect({ x: 0, y: 40, width: 100, height: 24 });
      }
      if (this.id === "nested-block") {
        return DOMRect.fromRect({ x: 0, y: 60, width: 100, height: 24 });
      }
      if (this.id === "next-block") {
        return DOMRect.fromRect({ x: 0, y: 220, width: 100, height: 24 });
      }

      return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
    });

    const tracker = new ActiveHeadingTracker({
      getStickyTop: () => 80,
      resolveBinding: (key) => pageDocument.getBinding(key)
    });

    expect(tracker.sync(engine.getSnapshots(), true)).toBe(true);

    expect(tracker.getActiveHeadingKey()).toBe(pageDocument.headings[0].key);
  });
});
