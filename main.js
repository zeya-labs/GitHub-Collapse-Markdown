// ==UserScript==
// @name        GitHub Collapse Markdown
// @version     5.2.3
// @description GitHub Markdown 标题折叠脚本，支持大纲、状态记忆与现代 GitHub 页面
// @license     MIT
// @author      Xyea
// @namespace   https://github.com/Xyea/GitHub-Collapse-Markdown
// @homepageURL https://github.com/zeya-labs/GitHub-Collapse-Markdown
// @supportURL  https://github.com/zeya-labs/GitHub-Collapse-Markdown/issues
// @updateURL   https://raw.githubusercontent.com/zeya-labs/GitHub-Collapse-Markdown/main/main.js
// @downloadURL https://raw.githubusercontent.com/zeya-labs/GitHub-Collapse-Markdown/main/main.js
// @match       https://github.com/*
// @match       https://gist.github.com/*
// @match       https://help.github.com/*
// @match       https://docs.github.com/*
// @match       https://support.github.com/*
// @run-at      document-idle
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @noframes
// @icon        https://github.githubassets.com/pinned-octocat.svg
// ==/UserScript==

"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/utils/strings.ts
  function normalizeWhitespace(text) {
    return text.replace(/\s+/g, " ").trim();
  }
  function slugify(text) {
    return normalizeWhitespace(text).toLowerCase().replace(/[`'"!?.,()[\]{}:;<>/@#$%^&*+=~|\\]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  // src/parsing/heading-dom.ts
  var HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6";
  function getHeadingLevel(element) {
    return Number(element.tagName.slice(1));
  }
  function getHeadingBlock(element) {
    return element.closest(".markdown-heading") ?? element;
  }
  function getHeadingText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("a.anchor, .heading-link-symbol, svg, .octicon-link, .ghcm-heading-toggle").forEach((node) => node.remove());
    return normalizeWhitespace(clone.textContent ?? "");
  }
  function getHeadingAnchor(element, fallbackIndex) {
    const wrapperAnchor = element.closest(".markdown-heading")?.querySelector("a.anchor");
    if (wrapperAnchor?.hash) {
      return wrapperAnchor.hash.replace(/^#/, "");
    }
    const inlineAnchor = element.querySelector("a.anchor, a.heading-link") ?? element.closest("h1,h2,h3,h4,h5,h6")?.querySelector("a.anchor, a.heading-link");
    if (inlineAnchor?.hash) {
      return inlineAnchor.hash.replace(/^#/, "");
    }
    if (element.id) {
      return element.id;
    }
    return slugify(getHeadingText(element)) || `heading-${fallbackIndex + 1}`;
  }
  function queryHeadings(container) {
    return Array.from(container.querySelectorAll(HEADING_SELECTOR)).filter((heading) => {
      if (!getHeadingText(heading)) {
        return false;
      }
      if (heading.closest(".ghcm-root")) {
        return false;
      }
      if (heading.closest("nav, aside, header, footer, [data-container='toc']")) {
        return false;
      }
      return true;
    });
  }
  function hasHeadings(container) {
    return queryHeadings(container).length > 0;
  }

  // src/utils/dom.ts
  function getPreferredScrollBehavior() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  }
  function scrollToElementWithOffset(element, offset) {
    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top: Math.max(top, 0),
      behavior: getPreferredScrollBehavior()
    });
  }
  function isInteractiveTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(target.closest("a, button, input, textarea, select, summary, details, [role='button']"));
  }
  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(target.closest("input, textarea, [contenteditable=''], [contenteditable='true'], [role='textbox']"));
  }
  function isManagedNode(node) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    if (node.classList.contains("ghcm-root") || node.classList.contains("ghcm-heading-toggle")) {
      return true;
    }
    return Array.from(node.classList).some((className) => className.startsWith("ghcm-"));
  }
  function getSelectionText() {
    return normalizeWhitespace(window.getSelection?.()?.toString() ?? "");
  }

  // src/utils/visibility.ts
  var HIDDEN_CONTEXT_SELECTOR = "[hidden], [aria-hidden='true'], [inert], template, details:not([open])";
  var EDITABLE_CONTEXT_SELECTOR = "textarea, input, select, [contenteditable]:not([contenteditable='false']), [role='textbox']";
  function isVisibleElement(element) {
    if (!element.isConnected || element.closest(HIDDEN_CONTEXT_SELECTOR)) {
      return false;
    }
    const view = element.ownerDocument.defaultView;
    if (!view) {
      return false;
    }
    for (let current = element; current; current = current.parentElement) {
      const style = view.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") {
        return false;
      }
    }
    if (element.ownerDocument.documentElement.clientWidth > 0 && view.getComputedStyle(element).display !== "contents" && element.getBoundingClientRect().width <= 0) {
      return false;
    }
    return true;
  }
  function isEditableElement(element) {
    return Boolean(element.closest(EDITABLE_CONTEXT_SELECTOR));
  }

  // src/adapters/shared.ts
  var EXCLUDED_CONTENT_CONTEXT = ".ghcm-root, nav, [role='navigation'], aside, header, footer, button, a, summary, [role='button']";
  function getLocationPageKey(location) {
    return `${location.hostname}${location.pathname}${location.search}`;
  }
  function queryContentCandidates(document2, selector, excludeSelector = EXCLUDED_CONTENT_CONTEXT) {
    const candidates = Array.from(document2.querySelectorAll(selector)).filter((element) => !element.closest(excludeSelector) && !isEditableElement(element) && isVisibleElement(element)).filter((element) => hasHeadings(element));
    return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
  }
  function buildContentContainers(siteId, candidates, describe) {
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
  function findFirstContentCandidate(document2, selector, excludeSelector = EXCLUDED_CONTENT_CONTEXT) {
    return queryContentCandidates(document2, selector, excludeSelector)[0] ?? null;
  }
  function describeStaticContainer(id, label, kind) {
    return () => ({
      id,
      label,
      kind
    });
  }
  function shouldRefreshForContentMutation(mutation, contentRootSelector) {
    const target = mutation.target instanceof HTMLElement ? mutation.target : mutation.target.parentElement;
    if (target?.closest(".ghcm-root, .ghcm-dock-row")) {
      return false;
    }
    if (mutation.type === "characterData") {
      return Boolean(target?.closest(contentRootSelector) && !target.closest(".ghcm-heading-toggle"));
    }
    if (mutation.type === "attributes") {
      return Boolean(target && !isManagedNode(target) && (target.closest(contentRootSelector) || target.querySelector(contentRootSelector)));
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
  function isContentMutationNode(node, contentRootSelector) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    if (isManagedNode(node)) {
      return false;
    }
    return Boolean(node.matches?.(contentRootSelector) || node.querySelector?.(contentRootSelector));
  }
  function uniqueCandidateElements(candidates) {
    const seen = /* @__PURE__ */ new Set();
    return candidates.filter((element) => {
      if (seen.has(element)) {
        return false;
      }
      seen.add(element);
      return true;
    });
  }

  // src/adapters/docs.ts
  var DOCS_HOSTS = /* @__PURE__ */ new Set(["docs.github.com", "help.github.com", "support.github.com"]);
  var DOCS_ARTICLE_SELECTOR = [
    "[data-container='article'] .markdown-body",
    "#article-contents .markdown-body",
    "main article .markdown-body",
    "main .markdown-body"
  ].join(", ");
  var docsAdapter = {
    id: "docs",
    matches(location) {
      return DOCS_HOSTS.has(location.hostname);
    },
    getPageKey(location) {
      return getLocationPageKey(location);
    },
    findContainers(document2) {
      const article = findFirstContentCandidate(document2, DOCS_ARTICLE_SELECTOR);
      if (!article) {
        return [];
      }
      return buildContentContainers("docs", [article], describeStaticContainer("article", "Docs Article", "article"));
    },
    shouldRefreshForMutation(mutation) {
      return shouldRefreshForContentMutation(mutation, DOCS_ARTICLE_SELECTOR);
    },
    getStickyHeaderOffset(document2) {
      const sticky = document2.querySelector("header[role='banner']");
      return (sticky?.offsetHeight ?? 80) + 24;
    }
  };

  // src/adapters/gist.ts
  var GIST_CONTENT_ROOT_SELECTOR = ".markdown-body";
  var gistAdapter = {
    id: "gist",
    matches(location) {
      return location.hostname === "gist.github.com";
    },
    getPageKey(location) {
      return getLocationPageKey(location);
    },
    findContainers(document2) {
      return buildContentContainers(
        "gist",
        queryContentCandidates(document2, GIST_CONTENT_ROOT_SELECTOR),
        (_element, index) => ({
          id: index === 0 ? "gist" : `gist:${index + 1}`,
          label: index === 0 ? "Gist" : `Gist Section ${index + 1}`,
          kind: "markdown"
        })
      );
    },
    shouldRefreshForMutation(mutation) {
      return shouldRefreshForContentMutation(mutation, GIST_CONTENT_ROOT_SELECTOR);
    },
    getStickyHeaderOffset(document2) {
      const sticky = document2.querySelector("header[role='banner'], .Header");
      return (sticky?.offsetHeight ?? 64) + 18;
    }
  };

  // src/adapters/github.ts
  var README_SELECTOR = "#readme";
  var ISSUE_BODY_SELECTOR = "[data-testid='issue-body']";
  var PR_BODY_SELECTOR = "[id^='pullrequest-']";
  var COMMENT_SELECTOR = "[id^='issuecomment-']";
  var STICKY_HEADER_SELECTOR = [
    "header[role='banner']",
    ".AppHeader",
    ".Header"
  ].join(", ");
  var GITHUB_CONTENT_ROOT_SELECTOR = ".markdown-body, [data-testid='markdown-body'], [data-testid='markdown-preview']";
  var GITHUB_SIDEBAR_SELECTORS = [
    "rails-partial[data-partial-name='codeViewRepoRoute.Sidebar']",
    ".Layout-sidebar",
    "[data-testid='issue-metadata-pane']",
    "[data-testid='discussion-sidebar']",
    ".discussion-sidebar",
    "#wiki-rightbar",
    "[data-component='SplitPageLayout.Pane']",
    "[class*='PageLayout-Pane-']"
  ];
  var GITHUB_SIDEBAR_SELECTOR = GITHUB_SIDEBAR_SELECTORS.join(", ");
  var MODERN_PANE_SELECTOR = "[data-component='SplitPageLayout.Pane'], [class*='PageLayout-Pane-']";
  var METADATA_GRID_SELECTOR = ".BorderGrid, [class*='borderGrid__']";
  var UNSAFE_DOCK_CONTEXT_SELECTOR = ".ghcm-root, nav, [role='navigation'], a, button, summary, [role='button']";
  function isGitHubRootHomePath(location) {
    return location.pathname === "/";
  }
  function isGitHubWikiPath(location) {
    return /\/wiki(?:\/|$)/.test(location.pathname);
  }
  function describeGitHubContainer(element, location) {
    if (element.closest(README_SELECTOR)) {
      return {
        id: "readme",
        kind: "markdown",
        label: "README"
      };
    }
    const comment = element.closest(COMMENT_SELECTOR);
    if (comment?.id) {
      return {
        id: `comment:${comment.id.replace(/^issuecomment-/, "")}`,
        kind: "comment",
        label: "Comment",
        numbered: true
      };
    }
    const discussionComment = element.closest("[id^='discussioncomment-']");
    if (discussionComment?.id) {
      return {
        id: `discussion-comment:${discussionComment.id.replace(/^discussioncomment-/, "")}`,
        kind: "comment",
        label: "Discussion comment",
        numbered: true
      };
    }
    const reviewComment = element.closest("[id^='discussion_r']");
    if (reviewComment?.id) {
      return {
        id: `review-comment:${reviewComment.id.replace(/^discussion_r/, "")}`,
        kind: "comment",
        label: "Review comment",
        numbered: true
      };
    }
    const preview = element.closest(".js-preview-body, [data-testid='markdown-preview']");
    if (preview) {
      return { id: preview.id ? `preview:${preview.id}` : void 0, kind: "markdown", label: "Preview", numbered: true };
    }
    const review = element.closest("[id^='pullrequestreview-']");
    if (review?.id) {
      return {
        id: `review:${review.id.replace(/^pullrequestreview-/, "")}`,
        kind: "comment",
        label: "Review",
        numbered: true
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
    const discussion = element.closest("[data-testid='discussion-body'], [id^='discussion-']");
    if (discussion) {
      return { id: discussion.id || "discussion-body", kind: "markdown", label: "Discussion" };
    }
    const release = element.closest(".release-entry, [data-testid='release-card']");
    if (release) {
      const tagLink = release.querySelector("a[href*='/releases/tag/']");
      const tag = tagLink ? new URL(tagLink.href, location.href).pathname.split("/releases/tag/")[1] : null;
      return {
        id: tag ? `release:${tag}` : release.id ? `release:${release.id}` : void 0,
        kind: "markdown",
        label: "Release",
        numbered: true
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
  var githubAdapter = {
    id: "github",
    matches(location) {
      return location.hostname === "github.com" && !isGitHubRootHomePath(location);
    },
    getPageKey(location) {
      return getLocationPageKey(location);
    },
    findContainers(document2) {
      const candidates = queryContentCandidates(document2, GITHUB_CONTENT_ROOT_SELECTOR);
      const counts = /* @__PURE__ */ new Map();
      return buildContentContainers("github", candidates, (element) => {
        const descriptor = describeGitHubContainer(element, document2.location);
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
    getStickyHeaderOffset(document2) {
      const sticky = document2.querySelector(STICKY_HEADER_SELECTOR);
      return (sticky?.offsetHeight ?? 72) + 18;
    },
    getDockedPanelLayout(document2) {
      const host = resolveGitHubDockHost(document2);
      if (!host) {
        return null;
      }
      return {
        host,
        boundary: resolveGitHubDockBoundary(host),
        topOffset: this.getStickyHeaderOffset(document2)
      };
    }
  };
  function resolveGitHubDockHost(document2) {
    const visited = /* @__PURE__ */ new Set();
    for (const selector of GITHUB_SIDEBAR_SELECTORS) {
      for (const candidate of document2.querySelectorAll(selector)) {
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
  function isDockVisibilityMutation(mutation) {
    const target = mutation.target instanceof HTMLElement ? mutation.target : null;
    if (mutation.type !== "attributes" || !target || isManagedNode(target) || target.closest(".ghcm-root, .ghcm-dock-row")) {
      return false;
    }
    return target.matches(GITHUB_SIDEBAR_SELECTOR) || Boolean(target.querySelector(GITHUB_SIDEBAR_SELECTOR));
  }
  function resolveGitHubDockBoundary(host) {
    const sidebar = resolveSidebarOwner(host);
    const contentRoots = queryContentCandidates(host.ownerDocument, GITHUB_CONTENT_ROOT_SELECTOR).filter((element) => !sidebar.contains(element));
    for (let ancestor = sidebar.parentElement; ancestor && ancestor !== host.ownerDocument.body; ancestor = ancestor.parentElement) {
      if (contentRoots.some((element) => ancestor.contains(element))) {
        return ancestor;
      }
    }
    return null;
  }
  function isMetadataSidebar(element) {
    return !element.matches(MODERN_PANE_SELECTOR) || Boolean(element.querySelector(METADATA_GRID_SELECTOR));
  }
  function resolveSidebarOwner(element) {
    let sidebar = element.closest(GITHUB_SIDEBAR_SELECTOR) ?? element;
    for (let ancestor = sidebar.parentElement?.closest(GITHUB_SIDEBAR_SELECTOR); ancestor; ancestor = ancestor.parentElement?.closest(GITHUB_SIDEBAR_SELECTOR)) {
      if (isMetadataSidebar(ancestor)) {
        sidebar = ancestor;
      }
    }
    return sidebar;
  }
  function resolveCompleteSidebarHost(sidebar) {
    const grid = sidebar.querySelector(".BorderGrid");
    if (!grid) {
      return sidebar;
    }
    let branch = grid;
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
  function isSafeDockHost(element) {
    return isVisibleElement(element) && !isEditableElement(element) && !element.closest(UNSAFE_DOCK_CONTEXT_SELECTOR) && !element.closest(GITHUB_CONTENT_ROOT_SELECTOR);
  }

  // src/adapters/index.ts
  var adapters = [githubAdapter, gistAdapter, docsAdapter];

  // src/core/revisions.ts
  function serializeContainerIdentity(container) {
    return `${container.key}:${container.kind}`;
  }
  function serializeContainerDisplay(container) {
    return `${serializeContainerIdentity(container)}:${container.label}`;
  }
  function serializeHeadingIdentity(heading) {
    return [
      heading.key,
      serializeContainerIdentity(heading.container),
      heading.anchor,
      heading.level,
      heading.parentKey ?? "root"
    ].join(":");
  }
  function buildHeadingIdentityRevision(headings) {
    return headings.map((heading) => serializeHeadingIdentity(heading)).join("|");
  }
  function buildHeadingDisplayRevision(headings) {
    return headings.map((heading) => `${serializeHeadingIdentity(heading)}:${serializeContainerDisplay(heading.container)}:${heading.text}`).join("|");
  }
  function buildPageIdentityRevision(siteId, pageKey, headings) {
    const headingRevision = buildHeadingIdentityRevision(headings);
    return `${siteId}:${pageKey}:${headingRevision || "empty"}`;
  }
  function buildPageDisplayRevision(siteId, pageKey, headings) {
    const headingRevision = buildHeadingDisplayRevision(headings);
    return `${siteId}:${pageKey}:${headingRevision || "empty"}`;
  }
  function buildPageVersion(siteId, pageKey, headings) {
    return {
      structure: buildPageIdentityRevision(siteId, pageKey, headings),
      display: buildPageDisplayRevision(siteId, pageKey, headings)
    };
  }
  function hasSamePageStructure(left, right) {
    return left?.structure === right.structure;
  }
  function hasSamePageDisplay(left, right) {
    return left?.display === right.display;
  }

  // src/platform/userscript.ts
  function createUserscriptValueStore(storage = window.localStorage) {
    if (canUseGMValueStore()) {
      return {
        read(key, fallback) {
          return GM_getValue(key, fallback);
        },
        write(key, value) {
          GM_setValue(key, value);
        }
      };
    }
    return {
      read(key, fallback) {
        const raw = storage.getItem(key);
        if (!raw) {
          return fallback;
        }
        try {
          return JSON.parse(raw);
        } catch {
          return fallback;
        }
      },
      write(key, value) {
        storage.setItem(key, JSON.stringify(value));
      }
    };
  }
  function injectUserscriptStyle(css) {
    if (typeof GM_addStyle !== "function") {
      return false;
    }
    GM_addStyle(css);
    return true;
  }
  function registerUserscriptMenuCommand(name, listener) {
    if (typeof GM_registerMenuCommand !== "function") {
      return false;
    }
    GM_registerMenuCommand(name, listener);
    return true;
  }
  function canUseGMValueStore() {
    return typeof GM_getValue === "function" && typeof GM_setValue === "function";
  }

  // src/core/page-state.ts
  function createEmptyPageState() {
    return {
      collapsedByContainer: {}
    };
  }
  function normalizePageState(pageState) {
    const collapsedByContainer = {};
    for (const [containerKey, collapsedKeys] of Object.entries(pageState?.collapsedByContainer ?? {})) {
      collapsedByContainer[containerKey] = [...collapsedKeys];
    }
    return {
      collapsedByContainer
    };
  }
  function isEmptyPageState(pageState) {
    return Object.values(pageState.collapsedByContainer).every((collapsedKeys) => collapsedKeys.length === 0);
  }
  function serializePageState(pageState) {
    return Object.entries(pageState.collapsedByContainer).filter(([, collapsedKeys]) => collapsedKeys.length > 0).sort(([left], [right]) => left.localeCompare(right)).map(([containerKey, collapsedKeys]) => `${containerKey}:${collapsedKeys.join(",")}`).join("|");
  }
  function arePageStatesEqual(left, right) {
    return serializePageState(normalizePageState(left)) === serializePageState(normalizePageState(right));
  }

  // src/core/storage.ts
  var STORAGE_KEY = "ghcm-v5-state";
  var defaultState = {
    version: 2,
    pages: {}
  };
  function cloneState(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }
  var StorageService = class {
    constructor(store = createUserscriptValueStore()) {
      __publicField(this, "state");
      __publicField(this, "store");
      this.store = store;
      this.state = this.read();
    }
    getPageState(pageKey) {
      return cloneState(this.state.pages[pageKey] ?? createEmptyPageState());
    }
    setPageState(pageKey, pageState) {
      const normalized = normalizePageState(pageState);
      if (isEmptyPageState(normalized)) {
        if (!(pageKey in this.state.pages)) {
          return;
        }
        delete this.state.pages[pageKey];
        this.write();
        return;
      }
      if (arePageStatesEqual(this.state.pages[pageKey], normalized)) {
        return;
      }
      this.state.pages[pageKey] = normalized;
      this.write();
    }
    clearPage(pageKey) {
      if (!(pageKey in this.state.pages)) {
        return;
      }
      delete this.state.pages[pageKey];
      this.write();
    }
    read() {
      const stored = this.store.read(STORAGE_KEY, null);
      if (!stored) {
        return cloneState(defaultState);
      }
      if (stored.version === 2) {
        const current = stored;
        return {
          ...cloneState(defaultState),
          ...current,
          pages: normalizePages(current.pages)
        };
      }
      if (stored.version === 1) {
        const legacy = stored;
        return {
          ...cloneState(defaultState),
          pages: normalizePages(legacy.pages)
        };
      }
      return cloneState(defaultState);
    }
    write() {
      this.store.write(STORAGE_KEY, cloneState(this.state));
    }
  };
  function normalizePages(pages) {
    const normalized = {};
    for (const [key, value] of Object.entries(pages ?? {})) {
      normalized[key] = normalizePageState(value);
    }
    return normalized;
  }

  // src/ui/styles/base.ts
  var baseStyles = `
  .ghcm-root {
    all: initial;
    display: block;
    width: 100%;
    min-width: 0;
    font: inherit;
    color: var(--fgColor-default, var(--color-fg-default, inherit));
    --ghcm-space-1: var(--base-size-4, 4px);
    --ghcm-space-2: var(--base-size-8, 8px);
    --ghcm-space-4: var(--base-size-16, 16px);
    --ghcm-ink: var(--fgColor-default, var(--color-fg-default, currentColor));
    --ghcm-ink-soft: var(--fgColor-muted, var(--color-fg-muted, #59636e));
    --ghcm-ink-muted: var(--ghcm-ink-soft);
    --ghcm-line: var(--borderColor-default, var(--color-border-default, #d0d7de));
    --ghcm-surface: var(--bgColor-default, var(--color-canvas-default, #ffffff));
    --ghcm-hover: var(--control-transparent-bgColor-hover, var(--color-action-list-item-default-hover-bg, rgba(129, 139, 152, 0.1)));
    --ghcm-pressed: var(--control-transparent-bgColor-active, var(--color-action-list-item-default-active-bg, rgba(129, 139, 152, 0.15)));
    --ghcm-radius: var(--borderRadius-medium, 6px);
    --ghcm-accent: var(--fgColor-accent, var(--color-accent-fg, #0969da));
  }

  .ghcm-root,
  .ghcm-root *,
  .ghcm-root *::before,
  .ghcm-root *::after {
    box-sizing: border-box;
  }

  .ghcm-root button {
    font-family: inherit;
  }

  .ghcm-root :is(button, summary) {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .ghcm-root :is(.ghcm-trigger, .ghcm-actions-trigger, .ghcm-close-action, .ghcm-inline-action, .ghcm-outline-link, .ghcm-drag-handle):focus-visible {
    outline: 2px solid var(--focus-outlineColor, var(--ghcm-accent));
    outline-offset: -2px;
  }

  .ghcm-dock-row,
  .ghcm-dock-cell {
    overflow: visible;
  }

  .ghcm-dock-row:not(.BorderGrid-row) {
    margin-top: var(--base-size-16, 16px);
    padding-top: var(--base-size-16, 16px);
    border-top: 1px solid var(--borderColor-muted, var(--color-border-muted, #d8dee4));
  }

  .ghcm-root.is-docked {
    position: relative;
    z-index: 2;
  }

  .ghcm-root.is-inline {
    margin-bottom: var(--ghcm-space-2);
  }

  .markdown-body > .ghcm-root + :is(h1, h2, h3, h4, h5, h6, .markdown-heading) {
    margin-top: 0 !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .ghcm-root *,
    .ghcm-heading-toggle {
      transition: none !important;
      scroll-behavior: auto !important;
    }
  }
`;

  // src/ui/styles/headings.ts
  var headingStyles = `
  .ghcm-heading-block {
    position: relative;
    cursor: pointer;
    scroll-margin-top: 120px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .ghcm-heading-block--wrapped {
    display: block !important;
  }

  .ghcm-heading-inline {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .ghcm-heading-toggle {
    appearance: none;
    box-sizing: border-box;
    position: relative;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: var(--borderRadius-medium, 6px);
    background: transparent;
    color: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 140ms ease;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .ghcm-heading-toggle::before {
    content: "";
    width: 6px;
    height: 6px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 140ms ease;
  }

  .ghcm-heading-toggle[aria-expanded="true"]::before {
    transform: rotate(45deg);
  }

  .ghcm-heading-toggle:focus-visible {
    outline: 2px solid var(--focus-outlineColor, var(--fgColor-accent, var(--color-accent-fg, #0969da)));
    outline-offset: -2px;
  }

  .ghcm-heading-toggle:focus-visible {
    opacity: 1;
  }

  @media (hover: hover) and (pointer: fine) {
    .ghcm-heading-block:hover .ghcm-heading-toggle {
      opacity: 1;
    }
  }

  .ghcm-heading-toggle:active {
    opacity: 1;
    background: var(--control-transparent-bgColor-active, var(--color-action-list-item-default-active-bg, rgba(129, 139, 152, 0.15)));
  }

  @media (pointer: coarse) {
    .ghcm-heading-toggle::after {
      content: "";
      position: absolute;
      inset: -6px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ghcm-heading-toggle,
    .ghcm-heading-toggle::before {
      transition: none;
    }
  }

  .ghcm-section-hidden,
  .ghcm-hidden-by-parent {
    display: none !important;
  }
`;

  // src/ui/styles/outline.ts
  var outlineStyles = `
  .ghcm-outline {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: 0;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    margin: 0;
    padding: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(101, 109, 118, 0.36) transparent;
  }

  .ghcm-outline::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .ghcm-outline::-webkit-scrollbar-track {
    background: transparent;
  }

  .ghcm-outline::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(101, 109, 118, 0.36);
  }

  .ghcm-outline::-webkit-scrollbar-thumb:hover {
    background: rgba(101, 109, 118, 0.5);
  }

  .ghcm-outline-group + .ghcm-outline-group {
    margin-top: var(--ghcm-space-2);
  }

  .ghcm-root .ghcm-outline-group-title {
    margin: 0 0 var(--ghcm-space-1);
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    color: var(--ghcm-ink-muted);
  }

  .ghcm-root .ghcm-outline-link {
    appearance: none;
    display: flex;
    position: relative;
    flex-shrink: 0;
    align-items: center;
    width: 100%;
    min-height: var(--control-medium-size, 32px);
    border: none;
    background: transparent;
    border-radius: var(--ghcm-radius, 6px);
    margin: 0;
    padding: var(--control-medium-paddingBlock, 6px) var(--control-medium-paddingInline-condensed, 8px)
      var(--control-medium-paddingBlock, 6px)
      calc(var(--control-medium-paddingInline-condensed, 8px) + (var(--ghcm-depth, 0) * var(--ghcm-space-2)));
    cursor: pointer;
    text-align: left;
    transition: background-color 33.333ms linear;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .ghcm-root .ghcm-outline-link:hover {
      background: var(--ghcm-hover);
    }
  }

  .ghcm-root .ghcm-outline-link:active {
    background: var(--ghcm-pressed);
  }

  .ghcm-outline-link.is-active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 2px;
    height: 16px;
    border-radius: 2px;
    background: var(--ghcm-accent);
    transform: translateY(-50%);
    pointer-events: none;
  }

  .ghcm-outline-link.is-muted {
    opacity: 0.62;
  }

  .ghcm-outline-label {
    display: block;
    min-width: 0;
    color: var(--ghcm-ink-soft);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    overflow-wrap: anywhere;
  }

  .ghcm-outline-link.is-active .ghcm-outline-label {
    color: var(--ghcm-ink);
    font-weight: 600;
  }

  .ghcm-root .ghcm-outline-empty {
    margin: 0;
    padding: var(--ghcm-space-2) 0;
    color: var(--ghcm-ink-muted);
    font-size: 12px;
    line-height: 1.5;
  }

  .ghcm-root.is-inline .ghcm-outline {
    max-height: min(45dvh, 420px);
  }
`;

  // src/ui/styles/panel.ts
  var panelStyles = `
  .ghcm-trigger {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: var(--ghcm-space-1);
    margin: 0;
    border: 0;
    border-radius: var(--ghcm-radius);
    padding: var(--control-small-paddingBlock, 4px) var(--control-medium-paddingInline-condensed, 8px);
    background: transparent;
    color: var(--ghcm-ink-soft);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    cursor: pointer;
    transition: background-color 33.333ms linear;
  }

  .ghcm-trigger::before {
    content: "";
    width: 5px;
    height: 5px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
  }

  .ghcm-trigger.is-hidden {
    display: none;
  }

  .ghcm-panel {
    display: none;
    flex-direction: column;
    position: static;
    inset: auto;
    width: 100%;
    min-height: 0;
    margin: 0;
    border: 0;
    padding: 0;
    overflow: visible;
    background: transparent;
    box-shadow: none;
  }

  .ghcm-panel.is-open {
    display: flex;
  }

  .ghcm-root.is-overlay .ghcm-trigger {
    position: fixed;
    top: 88px;
    right: var(--ghcm-space-4);
    z-index: 2147483644;
    border: 1px solid var(--ghcm-line);
    background: var(--ghcm-surface);
  }

  .ghcm-root.is-overlay .ghcm-panel {
    position: fixed;
    top: var(--ghcm-overlay-top, 88px);
    left: var(--ghcm-overlay-left, max(16px, calc(100vw - 336px)));
    right: auto;
    width: 320px;
    max-width: calc(100vw - 32px);
    max-height: min(560px, calc(100dvh - 16px));
    z-index: 2147483644;
    border: 1px solid var(--ghcm-line);
    border-radius: var(--ghcm-radius);
    background: var(--ghcm-surface);
    box-shadow: var(--shadow-floating-small, 0 4px 12px rgba(31, 35, 40, 0.12));
  }

  .ghcm-root.is-docked .ghcm-panel {
    height: var(--ghcm-panel-height, auto);
    max-height: var(--ghcm-panel-max-height, none);
  }

  .ghcm-root.is-docked.is-floating .ghcm-panel {
    position: fixed;
    top: var(--ghcm-panel-top, 0px);
    left: var(--ghcm-panel-left, 0px);
    width: var(--ghcm-panel-width, 100%);
    background: var(--ghcm-surface);
  }

  .ghcm-sidebar-header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: var(--ghcm-space-1) var(--ghcm-space-2);
    margin: 0;
    border: 0;
    padding: 0 0 var(--ghcm-space-2);
  }

  .ghcm-root.is-overlay .ghcm-sidebar-header {
    border-bottom: 1px solid var(--ghcm-line);
    padding: var(--ghcm-space-2);
  }

  .ghcm-sidebar-kicker {
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    min-width: 0;
    margin: 0;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--ghcm-ink);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  .ghcm-root.is-overlay .ghcm-drag-handle {
    touch-action: none;
    user-select: none;
    cursor: grab;
  }

  .ghcm-root .ghcm-panel.is-dragging .ghcm-drag-handle {
    cursor: grabbing;
  }

  .ghcm-sidebar-tools {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--ghcm-space-1);
  }

  .ghcm-inline-action {
    appearance: none;
    margin: 0;
    border: 0;
    border-radius: var(--ghcm-radius);
    padding: 0;
    background: transparent;
    color: var(--ghcm-ink);
    font: inherit;
    font-size: 14px;
    line-height: 20px;
    cursor: pointer;
    transition: background-color 33.333ms linear;
  }

  .ghcm-root .ghcm-actions {
    position: relative;
    margin: 0;
    padding: 0;
  }

  .ghcm-root .ghcm-actions-trigger,
  .ghcm-root .ghcm-close-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-small-size, 28px);
    height: var(--control-small-size, 28px);
    margin: 0;
    border: 0;
    border-radius: var(--ghcm-radius);
    padding: 0;
    background: transparent;
    color: var(--ghcm-ink-soft);
    cursor: pointer;
    list-style: none;
    transition: background-color 33.333ms linear;
  }

  .ghcm-actions-trigger::-webkit-details-marker {
    display: none;
  }

  .ghcm-actions-trigger svg,
  .ghcm-close-action svg {
    width: 16px;
    height: 16px;
    pointer-events: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .ghcm-root :is(.ghcm-trigger, .ghcm-actions-trigger, .ghcm-close-action, .ghcm-inline-action):hover {
      background-color: var(--ghcm-hover);
    }
  }

  .ghcm-root :is(.ghcm-trigger, .ghcm-actions-trigger, .ghcm-close-action, .ghcm-inline-action):active {
    background-color: var(--ghcm-pressed);
  }

  .ghcm-actions-menu {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: calc(100% + var(--ghcm-space-1));
    right: 0;
    z-index: 3;
    width: max-content;
    min-width: 160px;
    margin: 0;
    border: 1px solid var(--ghcm-line);
    border-radius: var(--ghcm-radius);
    padding: var(--ghcm-space-1);
    background: var(--ghcm-surface);
    box-shadow: var(--shadow-floating-small, 0 4px 12px rgba(31, 35, 40, 0.12));
  }

  .ghcm-actions.is-above .ghcm-actions-menu {
    top: auto;
    bottom: calc(100% + var(--ghcm-space-1));
  }

  .ghcm-actions-menu .ghcm-inline-action {
    width: 100%;
    min-height: var(--control-medium-size, 32px);
    padding: var(--control-medium-paddingBlock, 6px) var(--control-medium-paddingInline-condensed, 8px);
    text-align: left;
    white-space: nowrap;
  }

  .ghcm-root.is-overlay .ghcm-outline {
    margin: var(--ghcm-space-2);
  }
`;

  // src/ui/styles/responsive.ts
  var responsiveStyles = `
  @media (pointer: coarse) {
    .ghcm-root .ghcm-trigger,
    .ghcm-root .ghcm-actions-trigger,
    .ghcm-root .ghcm-close-action,
    .ghcm-root .ghcm-inline-action,
    .ghcm-root .ghcm-outline-link,
    .ghcm-root.is-overlay .ghcm-drag-handle {
      min-width: 44px;
      min-height: 44px;
    }
  }
`;

  // src/ui/styles.ts
  var styles = [baseStyles, headingStyles, panelStyles, outlineStyles, responsiveStyles].join("\n");

  // src/app/app-lifecycle.ts
  var RERENDER_EVENTS = ["turbo:load", "turbo:render", "pjax:end", "pageshow", "load"];
  var AppLifecycle = class {
    constructor(options) {
      this.options = options;
      __publicField(this, "observer", null);
    }
    bind(signal) {
      RERENDER_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, () => this.options.onRefreshRequested(), {
          passive: true,
          signal
        });
      });
      document.addEventListener("keydown", (event) => this.options.onKeydown(event), {
        passive: false,
        signal
      });
      this.observer = new MutationObserver((mutations) => {
        const adapter = this.options.resolveMutationAdapter();
        if (!adapter) {
          return;
        }
        for (const mutation of mutations) {
          if (adapter.shouldRefreshForMutation(mutation)) {
            this.options.onRefreshRequested();
            return;
          }
        }
      });
      this.observer.observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "aria-hidden", "open", "style", "class"]
      });
    }
    destroy() {
      this.observer?.disconnect();
      this.observer = null;
    }
  };

  // src/app/active-heading-tracker.ts
  var ActiveHeadingTracker = class {
    constructor(options) {
      this.options = options;
      __publicField(this, "activeHeadingKey", null);
      __publicField(this, "rafHandle", 0);
      __publicField(this, "positionsDirty", true);
      __publicField(this, "positionsSignature", "");
      __publicField(this, "headingPositions", []);
    }
    bind(signal, getSnapshots, onChange) {
      const scheduleSync = () => {
        window.cancelAnimationFrame(this.rafHandle);
        this.rafHandle = window.requestAnimationFrame(() => {
          if (!this.sync(getSnapshots())) {
            return;
          }
          onChange(this.activeHeadingKey);
        });
      };
      window.addEventListener(
        "scroll",
        () => scheduleSync(),
        { signal, passive: true }
      );
      window.addEventListener(
        "resize",
        () => {
          this.positionsDirty = true;
          scheduleSync();
        },
        { signal, passive: true }
      );
    }
    destroy() {
      window.cancelAnimationFrame(this.rafHandle);
    }
    getActiveHeadingKey() {
      return this.activeHeadingKey;
    }
    invalidateLayout() {
      this.positionsDirty = true;
    }
    setActiveHeadingKey(activeHeadingKey, force = false) {
      if (!force && activeHeadingKey === this.activeHeadingKey) {
        return false;
      }
      this.activeHeadingKey = activeHeadingKey;
      return true;
    }
    sync(snapshots, force = false) {
      this.refreshHeadingPositions(snapshots);
      return this.setActiveHeadingKey(this.computeActiveHeadingKey(), force);
    }
    refreshHeadingPositions(snapshots) {
      const nextSignature = snapshots.map((heading) => `${heading.key}:${heading.collapsed}:${heading.hiddenByAncestor}:${heading.text}`).join("|");
      if (!this.positionsDirty && nextSignature === this.positionsSignature) {
        return;
      }
      this.positionsSignature = nextSignature;
      this.positionsDirty = false;
      this.headingPositions = snapshots.flatMap((heading) => {
        if (heading.hiddenByAncestor) {
          return [];
        }
        const binding = this.options.resolveBinding(heading.key);
        if (!binding) {
          return [];
        }
        return [
          {
            key: heading.key,
            top: window.scrollY + binding.blockEl.getBoundingClientRect().top
          }
        ];
      });
    }
    computeActiveHeadingKey() {
      if (this.headingPositions.length === 0) {
        return null;
      }
      const threshold = window.scrollY + this.options.getStickyTop() + 8;
      let low = 0;
      let high = this.headingPositions.length - 1;
      let match = -1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (this.headingPositions[mid].top <= threshold) {
          match = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return match >= 0 ? this.headingPositions[match].key : null;
    }
  };

  // src/ui/heading-controls.ts
  function createToggleButton(text, collapsed) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghcm-heading-toggle";
    syncToggleButton(button, text, collapsed);
    return button;
  }
  function syncToggleButton(button, text, collapsed) {
    const label = `${collapsed ? "Expand" : "Collapse"} section: ${text}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-expanded", String(!collapsed));
  }
  var HeadingControls = class {
    constructor(document2, engine) {
      this.document = document2;
      this.engine = engine;
      __publicField(this, "toggleElements", /* @__PURE__ */ new Map());
    }
    mount(signal) {
      for (const heading of this.document.headings) {
        this.mountHeading(heading, signal);
      }
    }
    sync(snapshots) {
      for (const snapshot of snapshots) {
        const binding = this.document.getBinding(snapshot.key);
        if (!binding) {
          continue;
        }
        binding.blockEl.classList.toggle("ghcm-hidden-by-parent", snapshot.hiddenByAncestor);
        binding.blockEl.classList.toggle("ghcm-collapsed", snapshot.collapsed);
        const toggle = this.toggleElements.get(snapshot.key);
        if (toggle) {
          syncToggleButton(toggle, snapshot.text, snapshot.collapsed);
        }
        for (const element of binding.sectionEls) {
          element.classList.toggle("ghcm-section-hidden", snapshot.hiddenByAncestor || snapshot.collapsed);
        }
      }
    }
    isConnected() {
      return this.document.headings.every((heading) => {
        const binding = this.document.getBinding(heading.key);
        const toggle = this.toggleElements.get(heading.key);
        return Boolean(
          binding && binding.headingEl.isConnected && binding.blockEl.isConnected && toggle?.isConnected
        );
      });
    }
    destroy() {
      for (const toggle of this.toggleElements.values()) {
        toggle.remove();
      }
      this.toggleElements.clear();
      for (const heading of this.document.headings) {
        const binding = this.document.getBinding(heading.key);
        if (!binding) {
          continue;
        }
        binding.blockEl.classList.remove(
          "ghcm-heading-block",
          "ghcm-heading-block--wrapped",
          "ghcm-hidden-by-parent",
          "ghcm-collapsed"
        );
        binding.headingEl.classList.remove("ghcm-heading-inline");
        binding.sectionEls.forEach((element) => element.classList.remove("ghcm-section-hidden"));
      }
    }
    mountHeading(heading, signal) {
      const binding = this.document.getBinding(heading.key);
      if (!binding) {
        return;
      }
      const wrapped = binding.blockEl !== binding.headingEl;
      binding.blockEl.classList.add("ghcm-heading-block");
      binding.headingEl.classList.add("ghcm-heading-inline");
      if (wrapped) {
        binding.blockEl.classList.add("ghcm-heading-block--wrapped");
      }
      const button = createToggleButton(heading.text, this.engine.isCollapsed(heading.key));
      this.toggleElements.set(heading.key, button);
      binding.headingEl.prepend(button);
      button.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();
          this.toggleHeading(heading.key, event);
        },
        { signal }
      );
      binding.blockEl.addEventListener(
        "click",
        (event) => {
          if (getSelectionText() || isNativePermalinkTarget(binding, event.target) || isInteractiveTarget(event.target)) {
            return;
          }
          this.toggleHeading(heading.key, event);
        },
        { signal }
      );
    }
    toggleHeading(key, event) {
      event.preventDefault();
      if (event.shiftKey) {
        this.engine.toggleWithSiblings(key);
      } else {
        this.engine.toggle(key);
      }
    }
  };
  function isNativePermalinkTarget(binding, target) {
    if (!(target instanceof Element)) {
      return false;
    }
    const permalink = target.closest("a.anchor, a.heading-link");
    return Boolean(permalink && binding.blockEl.contains(permalink));
  }

  // src/ui/panel-frame.ts
  var DOCKED_PANEL_BOUNDARY_BOTTOM_GAP = 30;
  var DOCKED_PANEL_VIEWPORT_BOTTOM_GAP = 16;
  function stylePixels(style, property) {
    return Number.parseFloat(style.getPropertyValue(property)) || 0;
  }
  function verticalMargins(element) {
    const style = window.getComputedStyle(element);
    return stylePixels(style, "margin-top") + stylePixels(style, "margin-bottom");
  }
  function measureOutlineContentHeight(outline) {
    const style = window.getComputedStyle(outline);
    const lastChild = outline.lastElementChild;
    if (lastChild instanceof HTMLElement) {
      const contentBottom = lastChild.getBoundingClientRect().bottom - outline.getBoundingClientRect().top + outline.scrollTop;
      if (contentBottom > 0) {
        return contentBottom + stylePixels(window.getComputedStyle(lastChild), "margin-bottom") + stylePixels(style, "padding-bottom") + stylePixels(style, "border-bottom-width");
      }
    }
    return outline.scrollHeight + stylePixels(style, "border-top-width") + stylePixels(style, "border-bottom-width");
  }
  function measureNaturalPanelHeight({ panel, outline }) {
    const fallback = Math.max(panel.scrollHeight, panel.offsetHeight, 0);
    if (!outline || outline.parentElement !== panel) {
      return fallback;
    }
    const style = window.getComputedStyle(panel);
    const children = Array.from(panel.children).filter((child) => child instanceof HTMLElement);
    const contentHeight = children.reduce((height, child) => height + verticalMargins(child) + (child === outline ? measureOutlineContentHeight(outline) : child.offsetHeight), 0);
    const naturalHeight = contentHeight + stylePixels(style, "padding-top") + stylePixels(style, "padding-bottom") + stylePixels(style, "border-top-width") + stylePixels(style, "border-bottom-width") + stylePixels(style, "row-gap") * Math.max(children.length - 1, 0);
    return naturalHeight > 0 ? naturalHeight : fallback;
  }
  function measureDockedPanel(elements, context) {
    const cellRect = elements.dockCell.getBoundingClientRect();
    const cellStyle = window.getComputedStyle(elements.dockCell);
    const inset = (property) => stylePixels(cellStyle, property);
    const leftInset = inset("padding-left") + inset("border-left-width");
    const rightInset = inset("padding-right") + inset("border-right-width");
    const topInset = inset("padding-top") + inset("border-top-width");
    const dockedBoundaryRect = context.boundary?.getBoundingClientRect();
    return {
      boundaryViewportBottom: dockedBoundaryRect ? dockedBoundaryRect.bottom - DOCKED_PANEL_BOUNDARY_BOTTOM_GAP : Number.POSITIVE_INFINITY,
      cellLeft: Math.max(cellRect.left + leftInset, 0),
      cellWidth: Math.max(cellRect.width - leftInset - rightInset, 0),
      naturalPanelHeight: measureNaturalPanelHeight(elements),
      rowViewportTop: cellRect.top + topInset
    };
  }
  function computeDockedPanelFrame(measurement, topOffset, viewportHeight) {
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
  function applyDockedPanelFrame(elements, frame) {
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
  function clearDockedPanelFrame(elements) {
    elements.root.classList.remove("is-floating");
    elements.root.style.removeProperty("--ghcm-panel-height");
    elements.root.style.removeProperty("--ghcm-panel-left");
    elements.root.style.removeProperty("--ghcm-panel-top");
    elements.root.style.removeProperty("--ghcm-panel-width");
    elements.root.style.removeProperty("--ghcm-panel-max-height");
    elements.root.style.removeProperty("min-height");
    elements.dockRow.style.removeProperty("min-height");
  }

  // src/ui/panel-placement.ts
  var UNSAFE_PANEL_CONTEXT_SELECTOR = ".ghcm-root, nav, [role='navigation'], a, button, summary, [role='button']";
  var INVALID_PANEL_HOST_TAGS = /* @__PURE__ */ new Set(["P", "SPAN", "PRE", "CODE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL", "OL", "DL"]);
  function resolvePanelPlacement(resolvers) {
    const dockedLayout = resolvers.resolveDockedLayout?.() ?? null;
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
  function isUsablePanelHost(element) {
    return !INVALID_PANEL_HOST_TAGS.has(element.tagName) && !element.closest(UNSAFE_PANEL_CONTEXT_SELECTOR) && !isEditableElement(element) && isVisibleElement(element);
  }
  function collectPlacementTargets(placement) {
    if (placement.kind !== "docked") {
      return [];
    }
    const targets = [placement.context.host, placement.context.boundary].filter(
      (element) => Boolean(element)
    );
    return Array.from(new Set(targets));
  }

  // src/ui/panel-layout.ts
  var PanelLayout = class {
    constructor(elements, resolvers) {
      this.elements = elements;
      this.resolvers = resolvers;
      __publicField(this, "open", false);
      __publicField(this, "placement", { kind: "overlay" });
      __publicField(this, "positionRaf", 0);
      __publicField(this, "resizeObserver", null);
      __publicField(this, "layoutMutationObserver", null);
      __publicField(this, "observedDockElements", []);
      __publicField(this, "measurementDirty", true);
    }
    bind(signal) {
      window.addEventListener("scroll", (event) => this.handleScroll(event), {
        signal,
        passive: true
      });
      document.addEventListener("scroll", (event) => this.handleScroll(event), {
        signal,
        passive: true,
        capture: true
      });
      window.addEventListener("resize", () => this.invalidateGeometry(), { signal, passive: true });
      signal.addEventListener("abort", () => {
        window.cancelAnimationFrame(this.positionRaf);
        this.disconnectLayoutObservers();
      }, { once: true });
    }
    destroy() {
      window.cancelAnimationFrame(this.positionRaf);
      this.disconnectLayoutObservers();
      this.elements.dockRow.remove();
    }
    getPlacement() {
      return this.placement.kind;
    }
    refreshGeometry() {
      this.invalidateGeometry();
    }
    sync(open) {
      this.open = open;
      this.placement = resolvePanelPlacement(this.resolvers);
      this.mountPlacement(this.placement);
      this.syncLayoutObservers(this.placement);
      this.elements.root.style.setProperty(
        "--ghcm-sticky-top",
        `${this.placement.kind === "docked" ? this.placement.context.topOffset : 0}px`
      );
      this.invalidateGeometry();
    }
    mountPlacement(placement) {
      if (placement.kind === "overlay") {
        this.mountOverlay();
        return;
      }
      if (placement.kind === "docked") {
        const nativeGrid = placement.context.host.classList.contains("BorderGrid");
        this.elements.dockRow.classList.toggle("BorderGrid-row", nativeGrid);
        this.elements.dockCell.classList.toggle("BorderGrid-cell", nativeGrid);
        if (this.elements.root.parentElement !== this.elements.dockCell) {
          this.elements.dockCell.append(this.elements.root);
        }
        this.keepDockRowLast(placement.context.host);
        return;
      }
      this.elements.dockRow.remove();
      if (this.elements.root.parentElement !== placement.host || placement.host.firstElementChild !== this.elements.root) {
        placement.host.prepend(this.elements.root);
      }
    }
    mountOverlay() {
      this.elements.dockRow.remove();
      if (this.elements.root.parentElement !== document.body) {
        document.body.append(this.elements.root);
      }
    }
    keepDockRowLast(host) {
      if (this.elements.dockRow.parentElement !== host || host.lastElementChild !== this.elements.dockRow) {
        host.append(this.elements.dockRow);
      }
    }
    handleScroll(event) {
      if (!this.shouldPositionDockedPanel()) {
        return;
      }
      if (event.target instanceof Node && this.elements.root.contains(event.target)) {
        return;
      }
      this.invalidateGeometry();
    }
    syncLayoutObservers(placement) {
      const nextTargets = collectPlacementTargets(placement);
      const targetsUnchanged = nextTargets.length === this.observedDockElements.length && nextTargets.every((element, index) => element === this.observedDockElements[index]);
      if (targetsUnchanged) {
        return;
      }
      this.disconnectLayoutObservers();
      this.observedDockElements = nextTargets;
      if (!nextTargets.length) {
        return;
      }
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => this.invalidateGeometry());
        nextTargets.forEach((element) => this.resizeObserver?.observe(element));
      }
      if (placement.kind === "docked") {
        this.layoutMutationObserver = new MutationObserver((records) => {
          const nativeContentChanged = records.some(
            (record) => !this.elements.dockRow.contains(record.target) && (record.type !== "childList" || [...record.addedNodes, ...record.removedNodes].some(
              (node) => node !== this.elements.dockRow
            ))
          );
          if (!nativeContentChanged) {
            return;
          }
          this.keepDockRowLast(placement.context.host);
          this.invalidateGeometry();
        });
        this.layoutMutationObserver.observe(placement.context.host, {
          childList: true,
          characterData: true,
          subtree: true
        });
      }
    }
    disconnectLayoutObservers() {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.layoutMutationObserver?.disconnect();
      this.layoutMutationObserver = null;
      this.observedDockElements = [];
    }
    invalidateGeometry() {
      this.measurementDirty = true;
      this.schedulePositionUpdate();
    }
    schedulePositionUpdate() {
      window.cancelAnimationFrame(this.positionRaf);
      this.positionRaf = window.requestAnimationFrame(() => {
        this.positionRaf = 0;
        this.updateDockedPosition();
      });
    }
    shouldPositionDockedPanel() {
      return this.placement.kind === "docked" && this.open;
    }
    updateDockedPosition() {
      if (!this.shouldPositionDockedPanel()) {
        clearDockedPanelFrame(this.elements);
        this.measurementDirty = false;
        return;
      }
      if (this.placement.kind !== "docked") {
        return;
      }
      if (!this.measurementDirty) {
        return;
      }
      this.measurementDirty = false;
      const measurement = measureDockedPanel(this.elements, this.placement.context);
      const frame = computeDockedPanelFrame(measurement, this.placement.context.topOffset, window.innerHeight);
      applyDockedPanelFrame(this.elements, frame);
    }
  };

  // src/ui/panel-dom.ts
  function createPanelDom() {
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
      dockRow,
      dockCell,
      root,
      trigger,
      dragHandle: kicker,
      panel,
      outline,
      collapseAllButton,
      expandAllButton,
      closeButton,
      actionsDetails,
      actionsTrigger,
      actionsMenu
    };
  }
  function updatePanelDom(dom, placement, open) {
    const floating = placement === "overlay";
    for (const kind of ["docked", "inline", "overlay"]) {
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
  function createButton(className, textContent, ariaLabel) {
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
  function createIcon(pathData) {
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

  // src/ui/panel-actions.ts
  var PanelActions = class {
    constructor(elements) {
      this.elements = elements;
      __publicField(this, "abortController", new AbortController());
      __publicField(this, "bound", false);
    }
    bind(signal) {
      if (this.bound || this.abortController.signal.aborted) {
        return;
      }
      if (signal.aborted) {
        this.destroy();
        return;
      }
      this.bound = true;
      const options = { signal: this.abortController.signal };
      this.elements.details.addEventListener("toggle", () => this.placeMenu(), options);
      this.elements.menu.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("button[data-action]")) {
          this.close({ restoreFocus: true });
        }
      }, options);
      document.addEventListener("pointerdown", (event) => {
        if (event.target instanceof Node && !this.elements.details.contains(event.target)) {
          this.close();
        }
      }, { ...options, capture: true });
      document.addEventListener("keydown", (event) => {
        if (this.elements.details.open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          this.close({ restoreFocus: true });
        }
      }, { ...options, capture: true });
      window.addEventListener("resize", () => this.close(), options);
      document.addEventListener("scroll", () => this.close(), { ...options, capture: true });
      signal.addEventListener("abort", () => this.destroy(), { ...options, once: true });
      this.placeMenu();
    }
    close({ restoreFocus = false } = {}) {
      const wasOpen = this.elements.details.open;
      this.elements.details.open = false;
      this.elements.details.classList.remove("is-above");
      if (wasOpen && restoreFocus) {
        this.elements.trigger.focus({ preventScroll: true });
      }
    }
    destroy() {
      this.abortController.abort();
      this.close();
    }
    placeMenu() {
      const { details, trigger, menu } = this.elements;
      details.classList.remove("is-above");
      if (!details.open) {
        return;
      }
      const menuRect = menu.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const below = window.innerHeight - triggerRect.bottom;
      const above = triggerRect.top;
      details.classList.toggle("is-above", menuRect.bottom > window.innerHeight - 8 && above > below);
    }
  };

  // src/ui/panel-focus.ts
  var PanelFocus = class {
    constructor(dom) {
      this.dom = dom;
      __publicField(this, "open", false);
      __publicField(this, "returnTarget", null);
    }
    sync({ open, moveFocus, previousFocus }) {
      const wasOpen = this.open;
      this.open = open;
      if (open && !wasOpen) {
        this.returnTarget = previousFocus instanceof HTMLElement ? previousFocus : null;
        if (moveFocus) {
          this.dom.actionsTrigger.focus({ preventScroll: true });
        }
        return;
      }
      if (!open && wasOpen) {
        if (moveFocus || previousFocus && this.dom.panel.contains(previousFocus)) {
          this.restoreFocus();
        }
        this.returnTarget = null;
        return;
      }
      if (open && previousFocus instanceof HTMLElement && this.dom.panel.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      }
    }
    destroy() {
      if (this.dom.panel.contains(document.activeElement) && this.returnTarget?.isConnected && !this.dom.root.contains(this.returnTarget)) {
        this.returnTarget.focus({ preventScroll: true });
      }
      this.returnTarget = null;
    }
    restoreFocus() {
      const target = this.returnTarget;
      if (target?.isConnected && target !== document.body && !target.closest("[hidden], [inert]")) {
        target.focus({ preventScroll: true });
      }
      if (!target || document.activeElement !== target) {
        this.dom.trigger.focus({ preventScroll: true });
      }
    }
  };

  // src/ui/panel-drag.ts
  var VIEWPORT_MARGIN = 8;
  var KEYBOARD_STEP = 16;
  var INTERACTIVE_SELECTOR = "a, button, input, select, textarea, [contenteditable], [role='button']";
  var PanelDrag = class {
    constructor(elements) {
      this.elements = elements;
      __publicField(this, "abortController", new AbortController());
      __publicField(this, "bound", false);
      __publicField(this, "enabled", false);
      __publicField(this, "position", null);
      __publicField(this, "drag", null);
    }
    bind(signal) {
      if (this.bound || this.abortController.signal.aborted) {
        return;
      }
      if (signal.aborted) {
        this.destroy();
        return;
      }
      this.bound = true;
      const options = { signal: this.abortController.signal };
      this.elements.handle.addEventListener("pointerdown", (event) => this.startDrag(event), options);
      this.elements.handle.addEventListener("lostpointercapture", (event) => this.endDrag(event), options);
      this.elements.handle.addEventListener("keydown", (event) => this.handleKeydown(event), options);
      document.addEventListener("pointermove", (event) => this.moveDrag(event), { ...options, passive: false });
      document.addEventListener("pointerup", (event) => this.endDrag(event), options);
      document.addEventListener("pointercancel", (event) => this.endDrag(event), options);
      window.addEventListener("resize", () => {
        if (this.enabled && this.position) {
          this.moveTo(this.position);
        }
      }, options);
      signal.addEventListener("abort", () => this.destroy(), { ...options, once: true });
    }
    sync(enabled) {
      if (this.abortController.signal.aborted) {
        return;
      }
      this.enabled = enabled;
      if (enabled) {
        this.moveTo(this.position ?? this.measurePosition());
      } else {
        this.finishDrag();
      }
    }
    destroy() {
      this.enabled = false;
      this.finishDrag();
      this.abortController.abort();
      this.elements.panel.style.removeProperty("--ghcm-overlay-left");
      this.elements.panel.style.removeProperty("--ghcm-overlay-top");
    }
    startDrag(event) {
      if (!this.enabled || this.drag || event.button !== 0 || !event.isPrimary) {
        return;
      }
      if (event.target instanceof Element && event.target.closest(INTERACTIVE_SELECTOR)) {
        return;
      }
      event.preventDefault();
      this.drag = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        position: this.position ?? this.measurePosition()
      };
      this.elements.panel.classList.add("is-dragging");
      try {
        this.elements.handle.setPointerCapture(event.pointerId);
      } catch {
      }
    }
    moveDrag(event) {
      if (!this.drag || event.pointerId !== this.drag.pointerId) {
        return;
      }
      event.preventDefault();
      this.moveTo({
        left: this.drag.position.left + event.clientX - this.drag.pointerX,
        top: this.drag.position.top + event.clientY - this.drag.pointerY
      });
    }
    endDrag(event) {
      if (event.pointerId === this.drag?.pointerId) {
        this.finishDrag();
      }
    }
    finishDrag() {
      const pointerId = this.drag?.pointerId;
      this.drag = null;
      this.elements.panel.classList.remove("is-dragging");
      if (pointerId !== void 0 && this.elements.handle.hasPointerCapture?.(pointerId)) {
        this.elements.handle.releasePointerCapture(pointerId);
      }
    }
    handleKeydown(event) {
      if (!this.enabled || event.target !== this.elements.handle || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const step = KEYBOARD_STEP * (event.shiftKey ? 3 : 1);
      const offsets = {
        ArrowLeft: { left: -step, top: 0 },
        ArrowRight: { left: step, top: 0 },
        ArrowUp: { left: 0, top: -step },
        ArrowDown: { left: 0, top: step }
      };
      const offset = offsets[event.key];
      if (!offset) {
        return;
      }
      event.preventDefault();
      const position = this.position ?? this.measurePosition();
      this.moveTo({ left: position.left + offset.left, top: position.top + offset.top });
    }
    measurePosition() {
      const rect = this.elements.panel.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    }
    moveTo(position) {
      const rect = this.elements.panel.getBoundingClientRect();
      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
      const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
      this.position = {
        left: Math.max(VIEWPORT_MARGIN, Math.min(position.left, maxLeft)),
        top: Math.max(VIEWPORT_MARGIN, Math.min(position.top, maxTop))
      };
      this.elements.panel.style.setProperty("--ghcm-overlay-left", `${this.position.left}px`);
      this.elements.panel.style.setProperty("--ghcm-overlay-top", `${this.position.top}px`);
    }
  };

  // src/ui/panel-outline.ts
  var PanelOutlineView = class {
    constructor(outline) {
      this.outline = outline;
      __publicField(this, "visibilityRaf", 0);
      __publicField(this, "displayRevision", "");
      __publicField(this, "activeHeadingKey", null);
      __publicField(this, "itemElements", /* @__PURE__ */ new Map());
      this.outline.tabIndex = -1;
    }
    destroy() {
      window.cancelAnimationFrame(this.visibilityRaf);
    }
    render(state) {
      const structureChanged = state.displayRevision !== this.displayRevision;
      if (structureChanged) {
        this.displayRevision = state.displayRevision;
        this.renderStructure(state.headings);
      }
      this.syncItemStates(state.headings);
      this.syncActiveHeading(state.activeHeadingKey);
      return structureChanged;
    }
    scheduleActiveItemVisibility(open) {
      window.cancelAnimationFrame(this.visibilityRaf);
      if (!open) {
        return;
      }
      this.visibilityRaf = window.requestAnimationFrame(() => this.ensureActiveItemVisible());
    }
    ensureActiveItemVisible() {
      const activeItem = this.outline.querySelector(".ghcm-outline-link.is-active");
      if (!activeItem) {
        return;
      }
      const outlineHeight = this.outline.clientHeight;
      const maxScrollTop = Math.max(this.outline.scrollHeight - outlineHeight, 0);
      if (outlineHeight <= 0 || maxScrollTop <= 0) {
        return;
      }
      const outlineRect = this.outline.getBoundingClientRect();
      const activeRect = activeItem.getBoundingClientRect();
      const itemCenter = activeRect.top - outlineRect.top + this.outline.scrollTop + activeRect.height / 2;
      const currentCenter = this.outline.scrollTop + outlineHeight / 2;
      const comfortBand = Math.max(outlineHeight * 0.14, 24);
      const delta = itemCenter - currentCenter;
      if (Math.abs(delta) <= comfortBand) {
        return;
      }
      const targetTop = clamp(itemCenter - outlineHeight / 2, 0, maxScrollTop);
      if (typeof this.outline.scrollTo === "function") {
        this.outline.scrollTo({
          top: targetTop,
          behavior: getPreferredScrollBehavior()
        });
        return;
      }
      this.outline.scrollTop = targetTop;
    }
    renderStructure(headings) {
      const focused = document.activeElement;
      const focusedKey = focused instanceof HTMLElement && this.outline.contains(focused) ? focused.closest(".ghcm-outline-link")?.dataset.key : void 0;
      this.itemElements.clear();
      this.activeHeadingKey = null;
      this.outline.replaceChildren(this.createOutlineContent(headings));
      if (focusedKey) {
        const next = this.itemElements.get(focusedKey) ?? this.itemElements.values().next().value ?? this.outline;
        next.focus({ preventScroll: true });
      }
    }
    createOutlineContent(headings) {
      const fragment = document.createDocumentFragment();
      if (headings.length === 0) {
        const empty = document.createElement("p");
        empty.className = "ghcm-outline-empty";
        empty.textContent = "No headings found.";
        fragment.append(empty);
        return fragment;
      }
      const minLevel = headings.reduce((lowest, heading) => Math.min(lowest, heading.level), headings[0]?.level ?? 1);
      const showGroups = new Set(headings.map((heading) => heading.container.key)).size > 1;
      let currentGroupKey = "";
      let currentGroup = null;
      headings.forEach((heading) => {
        if (showGroups && heading.container.key !== currentGroupKey) {
          currentGroupKey = heading.container.key;
          currentGroup = document.createElement("section");
          currentGroup.className = "ghcm-outline-group";
          const groupTitle = document.createElement("p");
          groupTitle.className = "ghcm-outline-group-title";
          groupTitle.textContent = heading.container.label;
          currentGroup.append(groupTitle);
          fragment.append(currentGroup);
        }
        const item = createOutlineItem(heading, Math.max(0, heading.level - minLevel));
        this.itemElements.set(heading.key, item);
        if (currentGroup) {
          currentGroup.append(item);
        } else {
          fragment.append(item);
        }
      });
      return fragment;
    }
    syncItemStates(headings) {
      headings.forEach((heading) => {
        const item = this.itemElements.get(heading.key);
        if (!item) {
          return;
        }
        item.title = heading.text;
        item.classList.toggle("is-muted", heading.hiddenByAncestor);
      });
    }
    syncActiveHeading(activeHeadingKey) {
      if (activeHeadingKey === this.activeHeadingKey) {
        return;
      }
      const previous = this.activeHeadingKey ? this.itemElements.get(this.activeHeadingKey) : null;
      previous?.classList.remove("is-active");
      previous?.removeAttribute("aria-current");
      this.activeHeadingKey = activeHeadingKey;
      const current = activeHeadingKey ? this.itemElements.get(activeHeadingKey) : null;
      current?.classList.add("is-active");
      current?.setAttribute("aria-current", "location");
    }
  };
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function createOutlineItem(heading, depth) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ghcm-outline-link";
    item.dataset.key = heading.key;
    item.style.setProperty("--ghcm-depth", String(depth));
    const label = document.createElement("span");
    label.className = "ghcm-outline-label";
    label.textContent = heading.text;
    item.append(label);
    return item;
  }

  // src/ui/panel.ts
  var PanelUI = class {
    constructor(options) {
      this.options = options;
      __publicField(this, "abortController", new AbortController());
      __publicField(this, "dom", createPanelDom());
      __publicField(this, "focus", new PanelFocus(this.dom));
      __publicField(this, "actions", new PanelActions({
        details: this.dom.actionsDetails,
        trigger: this.dom.actionsTrigger,
        menu: this.dom.actionsMenu
      }));
      __publicField(this, "drag", new PanelDrag({ panel: this.dom.panel, handle: this.dom.dragHandle }));
      __publicField(this, "layout");
      __publicField(this, "outlineView");
      __publicField(this, "mounted", false);
      __publicField(this, "open", false);
      __publicField(this, "layoutChangeRaf", 0);
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
    mount() {
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
    destroy() {
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
    isOpen() {
      return this.open;
    }
    isConnected() {
      return this.dom.root.isConnected;
    }
    refreshLayout() {
      this.sync();
    }
    setOpen(open) {
      this.applyOpenState(open);
    }
    render(state) {
      const structureChanged = this.outlineView.render(state);
      if (this.open) {
        this.outlineView.scheduleActiveItemVisibility(true);
      }
      if (structureChanged) {
        this.layout.refreshGeometry();
        this.scheduleLayoutChange();
      }
    }
    bindEvents() {
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
    handleOutlineClick(event) {
      const button = event.target instanceof Element ? event.target.closest(".ghcm-outline-link") : null;
      const key = button?.dataset.key;
      if (!key) {
        return;
      }
      this.options.onJump(key);
      if (this.layout.getPlacement() === "overlay") {
        this.setOpen(false);
      }
    }
    handleKeydown(event) {
      if (!event.defaultPrevented && event.key === "Escape" && this.open && this.layout.getPlacement() === "overlay") {
        event.preventDefault();
        this.setOpen(false);
      }
    }
    handleViewportChange(force = false) {
      this.sync({ resetOpen: force });
    }
    applyOpenState(open) {
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
    sync({ resetOpen = false, moveFocus = false } = {}) {
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
    scheduleLayoutChange() {
      if (!this.options.onLayoutChange) {
        return;
      }
      window.cancelAnimationFrame(this.layoutChangeRaf);
      this.layoutChangeRaf = window.requestAnimationFrame(() => {
        this.layoutChangeRaf = 0;
        this.options.onLayoutChange?.();
      });
    }
  };

  // src/app/page-session-ui.ts
  var PageSessionUI = class {
    constructor(options) {
      this.options = options;
      __publicField(this, "controls");
      __publicField(this, "panel");
      __publicField(this, "activeHeading");
      __publicField(this, "panelState", {
        headings: [],
        activeHeadingKey: null,
        displayRevision: ""
      });
      this.controls = new HeadingControls(this.options.document, this.options.engine);
      this.panel = new PanelUI({
        onCollapseAll: this.options.onCollapseAll,
        onExpandAll: this.options.onExpandAll,
        onJump: (key) => this.jumpToHeading(key),
        onLayoutChange: () => this.refreshActiveHeading(),
        resolveDockedLayout: () => this.options.adapter.getDockedPanelLayout?.(document) ?? null,
        resolveInlineHost: () => this.options.document.getContainerElements().find(isUsablePanelHost) ?? null
      });
      this.activeHeading = new ActiveHeadingTracker({
        getStickyTop: () => this.options.adapter.getStickyHeaderOffset(document),
        resolveBinding: (key) => this.options.document.getBinding(key)
      });
    }
    mount(signal) {
      this.controls.mount(signal);
      this.panel.mount();
      this.activeHeading.bind(
        signal,
        () => this.panelState.headings,
        (activeHeadingKey) => this.updatePanelState({ activeHeadingKey })
      );
    }
    destroy() {
      this.activeHeading.destroy();
      this.panel.destroy();
      this.controls.destroy();
    }
    isStale() {
      return !this.panel.isConnected() || this.options.document.getContainerElements().some((element) => !element.isConnected) || !this.controls.isConnected();
    }
    togglePanel() {
      this.panel.setOpen(!this.panel.isOpen());
    }
    refreshLayout() {
      this.panel.refreshLayout();
    }
    renderSnapshots(snapshots, displayRevision = buildHeadingDisplayRevision(snapshots)) {
      this.controls.sync(snapshots);
      this.activeHeading.sync(snapshots, true);
      this.updatePanelState({
        headings: snapshots,
        activeHeadingKey: this.activeHeading.getActiveHeadingKey(),
        displayRevision
      });
    }
    jumpToHeading(key) {
      const binding = this.options.document.getBinding(key);
      if (!binding) {
        return;
      }
      this.options.onExpandTo(key);
      scrollToElementWithOffset(binding.blockEl, this.options.adapter.getStickyHeaderOffset(document));
      this.activeHeading.setActiveHeadingKey(key, true);
      this.updatePanelState({
        activeHeadingKey: this.activeHeading.getActiveHeadingKey()
      });
    }
    updatePanelState(patch) {
      this.panelState = {
        ...this.panelState,
        ...patch
      };
      this.panel.render(this.panelState);
    }
    refreshActiveHeading() {
      this.activeHeading.invalidateLayout();
      if (this.activeHeading.sync(this.panelState.headings)) {
        this.updatePanelState({ activeHeadingKey: this.activeHeading.getActiveHeadingKey() });
      }
    }
  };

  // src/core/collapse-engine.ts
  var CollapseEngine = class {
    constructor(document2, initialCollapsedKeys) {
      this.document = document2;
      __publicField(this, "collapsedKeys", /* @__PURE__ */ new Set());
      __publicField(this, "states", /* @__PURE__ */ new Map());
      __publicField(this, "listeners", /* @__PURE__ */ new Set());
      this.document.filterKnownHeadingKeys(initialCollapsedKeys).forEach((key) => this.collapsedKeys.add(key));
      this.recompute();
    }
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    isCollapsed(key) {
      return this.collapsedKeys.has(key);
    }
    getState(key) {
      return this.states.get(key) ?? { collapsed: false, hiddenByAncestor: false };
    }
    getSnapshots() {
      return this.getSnapshotsForHeadings(this.document.headings);
    }
    getSnapshotsForHeadings(headings) {
      return headings.map((heading) => ({
        ...heading,
        ...this.getState(heading.key)
      }));
    }
    toggle(key) {
      if (this.collapsedKeys.has(key)) {
        this.collapsedKeys.delete(key);
      } else {
        this.collapsedKeys.add(key);
      }
      this.apply();
    }
    toggleWithSiblings(key) {
      const shouldCollapse = !this.collapsedKeys.has(key);
      const siblingKeys = this.document.getSiblingKeys(key);
      for (const siblingKey of siblingKeys) {
        if (shouldCollapse) {
          this.collapsedKeys.add(siblingKey);
        } else {
          this.collapsedKeys.delete(siblingKey);
        }
      }
      this.apply();
    }
    collapseAll() {
      this.document.headings.forEach((heading) => this.collapsedKeys.add(heading.key));
      this.apply();
    }
    expandAll() {
      this.collapsedKeys.clear();
      this.apply();
    }
    expandTo(key) {
      this.document.getHeadingPath(key).forEach((heading) => this.collapsedKeys.delete(heading.key));
      this.apply();
    }
    getCollapsedKeysForContainer(containerKey) {
      return this.document.headings.filter((heading) => heading.container.key === containerKey && this.collapsedKeys.has(heading.key)).map((heading) => heading.key);
    }
    apply() {
      this.recompute();
      this.listeners.forEach((listener) => listener());
    }
    recompute() {
      this.states.clear();
      for (const heading of this.document.headings) {
        const parentState = heading.parentKey ? this.states.get(heading.parentKey) : void 0;
        this.states.set(heading.key, {
          collapsed: this.collapsedKeys.has(heading.key),
          hiddenByAncestor: Boolean(parentState && (parentState.collapsed || parentState.hiddenByAncestor))
        });
      }
    }
  };

  // src/app/page-session.ts
  var PageSession = class {
    constructor(pageKey, adapter, document2, storage) {
      this.pageKey = pageKey;
      this.adapter = adapter;
      this.document = document2;
      this.storage = storage;
      __publicField(this, "engine");
      __publicField(this, "ui");
      __publicField(this, "abortController", new AbortController());
      __publicField(this, "initialPageState");
      __publicField(this, "displayHeadings");
      __publicField(this, "lastPersistedStateRevision");
      __publicField(this, "unsubscribeEngine", null);
      this.displayHeadings = this.document.headings;
      this.initialPageState = this.storage.getPageState(this.pageKey);
      this.lastPersistedStateRevision = serializePageState(this.initialPageState);
      this.engine = new CollapseEngine(this.document, this.getInitialCollapsedKeys());
      this.ui = new PageSessionUI({
        adapter: this.adapter,
        engine: this.engine,
        document: this.document,
        onCollapseAll: () => this.engine.collapseAll(),
        onExpandAll: () => this.engine.expandAll(),
        onExpandTo: (key) => this.engine.expandTo(key)
      });
    }
    mount() {
      this.ui.mount(this.abortController.signal);
      this.unsubscribeEngine = this.engine.subscribe(() => this.handleEngineChange());
      this.handleEngineChange();
    }
    destroy() {
      this.abortController.abort();
      this.unsubscribeEngine?.();
      this.unsubscribeEngine = null;
      this.ui.destroy();
    }
    isStale() {
      return this.ui.isStale();
    }
    collapseAll() {
      this.engine.collapseAll();
    }
    expandAll() {
      this.engine.expandAll();
    }
    togglePanel() {
      this.ui.togglePanel();
    }
    refreshLayout() {
      this.ui.refreshLayout();
    }
    clearPageMemory() {
      this.lastPersistedStateRevision = serializePageState(createEmptyPageState());
      this.storage.clearPage(this.pageKey);
      this.engine.expandAll();
    }
    refreshDisplay(headings, displayRevision) {
      this.displayHeadings = headings;
      this.renderSnapshots(displayRevision);
    }
    getInitialCollapsedKeys() {
      return this.document.filterKnownHeadingKeys(
        this.document.containers.flatMap((container) => this.initialPageState.collapsedByContainer[container.key] ?? [])
      );
    }
    handleEngineChange() {
      this.renderSnapshots();
      this.persistState();
    }
    renderSnapshots(displayRevision) {
      this.ui.renderSnapshots(this.engine.getSnapshotsForHeadings(this.displayHeadings), displayRevision);
    }
    persistState() {
      const nextPageState = this.buildPageState();
      const nextStateRevision = serializePageState(nextPageState);
      if (nextStateRevision === this.lastPersistedStateRevision) {
        return;
      }
      this.lastPersistedStateRevision = nextStateRevision;
      this.storage.setPageState(this.pageKey, nextPageState);
    }
    buildPageState() {
      return {
        collapsedByContainer: Object.fromEntries(
          this.document.containers.map((container) => [
            container.key,
            this.engine.getCollapsedKeysForContainer(container.key)
          ])
        )
      };
    }
  };

  // src/core/document-keys.ts
  function buildSiblingBucketKey(heading) {
    return `${heading.container.key}::${heading.parentKey ?? "root"}::${heading.level}`;
  }
  function buildHeadingBaseKey(containerKey, anchor) {
    return `${containerKey}::${anchor}`;
  }
  function buildHeadingKey(containerKey, anchor, duplicateIndex) {
    const baseKey = buildHeadingBaseKey(containerKey, anchor);
    if (duplicateIndex === 0) {
      return baseKey;
    }
    return `${baseKey}::${duplicateIndex + 1}`;
  }

  // src/core/page-document.ts
  var PageDocument = class {
    constructor(options) {
      __publicField(this, "containers");
      __publicField(this, "headings");
      __publicField(this, "containerElements", /* @__PURE__ */ new Map());
      __publicField(this, "headingIndex", /* @__PURE__ */ new Map());
      __publicField(this, "headingBindings", /* @__PURE__ */ new Map());
      __publicField(this, "headingPathKeys", /* @__PURE__ */ new Map());
      __publicField(this, "siblingIndex", /* @__PURE__ */ new Map());
      this.containers = options.containers;
      this.headings = options.headings;
      options.containerElements.forEach((container) => this.containerElements.set(container.key, container.element));
      options.headings.forEach((heading) => this.headingIndex.set(heading.key, heading));
      options.headingBindings.forEach((binding) => this.headingBindings.set(binding.key, binding));
      options.headingPathKeys.forEach((pathKeys, key) => this.headingPathKeys.set(key, pathKeys));
      options.siblingIndex.forEach((siblingKeys, key) => this.siblingIndex.set(key, siblingKeys));
    }
    findHeading(key) {
      return this.headingIndex.get(key);
    }
    hasHeading(key) {
      return this.headingIndex.has(key);
    }
    getBinding(key) {
      return this.headingBindings.get(key);
    }
    getContainerElements() {
      return [...this.containerElements.values()];
    }
    getPrimaryContainerElement() {
      return this.containerElements.values().next().value ?? null;
    }
    filterKnownHeadingKeys(keys) {
      return keys.filter((key) => this.hasHeading(key));
    }
    getHeadingPath(key) {
      return (this.headingPathKeys.get(key) ?? []).map((pathKey) => this.headingIndex.get(pathKey)).filter((heading) => Boolean(heading));
    }
    getSiblingKeys(key) {
      const heading = this.findHeading(key);
      if (!heading) {
        return [];
      }
      return [...this.siblingIndex.get(buildSiblingBucketKey(heading)) ?? []];
    }
  };

  // src/parsing/document-parser.ts
  function buildDocument(containers) {
    const containerRecords = [];
    const headings = [];
    const headingBindings = [];
    const headingPathKeys = /* @__PURE__ */ new Map();
    const siblingIndex = /* @__PURE__ */ new Map();
    for (const container of containers) {
      const { containerRecord, records, bindings } = buildContainerDocument(container, headingPathKeys, siblingIndex);
      containerRecords.push(containerRecord);
      headings.push(...records);
      headingBindings.push(...bindings);
    }
    return new PageDocument({
      containers: containerRecords,
      headings,
      containerElements: containers.map((container) => ({ key: container.key, element: container.element })),
      headingBindings,
      headingPathKeys,
      siblingIndex
    });
  }
  function buildContainerDocument(container, headingPathKeys, siblingIndex) {
    const containerRecord = {
      key: container.key,
      label: container.label,
      kind: container.kind
    };
    const containerHeadings = queryHeadings(container.element);
    const records = [];
    const bindings = [];
    const ancestryStack = [];
    const duplicateHeadingCounts = /* @__PURE__ */ new Map();
    for (let index = 0; index < containerHeadings.length; index += 1) {
      const headingEl = containerHeadings[index];
      const level = getHeadingLevel(headingEl);
      const anchor = getHeadingAnchor(headingEl, index);
      const text = getHeadingText(headingEl);
      const duplicateIndex = duplicateHeadingCounts.get(anchor) ?? 0;
      duplicateHeadingCounts.set(anchor, duplicateIndex + 1);
      while (ancestryStack.length > 0 && level <= ancestryStack[ancestryStack.length - 1].level) {
        ancestryStack.pop();
      }
      const record = {
        key: buildHeadingKey(container.key, anchor, duplicateIndex),
        anchor,
        level,
        text,
        container: containerRecord,
        parentKey: ancestryStack[ancestryStack.length - 1]?.key ?? null
      };
      const binding = {
        key: record.key,
        headingEl,
        blockEl: getHeadingBlock(headingEl),
        sectionEls: []
      };
      records.push(record);
      bindings.push(binding);
      headingPathKeys.set(record.key, ancestryStack.map((heading) => heading.key));
      ancestryStack.push(record);
      const siblingBucketKey = buildSiblingBucketKey(record);
      const siblingKeys = siblingIndex.get(siblingBucketKey) ?? [];
      siblingKeys.push(record.key);
      siblingIndex.set(siblingBucketKey, siblingKeys);
    }
    populateSectionElements(container.element, records, bindings);
    return {
      containerRecord,
      records,
      bindings
    };
  }
  function populateSectionElements(containerElement, records, bindings) {
    if (records.length === 0) {
      return;
    }
    if (bindings.every((binding) => binding.blockEl.parentElement === containerElement)) {
      const headingIndexByBlock = /* @__PURE__ */ new Map();
      bindings.forEach((binding, index) => headingIndexByBlock.set(binding.blockEl, index));
      const openHeadingIndexes = [];
      for (const child of Array.from(containerElement.children)) {
        if (child.closest(".ghcm-root")) {
          continue;
        }
        const headingIndex = headingIndexByBlock.get(child);
        if (headingIndex === void 0) {
          openHeadingIndexes.forEach((index) => bindings[index].sectionEls.push(child));
          continue;
        }
        while (openHeadingIndexes.length > 0 && records[openHeadingIndexes[openHeadingIndexes.length - 1]].level >= records[headingIndex].level) {
          openHeadingIndexes.pop();
        }
        openHeadingIndexes.forEach((index) => bindings[index].sectionEls.push(child));
        openHeadingIndexes.push(headingIndex);
      }
      return;
    }
    const boundaryIndexes = computeBoundaryIndexes(records);
    for (let index = 0; index < bindings.length; index += 1) {
      const current = bindings[index];
      const boundaryIndex = boundaryIndexes[index];
      const boundary = boundaryIndex === null ? null : bindings[boundaryIndex].blockEl;
      let cursor = current.blockEl.nextElementSibling;
      while (cursor && cursor !== boundary) {
        if (!cursor.closest(".ghcm-root")) {
          current.sectionEls.push(cursor);
        }
        cursor = cursor.nextElementSibling;
      }
    }
  }
  function computeBoundaryIndexes(records) {
    const boundaryIndexes = new Array(records.length).fill(null);
    const nextHeadingIndexByLevel = new Array(7).fill(void 0);
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const currentLevel = records[index].level;
      let boundaryIndex;
      for (let level = 1; level <= currentLevel; level += 1) {
        const candidateIndex = nextHeadingIndexByLevel[level];
        if (candidateIndex === void 0) {
          continue;
        }
        if (boundaryIndex === void 0 || candidateIndex < boundaryIndex) {
          boundaryIndex = candidateIndex;
        }
      }
      boundaryIndexes[index] = boundaryIndex ?? null;
      nextHeadingIndexByLevel[currentLevel] = index;
    }
    return boundaryIndexes;
  }

  // src/app/page-session-resolver.ts
  function findMatchingAdapter(adapters2, location) {
    return adapters2.find((candidate) => candidate.matches(location)) ?? null;
  }
  function resolvePageSession(adapters2, document2, location) {
    const adapter = findMatchingAdapter(adapters2, location);
    if (!adapter) {
      return { kind: "unsupported" };
    }
    const pageKey = adapter.getPageKey(location);
    const containers = adapter.findContainers(document2);
    if (containers.length === 0) {
      return {
        kind: "empty",
        version: buildPageVersion(adapter.id, pageKey, [])
      };
    }
    const parsedDocument = buildDocument(containers);
    return {
      kind: "ready",
      spec: {
        adapter,
        pageKey,
        document: parsedDocument,
        version: buildPageVersion(adapter.id, pageKey, parsedDocument.headings)
      }
    };
  }

  // src/app/app.ts
  var GitHubCollapseMarkdownApp = class {
    constructor() {
      __publicField(this, "storage", new StorageService());
      __publicField(this, "abortController", new AbortController());
      __publicField(this, "lifecycle", new AppLifecycle({
        onRefreshRequested: () => this.scheduleRefresh(),
        onKeydown: (event) => this.handleKeydown(event),
        resolveMutationAdapter: () => findMatchingAdapter(adapters, window.location)
      }));
      __publicField(this, "session", null);
      __publicField(this, "lastPageVersion", null);
      __publicField(this, "refreshTimer", 0);
      __publicField(this, "styleInjected", false);
    }
    start() {
      this.injectStyles();
      this.registerMenuCommands();
      this.bindLifecycleEvents();
      this.refresh();
    }
    handleKeydown(event) {
      if (isEditableTarget(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || !event.shiftKey) {
        return;
      }
      if (key === "m") {
        event.preventDefault();
        this.session?.togglePanel();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        this.session?.collapseAll();
        return;
      }
      if (key === "e") {
        event.preventDefault();
        this.session?.expandAll();
      }
    }
    destroy() {
      this.cancelScheduledRefresh();
      this.abortController.abort();
      this.lifecycle.destroy();
      this.teardownSession();
    }
    bindLifecycleEvents() {
      this.lifecycle.bind(this.abortController.signal);
    }
    registerMenuCommands() {
      registerUserscriptMenuCommand("Toggle panel", () => this.session?.togglePanel());
      registerUserscriptMenuCommand("Collapse all", () => this.session?.collapseAll());
      registerUserscriptMenuCommand("Expand all", () => this.session?.expandAll());
      registerUserscriptMenuCommand("Clear current page memory", () => this.session?.clearPageMemory());
    }
    injectStyles() {
      if (this.styleInjected) {
        return;
      }
      if (!injectUserscriptStyle(styles)) {
        const style = document.createElement("style");
        style.textContent = styles;
        document.head.append(style);
      }
      this.styleInjected = true;
    }
    refresh() {
      const resolution = resolvePageSession(adapters, document, window.location);
      if (resolution.kind === "unsupported") {
        this.lastPageVersion = null;
        this.teardownSession();
        return;
      }
      if (resolution.kind === "empty") {
        this.lastPageVersion = resolution.version;
        this.teardownSession();
        return;
      }
      const { spec } = resolution;
      if (this.session && !this.session.isStale() && hasSamePageStructure(this.lastPageVersion, spec.version)) {
        if (!hasSamePageDisplay(this.lastPageVersion, spec.version)) {
          this.session.refreshDisplay(spec.document.headings, spec.version.display);
        }
        this.session.refreshLayout();
        this.lastPageVersion = spec.version;
        return;
      }
      this.lastPageVersion = spec.version;
      this.teardownSession();
      this.session = new PageSession(
        spec.pageKey,
        spec.adapter,
        spec.document,
        this.storage
      );
      this.session.mount();
    }
    scheduleRefresh() {
      this.cancelScheduledRefresh();
      this.refreshTimer = window.setTimeout(() => {
        this.refreshTimer = 0;
        this.refresh();
      }, 80);
    }
    cancelScheduledRefresh() {
      if (this.refreshTimer === 0) {
        return;
      }
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = 0;
    }
    teardownSession() {
      this.session?.destroy();
      this.session = null;
    }
  };

  // src/main.ts
  var app = new GitHubCollapseMarkdownApp();
  app.start();
  Object.assign(window, {
    ghcmApp: app
  });
})();
