import type { DockedPanelLayoutContext } from "../core/types";

export interface DockedPanelMeasureElements {
  dockRow: HTMLElement;
  dockCell: HTMLElement;
  panel: HTMLElement;
  outline?: HTMLElement;
}

export interface DockedPanelFrameElements {
  dockRow: HTMLElement;
  root: HTMLElement;
}

export interface DockedPanelMeasurement {
  boundaryViewportBottom: number;
  cellLeft: number;
  cellWidth: number;
  naturalPanelHeight: number;
  rowViewportTop: number;
}

export interface DockedPanelFrame {
  mode: "flow" | "fixed";
  panelLeft: number;
  panelHeight: number;
  panelMaxHeight: number;
  panelTop: number;
  panelWidth: number;
  rowHeight: number;
}

const DOCKED_PANEL_BOUNDARY_BOTTOM_GAP = 30;
const DOCKED_PANEL_VIEWPORT_BOTTOM_GAP = 16;

function stylePixels(style: CSSStyleDeclaration, property: string): number {
  return Number.parseFloat(style.getPropertyValue(property)) || 0;
}

function verticalMargins(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  return stylePixels(style, "margin-top") + stylePixels(style, "margin-bottom");
}

function measureOutlineContentHeight(outline: HTMLElement): number {
  const style = window.getComputedStyle(outline);
  const lastChild = outline.lastElementChild;
  if (lastChild instanceof HTMLElement) {
    const contentBottom = lastChild.getBoundingClientRect().bottom - outline.getBoundingClientRect().top + outline.scrollTop;
    if (contentBottom > 0) {
      // A flexed navigation viewport can be taller or shorter than its contents.
      return contentBottom + stylePixels(window.getComputedStyle(lastChild), "margin-bottom") +
        stylePixels(style, "padding-bottom") + stylePixels(style, "border-bottom-width");
    }
  }

  return outline.scrollHeight + stylePixels(style, "border-top-width") + stylePixels(style, "border-bottom-width");
}

function measureNaturalPanelHeight({ panel, outline }: DockedPanelMeasureElements): number {
  const fallback = Math.max(panel.scrollHeight, panel.offsetHeight, 0);
  if (!outline || outline.parentElement !== panel) {
    return fallback;
  }

  const style = window.getComputedStyle(panel);
  const children = Array.from(panel.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  const contentHeight = children.reduce((height, child) => height + verticalMargins(child) +
    (child === outline ? measureOutlineContentHeight(outline) : child.offsetHeight), 0);
  const naturalHeight = contentHeight +
    stylePixels(style, "padding-top") + stylePixels(style, "padding-bottom") +
    stylePixels(style, "border-top-width") + stylePixels(style, "border-bottom-width") +
    stylePixels(style, "row-gap") * Math.max(children.length - 1, 0);

  return naturalHeight > 0 ? naturalHeight : fallback;
}

export function measureDockedPanel(
  elements: DockedPanelMeasureElements,
  context: DockedPanelLayoutContext
): DockedPanelMeasurement {
  const cellRect = elements.dockCell.getBoundingClientRect();
  const cellStyle = window.getComputedStyle(elements.dockCell);
  const inset = (property: string) => stylePixels(cellStyle, property);
  const leftInset = inset("padding-left") + inset("border-left-width");
  const rightInset = inset("padding-right") + inset("border-right-width");
  const topInset = inset("padding-top") + inset("border-top-width");
  const dockedBoundaryRect = context.boundary?.getBoundingClientRect();

  return {
    boundaryViewportBottom: dockedBoundaryRect
      ? dockedBoundaryRect.bottom - DOCKED_PANEL_BOUNDARY_BOTTOM_GAP
      : Number.POSITIVE_INFINITY,
    cellLeft: Math.max(cellRect.left + leftInset, 0),
    cellWidth: Math.max(cellRect.width - leftInset - rightInset, 0),
    naturalPanelHeight: measureNaturalPanelHeight(elements),
    rowViewportTop: cellRect.top + topInset
  };
}

export function computeDockedPanelFrame(
  measurement: DockedPanelMeasurement,
  topOffset: number,
  viewportHeight: number
): DockedPanelFrame {
  const viewportBottom = viewportHeight - DOCKED_PANEL_VIEWPORT_BOTTOM_GAP;
  const viewportMaxHeight = Math.max(viewportBottom - topOffset, 0);
  const preferredHeight = Math.min(measurement.naturalPanelHeight, viewportMaxHeight);

  if (measurement.rowViewportTop > topOffset) {
    return {
      mode: "flow",
      panelLeft: measurement.cellLeft,
      panelHeight: Math.max(Math.ceil(preferredHeight), 0),
      panelMaxHeight: viewportMaxHeight,
      panelTop: measurement.rowViewportTop,
      panelWidth: measurement.cellWidth,
      rowHeight: 0
    };
  }

  let panelTop = topOffset;

  if (measurement.boundaryViewportBottom < panelTop + preferredHeight) {
    panelTop = Math.max(measurement.rowViewportTop, measurement.boundaryViewportBottom - preferredHeight);
  }

  const panelMaxHeight = Math.max(Math.min(viewportBottom - panelTop, measurement.boundaryViewportBottom - panelTop), 0);
  const panelHeight = Math.max(Math.min(Math.ceil(measurement.naturalPanelHeight), Math.ceil(panelMaxHeight)), 0);

  return {
    mode: "fixed",
    panelLeft: measurement.cellLeft,
    panelHeight,
    panelMaxHeight,
    panelTop,
    panelWidth: measurement.cellWidth,
    rowHeight: panelHeight
  };
}

export function applyDockedPanelFrame(elements: DockedPanelFrameElements, frame: DockedPanelFrame): void {
  elements.root.classList.toggle("is-floating", frame.mode === "fixed");
  elements.root.style.setProperty("--ghcm-panel-height", `${frame.panelHeight}px`);
  elements.root.style.setProperty("--ghcm-panel-max-height", `${frame.panelMaxHeight}px`);

  if (frame.mode === "fixed") {
    elements.root.style.setProperty("--ghcm-panel-left", `${frame.panelLeft}px`);
    elements.root.style.setProperty("--ghcm-panel-top", `${frame.panelTop}px`);
    elements.root.style.setProperty("--ghcm-panel-width", `${frame.panelWidth}px`);
    elements.root.style.minHeight = frame.rowHeight > 0 ? `${frame.rowHeight}px` : "";
    elements.dockRow.style.minHeight = frame.rowHeight > 0 ? `${frame.rowHeight}px` : "";
    return;
  }

  elements.root.style.removeProperty("--ghcm-panel-left");
  elements.root.style.removeProperty("--ghcm-panel-top");
  elements.root.style.removeProperty("--ghcm-panel-width");
  elements.root.style.removeProperty("min-height");
  elements.dockRow.style.removeProperty("min-height");
}

export function clearDockedPanelFrame(elements: DockedPanelFrameElements): void {
  elements.root.classList.remove("is-floating");
  elements.root.style.removeProperty("--ghcm-panel-height");
  elements.root.style.removeProperty("--ghcm-panel-left");
  elements.root.style.removeProperty("--ghcm-panel-top");
  elements.root.style.removeProperty("--ghcm-panel-width");
  elements.root.style.removeProperty("--ghcm-panel-max-height");
  elements.root.style.removeProperty("min-height");
  elements.dockRow.style.removeProperty("min-height");
}
