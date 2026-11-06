import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDockedPanelFrame, computeDockedPanelFrame, measureDockedPanel, type DockedPanelMeasurement } from "../src/ui/panel-frame";
import { PanelLayout } from "../src/ui/panel-layout";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("starts following from the cell content position when the containing row has its own inset", () => {
    const dockRow = document.createElement("div");
    const dockCell = document.createElement("div");
    const panel = document.createElement("aside");
    vi.spyOn(dockRow, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ y: 120 }));
    vi.spyOn(dockCell, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ y: 137, width: 320 }));

    const measured = measureDockedPanel({ dockRow, dockCell, panel }, { host: dockRow, topOffset: 80 });

    expect(measured.rowViewportTop).toBe(137);
  });

  it("caps the normal-flow outline to a stable viewport height without truncating its sidebar space", () => {
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
      panelHeight: 800,
      panelMaxHeight: 877,
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
      panelMaxHeight: 804,
      panelTop: 140,
      panelWidth: 320,
      rowHeight: 0
    });
  });

  it("applies the viewport height limit while the panel is still in normal flow", () => {
    const root = document.createElement("div");
    const dockRow = document.createElement("div");
    const frame = computeDockedPanelFrame(
      createMeasurement({ naturalPanelHeight: 1200, rowViewportTop: 600 }),
      80,
      900
    );

    applyDockedPanelFrame({ root, dockRow }, frame);

    expect(root.classList.contains("is-floating")).toBe(false);
    expect(root.style.getPropertyValue("--ghcm-panel-height")).toBe("804px");
    expect(root.style.getPropertyValue("--ghcm-panel-max-height")).toBe("804px");
    expect(root.style.minHeight).toBe("");
    expect(dockRow.style.minHeight).toBe("");
  });

  it("preserves the outline's normal-flow space below long native sidebar metadata", () => {
    const frame = computeDockedPanelFrame(
      createMeasurement({ boundaryViewportBottom: 1100, naturalPanelHeight: 1200, rowViewportTop: 1100 }),
      80,
      900
    );

    expect(frame.mode).toBe("flow");
    expect(frame.panelHeight).toBe(804);
    expect(frame.panelMaxHeight).toBe(804);
  });

  it("measures the full outline after its scrolling viewport has been constrained", () => {
    const dockRow = document.createElement("div");
    const dockCell = document.createElement("div");
    const panel = document.createElement("aside");
    const header = document.createElement("header");
    const outline = document.createElement("nav");
    panel.append(header, outline);
    vi.spyOn(panel, "offsetHeight", "get").mockReturnValue(100);
    vi.spyOn(panel, "scrollHeight", "get").mockReturnValue(100);
    vi.spyOn(header, "offsetHeight", "get").mockReturnValue(36);
    vi.spyOn(outline, "clientHeight", "get").mockReturnValue(64);
    vi.spyOn(outline, "scrollHeight", "get").mockReturnValue(800);

    const measured = measureDockedPanel({ dockRow, dockCell, panel, outline }, { host: dockRow, topOffset: 80 });

    expect(measured.naturalPanelHeight).toBe(836);
  });

  it("uses the outline content extent instead of retaining a previous expanded height", () => {
    const dockRow = document.createElement("div");
    const dockCell = document.createElement("div");
    const panel = document.createElement("aside");
    const header = document.createElement("header");
    const outline = document.createElement("nav");
    const lastHeading = document.createElement("button");
    outline.append(lastHeading);
    outline.scrollTop = 80;
    panel.append(header, outline);
    vi.spyOn(panel, "offsetHeight", "get").mockReturnValue(804);
    vi.spyOn(panel, "scrollHeight", "get").mockReturnValue(804);
    vi.spyOn(header, "offsetHeight", "get").mockReturnValue(36);
    vi.spyOn(outline, "scrollHeight", "get").mockReturnValue(768);
    vi.spyOn(outline, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ y: 116, height: 768 }));
    vi.spyOn(lastHeading, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ y: 124, height: 32 }));

    const measured = measureDockedPanel({ dockRow, dockCell, panel, outline }, { host: dockRow, topOffset: 80 });

    expect(measured.naturalPanelHeight).toBe(156);
  });
});

function createLayoutFixture() {
  const boundary = document.createElement("main");
  const host = document.createElement("aside");
  const dockRow = document.createElement("div");
  const dockCell = document.createElement("div");
  const root = document.createElement("div");
  const panel = document.createElement("aside");
  boundary.append(host);
  root.append(panel);
  dockCell.append(root);
  dockRow.append(dockCell);
  document.body.append(boundary);
  let rowTop = 200;
  let boundaryBottom = 4000;
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => frames.delete(id));
  vi.spyOn(dockRow, "getBoundingClientRect").mockImplementation(() => DOMRect.fromRect({ y: rowTop }));
  vi.spyOn(dockCell, "getBoundingClientRect").mockImplementation(() => DOMRect.fromRect({ x: 720, y: rowTop, width: 260 }));
  vi.spyOn(boundary, "getBoundingClientRect").mockImplementation(() => DOMRect.fromRect({ height: boundaryBottom }));
  vi.spyOn(panel, "scrollHeight", "get").mockReturnValue(400);
  const layout = new PanelLayout({ dockRow, dockCell, root, panel }, {
    resolveDockedLayout: () => ({ host, boundary, topOffset: 80 })
  });
  const controller = new AbortController();
  layout.bind(controller.signal);

  return {
    boundary, host, dockRow, root, panel, layout,
    setRowTop: (value: number) => { rowTop = value; },
    setBoundaryBottom: (value: number) => { boundaryBottom = value; },
    flush: () => {
      const pending = Array.from(frames.values());
      frames.clear();
      pending.forEach((callback) => callback(0));
    },
    destroy: () => { controller.abort(); layout.destroy(); }
  };
}

describe("PanelLayout sidebar following", () => {
  it("uses an available sidebar and follows it from normal flow to the reading boundary and back", () => {
    const fixture = createLayoutFixture();
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
    fixture.layout.sync(true);
    fixture.flush();
    expect(fixture.layout.getPlacement()).toBe("docked");
    expect(fixture.root.classList.contains("is-floating")).toBe(false);

    fixture.setRowTop(-300);
    window.dispatchEvent(new Event("scroll"));
    fixture.flush();
    expect(fixture.root.classList.contains("is-floating")).toBe(true);
    expect(fixture.root.style.getPropertyValue("--ghcm-panel-top")).toBe("80px");

    fixture.setBoundaryBottom(300);
    window.dispatchEvent(new Event("scroll"));
    fixture.flush();
    expect(fixture.root.style.getPropertyValue("--ghcm-panel-top")).toBe("-130px");

    fixture.setRowTop(200);
    fixture.setBoundaryBottom(4000);
    window.dispatchEvent(new Event("scroll"));
    fixture.flush();
    expect(fixture.root.classList.contains("is-floating")).toBe(false);
    expect(fixture.root.style.getPropertyValue("--ghcm-panel-top")).toBe("");
    fixture.destroy();
  });

  it("keeps asynchronously appended native sidebar sections before the outline without repeated mutations", async () => {
    const fixture = createLayoutFixture();
    fixture.layout.sync(true);
    fixture.flush();
    const append = vi.spyOn(fixture.host, "append");
    const languages = document.createElement("section");
    languages.textContent = "Languages";
    fixture.host.append(languages);

    await Promise.resolve();
    fixture.flush();
    await Promise.resolve();
    fixture.flush();

    expect(fixture.host.lastElementChild).toBe(fixture.dockRow);
    expect(append).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  it("updates following coordinates when an ancestor scrolls or the viewport is resized", () => {
    const fixture = createLayoutFixture();
    fixture.layout.sync(true);
    fixture.flush();

    fixture.setRowTop(-300);
    fixture.boundary.dispatchEvent(new Event("scroll"));
    fixture.flush();
    expect(fixture.root.style.getPropertyValue("--ghcm-panel-top")).toBe("80px");

    vi.spyOn(window, "innerHeight", "get").mockReturnValue(300);
    window.dispatchEvent(new Event("resize"));
    fixture.flush();
    expect(fixture.root.style.getPropertyValue("--ghcm-panel-height")).toBe("204px");
    fixture.destroy();
  });
});
