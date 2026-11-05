import * as React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "android", constants: {} },
  Image: { resolveAssetSource: (source: unknown) => source },
  findNodeHandle: () => null,
  processColor: (value: unknown) => value,
  requireNativeComponent: () => () => null,
}));

import { ViroSpecsScene, type ViroSpecsSceneTransport } from "../components/Specs/ViroSpecsScene";
import { applySpecsManifest } from "../components/Specs/applySpecsManifest";
import type { ViroSpecsDiagnostic } from "../components/Specs/core/diagnostic";
import { validateSpecsSceneSnapshot } from "../components/Specs/core/validate";
import { ViroNode } from "../components/ViroNode";
import { ViroText } from "../components/ViroText";
import { VIRO_SPECS_EXPERIENCE_CODES } from "../components/Specs/core/experience";

/**
 * Keeps transport and protocol findings. These scenes sit at the origin to
 * test the transport, so comfort findings (VS3016-VS3021, covered in
 * ViroSpecsExperience.test.tsx) are left out.
 */
function record(diagnostics: ViroSpecsDiagnostic[], diagnostic: ViroSpecsDiagnostic): void {
  if ((VIRO_SPECS_EXPERIENCE_CODES as readonly string[]).includes(diagnostic.code)) return;
  diagnostics.push(diagnostic);
}

type SpecsGlobal = typeof globalThis & { __VIRO_SPECS_BUILD__?: boolean; IS_REACT_ACT_ENVIRONMENT?: boolean };
const specsGlobal = globalThis as SpecsGlobal;

function mockTransport(overrides: Partial<ViroSpecsSceneTransport> = {}) {
  const applyScene = jest.fn<void, Parameters<ViroSpecsSceneTransport["applyScene"]>>();
  const presentPolyline = jest.fn();
  const transport: ViroSpecsSceneTransport = {
    applyScene,
    presentPolyline,
    clearPolylines: jest.fn(),
    ...overrides,
  };
  return { transport, applyScene, presentPolyline };
}

async function render(element: React.ReactElement) {
  await act(async () => {
    create(element);
  });
  // Let the transport queue drain.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("ViroSpecsScene", () => {
  beforeAll(() => {
    specsGlobal.__VIRO_SPECS_BUILD__ = true;
    specsGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    delete specsGlobal.__VIRO_SPECS_BUILD__;
  });

  it("applies a valid scene and passes it through the protocol gate", async () => {
    const { transport, applyScene } = mockTransport();
    const diagnostics: ViroSpecsDiagnostic[] = [];
    await render(
      <ViroSpecsScene transport={transport} onDiagnostic={(d) => record(diagnostics, d)}>
        <ViroNode viroTag="root">
          <ViroText viroTag="t" text="Hi" />
        </ViroNode>
      </ViroSpecsScene>
    );
    expect(diagnostics).toEqual([]);
    expect(applyScene).toHaveBeenCalledTimes(1);
    const snapshot = applyScene.mock.calls[0][0];
    expect(validateSpecsSceneSnapshot(snapshot).ok).toBe(true);
    expect(snapshot.nodes.map((node) => node.id)).toEqual(["root", "t"]);
  });

  it("does not apply a scene with errors and reports coded diagnostics", async () => {
    const { transport, applyScene } = mockTransport();
    const diagnostics: ViroSpecsDiagnostic[] = [];
    await render(
      <ViroSpecsScene transport={transport} onDiagnostic={(d) => record(diagnostics, d)}>
        <ViroNode viroTag="a" />
        <ViroNode viroTag="a" />
      </ViroSpecsScene>
    );
    expect(applyScene).not.toHaveBeenCalled();
    expect(diagnostics.map((d) => [d.code, d.severity])).toEqual([["VS1007", "error"]]);
  });

  it("sends scene protocol 2 to a transport with applySceneDocument, with no VS1015", async () => {
    const applySceneDocument = jest.fn();
    const { transport, applyScene, presentPolyline } = mockTransport({ applySceneDocument });
    const diagnostics: ViroSpecsDiagnostic[] = [];
    await render(
      <ViroSpecsScene transport={transport} onDiagnostic={(d) => record(diagnostics, d)}>
        <ViroText viroTag="t" text="Hi" width={0.5} height={0.1} style={{ fontSize: 18, color: "#fff" }} />
      </ViroSpecsScene>
    );
    expect(diagnostics).toEqual([]);
    expect(applyScene).not.toHaveBeenCalled();
    expect(presentPolyline).not.toHaveBeenCalled();
    expect(applySceneDocument).toHaveBeenCalledTimes(1);
    const document = applySceneDocument.mock.calls[0][0];
    expect(document.version).toBe(2);
    expect(document.nodes[0]).toMatchObject({ id: "t", style: { fontSize: 18, color: "#ffffff" }, extents: { width: 0.5, height: 0.1 } });
  });

  it("falls back to protocol 1 and reports what it drops as VS1015", async () => {
    const { transport, applyScene } = mockTransport();
    const diagnostics: ViroSpecsDiagnostic[] = [];
    await render(
      <ViroSpecsScene transport={transport} onDiagnostic={(d) => record(diagnostics, d)}>
        <ViroText viroTag="t" text="Hi" style={{ fontSize: 18 }} />
      </ViroSpecsScene>
    );
    expect(applyScene).toHaveBeenCalledTimes(1);
    expect(diagnostics.map((d) => [d.code, d.fieldPath])).toEqual([["VS1015", "/nodes/0/style"]]);
  });

  it("reports a failing transport as VS3011", async () => {
    const { transport } = mockTransport({
      applyScene: () => Promise.reject(new Error("lens went away")),
    });
    const diagnostics: ViroSpecsDiagnostic[] = [];
    await render(
      <ViroSpecsScene transport={transport} onDiagnostic={(d) => record(diagnostics, d)}>
        <ViroNode viroTag="a" />
      </ViroSpecsScene>
    );
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: "VS3011", severity: "error", message: "Transport failed: lens went away" }),
    ]);
  });
});

describe("applySpecsManifest", () => {
  const fixture = (...parts: string[]) =>
    JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "specs", ...parts), "utf8")) as unknown;

  it("applies a v1 manifest after migration, with the deprecation warning", async () => {
    const { transport, applyScene, presentPolyline } = mockTransport();
    const result = await applySpecsManifest(transport, fixture("manifest-v1", "platform-lab.v1.json"));
    expect(result.applied).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["VS1002"]);
    expect(applyScene).toHaveBeenCalledTimes(1);
    expect(presentPolyline).toHaveBeenCalledTimes(1);
  });

  it("sends a protocol 2 document to applySceneDocument without lowering", async () => {
    const applySceneDocument = jest.fn();
    const { transport, applyScene } = mockTransport({ applySceneDocument });
    const result = await applySpecsManifest(transport, fixture("manifest-v2", "valid", "platform-lab.json"));
    expect(result.applied).toBe(true);
    expect(result.diagnostics.filter((d) => d.code === "VS1015")).toEqual([]);
    expect(applyScene).not.toHaveBeenCalled();
    expect(applySceneDocument.mock.calls[0][0].version).toBe(2);
  });

  it("rejects invalid raw JSON before it reaches the transport", async () => {
    const { transport, applyScene } = mockTransport();
    for (const name of fs.readdirSync(path.join(__dirname, "fixtures", "specs", "manifest-v2", "invalid"))) {
      const invalid = fixture("manifest-v2", "invalid", name) as { manifest: unknown };
      const result = await applySpecsManifest(transport, invalid.manifest, { file: name });
      expect([name, result.applied]).toEqual([name, false]);
      expect(result.diagnostics.every((d) => d.file === name)).toBe(true);
    }
    expect(applyScene).not.toHaveBeenCalled();
  });

  it("reports a failing transport as VS3011", async () => {
    const { transport } = mockTransport({
      applyScene: () => {
        throw new Error("no lens");
      },
    });
    const result = await applySpecsManifest(transport, fixture("manifest-v2", "valid", "minimal.json"));
    expect(result.applied).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toEqual(["VS3011"]);
  });
});
