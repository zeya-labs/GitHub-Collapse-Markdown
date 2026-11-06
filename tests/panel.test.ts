import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelUI } from "../src/ui/panel";
import { styles } from "../src/ui/styles";

describe("embedded and floating contents panels", () => {
  let panel: PanelUI;
  const actions = () => ({ onCollapseAll: vi.fn(), onExpandAll: vi.fn(), onJump: vi.fn() });
  const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;

  beforeEach(() => {
    vi.stubGlobal("innerWidth", 900);
    document.body.innerHTML = '<main><button id="page-button">Page action</button></main>';
    const style = document.createElement("style");
    style.textContent = styles;
    document.head.append(style);
    panel = new PanelUI(actions());
    panel.mount();
  });

  afterEach(() => {
    panel.destroy();
    document.body.replaceChildren();
    document.head.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("uses a closed floating panel only when no embedding host is available", () => {
    expect(document.querySelector(".ghcm-root")?.classList.contains("is-overlay")).toBe(true);
    expect(document.querySelector(".ghcm-backdrop")).toBeNull();
    expect(document.querySelector<HTMLElement>(".ghcm-panel")?.hidden).toBe(true);
    expect(button(".ghcm-trigger").getAttribute("aria-expanded")).toBe("false");
  });

  it("opens a nonmodal dialog and returns focus when Escape closes it", () => {
    const trigger = button(".ghcm-trigger");
    trigger.focus();
    trigger.click();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.hasAttribute("aria-modal")).toBe(false);
    expect(document.activeElement).toBe(document.querySelector(".ghcm-actions-trigger"));
    expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
    expect(document.querySelector("main")?.hasAttribute("inert")).toBe(false);
    expect(document.querySelector<HTMLElement>(".ghcm-drag-handle")?.tabIndex).toBe(0);

    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(panel.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("allows keyboard and page interaction while the floating panel is open", () => {
    panel.setOpen(true);
    const first = document.querySelector<HTMLElement>(".ghcm-actions-trigger")!;
    first.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    first.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    button("#page-button").focus();
    expect(document.activeElement).toBe(button("#page-button"));
    expect(panel.isOpen()).toBe(true);
  });

  it("restores the page control that opened the panel with a shortcut", () => {
    const pageButton = button("#page-button");
    pageButton.focus();
    panel.setOpen(true);
    panel.setOpen(false);
    expect(document.activeElement).toBe(pageButton);
  });

  it("keeps bulk actions in a disclosure and returns focus after an action", () => {
    panel.setOpen(true);
    const details = document.querySelector<HTMLDetailsElement>(".ghcm-actions")!;
    const summary = document.querySelector<HTMLElement>(".ghcm-actions-trigger")!;
    expect(details.open).toBe(false);

    summary.click();
    expect(details.open).toBe(true);
    button('[data-action="collapse-all"]').click();

    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect(panel.isOpen()).toBe(true);
  });

  it("closes the actions first when Escape is pressed inside the floating panel", () => {
    panel.setOpen(true);
    const details = document.querySelector<HTMLDetailsElement>(".ghcm-actions")!;
    const summary = document.querySelector<HTMLElement>(".ghcm-actions-trigger")!;
    summary.click();
    summary.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(details.open).toBe(false);
    expect(panel.isOpen()).toBe(true);

    summary.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(panel.isOpen()).toBe(false);
  });

  it("resets the actions disclosure when the panel is hidden", () => {
    panel.setOpen(true);
    const details = document.querySelector<HTMLDetailsElement>(".ghcm-actions")!;
    document.querySelector<HTMLElement>(".ghcm-actions-trigger")!.click();
    expect(details.open).toBe(true);
    panel.setOpen(false);
    panel.setOpen(true);
    expect(details.open).toBe(false);
  });

  it("does not steal page focus when an unused floating panel is destroyed", () => {
    panel.setOpen(true);
    const pageButton = button("#page-button");
    pageButton.focus();
    panel.destroy();
    expect(document.activeElement).toBe(pageButton);
  });

  it("embeds a compact disclosure on narrow screens and preserves its state on resize", () => {
    panel.destroy();
    panel = new PanelUI({ ...actions(), resolveInlineHost: () => document.querySelector("main") });
    panel.mount();
    const root = document.querySelector<HTMLElement>(".ghcm-root")!;
    expect(root.classList.contains("is-inline")).toBe(true);
    expect(root.parentElement).toBe(document.querySelector("main"));
    expect(panel.isOpen()).toBe(false);
    expect(document.querySelector(".ghcm-panel")?.hasAttribute("role")).toBe(false);
    button(".ghcm-trigger").click();
    expect(panel.isOpen()).toBe(true);

    vi.stubGlobal("innerWidth", 1440);
    window.dispatchEvent(new Event("resize"));
    expect(panel.isOpen()).toBe(true);
    expect(root.classList.contains("is-inline")).toBe(true);
    button(".ghcm-close-action").click();
    expect(document.activeElement).toBe(button(".ghcm-trigger"));
  });

  it("opens a desktop sidebar without taking focus from the page", () => {
    panel.destroy();
    vi.stubGlobal("innerWidth", 1440);
    const host = document.createElement("aside");
    document.body.append(host);
    const pageButton = button("#page-button");
    pageButton.focus();
    panel = new PanelUI({ ...actions(), resolveDockedLayout: () => ({ host, topOffset: 80 }) });
    panel.mount();
    expect(panel.isOpen()).toBe(true);
    expect(document.querySelector(".ghcm-root")?.classList.contains("is-docked")).toBe(true);
    expect(document.activeElement).toBe(pageButton);
  });
});
