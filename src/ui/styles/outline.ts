export const outlineStyles = `
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

  .ghcm-outline-link {
    appearance: none;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    width: 100%;
    min-height: 28px;
    border: none;
    background: transparent;
    border-radius: 4px;
    margin: 0;
    padding: var(--ghcm-space-1) var(--ghcm-space-2) var(--ghcm-space-1)
      calc(var(--ghcm-space-2) + (var(--ghcm-depth, 0) * var(--ghcm-space-3)));
    cursor: pointer;
    text-align: left;
    transition: background-color 120ms ease, opacity 120ms ease;
  }

  .ghcm-outline-link:hover {
    background: var(--ghcm-surface-subtle);
  }

  .ghcm-outline-link.is-active {
    background: var(--ghcm-surface-accent);
    box-shadow: inset 2px 0 var(--ghcm-accent);
  }

  .ghcm-outline-link.is-muted {
    opacity: 0.62;
  }

  .ghcm-outline-label {
    display: block;
    min-width: 0;
    color: var(--ghcm-ink-soft);
    font-size: 13px;
    font-weight: 400;
    line-height: 1.5;
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
