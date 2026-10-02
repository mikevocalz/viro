import {
  decodeViroEngineCapabilities,
  normalizeViroEngineAbiInfo,
  queryViroEngineContract,
} from "../components/Engine/ViroEngineContract";

describe("ViroEngineContract", () => {
  it("does not transport a uint64 capability mask through a JS number", () => {
    const caps = decodeViroEngineCapabilities(
      (1 << 0) | (1 << 8) | (1 << 12),
      0
    );
    expect([...caps]).toEqual(["openxr", "stylus", "dynamic-geometry"]);
  });

  it("normalizes the C++ reference backend", () => {
    const info = normalizeViroEngineAbiInfo({
      structSize: 24,
      abiMajor: 0,
      abiMinor: 1,
      backendKind: 1,
      capabilitiesLow: (1 << 0) | (1 << 5),
      capabilitiesHigh: 0,
    });

    expect(info.available).toBe(true);
    expect(info.compatible).toBe(true);
    expect(info.backend).toBe("cpp");
    expect([...info.capabilities]).toEqual(["openxr", "controller"]);
    expect(info.reason).toBe("ok");
  });

  it("rejects a different ABI major without hiding diagnostics", () => {
    const info = normalizeViroEngineAbiInfo({
      structSize: 24,
      abiMajor: 1,
      abiMinor: 0,
      backendKind: 2,
      capabilitiesLow: 0,
      capabilitiesHigh: 0,
    });

    expect(info.available).toBe(true);
    expect(info.compatible).toBe(false);
    expect(info.backend).toBe("eskiu");
    expect(info.reason).toBe("abi-major-mismatch");
  });

  it("rejects an older minor version within the current major", () => {
    const info = normalizeViroEngineAbiInfo({
      structSize: 24,
      abiMajor: 0,
      abiMinor: 0,
      backendKind: 1,
      capabilitiesLow: 0,
      capabilitiesHigh: 0,
    });

    expect(info.compatible).toBe(false);
    expect(info.reason).toBe("abi-too-old");
  });

  it("gracefully represents a platform with no native engine-contract module", async () => {
    const info = await queryViroEngineContract(null);

    expect(info).toMatchObject({
      available: false,
      compatible: false,
      backend: "unknown",
      reason: "native-module-missing",
    });
    expect(info.capabilities.size).toBe(0);
  });

  it("queries an injected native module without binding the facade to NativeModules", async () => {
    const info = await queryViroEngineContract({
      queryAbi: async () => ({
        structSize: 24,
        abiMajor: 0,
        abiMinor: 1,
        backendKind: 3,
        capabilitiesLow: 1 << 12,
        capabilitiesHigh: 0,
      }),
    });

    expect(info.backend).toBe("wasm");
    expect(info.capabilities.has("dynamic-geometry")).toBe(true);
  });
});
