interface PanelActionsElements {
  details: HTMLDetailsElement;
  trigger: HTMLElement;
  menu: HTMLElement;
}

export class PanelActions {
  private readonly abortController = new AbortController();
  private bound = false;

  constructor(private readonly elements: PanelActionsElements) {}

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
    this.elements.details.addEventListener("toggle", () => this.placeMenu(), options);
    this.elements.menu.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("button[data-action]")) {
        this.close({ restoreFocus: true });
      }
    }, options);
    document.addEventListener("pointerdown", (event) => {
      if (event.target instanceof Node && !this.elements.details.contains(event.target)) {
        this.close();
      }
    }, { ...options, capture: true });
    document.addEventListener("keydown", (event) => {
      if (this.elements.details.open && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close({ restoreFocus: true });
      }
    }, { ...options, capture: true });
    window.addEventListener("resize", () => this.close(), options);
    document.addEventListener("scroll", () => this.close(), { ...options, capture: true });
    signal.addEventListener("abort", () => this.destroy(), { ...options, once: true });
    this.placeMenu();
  }

  close({ restoreFocus = false }: { restoreFocus?: boolean } = {}): void {
    const wasOpen = this.elements.details.open;
    this.elements.details.open = false;
    this.elements.details.classList.remove("is-above");
    if (wasOpen && restoreFocus) {
      this.elements.trigger.focus({ preventScroll: true });
    }
  }

  destroy(): void {
    this.abortController.abort();
    this.close();
  }

  private placeMenu(): void {
    const { details, trigger, menu } = this.elements;
    details.classList.remove("is-above");
    if (!details.open) {
      return;
    }

    const menuRect = menu.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const below = window.innerHeight - triggerRect.bottom;
    const above = triggerRect.top;
    details.classList.toggle("is-above", menuRect.bottom > window.innerHeight - 8 && above > below);
  }
}
