# QA Report

## Date

- Test date: 2026-11-06

## Latest fixes and validation

- Version 5.2.0: `npm run verify` passes the TypeScript check, 132 automated tests, and userscript build. Both userscript outputs match.
- 24 Chromium embedding checks pass with official Primer CSS and native table/sidebar fixtures, including the downloaded Node.js README. GitHub static assets are blocked by the environment, so these local fixtures do not establish full live-site or userscript-manager compatibility.
- Placement prefers a usable desktop sidebar, then a safe visible Markdown container on every screen size. Inline contents starts collapsed; hidden previews, editors, navigation, and invalid insertion hosts are excluded. Other containers are tried before falling back to a floating panel.
- All 18 Chromium floating-window checks pass, including real mouse/touch movement, keyboard steps, close/reopen position, stable height at viewport edges, resize clamping, and capture cleanup.
- The fallback is a nonmodal, draggable window. It supports pointer and keyboard movement, viewport bounds, remembered position while the session remains mounted, and focus restoration without disabling the page.
- Native fonts, theme colors, spacing tokens, first-heading margins, and sidebar cell padding are preserved. The panel no longer removes neighboring borders or wraps inline contents in another card.
- Visibility and text-node changes update rendered previews and headings; sidebar visibility changes re-evaluate placement without rebuilding heading controls.
- Fixed inline outline clipping, the heading visibility CSS cascade, cross-container collapsed ancestry, stale active-heading positions, and updated outline text reverting after an action.
- Panel DOM, focus, dragging, placement, and geometry have separate responsibilities. Heading-button state updates are centralized and collapse ancestry reuses parsed parent relationships.

The live DOM sources listed below were collected for the original 2026-04-17 fixtures; they are retained as historical coverage, not current live-browser validation.

## Requirement analysis

The repository historically promised a larger feature set than the current `v5` rebuild implements.
Using the previous tracked `README.md` as the baseline, the requirements split into three groups:

### P0: must work

- Detect rendered Markdown containers on:
  - GitHub repository/file pages
  - Issue / Pull Request comment bodies
  - Gist rendered pages
  - GitHub Docs article pages
- Click heading to collapse/expand its section
- Preserve nested heading visibility rules
- Do not hijack native heading anchors
- Mount and remount correctly after Turbo / PJAX / DOM updates
- Provide a usable control surface and basic shortcuts

### P1: should exist in current usable version

- Collapse all / expand all
- Outline navigation
- Per-page state memory
- Basic keyboard workflow

### P2: explicitly de-scoped in the simplified redesign

- Search headings
- Smart toggle
- Dedicated TOC shortcut
- Bookmarks
- Vim navigation
- Level filters in search
- Large settings surface
- Performance mode
- Debug mode
- Appearance presets / color customization
- Help panel

## Automated test coverage added

### DOM / adapter coverage

- `tests/adapters.realistic.test.ts`
  - GitHub modern markdown page fixture
  - GitHub comment-body fixture
  - Gist fixture
  - Docs article fixture

### Core model coverage

- `tests/document-model.test.ts`
  - Section boundary detection
- `tests/collapse-engine.test.ts`
  - Parent collapse hides nested headings and content
- `tests/docs-heading-controls.test.ts`
  - Docs native heading links do not accidentally trigger collapse

### App-level integration coverage

- `tests/app.integration.test.ts`
  - App mounts on a realistic GitHub markdown page
  - Clicking headings collapses sections
  - Clicking native anchor icons does not collapse
  - Panel actions work
  - Collapsed state is restored on remount
  - Delayed markdown injection triggers mount
  - Shift-click sibling collapse
  - Core shortcuts (`M / C / E`)
  - GitHub internal markdown re-render triggers re-mount

## Live DOM validation sources

These pages were fetched on 2026-04-17 and used to verify current DOM assumptions:

- `https://github.com/facebook/react/blob/main/README.md`
- `https://github.com/nodejs/node/blob/main/README.md`
- `https://github.com/nodejs/node/pull/1`
- `https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax`

## Current status

### Verified working in automated tests

- Modern GitHub markdown container detection
- Comment-body container detection
- Gist markdown container detection
- Docs article detection
- Nested collapse / expand behavior
- Basic floating panel workflow
- State persistence
- Mutation-driven mount after late content insertion

### Simplified product scope

The current redesign intentionally narrows the feature surface to core reading tasks:

- click-to-fold headings
- collapse all / expand all
- outline navigation
- page-state memory

Removed from the UI and interaction model on purpose:

- bookmarks
- Vim navigation
- level filters
- search
- smart toggle
- dedicated TOC shortcut
- large preference surface

## Conclusion

The script is now oriented around a much tighter product contract.

Current assessment after the simplification round:

- P0 behavior is covered and passing
- the reading workflow is smaller but cleaner
- the main remaining work is visual polish across more real GitHub surfaces, not feature expansion

Next work, if continued, should focus on:

1. broader real-page smoke testing
2. micro-interaction polish
3. performance validation on very large documents
