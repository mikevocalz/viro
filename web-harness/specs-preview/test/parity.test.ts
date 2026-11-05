// Parity between the three.js preview and viro-external's mock host. Both run
// the same vendored ViroSpecsSceneController; these tests check that the
// three.js scene graph realizes every backend call the controller makes, in
// Lens units. Evidence label: portable-test-passed.
import { readFileSync } from "node:fs";
import { Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { readPreviewInput } from "../src/document";
import { PRIMITIVE_STORIES } from "../src/primitives";
import { codes, createParityHosts, expectParity, presentBoth } from "./support/parity";

const repo = new URL("../../../", import.meta.url);
const json = (path: string): unknown => JSON.parse(readFileSync(new URL(path, repo), "utf8"));
const preview = new URL("../", import.meta.url);
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL("fixtures/" + name, preview), "utf8"));

const SHIBA = "examples/visionos-sweep/assets/shiba.glb";
/** Image IDs the Platform Lab navigation scene references. */
const GALLERY_IMAGES = ["examples/visionos-sweep/assets/button.png"];

/** Same document as the round-trip test in viro-external scripts/scene-controller.test.mjs. */
const lab = () => ({
  version: 2,
  nodes: [
    { id: "panel", kind: "panel", position: [0, 0, -1.2], extents: { width: 0.6, height: 0.4 } },
    {
      id: "title", kind: "text", parentId: "panel", text: "Platform Lab", position: [0, 0.12, 0.01],
      style: { fontFamily: "Inter", fontSize: 24, fontWeight: "bold", color: "#ffcc00", textAlign: "center" },
      extents: { width: 0.5, height: 0.08 }, opacity: 0.9,
    },
    { id: "list", kind: "group", parentId: "panel", scroll: { width: 0.5, height: 0.2, contentHeight: 0.6 } },
    { id: "row-1", kind: "text", parentId: "list", text: "Row 1" },
    { id: "row-2", kind: "text", parentId: "list", text: "Row 2" },
    { id: "logo", kind: "image", parentId: "panel", source: "images/logo.png", extents: { width: 0.1, height: 0.1 } },
    { id: "model", kind: "model", source: "models/tutor.glb", format: "glb", position: [0.3, 0, -1.2], materialId: "brand" },
  ],
  polylines: [{ id: "route", points: [[0, 0, -1], [0.5, 0, -1]], radiusMeters: 0.01, materialId: "registry-gold" }],
  lights: [{ id: "sun", type: "directional", direction: [0, -1, 0], intensity: 1000, color: "#ffffff" }],
  materials: [{ id: "brand", color: "#3366ff", opacity: 0.8 }],
  interactions: [
    { nodeId: "model", interactable: true, manipulation: true, events: ["select", "drag"] },
    { nodeId: "row-1", interactable: true, manipulation: false, events: ["hover", "select"] },
  ],
  animations: [{
    nodeId: "title", name: "pulse",
    plan: { engine: "AnimationPlayer", durationSeconds: 0.5, delaySeconds: 0, easing: "ease-in-out", playbackMode: "single",
      completionEvent: "viro-animation-complete:title:pulse", tracks: [{ target: "transform.scale.x", from: "current", to: 1.1 }] },
  }],
});

const LAB_REGISTRY = {
  images: ["images/logo.png"],
  models: ["models/tutor.glb"],
  fonts: ["Inter"],
  materials: { "registry-gold": [1, 0.8, 0.2, 1] as const },
};

describe("preview parity with the mock host", () => {
  it("Platform Lab scene document from viro-specs-compile --format scene-json", () => {
    const hosts = createParityHosts({ models: [SHIBA] });
    const { mock, three } = presentBoth(hosts, fixture("platform-lab.scene-v2.json"));
    expect(three.status).toBe("committed");
    expect(mock.status).toBe("committed");
    expect(codes(hosts.three.diagnostics)).toEqual(codes(hosts.mock.diagnostics));
    const graph = expectParity(hosts);
    const model = graph.find((e) => e.id === "platform-lab-model");
    // -0.2 m inside a root at z -1.5 m: Lens world position (-20, -5, -150) cm.
    expect(model?.worldPositionCm).toEqual([-20, -5, -150]);
    expect(hosts.three.controller.lifecycle).toBe("ready");
  });

  it("Platform Lab manifest v2 lowered by the preview equals the compiled scene document", () => {
    const input = readPreviewInput(fixture("platform-lab.manifest.json"));
    expect(input.route).toBe("manifest");
    expect(input.manifestDiagnostics).toEqual([]);
    expect(JSON.parse(JSON.stringify(input.scene))).toEqual(fixture("platform-lab.scene-v2.json"));
  });

  it("controller round-trip document: text style, scroll, image, owned and borrowed materials, light, polyline", () => {
    const hosts = createParityHosts(LAB_REGISTRY);
    presentBoth(hosts, lab());
    expect(codes(hosts.three.diagnostics)).toEqual(codes(hosts.mock.diagnostics));
    const graph = expectParity(hosts);
    const title = graph.find((e) => e.id === "title");
    expect(title?.text?.size).toBe(24);
    expect(title?.text?.color).toEqual([1, 0.8, 0, 1]);
    expect(title?.text?.rectCm).toEqual([50, 8]);
    const route = graph.find((e) => e.id === "route");
    expect(route?.polyline?.widthCm).toBe(2);
    expect(graph.find((e) => e.id === "model")?.material).toEqual({ id: "brand", owned: true, baseColor: [0.2, 0.4, 1, 0.8] });
  });

  it("all-fields manifest fixture with nothing registered: placeholders and diagnostics match", () => {
    const input = readPreviewInput(json("__test__/fixtures/specs/manifest-v2/valid/all-fields.json"));
    expect(input.route).toBe("manifest");
    const hosts = createParityHosts();
    presentBoth(hosts, input.scene);
    expect(codes(hosts.three.diagnostics)).toEqual(codes(hosts.mock.diagnostics));
    expect(codes(hosts.three.diagnostics)).toContain("VS5003");
    const graph = expectParity(hosts);
    // Missing image keeps its extents; missing model gets the 0.2 m default cube.
    expect(graph.find((e) => e.id === "poster")?.placeholderCm).toEqual([30, 20, 1]);
    expect(graph.find((e) => e.id === "model")?.placeholderCm).toEqual([20, 20, 20]);
    expect(hosts.three.controller.lifecycle).toBe("degraded");
  });

  it("manifest v1 migrates (VS1002) and renders with parity", () => {
    const input = readPreviewInput(json("__test__/fixtures/specs/manifest-v1/platform-lab.v1.json"));
    expect(input.manifestDiagnostics.map((d) => d.code)).toContain("VS1002");
    const hosts = createParityHosts({ models: [SHIBA] });
    presentBoth(hosts, input.scene);
    expectParity(hosts);
  });

  it("every valid manifest fixture renders with parity", () => {
    for (const name of ["minimal.json", "platform-lab.json", "all-fields.json"]) {
      const input = readPreviewInput(json("__test__/fixtures/specs/manifest-v2/valid/" + name), name);
      expect(input.route, name).toBe("manifest");
      const hosts = createParityHosts();
      presentBoth(hosts, input.scene);
      expect(codes(hosts.three.diagnostics), name).toEqual(codes(hosts.mock.diagnostics));
      expectParity(hosts);
    }
  });

  it("an invalid manifest is reported by viro and rejected by the controller on both hosts", () => {
    // Invalid fixtures wrap the manifest: { description, expectCodes, manifest }.
    const wrapper = json("__test__/fixtures/specs/manifest-v2/invalid/missing-parent.json") as { manifest: unknown; expectCodes: string[] };
    const input = readPreviewInput(wrapper.manifest);
    expect(input.route).toBe("scene-document");
    expect(input.manifestDiagnostics.map((d) => d.code)).toEqual(wrapper.expectCodes);
    const hosts = createParityHosts();
    const { mock, three } = presentBoth(hosts, input.scene);
    expect(three.status).toBe("rejected");
    expect(mock.status).toBe("rejected");
    expect(codes(three.diagnostics)).toEqual(codes(mock.diagnostics));
    expect(hosts.three.backend.liveHandles()).toEqual([]);
  });

  it("an update keeps untouched nodes' three.js objects and changes only the edited text", () => {
    const hosts = createParityHosts(LAB_REGISTRY);
    presentBoth(hosts, lab());
    const before = new Map(hosts.three.backend.liveHandles().map((h) => [h.id, h.object]));
    const next = lab();
    const row = next.nodes.find((n) => n.id === "row-2");
    if (!row || row.kind !== "text") throw new Error("fixture changed");
    row.text = "Row 2 (edited)";
    const mock = hosts.mock.controller.update(next);
    const three = hosts.three.controller.update(next);
    expect(three.status).toBe("patched");
    expect(three.status === "patched" && three.ops.map((o) => o.op)).toEqual(mock.status === "patched" && mock.ops.map((o) => o.op));
    for (const h of hosts.three.backend.liveHandles()) expect(h.object, h.id).toBe(before.get(h.id));
    const graph = expectParity(hosts);
    expect(graph.find((e) => e.id === "row-2")?.text?.text).toBe("Row 2 (edited)");
  });

  it("scroll position survives an update on both hosts", () => {
    const hosts = createParityHosts(LAB_REGISTRY);
    presentBoth(hosts, lab());
    const list = hosts.three.backend.liveHandles().find((h) => h.id === "list");
    if (!list) throw new Error("no list");
    hosts.three.backend.scrollTo(list, 0.25);
    const mockList = hosts.mock.backend.liveNodes().find((h) => h.id === "list");
    if (!mockList) throw new Error("no mock list");
    mockList.state.scrollNormalized = [0, 0.25];
    const next = lab();
    next.nodes = next.nodes.filter((n) => n.id !== "row-2");
    hosts.mock.controller.update(next);
    hosts.three.controller.update(next);
    expect(hosts.three.controller.getNodeState("list")?.scrollNormalized).toEqual([0, 0.25]);
    expectParity(hosts);
  });

  it("every gallery primitive is a valid manifest and renders with parity", () => {
    for (const story of PRIMITIVE_STORIES) {
      const input = readPreviewInput(story.manifest, story.id);
      expect(input.manifestDiagnostics, story.id).toEqual([]);
      expect(input.route, story.id).toBe("manifest");
      const hosts = createParityHosts({ images: ["examples/visionos-sweep/assets/button.png"], models: [SHIBA] });
      const { three } = presentBoth(hosts, input.scene);
      expect(three.status, story.id).toBe("committed");
      expect(codes(hosts.three.diagnostics), story.id).toEqual(codes(hosts.mock.diagnostics));
      expectParity(hosts);
    }
  });

  it("SpatialScrollView: rows, initial position, scrollByRows and clipping match the Lens backend", () => {
    const hosts = createParityHosts({ images: GALLERY_IMAGES });
    const { three } = presentBoth(hosts, json("__test__/fixtures/specs/gallery/navigation.scene.json"));
    expect(three.status).toBe("committed");
    expect(codes(hosts.three.diagnostics)).toEqual(codes(hosts.mock.diagnostics));
    expectParity(hosts);
    const list = hosts.three.backend.liveHandles().find((h) => h.id === "nav-list");
    const mockList = hosts.mock.backend.liveNodes().find((h) => h.id === "nav-list");
    if (!list?.scroll || !list.contentParent || !mockList) throw new Error("nav-list is not a scroll group");
    // itemHeightMeters 0.13 is the row; initialIndex 0 opens at the content top.
    expect(list.scroll.rows).toEqual({ stepMeters: 0.13, initialOffsetMeters: 0 });
    expect(mockList.state.scrollRows).toEqual({ stepMeters: 0.13, initialOffsetMeters: 0 });
    expect(list.scroll.normalized).toEqual([0, 1]);
    // Content y = 0 is the window's top edge: 0.26 m window, so the anchor sits 13 cm up.
    expect(list.contentParent.position.y).toBeCloseTo(13, 5);
    const card = hosts.three.backend.liveHandles().find((h) => h.id === "nav-card-1");
    if (!card) throw new Error("no nav-card-1");
    const before = card.object.getWorldPosition(new Vector3()).y;

    expect(hosts.three.controller.scrollByRows("nav-list", 1)).toBe(true);
    expect(hosts.mock.controller.scrollByRows("nav-list", 1)).toBe(true);
    expectParity(hosts);
    expect(card.object.getWorldPosition(new Vector3()).y - before).toBeCloseTo(13, 4);
    // Past the end clamps: 0.52 m content in a 0.26 m window leaves 26 cm.
    hosts.three.controller.scrollByRows("nav-list", 10);
    hosts.mock.controller.scrollByRows("nav-list", 10);
    expectParity(hosts);
    expect(list.scroll.normalized[1]).toBeCloseTo(-1, 6);
    expect(list.contentParent.position.y).toBeCloseTo(13 + 26, 4);
    expect(hosts.three.controller.scrollByRows("nav-title", 1)).toBe(false);

    hosts.three.backend.update(0, 1280, 720);
    const clipped = (id: string): number => {
      const node = hosts.three.backend.liveHandles().find((h) => h.id === id);
      let planes = 0;
      node?.object.traverse((o) => {
        if (o instanceof Mesh) for (const m of [o.material].flat()) planes = Math.max(planes, m.clippingPlanes?.length ?? 0);
      });
      return planes;
    };
    expect(clipped("nav-card-1")).toBe(4);
    expect(clipped("nav-card-1-image")).toBe(4);
    expect(clipped("nav-title")).toBe(0);
    expect(clipped("nav-next")).toBe(0);
  });

  it.each(["dashboard", "model-viewer", "world-placed-info"])("reference app %s (compiled scene.json) renders with parity", (app) => {
    const hosts = createParityHosts({ models: [SHIBA] });
    const { mock, three } = presentBoth(hosts, json("__test__/fixtures/specs/reference-apps/" + app + "/scene.json"));
    expect(three.status).toBe("committed");
    expect(mock.status).toBe("committed");
    expect(codes(hosts.three.diagnostics)).toEqual(codes(hosts.mock.diagnostics));
    expectParity(hosts);
  });

  it("navigation to a new scene retires the old one on both hosts", () => {
    const hosts = createParityHosts(LAB_REGISTRY);
    presentBoth(hosts, lab());
    presentBoth(hosts, fixture("platform-lab.scene-v2.json"));
    expectParity(hosts);
    expect(hosts.three.backend.liveHandles().filter((h) => h.kind === "root").length).toBe(1);
    expect(hosts.three.container.children.length).toBe(1);
  });
});
