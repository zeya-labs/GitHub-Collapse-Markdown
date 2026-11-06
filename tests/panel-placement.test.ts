import { afterEach, describe, expect, it } from "vitest";
import { isUsablePanelHost, resolvePanelPlacement } from "../src/ui/panel-placement";

afterEach(() => document.body.replaceChildren());

function mountHost(markup = '<article id="content"></article>'): HTMLElement {
  document.body.innerHTML = markup;
  return document.getElementById("content")!;
}

describe("contextual panel placement", () => {
  it("uses an available sidebar on desktop before an inline host", () => {
    const inline = mountHost('<main id="content"></main><aside id="sidebar"></aside>');
    const host = document.getElementById("sidebar")!;
    const context = { host, topOffset: 80 };
    expect(resolvePanelPlacement(true, {
      resolveDockedLayout: () => context, resolveInlineHost: () => inline
    })).toEqual({ kind: "docked", context });
  });

  it("embeds into the document on narrow screens instead of forcing a popup", () => {
    const host = mountHost('<article id="content"></article><aside id="sidebar"></aside>');
    expect(resolvePanelPlacement(false, {
      resolveDockedLayout: () => ({ host: document.getElementById("sidebar")!, topOffset: 80 }),
      resolveInlineHost: () => host
    })).toEqual({ kind: "inline", host });
  });

  it("falls back from an unavailable sidebar to the visible document", () => {
    const host = mountHost('<article id="content"></article><aside id="sidebar" hidden></aside>');
    expect(resolvePanelPlacement(true, {
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
    expect(resolvePanelPlacement(true, {
      resolveDockedLayout: () => ({ host, topOffset: 80 }), resolveInlineHost: () => host
    })).toEqual({ kind: "overlay" });
  });

  it("ignores disconnected hosts and accepts visible rendered previews inside forms", () => {
    expect(isUsablePanelHost(document.createElement("article"))).toBe(false);
    const host = mountHost('<form><textarea></textarea><article id="content" class="markdown-body"></article></form>');
    expect(isUsablePanelHost(host)).toBe(true);
  });
});
