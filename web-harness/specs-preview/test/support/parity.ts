import { Group, Mesh, MeshStandardMaterial, BoxGeometry, Texture } from "three";
import { expect } from "vitest";
import { ThreeSceneBackend } from "../../src/backend/ThreeSceneBackend";
import { createRegisteredMaterial } from "../../src/backend/materials";
import { createFixedAdvanceRasterizer } from "../../src/backend/textRaster";
import { DEFAULT_TEXT_SIZE, CM_PER_METER, LUMENS_PER_LENS_INTENSITY } from "../../src/backend/lensSemantics";
import type { PreviewAsset, PreviewMaterial } from "../../src/backend/types";
import { describePreviewGraph, type PreviewGraphEntry } from "../../src/describe";
import { FrameScheduler } from "../../src/scheduler";
import { ViroSpecsSceneController, type ViroSpecsApplyResult } from "../../src/vendor/lens-core/ViroSpecsSceneController";
import type { ViroSpecsHostDiagnostic } from "../../src/vendor/lens-core/ViroSpecsHostDiagnostics";
import { ManualScheduler, MockBackend, type MockHandle, type MockMaterial } from "../vendor/mock-scene-host.mjs";

/** Assets, materials and fonts registered identically on both hosts. */
export interface ParityRegistry {
  readonly images?: readonly string[];
  readonly models?: readonly string[];
  readonly fonts?: readonly string[];
  readonly materials?: Readonly<Record<string, readonly [number, number, number, number]>>;
}

export interface ParityHosts {
  readonly mock: { backend: MockBackend; scheduler: ManualScheduler; controller: ViroSpecsSceneController<MockHandle, unknown, MockMaterial>; diagnostics: ViroSpecsHostDiagnostic[] };
  readonly three: { backend: ThreeSceneBackend; scheduler: FrameScheduler; controller: ViroSpecsSceneController<ReturnType<ThreeSceneBackend["liveHandles"]>[number], PreviewAsset, PreviewMaterial>; diagnostics: ViroSpecsHostDiagnostic[]; container: Group };
}

/** Builds a mock host (viro-external's recording backend) and a three.js host with the same registry. */
export function createParityHosts(registry: ParityRegistry = {}): ParityHosts {
  const mockBackend = new MockBackend();
  for (const s of registry.images ?? []) mockBackend.images.set(s, { texture: s });
  for (const s of registry.models ?? []) mockBackend.models.set(s, { prefab: s });
  for (const f of registry.fonts ?? []) mockBackend.fonts.add(f);
  for (const id of Object.keys(registry.materials ?? {})) mockBackend.registeredMaterials.set(id, { borrowed: id });
  const mockScheduler = new ManualScheduler();
  const mockController = new ViroSpecsSceneController(mockBackend, mockScheduler);
  const mockDiagnostics: ViroSpecsHostDiagnostic[] = [];
  mockController.diagnostics.addOnDiagnosticListener((d) => mockDiagnostics.push(d));

  const textures = new Map((registry.images ?? []).map((s): [string, PreviewAsset] => [s, { kind: "texture", source: s, texture: new Texture() }]));
  const models = new Map(
    (registry.models ?? []).map((s): [string, PreviewAsset] => {
      const scene = new Group();
      scene.add(new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshStandardMaterial()));
      return [s, { kind: "model", source: s, scene, animations: [] }];
    })
  );
  const materials = new Map(Object.entries(registry.materials ?? {}).map(([id, rgba]): [string, PreviewMaterial] => [id, createRegisteredMaterial(id, rgba)]));
  const fonts = new Set(registry.fonts ?? []);
  const container = new Group();
  const scheduler = new FrameScheduler();
  const backend = new ThreeSceneBackend({
    container,
    scheduler,
    rasterizer: createFixedAdvanceRasterizer(),
    resources: {
      loadAsset: (kind, source) => (kind === "image" ? textures.get(source) : models.get(source)) ?? null,
      resolveMaterial: (id) => materials.get(id) ?? null,
      hasFont: (family) => fonts.has(family),
    },
  });
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const diagnostics: ViroSpecsHostDiagnostic[] = [];
  controller.diagnostics.addOnDiagnosticListener((d) => diagnostics.push(d));
  return {
    mock: { backend: mockBackend, scheduler: mockScheduler, controller: mockController, diagnostics: mockDiagnostics },
    three: { backend, scheduler, controller, diagnostics, container },
  };
}

/** Presents `scene` on both hosts and runs one frame so interactions bind. */
export function presentBoth(hosts: ParityHosts, scene: unknown): { mock: ViroSpecsApplyResult; three: ViroSpecsApplyResult } {
  const mock = hosts.mock.controller.present(scene);
  const three = hosts.three.controller.present(scene);
  hosts.mock.scheduler.tick(16);
  hosts.three.scheduler.tick(16);
  return { mock, three };
}

const near = (actual: readonly number[] | undefined, expected: readonly number[], label: string): void => {
  expect(actual, label).toBeDefined();
  expected.forEach((v, i) => expect(actual?.[i], label + "[" + i + "]").toBeCloseTo(v, 3));
};

/**
 * Asserts the three.js scene graph realizes every call the controller made
 * on the mock host: same nodes and parents, transforms x100 in cm, text,
 * extents, assets, placeholders, materials, lights, polylines, bindings.
 * Returns the preview graph for further checks.
 */
export function expectParity(hosts: ParityHosts): PreviewGraphEntry[] {
  const graph = describePreviewGraph(hosts.three.backend);
  const byId = new Map(graph.map((e) => [e.id, e]));
  const mockNodes = hosts.mock.backend.liveNodes();
  expect(graph.map((e) => e.id)).toEqual(mockNodes.map((h) => h.id).sort());
  const rootLike = (id: string | undefined): string => (id === undefined || id.startsWith("root:") || id.startsWith("viro-scene:") ? "<scene>" : id);

  for (const handle of mockNodes) {
    const entry = byId.get(handle.id);
    if (!entry) throw new Error("missing " + handle.id);
    const label = handle.id;
    expect(entry.kind, label + " kind").toBe(handle.kind);
    expect(rootLike(entry.parentId), label + " parent").toBe(rootLike(handle.parent?.id));
    expect(entry.visible, label + " visible").toBe(handle.visible && handle.enabled);
    const t = handle.state.transform;
    if (t) {
      near(entry.positionCm, t.position.map((v) => v * CM_PER_METER), label + " position cm");
      near(entry.rotation, t.rotation, label + " rotation");
      near(entry.scale, t.scale, label + " scale");
    }
    if (handle.state.opacity !== undefined) expect(entry.opacity, label + " opacity").toBe(handle.state.opacity);
    const text = handle.state.text;
    if (text) {
      expect(entry.text?.text, label + " text").toBe(text.text);
      expect(entry.text?.size, label + " text size").toBe(text.style.fontSize ?? text.style.lensSize ?? DEFAULT_TEXT_SIZE);
      if (text.extents) near(entry.text?.rectCm, [text.extents.width * CM_PER_METER, entry.text?.rectCm[1] ?? 0], label + " text rect");
    }
    const extents = handle.state.extents;
    if (extents) near(entry.surfaceCm, [extents.width * CM_PER_METER, extents.height * CM_PER_METER], label + " surface cm");
    if (handle.state.asset !== undefined) {
      expect(entry.imageSource ?? entry.modelSource, label + " asset bound").toBeDefined();
    } else {
      expect(entry.imageSource ?? entry.modelSource, label + " no asset").toBeUndefined();
    }
    const placeholder = handle.state.placeholder;
    if (placeholder) {
      const w = placeholder.width * CM_PER_METER;
      const h = placeholder.height * CM_PER_METER;
      near(entry.placeholderCm, [w, h, handle.kind === "model" ? Math.min(w, h) : 1], label + " placeholder cm");
    } else {
      expect(entry.placeholderCm, label + " no placeholder").toBeUndefined();
    }
    const material = handle.state.material;
    if (material && handle.kind !== "polyline") {
      expect(entry.material?.owned, label + " material owned").toBe(material.owned === true);
      if (material.definition) expect(entry.material?.id, label + " material id").toBe(material.definition.id);
      else expect(entry.material?.id, label + " borrowed material").toBe(material.borrowed);
    }
    const light = handle.state.light;
    if (light) {
      expect(entry.light?.type, label + " light type").toBe(light.type);
      expect(entry.light?.intensity, label + " light intensity").toBeCloseTo((light.intensity ?? LUMENS_PER_LENS_INTENSITY) / LUMENS_PER_LENS_INTENSITY, 4);
    }
    const line = handle.state.line;
    if (line) {
      expect(entry.polyline?.pointsCm.length, label + " points").toBe(line.points.length);
      line.points.forEach((p, i) => near(entry.polyline?.pointsCm[i], p.map((v) => v * CM_PER_METER), label + " point " + i));
      expect(entry.polyline?.widthCm, label + " width cm").toBeCloseTo(line.radiusMeters * CM_PER_METER * 2, 4);
      if (handle.state.material) expect(entry.material?.id, label + " line material").toBe(handle.state.material.borrowed ?? handle.state.material.definition?.id);
    }
    if (handle.state.scrollNormalized) near(entry.scrollNormalized, handle.state.scrollNormalized, label + " scroll");
  }

  const mockBound = hosts.mock.backend.bindings.filter((b) => b.active && b.handle.alive).map((b) => b.handle.id).sort();
  const threeBound = graph.filter((e) => e.interactable).map((e) => e.id);
  expect(threeBound, "interaction bindings").toEqual(mockBound);
  const mockAnimating = hosts.mock.backend.animations.filter((a) => a.active && a.handle.alive).map((a) => a.handle.id).sort();
  const threeAnimating = hosts.three.backend.animations.active.map((a) => a.nodeId).sort();
  expect(threeAnimating, "running animations").toEqual(mockAnimating);
  return graph;
}

/** Diagnostic codes in order. */
export const codes = (ds: readonly ViroSpecsHostDiagnostic[]): string[] => ds.map((d) => d.code);
