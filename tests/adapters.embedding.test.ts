import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { githubAdapter } from "../src/adapters/github";
import { gistAdapter } from "../src/adapters/gist";
import { docsAdapter } from "../src/adapters/docs";

const markdown = '<article class="markdown-body"><h2 id="intro">Introduction</h2><p>Content</p></article>';

beforeEach(() => window.history.replaceState({}, "", "/owner/repo/pull/42"));
afterEach(() => {
  vi.restoreAllMocks();
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe("Markdown surface discovery", () => {
  it("assigns stable identities to discussion and review comments", () => {
    document.body.innerHTML = `
      <div id="discussion-42" data-testid="discussion-body">${markdown}</div>
      <div id="discussioncomment-99">${markdown}</div>
      <div id="pullrequestreview-8">${markdown}<div id="discussion_r15">${markdown}</div></div>
    `;
    const containers = githubAdapter.findContainers(document);
    expect(containers.map((container) => container.key)).toEqual([
      "github:discussion-42", "github:discussion-comment:99", "github:review:8", "github:review-comment:15"
    ]);
    expect(containers.map((container) => container.kind)).toEqual(["markdown", "comment", "comment", "comment"]);
  });

  it("keeps release keys tied to tags when another release is inserted ahead", () => {
    const release = (tag: string) => `<section class="release-entry"><a href="/owner/repo/releases/tag/${tag}">${tag}</a>${markdown}</section>`;
    document.body.innerHTML = release("v1");
    expect(githubAdapter.findContainers(document)[0].key).toBe("github:release:v1");
    document.body.insertAdjacentHTML("afterbegin", release("v2"));
    expect(githubAdapter.findContainers(document).map((container) => container.key)).toEqual([
      "github:release:v2", "github:release:v1"
    ]);
  });

  it("discovers visible rendered previews without touching the editor or hidden preview", () => {
    document.body.innerHTML = `
      <form>
        <div contenteditable="true">${markdown}</div>
        <div class="js-preview-body" hidden>${markdown}</div>
        <div class="js-preview-body" id="live-preview">${markdown}</div>
      </form>
    `;
    const containers = githubAdapter.findContainers(document);
    expect(containers).toHaveLength(1);
    expect(containers[0].key).toBe("github:preview:live-preview");
  });

  it.each([githubAdapter, gistAdapter])("skips navigation, hidden and editable Markdown for $id", (adapter) => {
    document.body.innerHTML = `
      <nav>${markdown}</nav><div hidden>${markdown}</div><div aria-hidden="true">${markdown}</div>
      <div style="display:none">${markdown}</div><div contenteditable="plaintext-only">${markdown}</div>
      <button>${markdown}</button><div role="navigation">${markdown}</div>
      <div id="visible">${markdown}</div>
    `;
    const containers = adapter.findContainers(document);
    expect(containers).toHaveLength(1);
    expect(containers[0].element.parentElement?.id).toBe("visible");
  });

  it("chooses a visible Docs article when the first article is a hidden copy", () => {
    document.body.innerHTML = `<main><div hidden>${markdown}</div><section id="visible">${markdown}</section></main>`;
    const containers = docsAdapter.findContainers(document);
    expect(containers).toHaveLength(1);
    expect(containers[0].element.parentElement?.id).toBe("visible");
  });

  it("does not duplicate nested Markdown roots", () => {
    document.body.innerHTML = `<div class="markdown-body">${markdown}</div>`;
    expect(githubAdapter.findContainers(document)).toHaveLength(1);
  });
});

describe("available GitHub sidebars", () => {
  it("skips zero-width sidebar copies when browser layout is available", () => {
    document.body.innerHTML = '<div class="Layout-sidebar"><div class="BorderGrid" id="collapsed"></div></div><div class="Layout-sidebar"><div class="BorderGrid" id="visible"></div></div>';
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1440);
    vi.spyOn(document.getElementById("visible")!, "getBoundingClientRect")
      .mockReturnValue(DOMRect.fromRect({ width: 300, height: 500 }));
    expect(githubAdapter.getDockedPanelLayout?.(document)?.host.id).toBe("visible");
  });

  it("skips hidden copies of a sidebar before selecting a visible one", () => {
    document.body.innerHTML = `
      <div hidden><div class="Layout-sidebar"><div class="BorderGrid" id="hidden-host"></div></div></div>
      <div class="Layout-sidebar"><div class="BorderGrid" id="visible-host"></div></div>
    `;
    expect(githubAdapter.getDockedPanelLayout?.(document)?.host.id).toBe("visible-host");
  });

  it.each([
    '<aside data-testid="issue-metadata-pane" id="host"></aside>',
    '<aside data-testid="discussion-sidebar" id="host"></aside>',
    '<div id="wiki-rightbar"></div>'
  ])("uses semantic contextual sidebars: %s", (markup) => {
    document.body.innerHTML = markup;
    const context = githubAdapter.getDockedPanelLayout?.(document);
    expect(context?.host).toBe(document.querySelector("#host, #wiki-rightbar"));
    expect(context?.topOffset).toBe(githubAdapter.getStickyHeaderOffset(document));
  });

  it("does not use a sidebar nested in navigation or an editable surface", () => {
    document.body.innerHTML = '<nav><div class="Layout-sidebar"></div></nav><div contenteditable="true"><div class="Layout-sidebar"></div></div>';
    expect(githubAdapter.getDockedPanelLayout?.(document)).toBeNull();
  });
});

describe("visibility and text refresh filtering", () => {
  function attributeMutation(target: HTMLElement, attributeName = "hidden"): MutationRecord {
    return { type: "attributes", target, attributeName } as unknown as MutationRecord;
  }

  it("refreshes when a Markdown preview or one of its ancestors becomes visible", () => {
    document.body.innerHTML = `<div id="preview" hidden>${markdown}</div>`;
    const preview = document.getElementById("preview")!;
    expect(githubAdapter.findContainers(document)).toHaveLength(0);
    preview.hidden = false;
    expect(githubAdapter.shouldRefreshForMutation(attributeMutation(preview))).toBe(true);
    expect(githubAdapter.findContainers(document)).toHaveLength(1);
  });

  it("refreshes when sidebar visibility changes and ignores unrelated page attributes", () => {
    document.body.innerHTML = '<aside class="Layout-sidebar"></aside><div id="unrelated"></div>';
    expect(githubAdapter.shouldRefreshForMutation(attributeMutation(document.querySelector("aside")!))).toBe(true);
    expect(githubAdapter.shouldRefreshForMutation(attributeMutation(document.getElementById("unrelated")!))).toBe(false);
  });

  it("refreshes real Markdown text while ignoring script-owned text and style changes", () => {
    document.body.innerHTML = `<div class="ghcm-root"><button id="script-text">Contents</button></div>${markdown}`;
    const heading = document.querySelector("h2")!;
    const text = heading.firstChild!;
    expect(githubAdapter.shouldRefreshForMutation({ type: "characterData", target: text } as unknown as MutationRecord)).toBe(true);
    const scriptText = document.getElementById("script-text")!.firstChild!;
    expect(githubAdapter.shouldRefreshForMutation({ type: "characterData", target: scriptText } as unknown as MutationRecord)).toBe(false);
    heading.classList.add("ghcm-heading-block");
    expect(githubAdapter.shouldRefreshForMutation(attributeMutation(heading, "class"))).toBe(false);
    const toggle = document.createElement("button");
    toggle.className = "ghcm-heading-toggle";
    toggle.textContent = "▾";
    heading.prepend(toggle);
    expect(githubAdapter.shouldRefreshForMutation({ type: "characterData", target: toggle.firstChild } as unknown as MutationRecord)).toBe(false);
  });
});
