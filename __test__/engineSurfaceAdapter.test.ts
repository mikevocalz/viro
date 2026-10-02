import { describeCanvasSurface } from "../components/CanvasPanel/engineSurfaceAdapter";

describe("engineSurfaceAdapter", () => {
  it("describes a CanvasSurface without leaking native GPU pointers", () => {
    const surface = {
      id: 42,
      width: 1024,
      height: 512,
      route: "ahb" as const,
      markDirty() {},
      dispose() {},
    };

    expect(describeCanvasSurface(surface, "gpu")).toEqual({
      kind: "gpu",
      surfaceId: 42,
      width: 1024,
      height: 512,
      origin: "top-left",
      route: "ahb",
    });
  });

  it("returns null before a panel has a surface", () => {
    expect(describeCanvasSurface(null, "gpu")).toBeNull();
  });
});
