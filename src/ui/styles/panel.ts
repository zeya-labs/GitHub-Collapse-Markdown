export const panelStyles = `
  .ghcm-trigger {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: var(--ghcm-space-1);
    margin: 0;
    border: 0;
    border-radius: 4px;
    padding: var(--ghcm-space-1) 0;
    background: transparent;
    color: var(--ghcm-ink-soft);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .ghcm-trigger::before {
    content: "▸";
    font-size: 12px;
  }

  .ghcm-trigger:hover {
    color: var(--ghcm-accent);
  }

  .ghcm-trigger.is-hidden,
  .ghcm-inline-action.is-hidden {
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
    overflow: hidden;
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
    padding: var(--ghcm-space-1) var(--ghcm-space-2);
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
    border-radius: 6px;
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

  .ghcm-sidebar-shell {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }

  .ghcm-sidebar-header {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
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
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ghcm-space-2);
  }

  .ghcm-inline-action {
    appearance: none;
    margin: 0;
    border: 0;
    border-radius: 4px;
    padding: 0;
    background: transparent;
    color: var(--ghcm-accent);
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .ghcm-inline-action:hover {
    color: var(--ghcm-ink);
    text-decoration: underline;
  }

  .ghcm-sidebar-outline {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    margin: 0;
    padding: 0;
  }

  .ghcm-root.is-overlay .ghcm-sidebar-outline {
    padding: var(--ghcm-space-2);
  }
`;
