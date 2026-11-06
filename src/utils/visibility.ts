const HIDDEN_CONTEXT_SELECTOR = "[hidden], [aria-hidden='true'], [inert], template, details:not([open])";
const EDITABLE_CONTEXT_SELECTOR = "textarea, input, select, [contenteditable]:not([contenteditable='false']), [role='textbox']";

export function isVisibleElement(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest(HIDDEN_CONTEXT_SELECTOR)) {
    return false;
  }

  const view = element.ownerDocument.defaultView;
  if (!view) {
    return false;
  }

  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = view.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") {
      return false;
    }
  }

  // Non-layout environments cannot distinguish an empty box from a hidden host.
  if (element.ownerDocument.documentElement.clientWidth > 0 &&
    view.getComputedStyle(element).display !== "contents" && element.getBoundingClientRect().width <= 0) {
    return false;
  }

  return true;
}

export function isEditableElement(element: HTMLElement): boolean {
  return Boolean(element.closest(EDITABLE_CONTEXT_SELECTOR));
}
