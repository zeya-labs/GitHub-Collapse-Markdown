import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelDrag } from "../src/ui/panel-drag";

describe("floating panel movement", () => {
  let panel: HTMLElement;
  let handle: HTMLElement;
  let drag: PanelDrag;
  let controller: AbortController;
  let captured: Set<number>;

  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    panel = document.createElement("aside");
    handle = document.createElement("header");
    handle.tabIndex = 0;
    const button = document.createElement("button");
    button.textContent = "Close";
    handle.append(button);
    panel.append(handle);
    document.body.append(panel);
    vi.spyOn(panel, "getBoundingClientRect").mockImplementation(() => DOMRect.fromRect({
      x: Number.parseFloat(panel.style.getPropertyValue("--ghcm-overlay-left")) || 600,
      y: Number.parseFloat(panel.style.getPropertyValue("--ghcm-overlay-top")) || 100,
      width: 280,
      height: 360
    }));
    captured = new Set();
    handle.setPointerCapture = vi.fn((pointerId) => { captured.add(pointerId); });
    handle.hasPointerCapture = vi.fn((pointerId) => captured.has(pointerId));
    handle.releasePointerCapture = vi.fn((pointerId) => { captured.delete(pointerId); });
    controller = new AbortController();
    drag = new PanelDrag({ panel, handle });
    drag.bind(controller.signal);
    drag.sync(true);
  });

  afterEach(() => {
    drag.destroy();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function pointer(target: EventTarget, type: string, init: MouseEventInit & { pointerId?: number; isPrimary?: boolean } = {}): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
    Object.defineProperties(event, {
      pointerId: { value: init.pointerId ?? 7 },
      isPrimary: { value: init.isPrimary ?? true }
    });
    target.dispatchEvent(event);
    return event;
  }

  function position(): number[] {
    return ["--ghcm-overlay-left", "--ghcm-overlay-top"]
      .map((name) => Number.parseFloat(panel.style.getPropertyValue(name)));
  }

  it("moves by pointer delta and releases capture when dragging ends", () => {
    expect(pointer(handle, "pointerdown", { clientX: 610, clientY: 110 }).defaultPrevented).toBe(true);
    expect(captured.has(7)).toBe(true);
    expect(panel.classList.contains("is-dragging")).toBe(true);

    expect(pointer(document, "pointermove", { clientX: 700, clientY: 200 }).defaultPrevented).toBe(true);
    expect(position()).toEqual([690, 190]);
    pointer(document, "pointerup");

    expect(captured.size).toBe(0);
    expect(panel.classList.contains("is-dragging")).toBe(false);
    pointer(document, "pointermove", { clientX: 500, clientY: 500 });
    expect(position()).toEqual([690, 190]);
  });

  it("keeps the panel within the viewport at both drag boundaries", () => {
    pointer(handle, "pointerdown", { clientX: 610, clientY: 110 });
    pointer(document, "pointermove", { clientX: -1000, clientY: -1000 });
    expect(position()).toEqual([8, 8]);

    pointer(document, "pointermove", { clientX: 3000, clientY: 3000 });
    expect(position()).toEqual([712, 432]);
  });

  it("does not drag from interactive header controls or secondary pointers", () => {
    pointer(handle.querySelector("button")!, "pointerdown", { clientX: 610, clientY: 110 });
    pointer(handle, "pointerdown", { button: 2 });
    pointer(handle, "pointerdown", { isPrimary: false });
    pointer(document, "pointermove", { clientX: 100, clientY: 100 });

    expect(handle.setPointerCapture).not.toHaveBeenCalled();
    expect(position()).toEqual([600, 100]);
  });

  it("repositions after viewport resize while retaining the chosen position across closing", () => {
    pointer(handle, "pointerdown", { clientX: 610, clientY: 110 });
    pointer(document, "pointermove", { clientX: 700, clientY: 200 });
    drag.sync(false);
    expect(captured.size).toBe(0);
    pointer(document, "pointermove", { clientX: 100, clientY: 100 });
    drag.sync(true);
    expect(position()).toEqual([690, 190]);

    vi.stubGlobal("innerWidth", 400);
    vi.stubGlobal("innerHeight", 500);
    window.dispatchEvent(new Event("resize"));
    expect(position()).toEqual([112, 132]);
  });

  it("ends a drag only for its pointer and handles cancellation or capture loss", () => {
    pointer(handle, "pointerdown");
    pointer(document, "pointercancel", { pointerId: 2 });
    expect(panel.classList.contains("is-dragging")).toBe(true);
    pointer(document, "pointercancel");
    expect(captured.size).toBe(0);
    expect(panel.classList.contains("is-dragging")).toBe(false);

    pointer(handle, "pointerdown");
    pointer(handle, "lostpointercapture");
    expect(panel.classList.contains("is-dragging")).toBe(false);
    expect(captured.size).toBe(0);
  });

  it("supports keyboard movement without taking arrow keys from header controls", () => {
    const right = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    handle.dispatchEvent(right);
    expect(right.defaultPrevented).toBe(true);
    expect(position()).toEqual([616, 100]);

    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true, bubbles: true }));
    expect(position()).toEqual([616, 148]);
    handle.querySelector("button")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(position()).toEqual([616, 148]);
  });

  it("removes drag state, captured pointers, and event handlers on abort", () => {
    pointer(handle, "pointerdown");
    controller.abort();
    expect(captured.size).toBe(0);
    expect(panel.classList.contains("is-dragging")).toBe(false);
    expect(panel.style.getPropertyValue("--ghcm-overlay-left")).toBe("");

    expect(pointer(handle, "pointerdown").defaultPrevented).toBe(false);
    pointer(document, "pointermove", { clientX: 700, clientY: 200 });
    window.dispatchEvent(new Event("resize"));
    drag.sync(true);
    expect(panel.style.getPropertyValue("--ghcm-overlay-left")).toBe("");
  });

  it("cleans up its listeners when destroyed before the caller aborts", () => {
    drag.destroy();
    expect(pointer(handle, "pointerdown").defaultPrevented).toBe(false);
    const key = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    handle.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    expect(panel.style.getPropertyValue("--ghcm-overlay-top")).toBe("");
  });
});
