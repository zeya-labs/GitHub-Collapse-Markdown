interface PanelDragElements {
  panel: HTMLElement;
  handle: HTMLElement;
}

interface PanelPosition {
  left: number;
  top: number;
}

interface PointerDrag {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  position: PanelPosition;
}

const VIEWPORT_MARGIN = 8;
const KEYBOARD_STEP = 16;
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, [contenteditable], [role='button']";

export class PanelDrag {
  private readonly abortController = new AbortController();
  private bound = false;
  private enabled = false;
  private position: PanelPosition | null = null;
  private drag: PointerDrag | null = null;

  constructor(private readonly elements: PanelDragElements) {}

  bind(signal: AbortSignal): void {
    if (this.bound || this.abortController.signal.aborted) {
      return;
    }
    if (signal.aborted) {
      this.destroy();
      return;
    }

    this.bound = true;
    const options = { signal: this.abortController.signal };
    this.elements.handle.addEventListener("pointerdown", (event) => this.startDrag(event), options);
    this.elements.handle.addEventListener("lostpointercapture", (event) => this.endDrag(event), options);
    this.elements.handle.addEventListener("keydown", (event) => this.handleKeydown(event), options);
    document.addEventListener("pointermove", (event) => this.moveDrag(event), { ...options, passive: false });
    document.addEventListener("pointerup", (event) => this.endDrag(event), options);
    document.addEventListener("pointercancel", (event) => this.endDrag(event), options);
    window.addEventListener("resize", () => {
      if (this.enabled && this.position) {
        this.moveTo(this.position);
      }
    }, options);
    signal.addEventListener("abort", () => this.destroy(), { ...options, once: true });
  }

  sync(enabled: boolean): void {
    if (this.abortController.signal.aborted) {
      return;
    }
    this.enabled = enabled;
    if (enabled) {
      this.moveTo(this.position ?? this.measurePosition());
    } else {
      this.finishDrag();
    }
  }

  destroy(): void {
    this.enabled = false;
    this.finishDrag();
    this.abortController.abort();
    this.elements.panel.style.removeProperty("--ghcm-overlay-left");
    this.elements.panel.style.removeProperty("--ghcm-overlay-top");
  }

  private startDrag(event: PointerEvent): void {
    if (!this.enabled || this.drag || event.button !== 0 || !event.isPrimary) {
      return;
    }
    if (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR)) {
      return;
    }

    event.preventDefault();
    this.drag = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      position: this.position ?? this.measurePosition()
    };
    this.elements.panel.classList.add("is-dragging");
    try {
      this.elements.handle.setPointerCapture(event.pointerId);
    } catch {
      // Document listeners also cover browsers that cannot capture this pointer.
    }
  }

  private moveDrag(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    event.preventDefault();
    this.moveTo({
      left: this.drag.position.left + event.clientX - this.drag.pointerX,
      top: this.drag.position.top + event.clientY - this.drag.pointerY
    });
  }

  private endDrag(event: PointerEvent): void {
    if (event.pointerId === this.drag?.pointerId) {
      this.finishDrag();
    }
  }

  private finishDrag(): void {
    const pointerId = this.drag?.pointerId;
    this.drag = null;
    this.elements.panel.classList.remove("is-dragging");
    if (pointerId !== undefined && this.elements.handle.hasPointerCapture?.(pointerId)) {
      this.elements.handle.releasePointerCapture(pointerId);
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.enabled || event.target !== this.elements.handle || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const step = KEYBOARD_STEP * (event.shiftKey ? 3 : 1);
    const offsets: Record<string, PanelPosition> = {
      ArrowLeft: { left: -step, top: 0 },
      ArrowRight: { left: step, top: 0 },
      ArrowUp: { left: 0, top: -step },
      ArrowDown: { left: 0, top: step }
    };
    const offset = offsets[event.key];
    if (!offset) {
      return;
    }

    event.preventDefault();
    const position = this.position ?? this.measurePosition();
    this.moveTo({ left: position.left + offset.left, top: position.top + offset.top });
  }

  private measurePosition(): PanelPosition {
    const rect = this.elements.panel.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  }

  private moveTo(position: PanelPosition): void {
    const rect = this.elements.panel.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
    this.position = {
      left: Math.max(VIEWPORT_MARGIN, Math.min(position.left, maxLeft)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(position.top, maxTop))
    };
    this.elements.panel.style.setProperty("--ghcm-overlay-left", `${this.position.left}px`);
    this.elements.panel.style.setProperty("--ghcm-overlay-top", `${this.position.top}px`);
  }
}
