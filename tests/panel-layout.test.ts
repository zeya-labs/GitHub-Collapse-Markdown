import { describe, expect, it, vi } from "vitest";
import { computeDockedPanelFrame, measureDockedPanel, type DockedPanelMeasurement } from "../src/ui/panel-frame";

function createMeasurement(overrides: Partial<DockedPanelMeasurement> = {}): DockedPanelMeasurement {
  return {
    boundaryViewportBottom: Number.POSITIVE_INFINITY,
    cellLeft: 1080,
    cellWidth: 320,
    naturalPanelHeight: 360,
    rowViewportTop: 120,
    ...overrides
  };
}

describe("computeDockedPanelFrame", () => {
  it("keeps native sidebar cell padding when measuring the fixed panel content box", () => {
    const dockRow = document.createElement("div");
    const dockCell = document.createElement("div");
    const panel = document.createElement("aside");
    dockCell.style.cssText = "padding:16px 12px;border:1px solid";
    vi.spyOn(dockRow, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ y: 120 }));
    vi.spyOn(dockCell, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 1080, y: 120, width: 320 }));

    const measured = measureDockedPanel({ dockRow, dockCell, panel }, { host: dockRow, topOffset: 80 });

    expect(measured.cellLeft).toBe(1093);
    expect(measured.cellWidth).toBe(294);
    expect(measured.rowViewportTop).toBe(137);
  });

  it("clamps the panel height to the dock boundary when the natural height would overflow", () => {
    const frame = computeDockedPanelFrame(
      createMeasurement({
        boundaryViewportBottom: 670,
        naturalPanelHeight: 800,
        rowViewportTop: 40
      }),
      7,
      900
    );

    expect(frame).toEqual({
      mode: "flow",
      panelLeft: 1080,
      panelHeight: 630,
      panelMaxHeight: 630,
      panelTop: 40,
      panelWidth: 320,
      rowHeight: 0
    });
  });

  it("shifts the panel upward near the page end before shrinking it", () => {
    const frame = computeDockedPanelFrame(
      createMeasurement({
        boundaryViewportBottom: 410,
        naturalPanelHeight: 420,
        rowViewportTop: -600
      }),
      7,
      900
    );

    expect(frame).toEqual({
      mode: "fixed",
      panelLeft: 1080,
      panelHeight: 420,
      panelMaxHeight: 420,
      panelTop: -10,
      panelWidth: 320,
      rowHeight: 420
    });
  });

  it("pins the panel below the sticky header when the row starts above it", () => {
    const frame = computeDockedPanelFrame(
      createMeasurement({
        naturalPanelHeight: 240,
        rowViewportTop: 20
      }),
      80,
      900
    );

    expect(frame).toEqual({
      mode: "fixed",
      panelLeft: 1080,
      panelHeight: 240,
      panelMaxHeight: 804,
      panelTop: 80,
      panelWidth: 320,
      rowHeight: 240
    });
  });

  it("keeps the panel in the sidebar flow before it reaches the sticky threshold", () => {
    const frame = computeDockedPanelFrame(
      createMeasurement({
        naturalPanelHeight: 540,
        rowViewportTop: 140
      }),
      80,
      900
    );

    expect(frame).toEqual({
      mode: "flow",
      panelLeft: 1080,
      panelHeight: 540,
      panelMaxHeight: 744,
      panelTop: 140,
      panelWidth: 320,
      rowHeight: 0
    });
  });
});
