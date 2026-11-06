import type { CollapseEngine } from "../core/collapse-engine";
import type { PageDocument } from "../core/page-document";
import type { HeadingBinding, HeadingRecord, HeadingSnapshot } from "../core/types";
import { getSelectionText, isInteractiveTarget } from "../utils/dom";

function createToggleButton(text: string, collapsed: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghcm-heading-toggle";
  syncToggleButton(button, text, collapsed);
  return button;
}

function syncToggleButton(button: HTMLButtonElement, text: string, collapsed: boolean): void {
  const symbol = collapsed ? "▸" : "▾";
  if (button.textContent !== symbol) {
    button.textContent = symbol;
  }
  button.title = text;
  button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} section: ${text}`);
  button.setAttribute("aria-expanded", String(!collapsed));
}

export class HeadingControls {
  private readonly toggleElements = new Map<string, HTMLButtonElement>();

  constructor(private readonly document: PageDocument, private readonly engine: CollapseEngine) {}

  mount(signal: AbortSignal): void {
    for (const heading of this.document.headings) {
      this.mountHeading(heading, signal);
    }
  }

  sync(snapshots: HeadingSnapshot[]): void {
    for (const snapshot of snapshots) {
      const binding = this.document.getBinding(snapshot.key);
      if (!binding) {
        continue;
      }

      binding.blockEl.classList.toggle("ghcm-hidden-by-parent", snapshot.hiddenByAncestor);
      binding.blockEl.classList.toggle("ghcm-collapsed", snapshot.collapsed);
      binding.blockEl.classList.toggle("ghcm-visible-heading", !snapshot.hiddenByAncestor);
      binding.blockEl.setAttribute("aria-expanded", String(!snapshot.collapsed));

      const toggle = this.toggleElements.get(snapshot.key);
      if (toggle) {
        syncToggleButton(toggle, snapshot.text, snapshot.collapsed);
      }

      for (const element of binding.sectionEls) {
        element.classList.toggle("ghcm-section-hidden", snapshot.hiddenByAncestor || snapshot.collapsed);
      }
    }
  }

  isConnected(): boolean {
    return this.document.headings.every((heading) => {
      const binding = this.document.getBinding(heading.key);
      const toggle = this.toggleElements.get(heading.key);

      return Boolean(
        binding &&
        binding.headingEl.isConnected &&
        binding.blockEl.isConnected &&
        toggle?.isConnected
      );
    });
  }

  destroy(): void {
    for (const toggle of this.toggleElements.values()) {
      toggle.remove();
    }
    this.toggleElements.clear();

    for (const heading of this.document.headings) {
      const binding = this.document.getBinding(heading.key);
      if (!binding) {
        continue;
      }

      binding.blockEl.classList.remove("ghcm-heading-block", "ghcm-heading-block--wrapped");
      binding.blockEl.classList.remove("ghcm-hidden-by-parent", "ghcm-collapsed", "ghcm-visible-heading");
      binding.blockEl.removeAttribute("aria-expanded");
      binding.headingEl.classList.remove("ghcm-heading-inline");
      binding.sectionEls.forEach((element) => element.classList.remove("ghcm-section-hidden"));
    }
  }

  private mountHeading(heading: HeadingRecord, signal: AbortSignal): void {
    const binding = this.document.getBinding(heading.key);
    if (!binding) {
      return;
    }

    const wrapped = binding.blockEl !== binding.headingEl;
    binding.blockEl.classList.add("ghcm-heading-block");
    if (wrapped) {
      binding.blockEl.classList.add("ghcm-heading-block--wrapped");
    } else {
      binding.headingEl.classList.add("ghcm-heading-inline");
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

  private toggleHeading(key: string, event: MouseEvent): void {
    event.preventDefault();
    if (event.shiftKey) {
      this.engine.toggleWithSiblings(key);
    } else {
      this.engine.toggle(key);
    }
  }
}

function isNativePermalinkTarget(binding: HeadingBinding, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const permalink = target.closest("a.anchor, a.heading-link");
  return Boolean(permalink && binding.blockEl.contains(permalink));
}
