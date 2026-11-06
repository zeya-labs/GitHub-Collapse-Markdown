import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelActions } from "../src/ui/panel-actions";

describe("panel actions", () => {
  let details: HTMLDetailsElement;
  let trigger: HTMLElement;
  let menu: HTMLElement;
  let outside: HTMLButtonElement;
  let actions: PanelActions;
  let controller: AbortController;

  beforeEach(() => {
    document.body.innerHTML = `<details>
      <summary aria-label="Contents actions">Actions</summary>
      <div><button data-action="collapse-all"><span>Collapse all</span></button>
      <button data-action="expand-all">Expand all</button></div>
    </details><button id="outside">Outside</button>`;
    details = document.querySelector("details")!;
    trigger = details.querySelector("summary")!;
    menu = details.querySelector("div")!;
    outside = document.querySelector("#outside")!;
    vi.stubGlobal("innerHeight", 800);
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ y: 100, height: 28 }));
    vi.spyOn(menu, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ y: 132, height: 80 }));
    controller = new AbortController();
    actions = new PanelActions({ details, trigger, menu });
    actions.bind(controller.signal);
  });

  afterEach(() => {
    controller.abort();
    actions.destroy();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function open(): void {
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
  }

  function key(target: EventTarget, value: string): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  it("closes after either action, restores summary focus, and lets the action bubble", () => {
    const onAction = vi.fn();
    details.addEventListener("click", onAction);

    for (const target of [menu.querySelector("span")!, menu.querySelectorAll("button")[1]]) {
      open();
      (target.closest("button") as HTMLButtonElement).focus();
      target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(details.open).toBe(false);
      expect(document.activeElement).toBe(trigger);
    }
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("consumes Escape before the containing panel while leaving native summary keys alone", () => {
    const onPanelKey = vi.fn();
    window.addEventListener("keydown", onPanelKey, { signal: controller.signal });
    open();
    menu.querySelector("button")!.focus();

    expect(key(menu.querySelector("button")!, "Escape").defaultPrevented).toBe(true);
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(onPanelKey).not.toHaveBeenCalled();

    for (const value of ["Enter", " "]) {
      expect(key(trigger, value).defaultPrevented).toBe(false);
    }
    expect(key(trigger, "Escape").defaultPrevented).toBe(false);
    controller.abort();
  });

  it("dismisses on outside pointerdown without stealing focus or cancelling the pointer", () => {
    open();
    menu.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(details.open).toBe(true);

    outside.focus();
    const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
    outside.dispatchEvent(event);
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(outside);
    expect(event.defaultPrevented).toBe(false);
  });

  it("opens upward near the viewport bottom and clears placement when closed", () => {
    vi.mocked(trigger.getBoundingClientRect).mockReturnValue(DOMRect.fromRect({ y: 730, height: 28 }));
    vi.mocked(menu.getBoundingClientRect).mockReturnValue(DOMRect.fromRect({ y: 762, height: 80 }));
    open();
    expect(details.classList.contains("is-above")).toBe(true);

    actions.close();
    expect(details.classList.contains("is-above")).toBe(false);
    vi.mocked(trigger.getBoundingClientRect).mockReturnValue(DOMRect.fromRect({ y: 100, height: 28 }));
    vi.mocked(menu.getBoundingClientRect).mockReturnValue(DOMRect.fromRect({ y: 132, height: 80 }));
    open();
    expect(details.classList.contains("is-above")).toBe(false);
  });

  it("closes on viewport resize and scrolling inside the panel", () => {
    open();
    window.dispatchEvent(new Event("resize"));
    expect(details.open).toBe(false);

    open();
    menu.dispatchEvent(new Event("scroll"));
    expect(details.open).toBe(false);
  });

  it.each(["abort", "destroy"])("closes and removes listeners on %s", (cleanup) => {
    open();
    if (cleanup === "abort") {
      controller.abort();
    } else {
      actions.destroy();
    }
    expect(details.open).toBe(false);

    open();
    outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(key(trigger, "Escape").defaultPrevented).toBe(false);
    window.dispatchEvent(new Event("resize"));
    expect(details.open).toBe(true);
  });

  it("does not bind to an already aborted lifecycle", () => {
    actions.destroy();
    controller.abort();
    actions = new PanelActions({ details, trigger, menu });
    open();
    actions.bind(controller.signal);
    expect(details.open).toBe(false);
    open();
    expect(key(trigger, "Escape").defaultPrevented).toBe(false);
  });
});
