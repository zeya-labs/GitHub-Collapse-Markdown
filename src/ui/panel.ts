import { PanelLayout } from "./panel-layout";
import { createPanelDom } from "./panel-dom";
import { PanelFocus } from "./panel-focus";
import { PanelDrag } from "./panel-drag";
import { PanelOutlineView, type PanelRenderState } from "./panel-outline";
import type { PanelPlacementResolvers } from "./panel-placement";

const DESKTOP_BREAKPOINT = 1180;

interface PanelUIOptions extends PanelPlacementResolvers {
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onJump: (key: string) => void;
}

export class PanelUI {
  private readonly abortController = new AbortController();
  private readonly dom = createPanelDom();
  private readonly focus = new PanelFocus(this.dom);
  private readonly drag = new PanelDrag({ panel: this.dom.panel, handle: this.dom.dragHandle });
  private readonly layout: PanelLayout;
  private readonly outlineView: PanelOutlineView;
  private mounted = false;
  private desktop = false;
  private open = false;

  constructor(private readonly options: PanelUIOptions) {
    this.layout = new PanelLayout(
      {
        dockRow: this.dom.dockRow,
        dockCell: this.dom.dockCell,
        root: this.dom.root,
        panel: this.dom.panel
      },
      {
        resolveDockedLayout: this.options.resolveDockedLayout,
        resolveInlineHost: this.options.resolveInlineHost
      }
    );
    this.outlineView = new PanelOutlineView(this.dom.outline);
  }

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.mounted = true;
    document.body.append(this.dom.root);
    this.layout.bind(this.abortController.signal);
    this.drag.bind(this.abortController.signal);
    this.bindEvents();
    this.handleViewportChange(true);
  }

  destroy(): void {
    this.abortController.abort();
    this.focus.destroy();
    this.drag.destroy();
    this.layout.destroy();
    this.outlineView.destroy();
    this.dom.root.remove();
    this.mounted = false;
  }

  isOpen(): boolean {
    return this.open;
  }

  isConnected(): boolean {
    return this.dom.root.isConnected;
  }

  refreshLayout(): void {
    this.sync();
  }

  setOpen(open: boolean): void {
    this.applyOpenState(open);
  }

  render(state: PanelRenderState): void {
    const structureChanged = this.outlineView.render(state);
    if (this.open) {
      this.outlineView.scheduleActiveItemVisibility(true);
    }
    if (structureChanged) {
      this.layout.refreshGeometry();
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;
    this.dom.trigger.addEventListener("click", () => this.setOpen(!this.open), { signal });
    this.dom.collapseAllButton.addEventListener("click", this.options.onCollapseAll, { signal });
    this.dom.expandAllButton.addEventListener("click", this.options.onExpandAll, { signal });
    this.dom.closeButton.addEventListener("click", () => this.setOpen(false), { signal });
    this.dom.outline.addEventListener("click", (event) => this.handleOutlineClick(event), {
      signal
    });
    window.addEventListener("resize", () => this.handleViewportChange(), {
      signal,
      passive: true
    });
    window.addEventListener("keydown", (event) => this.handleKeydown(event), {
      signal
    });
  }

  private handleOutlineClick(event: Event): void {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>(".ghcm-outline-link")
      : null;
    const key = button?.dataset.key;
    if (!key) {
      return;
    }

    this.options.onJump(key);
    if (this.layout.getPlacement() === "overlay") {
      this.setOpen(false);
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.open && this.layout.getPlacement() === "overlay") {
      event.preventDefault();
      this.setOpen(false);
    }
  }

  private handleViewportChange(force = false): void {
    this.desktop = window.innerWidth >= DESKTOP_BREAKPOINT;
    this.sync({ resetOpen: force });
  }

  private applyOpenState(open: boolean): void {
    const becameOpen = open && !this.open;
    this.open = open;
    this.sync({ moveFocus: true });
    if (becameOpen) {
      this.outlineView.scheduleActiveItemVisibility(true);
    }
  }

  private sync({ resetOpen = false, moveFocus = false } = {}): void {
    const previousFocus = document.activeElement;
    const previousPlacement = this.layout.getPlacement();
    this.layout.sync(this.desktop, this.open);
    const placement = this.layout.getPlacement();
    if (resetOpen || placement !== previousPlacement) {
      this.open = placement === "docked";
      this.layout.sync(this.desktop, this.open);
    }
    const docked = placement === "docked";
    const inline = placement === "inline";
    const overlay = placement === "overlay";

    this.dom.root.classList.toggle("is-desktop", this.desktop);
    this.dom.root.classList.toggle("is-docked", docked);
    this.dom.root.classList.toggle("is-inline", inline);
    this.dom.root.classList.toggle("is-overlay", overlay);
    this.dom.trigger.classList.toggle("is-hidden", this.open);
    this.dom.panel.classList.toggle("is-open", this.open);
    this.dom.panel.hidden = !this.open;
    if (overlay) {
      this.dom.panel.setAttribute("role", "dialog");
      this.dom.trigger.setAttribute("aria-haspopup", "dialog");
      this.dom.dragHandle.setAttribute("aria-label", "Move contents panel with arrow keys; hold Shift to move faster");
      this.dom.dragHandle.setAttribute("role", "group");
    } else {
      this.dom.panel.removeAttribute("role");
      this.dom.trigger.removeAttribute("aria-haspopup");
      this.dom.dragHandle.removeAttribute("aria-label");
      this.dom.dragHandle.removeAttribute("role");
    }
    this.dom.dragHandle.tabIndex = overlay ? 0 : -1;
    this.dom.closeButton.textContent = overlay ? "Close" : "Hide";
    this.dom.closeButton.classList.toggle("is-hidden", !this.open);
    this.dom.trigger.setAttribute("aria-expanded", String(this.open));
    this.focus.sync({ open: this.open, moveFocus, previousFocus });
    this.drag.sync(overlay && this.open);
  }
}
