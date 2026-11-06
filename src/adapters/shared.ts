import type { ContainerKind, ContentContainer, SiteId } from "../core/types";
import { hasHeadings } from "../parsing/heading-dom";
import { isManagedNode } from "../utils/dom";
import { isEditableElement, isVisibleElement } from "../utils/visibility";

const EXCLUDED_CONTENT_CONTEXT = ".ghcm-root, nav, [role='navigation'], aside, header, footer, button, a, summary, [role='button']";

export function getLocationPageKey(location: Location): string {
  return `${location.hostname}${location.pathname}${location.search}`;
}

export function queryContentCandidates(
  document: Document,
  selector: string,
  excludeSelector = EXCLUDED_CONTENT_CONTEXT
): HTMLElement[] {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .filter((element) => !element.closest(excludeSelector) && !isEditableElement(element) && isVisibleElement(element))
    .filter((element) => hasHeadings(element));

  return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
}

export function buildContentContainers(
  siteId: SiteId,
  candidates: HTMLElement[],
  describe: (element: HTMLElement, index: number) => {
    id: string;
    label: string;
    kind: ContainerKind;
  }
): ContentContainer[] {
  const uniqueCandidates = uniqueCandidateElements(candidates);
  return uniqueCandidates.map((element, index) => {
    const descriptor = describe(element, index);
    return {
      key: `${siteId}:${descriptor.id}`,
      label: descriptor.label,
      kind: descriptor.kind,
      element
    };
  });
}

export function findFirstContentCandidate(
  document: Document,
  selector: string,
  excludeSelector = EXCLUDED_CONTENT_CONTEXT
): HTMLElement | null {
  return queryContentCandidates(document, selector, excludeSelector)[0] ?? null;
}

export function describeStaticContainer(id: string, label: string, kind: ContainerKind) {
  return () => ({
    id,
    label,
    kind
  });
}

export function shouldRefreshForContentMutation(
  mutation: MutationRecord,
  contentRootSelector: string
): boolean {
  const target = mutation.target instanceof HTMLElement ? mutation.target : mutation.target.parentElement;
  if (target?.closest(".ghcm-root, .ghcm-dock-row")) {
    return false;
  }

  if (mutation.type === "characterData") {
    return Boolean(target?.closest(contentRootSelector) && !target.closest(".ghcm-heading-toggle"));
  }

  if (mutation.type === "attributes") {
    return Boolean(target && !isManagedNode(target) && (
      target.closest(contentRootSelector) || target.querySelector(contentRootSelector)
    ));
  }

  if (mutation.type !== "childList") {
    return false;
  }

  const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
  if (changedNodes.some((node) => isContentMutationNode(node, contentRootSelector))) {
    return true;
  }

  if (!target?.closest(contentRootSelector)) {
    return false;
  }

  return changedNodes.some((node) => !isManagedNode(node));
}

function isContentMutationNode(node: Node, contentRootSelector: string): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  if (isManagedNode(node)) {
    return false;
  }

  return Boolean(node.matches?.(contentRootSelector) || node.querySelector?.(contentRootSelector));
}

function uniqueCandidateElements(candidates: HTMLElement[]): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  return candidates.filter((element) => {
    if (seen.has(element)) {
      return false;
    }

    seen.add(element);
    return true;
  });
}
