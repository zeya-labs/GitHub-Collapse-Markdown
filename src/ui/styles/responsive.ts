export const responsiveStyles = `
  @media (max-width: 1179px), (pointer: coarse) {
    .ghcm-root .ghcm-trigger,
    .ghcm-root .ghcm-inline-action,
    .ghcm-root .ghcm-outline-link,
    .ghcm-root.is-overlay .ghcm-drag-handle {
      min-width: 44px;
      min-height: 44px;
    }

    .ghcm-root .ghcm-inline-action {
      padding: var(--ghcm-space-1) var(--ghcm-space-2);
    }

    .ghcm-root .ghcm-outline-link {
      align-items: center;
    }
  }

  @media (max-width: 599px) {
    .ghcm-sidebar-header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;
