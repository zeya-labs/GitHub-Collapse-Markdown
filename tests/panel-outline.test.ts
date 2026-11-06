import { afterEach, describe, expect, it } from "vitest";
import { buildHeadingDisplayRevision } from "../src/core/revisions";
import type { HeadingSnapshot } from "../src/core/types";
import { PanelOutlineView } from "../src/ui/panel-outline";

function createSnapshot(overrides: Partial<HeadingSnapshot> = {}): HeadingSnapshot {
  return {
    key: "github:readme::intro",
    anchor: "intro",
    level: 2,
    text: "Intro",
    container: {
      key: "github:readme",
      label: "README",
      kind: "markdown"
    },
    parentKey: null,
    collapsed: false,
    hiddenByAncestor: false,
    ...overrides
  };
}

describe("PanelOutlineView", () => {
  afterEach(() => document.body.replaceChildren());

  it("preserves the focused heading when its displayed text changes", () => {
    const outline = document.createElement("nav");
    document.body.append(outline);
    const view = new PanelOutlineView(outline);
    const render = (headings: HeadingSnapshot[]) => view.render({
      headings, activeHeadingKey: headings[0]?.key ?? null,
      displayRevision: buildHeadingDisplayRevision(headings)
    });
    render([createSnapshot()]);
    outline.querySelector<HTMLButtonElement>("button")!.focus();

    render([createSnapshot({ text: "Updated introduction" })]);

    expect(document.activeElement).toBe(outline.querySelector("button"));
    expect(document.activeElement?.textContent).toBe("Updated introduction");
    view.destroy();
  });

  it("keeps focus in the outline when the focused heading is removed", () => {
    const outline = document.createElement("nav");
    document.body.append(outline);
    const view = new PanelOutlineView(outline);
    const first = createSnapshot();
    const second = createSnapshot({ key: "second", text: "Second" });
    const render = (headings: HeadingSnapshot[]) => view.render({
      headings, activeHeadingKey: null, displayRevision: buildHeadingDisplayRevision(headings)
    });
    render([first, second]);
    outline.querySelectorAll<HTMLButtonElement>("button")[1].focus();

    render([first]);
    expect(document.activeElement).toBe(outline.querySelector("button"));
    render([]);
    expect(document.activeElement).toBe(outline);
    view.destroy();
  });

  it("does not move page focus when the outline updates", () => {
    const pageControl = document.createElement("button");
    const outline = document.createElement("nav");
    document.body.append(pageControl, outline);
    pageControl.focus();
    const view = new PanelOutlineView(outline);
    const headings = [createSnapshot()];

    view.render({ headings, activeHeadingKey: null, displayRevision: buildHeadingDisplayRevision(headings) });

    expect(document.activeElement).toBe(pageControl);
    view.destroy();
  });

  it("reuses outline items when only the active heading changes", () => {
    const outline = document.createElement("nav");
    const view = new PanelOutlineView(outline);
    const headings = [
      createSnapshot(),
      createSnapshot({ key: "github:readme::next", anchor: "next", text: "Next" })
    ];

    view.render({
      headings,
      activeHeadingKey: headings[0].key,
      displayRevision: buildHeadingDisplayRevision(headings)
    });

    const firstItem = outline.querySelector(`[data-key="${headings[0].key}"]`);
    const secondItem = outline.querySelector(`[data-key="${headings[1].key}"]`);

    view.render({
      headings,
      activeHeadingKey: headings[1].key,
      displayRevision: buildHeadingDisplayRevision(headings)
    });

    expect(outline.querySelector(`[data-key="${headings[0].key}"]`)).toBe(firstItem);
    expect(outline.querySelector(`[data-key="${headings[1].key}"]`)).toBe(secondItem);
    expect(firstItem?.classList.contains("is-active")).toBe(false);
    expect(secondItem?.classList.contains("is-active")).toBe(true);

    view.destroy();
  });

  it("reuses outline items when collapsed state changes", () => {
    const outline = document.createElement("nav");
    const view = new PanelOutlineView(outline);
    const headings = [
      createSnapshot(),
      createSnapshot({ key: "github:readme::next", anchor: "next", text: "Next" })
    ];

    view.render({
      headings,
      activeHeadingKey: headings[0].key,
      displayRevision: buildHeadingDisplayRevision(headings)
    });

    const firstItem = outline.querySelector(`[data-key="${headings[0].key}"]`);

    const nextHeadings = [createSnapshot({ collapsed: true }), { ...headings[1], hiddenByAncestor: true }];
    view.render({
      headings: nextHeadings,
      activeHeadingKey: headings[0].key,
      displayRevision: buildHeadingDisplayRevision(nextHeadings)
    });

    expect(outline.querySelector(`[data-key="${headings[0].key}"]`)).toBe(firstItem);
    expect(outline.querySelector(`[data-key="${headings[1].key}"]`)?.classList.contains("is-muted")).toBe(true);

    view.destroy();
  });
});
