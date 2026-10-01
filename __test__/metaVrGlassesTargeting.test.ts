import {
  assertMetaVrGlassesXrMode,
  resolveMetaDefaultDeviceTargets,
} from "../plugins/metaTargeting";

describe("Meta VR Glasses targeting", () => {
  test("leaves Store targeting untouched by default", () => {
    expect(resolveMetaDefaultDeviceTargets()).toBeUndefined();
    expect(resolveMetaDefaultDeviceTargets({})).toBeUndefined();
  });

  test("defaults glasses-ready builds to Meta's quest3+ Store target", () => {
    expect(
      resolveMetaDefaultDeviceTargets({ metaVrGlassesCompatible: true })
    ).toBe("quest3+");
  });

  test("preserves an explicit Store targeting expression", () => {
    expect(
      resolveMetaDefaultDeviceTargets({
        metaVrGlassesCompatible: true,
        metaDefaultDeviceTargets: "quest3only",
      })
    ).toBe("quest3only");
  });

  test("requires the existing QUEST/OpenXR build path", () => {
    expect(() =>
      assertMetaVrGlassesXrMode(["AR"], { metaVrGlassesCompatible: true })
    ).toThrow(/requires android\.xRMode to include "QUEST"/);

    expect(() =>
      assertMetaVrGlassesXrMode(["AR", "QUEST"], {
        metaVrGlassesCompatible: true,
      })
    ).not.toThrow();
  });

  test("does not constrain non-glasses builds", () => {
    expect(() => assertMetaVrGlassesXrMode(["AR"], {})).not.toThrow();
  });
});
