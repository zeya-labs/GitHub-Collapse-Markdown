# QA Report

## Date

- Test date: 2026-11-06

## Latest fixes and validation

- Version 5.2.4: `npm run verify` passes the TypeScript check, 170 automated tests, and userscript build. Both userscript outputs match.
- Fixed a lifecycle gap that left contents above the README when metadata arrived after initial mounting. Native sidebar insertion, hydration, replacement, removal, and metadata added outside the original grid now trigger placement resolution. Script-owned outline updates and moves remain excluded from refresh filtering.
- Five new integration regressions fail against 5.2.3 and pass with the fix, without resize events, Markdown edits, or navigation events. The existing panel and heading controls are retained for insertion, hydration, and host promotion; removed/replaced sidebars recover one usable outline automatically.
- A Chromium before/after run uses the downloaded `zeya-labs/GitHub-Collapse-Markdown` README and complete metadata pane with local Primer CSS and layout shims. The same 22 checks pass 12/22 on 5.2.3 and 22/22 on 5.2.4. All five lifecycle failures are reproduced before the fix and recover afterward without resizing; the outline follows scrolling after migration. Screenshots and video capture the delayed-sidebar transition. The complete downloaded HTML also serves as a static host-discovery control, without claiming its blocked external styling was rendered faithfully.
- The repository outline belongs after all native sidebar metadata, including About, Releases, and Languages. It starts in normal document flow, follows reading after reaching the sticky offset, and avoids the reading-region end. This is core behavior, not an optional layout enhancement.
- All 25 Chromium sidebar-flow checks also pass again on 5.2.4 against the built userscript with a downloaded modern GitHub metadata pane and Node.js README, local Primer CSS, and modern/table layout fixtures. Coverage includes metadata order, normal scrolling before pinning, following beyond a short sidebar's bottom, internal outline scrolling, footer avoidance, return to normal flow, late metadata, visible sidebars at 1000px, hidden-sidebar fallback, and legacy sidebar following. The scroll sequence was also recorded.
- Modern `SplitPageLayout.Pane` metadata hosts and older sidebar grids are both supported. The complete metadata owner is used when native sections have sibling containers. Navigation panes are excluded, late native sections remain before the outline, and the reading region supplies the follow boundary instead of the short metadata pane.
- Sidebar visibility determines placement; there is no fixed viewport-width gate. Flow height remains stable when the outline initially starts below the viewport, and content measurement preserves internal scrolling for long outlines.
- Earlier 5.2.2 validation passed 40 Chromium layout checks, 23 focused interaction checks, and 18 floating-window checks with official Primer CSS and native fixtures. GitHub static assets are blocked by the environment, so these local reproductions do not establish full live-site or userscript-manager compatibility.
- Interaction styling follows the official [Primer ActionList source](https://github.com/primer/react/blob/main/packages/react/src/ActionList/ActionList.module.css): neutral transparent-control hover/active colors, 6px/8px content padding, medium radius, 14px/20px text, 32px mouse rows, and pointer-coarse touch targets. Narrow mouse windows keep compact spacing.
- The focused interaction checks cover native hover/press color matching, compact mouse and coarse-pointer spacing, keyboard focus, real touch response and release, and correct current-section remeasurement after opening inline contents.
- Current-section state uses text weight and a small indicator without a filled background. Hover is limited to hover-capable fine pointers; pressing, keyboard focus, and current-section state are independent. Native browser tap overlays are suppressed in favor of the same neutral active feedback.
- Placement prefers a visible native metadata sidebar at any viewport width, then a safe visible Markdown container. Inline contents starts collapsed; hidden previews, editors, navigation, and invalid insertion hosts are excluded. Other containers are tried before falling back to a floating panel.
- Floating-window checks cover real mouse/touch movement, keyboard steps, close/reopen position, stable height at viewport edges, resize clamping, and capture cleanup.
- The fallback is a nonmodal, draggable window. It supports pointer and keyboard movement, viewport bounds, remembered position while the session remains mounted, and focus restoration without disabling the page.
- The header shows Contents and two compact controls: actions and close. Bulk commands live in a native details disclosure; Escape, outside dismissal, focus return, and bottom-edge menu placement are covered.
- Removed decorative outline rails, per-level color aliases, three layout wrappers, redundant heading state, and Unicode toggle text. Heading chevrons use the button expanded state while preserving native heading metrics.
- Native fonts, theme colors, spacing tokens, first-heading margins, and sidebar cell padding are preserved. The panel no longer removes neighboring borders or wraps inline contents in another card.
- Expanding, collapsing, or moving contents invalidates cached heading positions after layout settles, so current-section marking follows actual document positions.
- Visibility and text-node changes update rendered previews and headings; sidebar visibility changes re-evaluate placement without rebuilding heading controls.
- Fixed inline outline clipping, the heading visibility CSS cascade, cross-container collapsed ancestry, stale active-heading positions, and updated outline text reverting after an action.
- Panel DOM rendering, action disclosure, focus, dragging, placement, and geometry have separate responsibilities. Heading-button state updates are centralized and collapse ancestry reuses parsed parent relationships.

The live DOM sources listed below were collected for the original 2026-04-17 fixtures; they are retained as historical coverage, not current live-browser validation.

## Requirement analysis

The repository historically promised a larger feature set than the current `v5` rebuild implements.
Using the previous tracked `README.md` as the baseline, the requirements split into three groups:

### P0: must work

- Place repository contents after all native sidebar metadata and follow document scrolling in that sidebar; only use inline/floating fallbacks when a usable sidebar is unavailable
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
  - Late sidebar insertion and metadata hydration move existing inline contents into the sidebar without resizing
  - Sidebar replacement/removal restores one usable outline, and later native siblings remain before contents
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

- Native metadata order, modern and legacy sidebar hosts, scroll-follow geometry, and visible-sidebar priority without a viewport-width gate
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
