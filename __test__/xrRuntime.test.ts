import { classifyAndroidXRBuild } from "../components/Utilities/ViroXRRuntime";

describe("classifyAndroidXRBuild", () => {
  it("recognizes legacy Oculus Quest identity", () => {
    expect(
      classifyAndroidXRBuild({ manufacturer: "Oculus", brand: "oculus", model: "Quest 2" })
    ).toEqual({ vendor: "meta-horizon", metaFormFactor: "quest" });
  });

  it("keeps an unrecognized Meta build identity in the Horizon OpenXR family", () => {
    expect(
      classifyAndroidXRBuild({ manufacturer: "Meta", brand: "meta", model: "Future Glasses" })
    ).toEqual({ vendor: "meta-horizon", metaFormFactor: "unknown" });
  });

  it("recognizes PICO hardware independently", () => {
    expect(
      classifyAndroidXRBuild({ manufacturer: "PICO", brand: "Pico", model: "PICO 4 Ultra" })
    ).toEqual({ vendor: "pico", metaFormFactor: null });
  });

  it("does not classify ordinary Android phones as XR", () => {
    expect(
      classifyAndroidXRBuild({ manufacturer: "Google", brand: "google", model: "Pixel" })
    ).toEqual({ vendor: null, metaFormFactor: null });
  });
});
