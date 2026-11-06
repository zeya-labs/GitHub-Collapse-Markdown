import type { DockedPanelLayoutContext } from "../core/types";
import { isEditableElement, isVisibleElement } from "../utils/visibility";

const UNSAFE_PANEL_CONTEXT_SELECTOR = ".ghcm-root, nav, [role='navigation'], a, button, summary, [role='button']";
const INVALID_PANEL_HOST_TAGS = new Set(["P", "SPAN", "PRE", "CODE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL", "OL", "DL"]);

export type PanelPlacement = "overlay" | "docked" | "inline";

export type ResolvedPanelPlacement =
  | { kind: "overlay" }
  | { kind: "inline"; host: HTMLElement }
  | { kind: "docked"; context: DockedPanelLayoutContext };

export interface PanelPlacementResolvers {
  resolveDockedLayout?: () => DockedPanelLayoutContext | null;
  resolveInlineHost?: () => HTMLElement | null;
}

export function resolvePanelPlacement(desktop: boolean, resolvers: PanelPlacementResolvers): ResolvedPanelPlacement {
  const dockedLayout = desktop ? resolvers.resolveDockedLayout?.() ?? null : null;
  if (dockedLayout && isUsablePanelHost(dockedLayout.host)) {
    return {
      kind: "docked",
      context: dockedLayout
    };
  }

  const inlineHost = resolvers.resolveInlineHost?.() ?? null;
  if (inlineHost && isUsablePanelHost(inlineHost)) {
    return {
      kind: "inline",
      host: inlineHost
    };
  }

  return { kind: "overlay" };
}

export function isUsablePanelHost(element: HTMLElement): boolean {
  return !INVALID_PANEL_HOST_TAGS.has(element.tagName) && !element.closest(UNSAFE_PANEL_CONTEXT_SELECTOR) &&
    !isEditableElement(element) && isVisibleElement(element);
}

export function collectPlacementTargets(placement: ResolvedPanelPlacement): HTMLElement[] {
  if (placement.kind !== "docked") {
    return [];
  }

  const targets = [placement.context.host, placement.context.boundary].filter(
    (element): element is HTMLElement => Boolean(element)
  );

  return Array.from(new Set(targets));
}
