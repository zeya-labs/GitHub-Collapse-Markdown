import { afterEach, describe, expect, it, vi } from "vitest";
import { isUsablePanelHost, resolvePanelPlacement } from "../src/ui/panel-placement";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function mountHost(markup = '<article id="content"></article>'): HTMLElement {
  document.body.innerHTML = markup;
  return document.getElementById("content")!;
}

describe("contextual panel placement", () => {
  it.each([390, 1024, 1440])("prefers a visible native sidebar at a viewport width of %i", (viewportWidth) => {
    vi.stubGlobal("innerWidth", viewportWidth);
    const inline = mountHost('<main id="content"></main><aside id="sidebar"></aside>');
    const host = document.getElementById("sidebar")!;
    const context = { host, topOffset: 80 };
    expect(resolvePanelPlacement({
      resolveDockedLayout: () => context, resolveInlineHost: () => inline
    })).toEqual({ kind: "docked", context });
  });

  it("embeds into the document when there is no native sidebar", () => {
    const host = mountHost();
    expect(resolvePanelPlacement({
      resolveDockedLayout: () => null, resolveInlineHost: () => host
    })).toEqual({ kind: "inline", host });
  });

  it("falls back from an unavailable sidebar to the visible document", () => {
    const host = mountHost('<article id="content"></article><aside id="sidebar" hidden></aside>');
    expect(resolvePanelPlacement({
      resolveDockedLayout: () => ({ host: document.getElementById("sidebar")!, topOffset: 80 }),
      resolveInlineHost: () => host
    })).toEqual({ kind: "inline", host });
  });

  it.each([
    '<div hidden><article id="content"></article></div>',
    '<div aria-hidden="true"><article id="content"></article></div>',
    '<div style="display:none"><article id="content"></article></div>',
    '<div style="visibility:hidden"><article id="content"></article></div>',
    '<div contenteditable="true"><article id="content"></article></div>',
    '<nav><div id="content"></div></nav>',
    '<button><div id="content"></div></button>',
    '<div class="ghcm-root"><div id="content"></div></div>',
    '<details><div id="content"></div></details>',
    '<table><tbody id="content"></tbody></table>'
  ])("uses a floating fallback when the only host is unsafe: %s", (markup) => {
    const host = mountHost(markup);
    expect(resolvePanelPlacement({
      resolveDockedLayout: () => ({ host, topOffset: 80 }), resolveInlineHost: () => host
    })).toEqual({ kind: "overlay" });
  });

  it("ignores disconnected hosts and accepts visible rendered previews inside forms", () => {
    expect(isUsablePanelHost(document.createElement("article"))).toBe(false);
    const host = mountHost('<form><textarea></textarea><article id="content" class="markdown-body"></article></form>');
    expect(isUsablePanelHost(host)).toBe(true);
  });
});
