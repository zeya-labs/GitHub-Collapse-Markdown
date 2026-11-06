import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollToElementWithOffset } from "../src/utils/dom";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("heading navigation motion preferences", () => {
  it.each([true, false])("respects reduced motion: %s", (reducedMotion) => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reducedMotion })));
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const heading = document.createElement("h2");
    vi.spyOn(heading, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ y: 200 }));

    scrollToElementWithOffset(heading, 80);

    expect(scrollTo).toHaveBeenCalledWith({ top: 120, behavior: reducedMotion ? "instant" : "smooth" });
  });
});
