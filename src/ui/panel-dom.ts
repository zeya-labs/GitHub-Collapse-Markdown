import type { PanelPlacement } from "./panel-placement";

export interface PanelDomRefs {
  dockRow: HTMLDivElement;
  dockCell: HTMLDivElement;
  root: HTMLDivElement;
  trigger: HTMLButtonElement;
  dragHandle: HTMLElement;
  panel: HTMLElement;
  outline: HTMLElement;
  collapseAllButton: HTMLButtonElement;
  expandAllButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  actionsDetails: HTMLDetailsElement;
  actionsTrigger: HTMLElement;
  actionsMenu: HTMLDivElement;
}

export function createPanelDom(): PanelDomRefs {
  const dockRow = document.createElement("div");
  dockRow.className = "ghcm-dock-row BorderGrid-row";

  const dockCell = document.createElement("div");
  dockCell.className = "ghcm-dock-cell BorderGrid-cell";

  const root = document.createElement("div");
  root.className = "ghcm-root";

  const trigger = createButton("ghcm-trigger", "Contents", "Toggle contents");
  trigger.setAttribute("aria-controls", "ghcm-contents-panel");

  const panel = document.createElement("aside");
  panel.id = "ghcm-contents-panel";
  panel.className = "ghcm-panel";
  panel.tabIndex = -1;
  panel.setAttribute("aria-label", "Page contents");

  const collapseAllButton = createButton("ghcm-inline-action", "Collapse all");
  collapseAllButton.dataset.action = "collapse-all";

  const expandAllButton = createButton("ghcm-inline-action", "Expand all");
  expandAllButton.dataset.action = "expand-all";

  const closeButton = createButton("ghcm-close-action", "", "Hide contents");
  closeButton.append(createIcon("M4 4l8 8M12 4l-8 8"));

  const actionsDetails = document.createElement("details");
  actionsDetails.className = "ghcm-actions";
  const actionsTrigger = document.createElement("summary");
  actionsTrigger.className = "ghcm-actions-trigger";
  actionsTrigger.setAttribute("aria-label", "Contents actions");
  actionsTrigger.title = "Contents actions";
  actionsTrigger.append(createIcon("M3 8h.01M8 8h.01M13 8h.01"));
  const actionsMenu = document.createElement("div");
  actionsMenu.className = "ghcm-actions-menu";
  actionsMenu.append(collapseAllButton, expandAllButton);
  actionsDetails.append(actionsTrigger, actionsMenu);

  const outline = document.createElement("nav");
  outline.className = "ghcm-outline";
  outline.setAttribute("aria-label", "Page contents");

  const header = document.createElement("header");
  header.className = "ghcm-sidebar-header";

  const kicker = document.createElement("div");
  kicker.className = "ghcm-sidebar-kicker ghcm-drag-handle";
  kicker.textContent = "Contents";

  const toolbar = document.createElement("div");
  toolbar.className = "ghcm-sidebar-tools";
  toolbar.append(actionsDetails, closeButton);
  header.append(kicker, toolbar);

  panel.append(header, outline);
  root.append(trigger, panel);
  dockCell.append(root);
  dockRow.append(dockCell);

  return {
    dockRow, dockCell, root, trigger, dragHandle: kicker, panel, outline,
    collapseAllButton, expandAllButton, closeButton, actionsDetails, actionsTrigger, actionsMenu
  };
}

export function updatePanelDom(dom: PanelDomRefs, placement: PanelPlacement, open: boolean): void {
  const floating = placement === "overlay";
  for (const kind of ["docked", "inline", "overlay"] as const) {
    dom.root.classList.toggle(`is-${kind}`, placement === kind);
  }
  dom.trigger.classList.toggle("is-hidden", open);
  dom.trigger.setAttribute("aria-expanded", String(open));
  dom.panel.classList.toggle("is-open", open);
  dom.panel.hidden = !open;
  dom.dragHandle.tabIndex = floating ? 0 : -1;
  if (floating) {
    dom.panel.setAttribute("role", "dialog");
    dom.trigger.setAttribute("aria-haspopup", "dialog");
    dom.dragHandle.setAttribute("aria-label", "Move contents panel with arrow keys; hold Shift to move faster");
    dom.dragHandle.setAttribute("role", "group");
  } else {
    dom.panel.removeAttribute("role");
    dom.trigger.removeAttribute("aria-haspopup");
    dom.dragHandle.removeAttribute("aria-label");
    dom.dragHandle.removeAttribute("role");
  }
  const closeLabel = floating ? "Close contents" : "Hide contents";
  dom.closeButton.setAttribute("aria-label", closeLabel);
  dom.closeButton.title = closeLabel;
}

function createButton(className: string, textContent: string, ariaLabel?: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = textContent;
  if (ariaLabel) {
    button.setAttribute("aria-label", ariaLabel);
    button.title = ariaLabel;
  }
  return button;
}

function createIcon(pathData: string): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.75");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", pathData);
  icon.append(path);
  return icon;
}
