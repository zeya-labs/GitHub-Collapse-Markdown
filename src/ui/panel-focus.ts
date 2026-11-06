import type { PanelDomRefs } from "./panel-dom";

interface PanelFocusState {
  open: boolean;
  moveFocus: boolean;
  previousFocus: Element | null;
}

export class PanelFocus {
  private open = false;
  private returnTarget: HTMLElement | null = null;

  constructor(private readonly dom: Pick<PanelDomRefs, "root" | "panel" | "trigger">) {}

  sync({ open, moveFocus, previousFocus }: PanelFocusState): void {
    const wasOpen = this.open;
    this.open = open;
    if (open && !wasOpen) {
      this.returnTarget = previousFocus instanceof HTMLElement ? previousFocus : null;
      if (moveFocus) {
        (this.dom.panel.querySelector<HTMLElement>("button:not(:disabled)") ?? this.dom.panel).focus({ preventScroll: true });
      }
      return;
    }

    if (!open && wasOpen) {
      if (moveFocus || (previousFocus && this.dom.panel.contains(previousFocus))) {
        this.restoreFocus();
      }
      this.returnTarget = null;
      return;
    }

    if (open && previousFocus instanceof HTMLElement && this.dom.panel.contains(previousFocus)) {
      previousFocus.focus({ preventScroll: true });
    }
  }

  destroy(): void {
    if (this.dom.panel.contains(document.activeElement) && this.returnTarget?.isConnected && !this.dom.root.contains(this.returnTarget)) {
      this.returnTarget.focus({ preventScroll: true });
    }
    this.returnTarget = null;
  }

  private restoreFocus(): void {
    const target = this.returnTarget;
    if (target?.isConnected && target !== document.body && !target.closest("[hidden], [inert]")) {
      target.focus({ preventScroll: true });
    }
    if (!target || document.activeElement !== target) {
      this.dom.trigger.focus({ preventScroll: true });
    }
  }
}
