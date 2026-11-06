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
const GITHUB_DOCK_HOST_SELECTORS = [
  "rails-partial[data-partial-name='codeViewRepoRoute.Sidebar'] .BorderGrid",
  "rails-partial[data-partial-name='codeViewRepoRoute.Sidebar']",
  ".Layout-sidebar .BorderGrid",
  ".Layout-sidebar",
  "[data-testid='issue-metadata-pane']",
  "[data-testid='discussion-sidebar']",
  ".discussion-sidebar",
  "#wiki-rightbar"
];
const GITHUB_DOCK_BOUNDARY_SELECTORS = [
  "[class*='PageLayout-PaneWrapper']",
  "[class*='PageLayout-Pane-']",
  ".Layout-sidebar",
  "[data-testid='issue-metadata-pane']",
  "[data-testid='discussion-sidebar']",
  ".discussion-sidebar",
  "#wiki-rightbar"
];

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

    return isDockVisibilityMutation(mutation);
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
  return queryFirst(document, GITHUB_DOCK_HOST_SELECTORS);
}

function isDockVisibilityMutation(mutation: MutationRecord): boolean {
  const target = mutation.target instanceof HTMLElement ? mutation.target : null;
  if (mutation.type !== "attributes" || !target || isManagedNode(target) || target.closest(".ghcm-root, .ghcm-dock-row")) {
    return false;
  }

  const selector = GITHUB_DOCK_HOST_SELECTORS.join(", ");
  return target.matches(selector) || Boolean(target.querySelector(selector));
}

function resolveGitHubDockBoundary(host: HTMLElement): HTMLElement | null {
  return closestFirst(host, GITHUB_DOCK_BOUNDARY_SELECTORS);
}

function queryFirst(document: Document, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const match = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .find((element) => isVisibleElement(element) && !isEditableElement(element) &&
        !element.closest(".ghcm-root, nav, [role='navigation'], a, button, summary, [role='button']") &&
        !element.closest(GITHUB_CONTENT_ROOT_SELECTOR));
    if (match) {
      return match;
    }
  }

  return null;
}

function closestFirst(element: HTMLElement, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const match = element.closest<HTMLElement>(selector);
    if (match) {
      return match;
    }
  }

  return null;
}
