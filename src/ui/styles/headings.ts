export const headingStyles = `
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
