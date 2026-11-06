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
}

export function createPanelDom(): PanelDomRefs {
  const dockRow = document.createElement("div");
  dockRow.className = "ghcm-dock-row BorderGrid-row";

  const dockCell = document.createElement("div");
  dockCell.className = "ghcm-dock-cell BorderGrid-cell";

  const root = document.createElement("div");
  root.className = "ghcm-root";

  const cell = document.createElement("div");
  cell.className = "ghcm-cell";

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

  const closeButton = createButton("ghcm-inline-action ghcm-close-action", "Hide");

  const outline = document.createElement("nav");
  outline.className = "ghcm-outline";
  outline.setAttribute("aria-label", "Page contents");

  const shell = document.createElement("div");
  shell.className = "ghcm-sidebar-shell";

  const header = document.createElement("header");
  header.className = "ghcm-sidebar-header";

  const kicker = document.createElement("div");
  kicker.className = "ghcm-sidebar-kicker ghcm-drag-handle";
  kicker.textContent = "Contents";

  const toolbar = document.createElement("div");
  toolbar.className = "ghcm-sidebar-tools";
  toolbar.append(collapseAllButton, expandAllButton, closeButton);
  header.append(kicker, toolbar);

  const outlineShell = document.createElement("div");
  outlineShell.className = "ghcm-sidebar-outline";
  outlineShell.append(outline);

  shell.append(header, outlineShell);
  panel.append(shell);
  cell.append(trigger, panel);
  root.append(cell);
  dockCell.append(root);
  dockRow.append(dockCell);

  return { dockRow, dockCell, root, trigger, dragHandle: kicker, panel, outline, collapseAllButton, expandAllButton, closeButton };
}

function createButton(className: string, textContent: string, ariaLabel?: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = textContent;
  if (ariaLabel) {
    button.setAttribute("aria-label", ariaLabel);
  }
  return button;
}
