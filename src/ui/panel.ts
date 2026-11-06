import { PanelLayout } from "./panel-layout";
import { createPanelDom, updatePanelDom } from "./panel-dom";
import { PanelActions } from "./panel-actions";
import { PanelFocus } from "./panel-focus";
import { PanelDrag } from "./panel-drag";
import { PanelOutlineView, type PanelRenderState } from "./panel-outline";
import type { PanelPlacementResolvers } from "./panel-placement";

interface PanelUIOptions extends PanelPlacementResolvers {
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onJump: (key: string) => void;
  onLayoutChange?: () => void;
}

export class PanelUI {
  private readonly abortController = new AbortController();
  private readonly dom = createPanelDom();
  private readonly focus = new PanelFocus(this.dom);
  private readonly actions = new PanelActions({
    details: this.dom.actionsDetails, trigger: this.dom.actionsTrigger, menu: this.dom.actionsMenu
  });
  private readonly drag = new PanelDrag({ panel: this.dom.panel, handle: this.dom.dragHandle });
  private readonly layout: PanelLayout;
  private readonly outlineView: PanelOutlineView;
  private mounted = false;
  private open = false;
  private layoutChangeRaf = 0;

  constructor(private readonly options: PanelUIOptions) {
    this.layout = new PanelLayout(
      {
        dockRow: this.dom.dockRow,
        dockCell: this.dom.dockCell,
        root: this.dom.root,
        panel: this.dom.panel,
        outline: this.dom.outline
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
    this.actions.bind(this.abortController.signal);
    this.bindEvents();
    this.handleViewportChange(true);
  }

  destroy(): void {
    this.abortController.abort();
    window.cancelAnimationFrame(this.layoutChangeRaf);
    this.focus.destroy();
    this.actions.destroy();
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
      this.scheduleLayoutChange();
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
    if (!event.defaultPrevented && event.key === "Escape" && this.open && this.layout.getPlacement() === "overlay") {
      event.preventDefault();
      this.setOpen(false);
    }
  }

  private handleViewportChange(force = false): void {
    this.sync({ resetOpen: force });
  }

  private applyOpenState(open: boolean): void {
    const changed = open !== this.open;
    const becameOpen = open && !this.open;
    this.open = open;
    this.sync({ moveFocus: true });
    if (becameOpen) {
      this.outlineView.scheduleActiveItemVisibility(true);
    }
    if (changed) {
      this.scheduleLayoutChange();
    }
  }

  private sync({ resetOpen = false, moveFocus = false } = {}): void {
    const previousFocus = document.activeElement;
    const previousPlacement = this.layout.getPlacement();
    const previousOpen = this.open;
    this.layout.sync(this.open);
    const placement = this.layout.getPlacement();
    if (resetOpen || placement !== previousPlacement) {
      this.open = placement === "docked";
      this.layout.sync(this.open);
    }
    if (!this.open || placement !== previousPlacement) {
      this.actions.close();
    }
    updatePanelDom(this.dom, placement, this.open);
    this.focus.sync({ open: this.open, moveFocus, previousFocus });
    this.drag.sync(placement === "overlay" && this.open);
    if (placement !== previousPlacement || this.open !== previousOpen) {
      this.scheduleLayoutChange();
    }
  }

  private scheduleLayoutChange(): void {
    if (!this.options.onLayoutChange) {
      return;
    }

    window.cancelAnimationFrame(this.layoutChangeRaf);
    this.layoutChangeRaf = window.requestAnimationFrame(() => {
      this.layoutChangeRaf = 0;
      this.options.onLayoutChange?.();
    });
  }
}
