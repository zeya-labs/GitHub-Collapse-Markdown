import { afterEach, describe, expect, it, vi } from "vitest";
import { PageSessionUI } from "../src/app/page-session-ui";
import { CollapseEngine } from "../src/core/collapse-engine";
import { buildDocument } from "../src/parsing/document-parser";
import type { ContentContainer, SiteAdapter } from "../src/core/types";

const adapter: SiteAdapter = {
  id: "github",
  matches: () => true,
  getPageKey: () => "github.com/test",
  findContainers: () => [],
  shouldRefreshForMutation: () => false,
  getStickyHeaderOffset: () => 0
};

function createContainer(markup: string): ContentContainer {
  document.body.innerHTML = markup;
  return {
    key: "github:readme",
    label: "README",
    kind: "markdown",
    element: document.querySelector(".markdown-body") as HTMLElement
  };
}

describe("PageSessionUI", () => {
  let abortController: AbortController | null = null;
  let ui: PageSessionUI | null = null;

  afterEach(() => {
    abortController?.abort();
    ui?.destroy();
    abortController = null;
    ui = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("renders outline state directly from heading snapshots", () => {
    const container = createContainer(`
      <article class="markdown-body">
        <div class="markdown-heading"><h2 class="heading-element">Intro</h2><a class="anchor" href="#intro"></a></div>
        <p>alpha</p>
        <div class="markdown-heading"><h3 class="heading-element">Nested</h3><a class="anchor" href="#nested"></a></div>
      </article>
    `);

    const pageDocument = buildDocument([container]);
    const engine = new CollapseEngine(pageDocument, []);

    abortController = new AbortController();
    ui = new PageSessionUI({
      adapter,
      engine,
      document: pageDocument,
      onCollapseAll: () => undefined,
      onExpandAll: () => undefined,
      onExpandTo: () => undefined
    });

    ui.mount(abortController.signal);
    ui.renderSnapshots(engine.getSnapshots());

    expect(document.querySelector(".ghcm-outline")?.textContent).toContain("Intro");
    expect(document.querySelector(".ghcm-outline")?.textContent).toContain("Nested");
    expect(ui.isStale()).toBe(false);
  });

  it("remeasures the current heading when the inline outline opens and closes", () => {
    vi.useFakeTimers();
    vi.stubGlobal("innerWidth", 900);
    vi.stubGlobal("scrollY", 0);
    const container = createContainer(`
      <article class="markdown-body">
        <h2 id="intro">Intro</h2>
        <p>First section</p>
        <h2 id="next">Next</h2>
        <p>Second section</p>
      </article>
    `);
    const pageDocument = buildDocument([container]);
    const engine = new CollapseEngine(pageDocument, []);
    pageDocument.headings.forEach((heading, index) => {
      vi.spyOn(pageDocument.getBinding(heading.key)!.blockEl, "getBoundingClientRect")
        .mockImplementation(() => {
          const panel = document.querySelector<HTMLElement>(".ghcm-panel");
          const top = (panel && !panel.hidden ? 400 : 20) + index * 200;
          return DOMRect.fromRect({ y: top - window.scrollY, width: 100, height: 24 });
        });
    });
    abortController = new AbortController();
    ui = new PageSessionUI({
      adapter: { ...adapter, getStickyHeaderOffset: () => 24 },
      engine,
      document: pageDocument,
      onCollapseAll: () => undefined,
      onExpandAll: () => undefined,
      onExpandTo: () => undefined
    });
    ui.mount(abortController.signal);
    ui.renderSnapshots(engine.getSnapshots());
    vi.advanceTimersByTime(32);
    const currentKey = () => document.querySelector<HTMLElement>('[aria-current="location"]')?.dataset.key;
    expect(currentKey()).toBe(pageDocument.headings[0].key);

    ui.togglePanel();
    vi.advanceTimersByTime(32);
    expect(currentKey()).toBeUndefined();

    vi.stubGlobal("scrollY", 450);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(32);
    expect(currentKey()).toBe(pageDocument.headings[0].key);

    vi.stubGlobal("scrollY", 650);
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(32);
    expect(currentKey()).toBe(pageDocument.headings[1].key);

    vi.stubGlobal("scrollY", 0);
    ui.togglePanel();
    vi.advanceTimersByTime(32);
    expect(currentKey()).toBe(pageDocument.headings[0].key);
  });

  it("reports itself as stale when managed controls disappear from the DOM", () => {
    const container = createContainer(`
      <article class="markdown-body">
        <div class="markdown-heading"><h2 class="heading-element">Intro</h2><a class="anchor" href="#intro"></a></div>
      </article>
    `);

    const pageDocument = buildDocument([container]);
    const engine = new CollapseEngine(pageDocument, []);

    abortController = new AbortController();
    ui = new PageSessionUI({
      adapter,
      engine,
      document: pageDocument,
      onCollapseAll: () => undefined,
      onExpandAll: () => undefined,
      onExpandTo: () => undefined
    });

    ui.mount(abortController.signal);
    ui.renderSnapshots(engine.getSnapshots());
    document.querySelector(".ghcm-heading-toggle")?.remove();

    expect(ui.isStale()).toBe(true);
  });

  it("reports itself as stale when the source markdown container leaves the DOM", () => {
    const container = createContainer(`
      <article class="markdown-body">
        <div class="markdown-heading"><h2 class="heading-element">Intro</h2><a class="anchor" href="#intro"></a></div>
      </article>
    `);

    const pageDocument = buildDocument([container]);
    const engine = new CollapseEngine(pageDocument, []);

    abortController = new AbortController();
    ui = new PageSessionUI({
      adapter,
      engine,
      document: pageDocument,
      onCollapseAll: () => undefined,
      onExpandAll: () => undefined,
      onExpandTo: () => undefined
    });

    ui.mount(abortController.signal);
    ui.renderSnapshots(engine.getSnapshots());
    container.element.remove();

    expect(ui.isStale()).toBe(true);
  });
});
