import {
  viroEngineDomainCode,
  viroEnginePreferenceCode,
  viroEnginePreferenceFromCode,
} from "../components/Engine/ViroEngineContract";

describe("Viro engine backend selector mapping", () => {
  it("keeps domain codes stable", () => {
    expect(viroEngineDomainCode("input")).toBe(0);
    expect(viroEngineDomainCode("geometry")).toBe(4);
    expect(viroEngineDomainCode("asset-loading")).toBe(6);
  });

  it("keeps backend preference codes stable", () => {
    expect(viroEnginePreferenceCode("auto")).toBe(0);
    expect(viroEnginePreferenceCode("cpp")).toBe(1);
    expect(viroEnginePreferenceCode("eskiu")).toBe(2);
    expect(viroEnginePreferenceFromCode(99)).toBe("auto");
  });
});
