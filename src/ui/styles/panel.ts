export const panelStyles = `
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
