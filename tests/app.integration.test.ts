import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubCollapseMarkdownApp } from "../src/app/app";
import { PageSession } from "../src/app/page-session";
import {
  githubIssueBodyNestedMarkdownFixture,
  githubModuleSidebarPageFixture,
  githubReadmeMarkdownFixture,
  githubReadmePageFixture
} from "./fixtures";

type GMStore = Map<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function installGMStubs(): GMStore {
  const store: GMStore = new Map();

  vi.stubGlobal("GM_addStyle", vi.fn());
  vi.stubGlobal("GM_registerMenuCommand", vi.fn());
  vi.stubGlobal("GM_getValue", vi.fn((key: string, fallback: unknown) => {
    return store.has(key) ? clone(store.get(key)) : fallback;
  }));
  vi.stubGlobal("GM_setValue", vi.fn((key: string, value: unknown) => {
    store.set(key, clone(value));
  }));

  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: vi.fn()
  });

  return store;
}

function dispatchClick(target: Element): void {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function dispatchShiftClick(target: Element): void {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));
}

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
}

function setViewportHeight(height: number): void {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height
  });
}

function sleep(ms = 120): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

describe("GitHubCollapseMarkdownApp integration", () => {
  let app: GitHubCollapseMarkdownApp | null = null;

  beforeEach(() => {
    installGMStubs();
    localStorage.clear();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    setViewportWidth(1400);
    setViewportHeight(900);
    window.history.replaceState({}, "", "/nodejs/node/blob/main/README.md");
  });

  afterEach(() => {
    app?.destroy();
    app = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("mounts controls and panel on a realistic GitHub markdown page", () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    expect(document.querySelector(".ghcm-trigger")).toBeTruthy();
    expect(document.querySelector(".ghcm-panel")).toBeTruthy();
    expect(document.querySelector(".ghcm-panel")?.classList.contains("is-open")).toBe(true);
    expect(document.querySelector(".ghcm-trigger")?.classList.contains("is-hidden")).toBe(true);
    expect(document.querySelectorAll(".ghcm-heading-toggle").length).toBe(6);
    expect(document.querySelector(".ghcm-dock-row")?.parentElement?.classList.contains("BorderGrid")).toBe(true);
    expect(document.querySelector(".ghcm-root")?.classList.contains("is-docked")).toBe(true);
    expect(document.querySelector(".ghcm-dock-row")?.classList.contains("BorderGrid-row")).toBe(true);
    expect(document.querySelector(".ghcm-dock-cell")?.classList.contains("BorderGrid-cell")).toBe(true);
    expect(document.querySelector(".BorderGrid > .BorderGrid-row")?.className).toBe("BorderGrid-row");
    expect(document.querySelector(".ghcm-backdrop")).toBeNull();
    const firstWrappedHeading = document.querySelector(".markdown-heading") as HTMLElement;
    const firstHeadingElement = firstWrappedHeading.querySelector(".heading-element") as HTMLElement;
    expect(firstHeadingElement.firstElementChild?.classList.contains("ghcm-heading-toggle")).toBe(true);
    expect(document.querySelector(".ghcm-search")).toBeFalsy();
    expect(document.querySelector("[data-setting='memory']")).toBeFalsy();
    expect(document.querySelector("[data-action='reset-page']")).toBeFalsy();
  });

  it("falls back to an inline contents block when no desktop sidebar host exists", () => {
    document.body.innerHTML = githubIssueBodyNestedMarkdownFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const root = document.querySelector(".ghcm-root") as HTMLElement;
    const inlineHost = document.querySelector(".NewMarkdownViewer-module__safe-html-box__ZT1eD") as HTMLElement;

    expect(root.classList.contains("is-inline")).toBe(true);
    expect(root.parentElement).toBe(inlineHost);
    expect(inlineHost.firstElementChild).toBe(root);
    expect(document.querySelector(".ghcm-sidebar-kicker")?.tagName).toBe("DIV");
    const panel = document.querySelector(".ghcm-panel") as HTMLElement;
    const trigger = document.querySelector(".ghcm-trigger") as HTMLButtonElement;
    expect(panel.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".ghcm-dock-row")).toBeFalsy();

    dispatchClick(trigger);
    expect(panel.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    dispatchClick(document.querySelector(".ghcm-close-action") as HTMLElement);
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it.each([768, 1024, 1179])("keeps an available native sidebar at %ipx", (width) => {
    setViewportWidth(width);
    document.body.innerHTML = githubReadmePageFixture;
    app = new GitHubCollapseMarkdownApp();
    app.start();

    expect(document.querySelector(".ghcm-root")?.classList.contains("is-docked")).toBe(true);
    expect(document.querySelector(".ghcm-panel")?.classList.contains("is-open")).toBe(true);
    expect(document.querySelector(".markdown-body > .ghcm-root")).toBeNull();
  });

  it("keeps contents after all native metadata, including later sidebar updates", async () => {
    document.body.innerHTML = githubReadmePageFixture;
    const sidebar = document.querySelector<HTMLElement>(".BorderGrid")!;
    const metadata = (title: string) => {
      const row = document.createElement("div");
      row.className = "BorderGrid-row";
      row.innerHTML = `<div class="BorderGrid-cell"><h2>${title}</h2><p>Native metadata</p></div>`;
      return row;
    };
    const releases = metadata("Releases");
    const languages = metadata("Languages");
    sidebar.append(releases, languages);
    app = new GitHubCollapseMarkdownApp();
    app.start();
    const row = document.querySelector(".ghcm-dock-row")!;
    expect(sidebar.lastElementChild).toBe(row);
    expect(row.previousElementSibling).toBe(languages);

    const packages = metadata("Packages");
    sidebar.append(packages);
    await sleep(180);

    expect(sidebar.lastElementChild).toBe(row);
    expect(row.previousElementSibling).toBe(packages);
    expect(sidebar.contains(releases)).toBe(true);
    expect(sidebar.contains(languages)).toBe(true);
    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-dock-row")).toHaveLength(1);
  });

  it("moves existing inline contents into a native sidebar inserted after mounting", async () => {
    document.body.innerHTML = githubReadmePageFixture;
    const sidebar = document.querySelector<HTMLElement>(".prc-PageLayout-PaneWrapper-pHPop")!;
    const readingRegion = sidebar.parentElement!;
    sidebar.remove();
    app = new GitHubCollapseMarkdownApp();
    app.start();
    const root = document.querySelector<HTMLElement>(".ghcm-root")!;
    const headingControl = document.querySelector(".ghcm-heading-toggle");
    expect(root.classList.contains("is-inline")).toBe(true);

    readingRegion.append(sidebar);
    await sleep(180);

    expect(root.classList.contains("is-docked")).toBe(true);
    expect(root.closest(".ghcm-dock-row")?.parentElement).toBe(sidebar.querySelector(".BorderGrid"));
    expect(document.querySelector(".ghcm-root")).toBe(root);
    expect(document.querySelector(".ghcm-heading-toggle")).toBe(headingControl);
    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
    expect(document.querySelector(".markdown-body > .ghcm-root")).toBeNull();
  });

  it("uses an existing modern sidebar when its metadata is hydrated after mounting", async () => {
    document.body.innerHTML = githubReadmePageFixture;
    const sidebar = document.querySelector<HTMLElement>(".prc-PageLayout-Pane-AyzHK")!;
    sidebar.replaceChildren();
    app = new GitHubCollapseMarkdownApp();
    app.start();
    const root = document.querySelector<HTMLElement>(".ghcm-root")!;
    const headingControl = document.querySelector(".ghcm-heading-toggle");
    expect(root.classList.contains("is-inline")).toBe(true);

    sidebar.innerHTML = '<div class="borderGrid__hydrated"><section><h2>About</h2></section><section><h2>Languages</h2></section></div>';
    await sleep(180);

    expect(root.classList.contains("is-docked")).toBe(true);
    expect(sidebar.lastElementChild).toBe(root.closest(".ghcm-dock-row"));
    expect(document.querySelector(".ghcm-root")).toBe(root);
    expect(document.querySelector(".ghcm-heading-toggle")).toBe(headingControl);
    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
  });

  it.each(["replace", "remove"] as const)("recovers contents when the native sidebar is %sd", async (change) => {
    document.body.innerHTML = githubReadmePageFixture;
    const sidebar = document.querySelector<HTMLElement>(".prc-PageLayout-PaneWrapper-pHPop")!;
    const replacement = sidebar.cloneNode(true) as HTMLElement;
    app = new GitHubCollapseMarkdownApp();
    app.start();
    expect(document.querySelector(".ghcm-root")?.classList.contains("is-docked")).toBe(true);

    if (change === "replace") {
      sidebar.replaceWith(replacement);
    } else {
      sidebar.remove();
    }
    await sleep(180);

    const root = document.querySelector<HTMLElement>(".ghcm-root");
    expect(root).not.toBeNull();
    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(6);
    if (change === "replace") {
      expect(root?.classList.contains("is-docked")).toBe(true);
      expect(replacement.contains(root)).toBe(true);
      expect(replacement.querySelector(".BorderGrid")?.lastElementChild).toBe(root?.closest(".ghcm-dock-row"));
    } else {
      expect(root?.classList.contains("is-inline")).toBe(true);
      expect(document.querySelector(".markdown-body")?.firstElementChild).toBe(root);
      expect(document.querySelector(".ghcm-dock-row")).toBeNull();
    }
  });

  it("moves contents after metadata added outside its original native grid", async () => {
    document.body.innerHTML = githubReadmePageFixture;
    const sidebar = document.querySelector<HTMLElement>(".prc-PageLayout-Pane-AyzHK")!;
    const nativeGrid = sidebar.querySelector<HTMLElement>(".BorderGrid")!;
    app = new GitHubCollapseMarkdownApp();
    app.start();
    const root = document.querySelector<HTMLElement>(".ghcm-root")!;
    const row = root.closest(".ghcm-dock-row");
    const headingControl = document.querySelector(".ghcm-heading-toggle");
    expect(row?.parentElement).toBe(nativeGrid);

    const languages = document.createElement("section");
    languages.innerHTML = "<h2>Languages</h2><p>TypeScript</p>";
    sidebar.append(languages);
    await sleep(180);

    expect(row?.parentElement).toBe(sidebar);
    expect(sidebar.lastElementChild).toBe(row);
    expect(row?.previousElementSibling).toBe(languages);
    expect(sidebar.contains(nativeGrid)).toBe(true);
    expect(document.querySelector(".ghcm-root")).toBe(root);
    expect(document.querySelector(".ghcm-heading-toggle")).toBe(headingControl);
    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
  });

  it.each(["initial", "hydrated"] as const)("docks contents in the user-reported sidebar with %s metadata", async (timing) => {
    document.body.innerHTML = githubModuleSidebarPageFixture;
    const sidebar = document.querySelector<HTMLElement>("[data-component='SplitPageLayout.Pane']")!;
    const grid = sidebar.firstElementChild!;
    if (timing === "hydrated") {
      grid.remove();
    }
    app = new GitHubCollapseMarkdownApp();
    app.start();
    const root = document.querySelector<HTMLElement>(".ghcm-root")!;
    const headingControl = document.querySelector(".ghcm-heading-toggle");
    if (timing === "hydrated") {
      expect(root.classList.contains("is-inline")).toBe(true);
      sidebar.append(grid);
      await sleep(180);
    }

    expect(root.classList.contains("is-docked")).toBe(true);
    expect(document.querySelector("#readme .ghcm-root")).toBeNull();
    expect(sidebar.lastElementChild).toBe(root.closest(".ghcm-dock-row"));
    expect(root.closest(".ghcm-dock-row")?.previousElementSibling).toBe(grid);
    expect(grid.lastElementChild?.textContent?.trim()).toBe("Languages");

    const workflows = document.createElement("section");
    workflows.innerHTML = "<h2>Suggested workflows</h2><p>Native suggestions</p>";
    sidebar.append(workflows);
    await sleep(180);

    expect(sidebar.lastElementChild).toBe(root.closest(".ghcm-dock-row"));
    expect(root.closest(".ghcm-dock-row")?.previousElementSibling).toBe(workflows);
    expect(document.querySelector(".ghcm-root")).toBe(root);
    expect(document.querySelector(".ghcm-heading-toggle")).toBe(headingControl);
    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
  });

  it("uses the complete reading layout bottom instead of the short metadata pane", () => {
    document.body.innerHTML = githubReadmePageFixture;
    Object.defineProperty(document.querySelector("header[role='banner']"), "offsetHeight", {
      configurable: true,
      value: 64
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ghcm-panel")) {
        return 630;
      }

      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.matches("header[role='banner']")) {
        return 64;
      }
      if (this.classList.contains("ghcm-panel")) {
        return 630;
      }

      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ghcm-dock-row")) {
        return DOMRect.fromRect({ x: 0, y: 40, width: 320, height: 0 });
      }
      if (this.classList.contains("ghcm-dock-cell")) {
        return DOMRect.fromRect({ x: 1080, y: 40, width: 320, height: 0 });
      }
      if (this.classList.contains("prc-PageLayout-PageLayoutRoot-xyz")) {
        return DOMRect.fromRect({ x: 1080, y: 0, width: 320, height: 700 });
      }
      if (this.classList.contains("prc-PageLayout-Pane-AyzHK")) {
        return DOMRect.fromRect({ x: 1080, y: 0, width: 320, height: 180 });
      }

      return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
    });

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const root = document.querySelector(".ghcm-root") as HTMLElement;
    expect(root.classList.contains("is-floating")).toBe(true);
    expect(root.style.getPropertyValue("--ghcm-panel-top")).toBe("40px");
    expect(root.style.getPropertyValue("--ghcm-panel-height")).toBe("630px");
    expect(root.style.getPropertyValue("--ghcm-panel-max-height")).toBe("630px");
  });

  it("shifts the docked panel upward near the page end instead of only shrinking it", () => {
    document.body.innerHTML = githubReadmePageFixture;
    Object.defineProperty(document.querySelector("header[role='banner']"), "offsetHeight", {
      configurable: true,
      value: 64
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ghcm-panel")) {
        return 420;
      }

      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.matches("header[role='banner']")) {
        return 64;
      }
      if (this.classList.contains("ghcm-panel")) {
        return 420;
      }

      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ghcm-dock-row")) {
        return DOMRect.fromRect({ x: 0, y: -600, width: 320, height: 0 });
      }
      if (this.classList.contains("ghcm-dock-cell")) {
        return DOMRect.fromRect({ x: 1080, y: -600, width: 320, height: 0 });
      }
      if (this.classList.contains("prc-PageLayout-PageLayoutRoot-xyz")) {
        return DOMRect.fromRect({ x: 1080, y: -700, width: 320, height: 1140 });
      }
      if (this.classList.contains("prc-PageLayout-Pane-AyzHK")) {
        return DOMRect.fromRect({ x: 1080, y: -700, width: 320, height: 180 });
      }

      return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
    });

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const root = document.querySelector(".ghcm-root") as HTMLElement;
    expect(root.classList.contains("is-floating")).toBe(true);
    expect(root.style.getPropertyValue("--ghcm-panel-top")).toBe("-10px");
    expect(root.style.getPropertyValue("--ghcm-panel-max-height")).toBe("420px");
  });

  it("recomputes the docked position when the GitHub sidebar reflows after mount", () => {
    document.body.innerHTML = githubReadmePageFixture;
    Object.defineProperty(document.querySelector("header[role='banner']"), "offsetHeight", {
      configurable: true,
      value: 64
    });

    let rowTop = 120;
    const sidebarHost = document.querySelector(
      "rails-partial[data-partial-name='codeViewRepoRoute.Sidebar'] .BorderGrid"
    ) as HTMLElement;
    const readingLayout = document.querySelector(".prc-PageLayout-PageLayoutRoot-xyz") as HTMLElement;

    class ResizeObserverMock {
      private static callback: ResizeObserverCallback | null = null;

      constructor(callback: ResizeObserverCallback) {
        ResizeObserverMock.callback = callback;
      }

      static emit(target: HTMLElement): void {
        if (!ResizeObserverMock.callback) {
          throw new Error("Resize observer callback was not registered");
        }

        ResizeObserverMock.callback(
          [
            {
              target,
              borderBoxSize: [],
              contentBoxSize: [],
              contentRect: DOMRect.fromRect(),
              devicePixelContentBoxSize: []
            } as unknown as ResizeObserverEntry
          ],
          {} as ResizeObserver
        );
      }

      observe(): void {}

      unobserve(): void {}

      disconnect(): void {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock as unknown as typeof ResizeObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ghcm-panel")) {
        return 360;
      }

      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.matches("header[role='banner']")) {
        return 64;
      }
      if (this.classList.contains("ghcm-panel")) {
        return 360;
      }

      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ghcm-dock-row")) {
        return DOMRect.fromRect({ x: 0, y: rowTop, width: 320, height: 0 });
      }
      if (this.classList.contains("ghcm-dock-cell")) {
        return DOMRect.fromRect({ x: 1080, y: rowTop, width: 320, height: 0 });
      }
      if (this === readingLayout) {
        return DOMRect.fromRect({ x: 1080, y: 0, width: 320, height: 900 });
      }
      if (this.classList.contains("prc-PageLayout-Pane-AyzHK")) {
        return DOMRect.fromRect({ x: 1080, y: 0, width: 320, height: 180 });
      }

      return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
    });

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const root = document.querySelector(".ghcm-root") as HTMLElement;
    expect(root.classList.contains("is-floating")).toBe(false);
    expect(root.style.getPropertyValue("--ghcm-panel-top")).toBe("");
    expect(root.style.getPropertyValue("--ghcm-panel-height")).toBe("360px");
    expect(root.style.getPropertyValue("--ghcm-panel-max-height")).toBe("802px");

    rowTop = 260;
    ResizeObserverMock.emit(sidebarHost);

    expect(root.classList.contains("is-floating")).toBe(false);
    expect(root.style.getPropertyValue("--ghcm-panel-top")).toBe("");
    expect(root.style.getPropertyValue("--ghcm-panel-height")).toBe("360px");
    expect(root.style.getPropertyValue("--ghcm-panel-max-height")).toBe("802px");
  });

  it("recomputes the docked position when scrolling changes the sidebar row geometry", () => {
    document.body.innerHTML = githubReadmePageFixture;
    Object.defineProperty(document.querySelector("header[role='banner']"), "offsetHeight", {
      configurable: true,
      value: 64
    });

    let rowTop = 280;
    const readingLayout = document.querySelector(".prc-PageLayout-PageLayoutRoot-xyz") as HTMLElement;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ghcm-panel")) {
        return 360;
      }

      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.matches("header[role='banner']")) {
        return 64;
      }
      if (this.classList.contains("ghcm-panel")) {
        return 360;
      }

      return 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("ghcm-dock-row")) {
        return DOMRect.fromRect({ x: 0, y: rowTop, width: 320, height: 0 });
      }
      if (this.classList.contains("ghcm-dock-cell")) {
        return DOMRect.fromRect({ x: 1080, y: rowTop, width: 320, height: 0 });
      }
      if (this === readingLayout) {
        return DOMRect.fromRect({ x: 1080, y: 0, width: 320, height: 900 });
      }
      if (this.classList.contains("prc-PageLayout-Pane-AyzHK")) {
        return DOMRect.fromRect({ x: 1080, y: 0, width: 320, height: 180 });
      }

      return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
    });

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const root = document.querySelector(".ghcm-root") as HTMLElement;
    expect(root.classList.contains("is-floating")).toBe(false);
    expect(root.style.getPropertyValue("--ghcm-panel-top")).toBe("");
    expect(root.style.getPropertyValue("--ghcm-panel-height")).toBe("360px");
    expect(root.style.getPropertyValue("--ghcm-panel-max-height")).toBe("802px");

    rowTop = 5;
    document.dispatchEvent(new Event("scroll"));

    expect(root.classList.contains("is-floating")).toBe(true);
    expect(root.style.getPropertyValue("--ghcm-panel-height")).toBe("360px");
    expect(parseFloat(root.style.getPropertyValue("--ghcm-panel-max-height"))).toBeCloseTo(788, 5);
    expect(parseFloat(root.style.getPropertyValue("--ghcm-panel-top"))).toBeCloseTo(82, 5);
  });

  it("collapses the target section when a heading is clicked", () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const releaseHeading = Array.from(document.querySelectorAll("h2"))
      .find((heading) => heading.textContent?.includes("Release types")) as HTMLElement;
    const downloadHeading = Array.from(document.querySelectorAll("h3"))
      .find((heading) => heading.textContent?.includes("Download")) as HTMLElement;

    dispatchClick(releaseHeading);

    expect(releaseHeading.closest(".markdown-heading")?.classList.contains("ghcm-collapsed")).toBe(true);
    expect(document.getElementById("release-types-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);
    expect(downloadHeading.closest(".markdown-heading")?.classList.contains("ghcm-hidden-by-parent")).toBe(true);
  });

  it("collapses the target section when the wrapped GitHub heading row is clicked", () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const wrappedHeading = Array.from(document.querySelectorAll(".markdown-heading"))
      .find((heading) => heading.textContent?.includes("Release types")) as HTMLElement;

    dispatchClick(wrappedHeading);

    expect(wrappedHeading.classList.contains("ghcm-collapsed")).toBe(true);
    expect(document.getElementById("release-types-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);
  });

  it("keeps the section expanded when the native anchor icon is clicked", () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const supportAnchor = document.querySelector("a[href='#support']") as HTMLAnchorElement;
    dispatchClick(supportAnchor);

    expect(document.querySelector("#user-content-support")?.closest(".markdown-heading")?.classList.contains("ghcm-collapsed")).toBe(false);
    expect(document.getElementById("support-copy")?.classList.contains("ghcm-section-hidden")).toBe(false);
  });

  it("supports core panel actions and renders a minimal outline", () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const outlineText = document.querySelector(".ghcm-outline")?.textContent ?? "";
    expect(outlineText).toContain("Support");
    expect(outlineText).toContain("Nightly releases");

    const collapseAll = document.querySelector("[data-action='collapse-all']") as HTMLButtonElement;
    dispatchClick(collapseAll);
    expect(document.getElementById("support-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);
    expect(document.getElementById("nightly-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);

    const expandAll = document.querySelector("[data-action='expand-all']") as HTMLButtonElement;
    dispatchClick(expandAll);
    expect(document.getElementById("support-copy")?.classList.contains("ghcm-section-hidden")).toBe(false);
  });

  it("supports shift-click sibling collapse on same level headings", () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const releaseHeading = Array.from(document.querySelectorAll("h2"))
      .find((heading) => heading.textContent?.includes("Release types")) as HTMLElement;

    dispatchShiftClick(releaseHeading);

    expect(document.getElementById("support-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);
    expect(document.getElementById("release-types-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);
  });

  it("supports only the reduced core shortcuts", () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    app.handleKeydown(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, shiftKey: true }));
    expect(document.getElementById("support-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);

    app.handleKeydown(new KeyboardEvent("keydown", { key: "e", ctrlKey: true, shiftKey: true }));
    expect(document.getElementById("support-copy")?.classList.contains("ghcm-section-hidden")).toBe(false);

    app.handleKeydown(new KeyboardEvent("keydown", { key: "m", ctrlKey: true, shiftKey: true }));
    expect(document.querySelector(".ghcm-panel")?.classList.contains("is-open")).toBe(false);
    expect(document.querySelector(".ghcm-trigger")?.classList.contains("is-hidden")).toBe(false);

    app.handleKeydown(new KeyboardEvent("keydown", { key: "m", ctrlKey: true, shiftKey: true }));
    expect(document.querySelector(".ghcm-panel")?.classList.contains("is-open")).toBe(true);
  });

  it("restores collapsed state from storage on remount", () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    const releaseHeading = Array.from(document.querySelectorAll("h2"))
      .find((heading) => heading.textContent?.includes("Release types")) as HTMLElement;
    const findDownloadHeading = () =>
      Array.from(document.querySelectorAll("h3"))
        .find((heading) => heading.textContent?.includes("Download")) as HTMLElement;

    dispatchClick(releaseHeading);
    app.destroy();

    document.body.innerHTML = githubReadmePageFixture;
    app = new GitHubCollapseMarkdownApp();
    app.start();

    expect(document.getElementById("release-types-copy")?.classList.contains("ghcm-section-hidden")).toBe(true);
    expect(findDownloadHeading().closest(".markdown-heading")?.classList.contains("ghcm-hidden-by-parent")).toBe(true);
  });

  it("mounts itself after markdown content is injected later", async () => {
    app = new GitHubCollapseMarkdownApp();
    app.start();

    expect(document.querySelector(".ghcm-trigger")).toBeFalsy();

    document.body.innerHTML = githubReadmePageFixture;
    await sleep(180);

    expect(document.querySelector(".ghcm-trigger")).toBeTruthy();
    expect(document.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(6);
  });

  it("re-mounts controls after GitHub re-renders content inside an existing markdown container", async () => {
    document.body.innerHTML = githubReadmePageFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    expect(document.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(6);

    const replacement = document.createElement("div");
    replacement.innerHTML = githubReadmeMarkdownFixture;
    const nextArticle = replacement.querySelector("article") as HTMLElement;
    const liveArticle = document.querySelector(".markdown-body") as HTMLElement;

    liveArticle.innerHTML = nextArticle.innerHTML;
    await sleep(180);

    expect(document.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(6);
    expect(document.querySelectorAll(".ghcm-trigger")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-panel")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-dock-row")).toHaveLength(1);
  });

  it.each(["replaceChild", "nodeValue"] as const)(
    "updates outline text without remounting when heading text changes through %s",
    async (updateMethod) => {
      document.body.innerHTML = githubReadmePageFixture;

      const mountSpy = vi.spyOn(PageSession.prototype, "mount");
      const destroySpy = vi.spyOn(PageSession.prototype, "destroy");

      app = new GitHubCollapseMarkdownApp();
      app.start();

      const supportHeading = Array.from(document.querySelectorAll("h2"))
        .find((heading) => heading.textContent?.includes("Support")) as HTMLElement;
      const headingTextNode = Array.from(supportHeading.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
      const originalToggle = supportHeading.querySelector(".ghcm-heading-toggle");
      if (updateMethod === "replaceChild") {
        supportHeading.replaceChild(document.createTextNode("Community Support"), headingTextNode as ChildNode);
      } else {
        headingTextNode!.nodeValue = "Community Support";
      }
      await sleep(180);

      expect(document.querySelector(".ghcm-outline")?.textContent).toContain("Community Support");
      dispatchClick(supportHeading);
      expect(document.querySelector(".ghcm-outline")?.textContent).toContain("Community Support");
      expect(supportHeading.querySelector(".ghcm-heading-toggle")).toBe(originalToggle);
      expect(mountSpy).toHaveBeenCalledTimes(1);
      expect(destroySpy).not.toHaveBeenCalled();
    }
  );

  it("injects a single toggle per heading when GitHub issue bodies nest markdown-body containers", () => {
    document.body.innerHTML = githubIssueBodyNestedMarkdownFixture;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    expect(document.querySelectorAll("h2")).toHaveLength(2);
    expect(document.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(2);
  });

  it("embeds collapsed contents when the native sidebar is hidden on mobile", () => {
    setViewportWidth(390);
    document.body.innerHTML = githubReadmePageFixture;
    (document.querySelector(".prc-PageLayout-PaneWrapper-pHPop") as HTMLElement).hidden = true;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    expect(document.querySelector(".ghcm-panel")?.classList.contains("is-open")).toBe(false);
    expect(document.querySelector(".ghcm-trigger")?.classList.contains("is-hidden")).toBe(false);
    const root = document.querySelector(".ghcm-root") as HTMLElement;
    const article = document.querySelector(".markdown-body") as HTMLElement;
    expect(root.classList.contains("is-inline")).toBe(true);
    expect(root.parentElement).toBe(article);
    expect(article.firstElementChild).toBe(root);
    expect(document.querySelector(".ghcm-backdrop")).toBeNull();
    expect(document.querySelector("[aria-modal='true']")).toBeNull();

    dispatchClick(document.querySelector(".ghcm-trigger") as HTMLElement);
    expect(document.querySelector(".ghcm-panel")?.classList.contains("is-open")).toBe(true);
  });

  it("keeps embedded mobile contents open after jumping from the outline", () => {
    setViewportWidth(390);
    document.body.innerHTML = githubReadmePageFixture;
    (document.querySelector(".prc-PageLayout-PaneWrapper-pHPop") as HTMLElement).hidden = true;

    app = new GitHubCollapseMarkdownApp();
    app.start();

    dispatchClick(document.querySelector(".ghcm-trigger") as HTMLElement);
    dispatchClick(document.querySelector(".ghcm-outline-link") as HTMLElement);

    expect(document.querySelector(".ghcm-panel")?.classList.contains("is-open")).toBe(true);
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it("activates a markdown preview when it becomes visible and cleans up when it is hidden again", async () => {
    document.body.innerHTML = `
      <main>
        <textarea aria-label="Comment source">## Preview heading</textarea>
        <div data-testid="markdown-preview" id="comment-preview" hidden>
          <div class="markdown-body">
            <h2 id="preview-heading">Preview heading</h2>
            <p>Rendered preview content</p>
          </div>
        </div>
      </main>
    `;
    app = new GitHubCollapseMarkdownApp();
    app.start();
    const preview = document.getElementById("comment-preview") as HTMLElement;

    expect(document.querySelector(".ghcm-root")).toBeNull();
    expect(document.querySelector(".ghcm-heading-toggle")).toBeNull();

    preview.hidden = false;
    await sleep(180);

    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
    expect(preview.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(1);
    expect(document.querySelector(".ghcm-outline")?.textContent).toContain("Preview heading");

    preview.hidden = true;
    await sleep(180);

    expect(document.querySelector(".ghcm-root")).toBeNull();
    expect(document.querySelector(".ghcm-heading-toggle")).toBeNull();

    preview.hidden = false;
    await sleep(180);

    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-panel")).toHaveLength(1);
    expect(preview.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(1);
  });

  it.each([
    { name: "native table", fixture: githubReadmePageFixture, host: ".BorderGrid", section: ".BorderGrid-row" },
    { name: "user-reported sidebar", fixture: githubModuleSidebarPageFixture, host: "[data-component='SplitPageLayout.Pane']", section: ".SidebarSection-module_TOhNLG_sidebarSection" }
  ])("moves between a hidden $name and inline contents without rebuilding heading controls", async ({ fixture, host, section }) => {
    document.body.innerHTML = fixture;
    const mountSpy = vi.spyOn(PageSession.prototype, "mount");
    const destroySpy = vi.spyOn(PageSession.prototype, "destroy");
    app = new GitHubCollapseMarkdownApp();
    app.start();

    const root = document.querySelector(".ghcm-root") as HTMLElement;
    const toggle = document.querySelector(".ghcm-heading-toggle");
    const sidebar = document.querySelector(".prc-PageLayout-PaneWrapper-pHPop") as HTMLElement;
    const article = document.querySelector(".markdown-body") as HTMLElement;
    const originalSidebarRow = sidebar.querySelector(section) as HTMLElement;
    const originalSidebarClass = originalSidebarRow.className;
    expect(root.classList.contains("is-docked")).toBe(true);

    sidebar.hidden = true;
    await sleep(180);

    expect(root.classList.contains("is-inline")).toBe(true);
    expect(root.parentElement).toBe(article);
    expect(document.querySelector(".ghcm-heading-toggle")).toBe(toggle);
    expect(document.querySelector(".ghcm-dock-row")).toBeNull();

    sidebar.hidden = false;
    await sleep(180);

    expect(root.classList.contains("is-docked")).toBe(true);
    expect(root.closest(host)).toBe(sidebar.querySelector(host));
    expect(document.querySelector(".ghcm-heading-toggle")).toBe(toggle);
    expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-panel")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-dock-row")).toHaveLength(1);
    expect(document.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(6);
    expect(originalSidebarRow.className).toBe(originalSidebarClass);
    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(destroySpy).not.toHaveBeenCalled();
  });

  it("reuses a single panel and its controls across desktop and mobile placement changes", () => {
    document.body.innerHTML = githubReadmePageFixture;
    app = new GitHubCollapseMarkdownApp();
    app.start();
    const root = document.querySelector(".ghcm-root") as HTMLElement;
    const toggle = document.querySelector(".ghcm-heading-toggle");

    const sidebar = document.querySelector<HTMLElement>(".prc-PageLayout-PaneWrapper-pHPop")!;
    for (const width of [390, 1024, 1400, 390, 1400]) {
      sidebar.hidden = width === 390;
      setViewportWidth(width);
      window.dispatchEvent(new Event("resize"));

      expect(root.classList.contains(sidebar.hidden ? "is-inline" : "is-docked")).toBe(true);
      expect(document.querySelector(".ghcm-root")).toBe(root);
      expect(document.querySelector(".ghcm-heading-toggle")).toBe(toggle);
      expect(document.querySelectorAll(".ghcm-root")).toHaveLength(1);
      expect(document.querySelectorAll(".ghcm-panel")).toHaveLength(1);
      expect(document.querySelectorAll(".ghcm-heading-toggle")).toHaveLength(6);
      expect(document.querySelectorAll(".ghcm-dock-row")).toHaveLength(sidebar.hidden ? 0 : 1);
    }
  });
});
