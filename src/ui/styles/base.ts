export const baseStyles = `
  .ghcm-root {
    all: initial;
    display: block;
    width: 100%;
    min-width: 0;
    font: inherit;
    color: var(--fgColor-default, var(--color-fg-default, inherit));
    --ghcm-space-1: var(--base-size-4, 4px);
    --ghcm-space-2: var(--base-size-8, 8px);
    --ghcm-space-3: var(--base-size-12, 12px);
    --ghcm-space-4: var(--base-size-16, 16px);
    --ghcm-ink: var(--fgColor-default, var(--color-fg-default, currentColor));
    --ghcm-ink-soft: var(--fgColor-muted, var(--color-fg-muted, #59636e));
    --ghcm-ink-muted: var(--ghcm-ink-soft);
    --ghcm-line: var(--borderColor-default, var(--color-border-default, #d0d7de));
    --ghcm-surface: var(--bgColor-default, var(--color-canvas-default, #ffffff));
    --ghcm-surface-subtle: var(--bgColor-muted, var(--color-canvas-subtle, #f6f8fa));
    --ghcm-surface-accent: var(--bgColor-accent-muted, var(--color-accent-subtle, rgba(9, 105, 218, 0.08)));
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

  .ghcm-root :is(.ghcm-trigger, .ghcm-actions-trigger, .ghcm-close-action, .ghcm-inline-action, .ghcm-outline-link, .ghcm-drag-handle):focus-visible {
    outline: 2px solid var(--ghcm-accent);
    outline-offset: 2px;
  }

  .ghcm-root .ghcm-outline-link:focus-visible {
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
