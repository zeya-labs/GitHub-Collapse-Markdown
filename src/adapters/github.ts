import type { ContainerKind, SiteAdapter } from "../core/types";
import { buildContentContainers, getLocationPageKey, queryContentCandidates, shouldRefreshForContentMutation } from "./shared";
import { isEditableElement, isVisibleElement } from "../utils/visibility";
import { isManagedNode } from "../utils/dom";

const README_SELECTOR = "#readme";
const ISSUE_BODY_SELECTOR = "[data-testid='issue-body']";
const PR_BODY_SELECTOR = "[id^='pullrequest-']";
const COMMENT_SELECTOR = "[id^='issuecomment-']";
const STICKY_HEADER_SELECTOR = [
  "header[role='banner']",
  ".AppHeader",
  ".Header"
].join(", ");
const GITHUB_CONTENT_ROOT_SELECTOR = ".markdown-body, [data-testid='markdown-body'], [data-testid='markdown-preview']";
const GITHUB_SIDEBAR_SELECTORS = [
  "rails-partial[data-partial-name='codeViewRepoRoute.Sidebar']",
  ".Layout-sidebar",
  "[data-testid='issue-metadata-pane']",
  "[data-testid='discussion-sidebar']",
  ".discussion-sidebar",
  "#wiki-rightbar",
  "[data-component='SplitPageLayout.Pane']",
  "[class*='PageLayout-Pane-']"
];
const GITHUB_SIDEBAR_SELECTOR = GITHUB_SIDEBAR_SELECTORS.join(", ");
const MODERN_PANE_SELECTOR = "[data-component='SplitPageLayout.Pane'], [class*='PageLayout-Pane-']";
const METADATA_GRID_SELECTOR = ".BorderGrid, [class*='borderGrid__']";
const UNSAFE_DOCK_CONTEXT_SELECTOR = ".ghcm-root, nav, [role='navigation'], a, button, summary, [role='button']";

interface GitHubContainerDescriptor {
  id?: string;
  kind: ContainerKind;
  label: string;
  numbered?: boolean;
}

function isGitHubRootHomePath(location: Location): boolean {
  return location.pathname === "/";
}

function isGitHubWikiPath(location: Location): boolean {
  return /\/wiki(?:\/|$)/.test(location.pathname);
}

function describeGitHubContainer(element: HTMLElement, location: Location): GitHubContainerDescriptor {
  if (element.closest(README_SELECTOR)) {
    return {
      id: "readme",
      kind: "markdown",
      label: "README"
    };
  }

  const comment = element.closest<HTMLElement>(COMMENT_SELECTOR);
  if (comment?.id) {
    return {
      id: `comment:${comment.id.replace(/^issuecomment-/, "")}`,
      kind: "comment",
      label: "Comment",
      numbered: true
    };
  }

  const discussionComment = element.closest<HTMLElement>("[id^='discussioncomment-']");
  if (discussionComment?.id) {
    return {
      id: `discussion-comment:${discussionComment.id.replace(/^discussioncomment-/, "")}`,
      kind: "comment", label: "Discussion comment", numbered: true
    };
  }

  const reviewComment = element.closest<HTMLElement>("[id^='discussion_r']");
  if (reviewComment?.id) {
    return {
      id: `review-comment:${reviewComment.id.replace(/^discussion_r/, "")}`,
      kind: "comment", label: "Review comment", numbered: true
    };
  }

  const preview = element.closest<HTMLElement>(".js-preview-body, [data-testid='markdown-preview']");
  if (preview) {
    return { id: preview.id ? `preview:${preview.id}` : undefined, kind: "markdown", label: "Preview", numbered: true };
  }

  const review = element.closest<HTMLElement>("[id^='pullrequestreview-']");
  if (review?.id) {
    return {
      id: `review:${review.id.replace(/^pullrequestreview-/, "")}`,
      kind: "comment", label: "Review", numbered: true
    };
  }

  if (element.closest(ISSUE_BODY_SELECTOR)) {
    return {
      id: "issue-body",
      kind: "markdown",
      label: "Issue / PR Body"
    };
  }

  if (element.closest(PR_BODY_SELECTOR)) {
    return {
      id: "pull-request-body",
      kind: "markdown",
      label: "Issue / PR Body"
    };
  }

  const discussion = element.closest<HTMLElement>("[data-testid='discussion-body'], [id^='discussion-']");
  if (discussion) {
    return { id: discussion.id || "discussion-body", kind: "markdown", label: "Discussion" };
  }

  const release = element.closest<HTMLElement>(".release-entry, [data-testid='release-card']");
  if (release) {
    const tagLink = release.querySelector<HTMLAnchorElement>("a[href*='/releases/tag/']");
    const tag = tagLink ? new URL(tagLink.href, location.href).pathname.split("/releases/tag/")[1] : null;
    return {
      id: tag ? `release:${tag}` : release.id ? `release:${release.id}` : undefined,
      kind: "markdown", label: "Release", numbered: true
    };
  }

  if (isGitHubWikiPath(location)) {
    return {
      id: "wiki",
      kind: "markdown",
      label: "Wiki"
    };
  }

  return {
    kind: "markdown",
    label: "Document",
    numbered: true
  };
}

export const githubAdapter: SiteAdapter = {
  id: "github",
  matches(location) {
    return location.hostname === "github.com" && !isGitHubRootHomePath(location);
  },
  getPageKey(location) {
    return getLocationPageKey(location);
  },
  findContainers(document) {
    const candidates = queryContentCandidates(document, GITHUB_CONTENT_ROOT_SELECTOR);
    const counts = new Map<string, number>();

    return buildContentContainers("github", candidates, (element) => {
      const descriptor = describeGitHubContainer(element, document.location);
      const sequence = (counts.get(descriptor.label) ?? 0) + 1;
      counts.set(descriptor.label, sequence);
      return {
        id: descriptor.id ?? `${descriptor.label.toLowerCase().replace(/\s+/g, "-")}:${sequence}`,
        label: descriptor.numbered ? `${descriptor.label} ${sequence}` : descriptor.label,
        kind: descriptor.kind
      };
    });
  },
  shouldRefreshForMutation(mutation) {
    if (shouldRefreshForContentMutation(mutation, GITHUB_CONTENT_ROOT_SELECTOR)) {
      return true;
    }

    return shouldRefreshForSidebarMutation(mutation);
  },
  getStickyHeaderOffset(document) {
    const sticky = document.querySelector<HTMLElement>(STICKY_HEADER_SELECTOR);
    return (sticky?.offsetHeight ?? 72) + 18;
  },
  getDockedPanelLayout(document) {
    const host = resolveGitHubDockHost(document);
    if (!host) {
      return null;
    }

    return {
      host,
      boundary: resolveGitHubDockBoundary(host),
      topOffset: this.getStickyHeaderOffset(document)
    };
  }
};

function resolveGitHubDockHost(document: Document): HTMLElement | null {
  const visited = new Set<HTMLElement>();
  for (const selector of GITHUB_SIDEBAR_SELECTORS) {
    for (const candidate of document.querySelectorAll<HTMLElement>(selector)) {
      if (!isMetadataSidebar(candidate)) {
        continue;
      }

      const sidebar = resolveSidebarOwner(candidate);
      if (visited.has(sidebar)) {
        continue;
      }
      visited.add(sidebar);

      const host = resolveCompleteSidebarHost(sidebar);
      if (isSafeDockHost(host)) {
        return host;
      }
    }
  }

  return null;
}

function shouldRefreshForSidebarMutation(mutation: MutationRecord): boolean {
  const target = mutation.target instanceof HTMLElement ? mutation.target : null;
  if (!target || isManagedNode(target) || target.closest(".ghcm-root, .ghcm-dock-row")) {
    return false;
  }

  if (mutation.type === "attributes") {
    return target.matches(GITHUB_SIDEBAR_SELECTOR) || Boolean(target.querySelector(GITHUB_SIDEBAR_SELECTOR));
  }

  if (mutation.type !== "childList") {
    return false;
  }

  const nativeElements = [...mutation.addedNodes, ...mutation.removedNodes]
    .filter((node): node is HTMLElement => node instanceof HTMLElement && !isManagedNode(node));

  // GitHub can hydrate or replace metadata after the Markdown is already mounted.
  return nativeElements.some((element) =>
    element.matches(GITHUB_SIDEBAR_SELECTOR) || Boolean(element.querySelector(GITHUB_SIDEBAR_SELECTOR))
  ) || (nativeElements.length > 0 && Boolean(target.closest(GITHUB_SIDEBAR_SELECTOR)));
}

function resolveGitHubDockBoundary(host: HTMLElement): HTMLElement | null {
  const sidebar = resolveSidebarOwner(host);
  const contentRoots = queryContentCandidates(host.ownerDocument, GITHUB_CONTENT_ROOT_SELECTOR)
    .filter((element) => !sidebar.contains(element));

  // The sidebar can be min-content tall. Follow the entire reading region instead.
  for (let ancestor = sidebar.parentElement; ancestor && ancestor !== host.ownerDocument.body; ancestor = ancestor.parentElement) {
    if (contentRoots.some((element) => ancestor.contains(element))) {
      return ancestor;
    }
  }

  return null;
}

function isMetadataSidebar(element: HTMLElement): boolean {
  return !element.matches(MODERN_PANE_SELECTOR) || Boolean(element.querySelector(METADATA_GRID_SELECTOR));
}

function resolveSidebarOwner(element: HTMLElement): HTMLElement {
  let sidebar = element.closest<HTMLElement>(GITHUB_SIDEBAR_SELECTOR) ?? element;
  for (let ancestor = sidebar.parentElement?.closest<HTMLElement>(GITHUB_SIDEBAR_SELECTOR);
    ancestor;
    ancestor = ancestor.parentElement?.closest<HTMLElement>(GITHUB_SIDEBAR_SELECTOR)) {
    if (isMetadataSidebar(ancestor)) {
      sidebar = ancestor;
    }
  }

  return sidebar;
}

function resolveCompleteSidebarHost(sidebar: HTMLElement): HTMLElement {
  const grid = sidebar.querySelector<HTMLElement>(".BorderGrid");
  if (!grid) {
    return sidebar;
  }

  // Reuse native table rows only when this grid owns every metadata section.
  let branch: Node = grid;
  for (let parent = grid.parentElement; parent; parent = parent.parentElement) {
    const hasOtherContent = Array.from(parent.childNodes).some((node) => {
      if (node === branch || isManagedNode(node) || node.nodeType === Node.COMMENT_NODE) {
        return false;
      }
      if (node instanceof HTMLElement) {
        return !node.matches("script, style, template");
      }
      return Boolean(node.textContent?.trim());
    });
    if (hasOtherContent) {
      return sidebar;
    }
    if (parent === sidebar) {
      return grid;
    }
    branch = parent;
  }

  return sidebar;
}

function isSafeDockHost(element: HTMLElement): boolean {
  return isVisibleElement(element) && !isEditableElement(element) &&
    !element.closest(UNSAFE_DOCK_CONTEXT_SELECTOR) && !element.closest(GITHUB_CONTENT_ROOT_SELECTOR);
}
