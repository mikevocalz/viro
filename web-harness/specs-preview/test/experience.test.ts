// The preview's experience layer: decorations, PanelButton hover, the
// sceneVisible gate, the error panel and VS5025, driven by the vendored
// ViroSpecsExperienceController. Evidence label: portable-test-passed.
import { readFileSync } from "node:fs";
import { MeshBasicMaterial, PerspectiveCamera, Vector3, type Mesh, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import type { TextFont } from "../src/backend/textLayout";
import { createFixedAdvanceRasterizer } from "../src/backend/textRaster";
import { readPreviewInput } from "../src/document";
import { PreviewExperience } from "../src/experience";
import { PreviewStage } from "../src/stage";
import { parseViroSpecsColor } from "../src/vendor/lens-core/ViroSpecsSceneDocument";
import { panelButtonScene, spatialPanelScene } from "../src/stories/scenes";
import { VIRO_SPECS_LENS_SPATIAL_TOKENS, viroSpecsAngleToMeters } from "../src/vendor/lens-core/ViroSpecsExperienceTokens";

const repo = new URL("../../../", import.meta.url);
const json = (path: string): { nodes: { id: string; kind: string }[] } & Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(path, repo), "utf8"));

/** The Platform Lab navigation scene without its image nodes, so nothing waits on a fetch. */
function navigationWithoutImages(): unknown {
  const scene = json("__test__/fixtures/specs/gallery/navigation.scene.json");
  return { ...scene, nodes: scene.nodes.filter((n) => n.kind !== "image") };
}

function setup(): { stage: PreviewStage; experience: PreviewExperience } {
  const rasterizer = createFixedAdvanceRasterizer();
  const stage = new PreviewStage({ rasterizer });
  const camera = new PerspectiveCamera(70, 1, 1, 5000);
  camera.position.set(0, 0, 0.01);
  camera.lookAt(0, 0, -120);
  const experience = new PreviewExperience({ stage, rasterizer, camera, nowMs: () => 0 });
  return { stage, experience };
}

const child = (stage: PreviewStage, id: string, name: string): Mesh | undefined =>
  stage.controller.getNodeHandle(id)?.object.children.find((c) => c.name === name) as Mesh | undefined;
const hex = (mesh: Mesh | undefined): string => "#" + (mesh?.material as MeshBasicMaterial).color.getHexString("srgb");
const tokens = VIRO_SPECS_LENS_SPATIAL_TOKENS;

describe("preview experience layer", () => {
  it("decorates SpatialPanel, PanelButton and PanelText from the theme tokens", () => {
    const { stage, experience } = setup();
    expect(stage.controller.present(navigationWithoutImages()).status).toBe("committed");
    stage.step(0.016, 1280, 720);
    experience.update();
    const panel = child(stage, "nav-panel", "viro-experience-backing:nav-panel");
    expect(panel?.scale.x).toBeCloseTo(53, 6);
    expect(panel?.scale.y).toBeCloseTo(60, 6);
    expect(hex(panel)).toBe(tokens.color.surface);
    expect((panel?.material as MeshBasicMaterial).opacity).toBe(tokens.opacity.surface);
    const card = child(stage, "nav-card-2", "viro-experience-backing:nav-card-2");
    expect(hex(card)).toBe(tokens.color.surfaceRaised);
    expect(card?.position.z).toBeCloseTo(tokens.depth.raisedMeters * 100, 6);
    expect(child(stage, "nav-card-2", "viro-experience-label:nav-card-2")?.userData.drawn).toMatch(/^Card 2\|/);
    // The selected button shows the check glyph so color is not the only cue.
    expect(child(stage, "nav-setting-labels", "viro-experience-label:nav-setting-labels")?.userData.drawn).toMatch(/^✓ Show labels\|/);
    const title = stage.controller.getNodeHandle("nav-title");
    expect(title?.textColor).toEqual(parseViroSpecsColor(tokens.color.text));
  });

  it("hover on a PanelButton scales and lifts its backing; hover-exit restores it", () => {
    const { stage, experience } = setup();
    stage.controller.present(navigationWithoutImages());
    stage.step(0.016, 1280, 720);
    const node = stage.controller.getNodeHandle("nav-card-2");
    if (!node) throw new Error("no nav-card-2");
    stage.backend.deliverInteraction(node, { phase: "hover-enter", source: "synthetic" });
    experience.update();
    const card = child(stage, "nav-card-2", "viro-experience-backing:nav-card-2");
    expect(card?.scale.x).toBeCloseTo(22 * tokens.motion.hoverScale, 6);
    expect(card?.position.z).toBeCloseTo(tokens.depth.hoverMeters * 100, 6);
    expect(experience.tracker.interactionOf("nav-card-2")).toEqual({ hovered: true, pressed: false });
    stage.backend.deliverInteraction(node, { phase: "hover-exit", source: "synthetic" });
    experience.update();
    expect(card?.scale.x).toBeCloseTo(22, 6);
    expect(card?.position.z).toBeCloseTo(tokens.depth.raisedMeters * 100, 6);
  });

  it("reports no VS5025: the host draws every premium feature the model viewer uses", () => {
    const { stage, experience } = setup();
    const codes: string[] = [];
    stage.controller.diagnostics.addOnDiagnosticListener((d) => codes.push(d.code + " " + (d.nodeId ?? "")));
    stage.controller.present(json("__test__/fixtures/specs/reference-apps/model-viewer/scene.json"));
    experience.update();
    experience.update();
    expect(codes.filter((c) => c.startsWith("VS5025"))).toEqual([]);
  });

  it("a rejected first scene hides the content; its no-fallback panel stays up after Close", () => {
    const { stage, experience } = setup();
    const invalid = json("__test__/fixtures/specs/manifest-v2/invalid/missing-parent.json") as unknown as { manifest: unknown };
    expect(stage.controller.present(invalid.manifest).status).toBe("rejected");
    expect(experience.view.sceneVisible).toBe(false);
    expect(stage.container.visible).toBe(false);
    expect(experience.view.errorPanel?.kind).toBe("scene-no-fallback");
    expect(experience.view.errorPanel?.action).toBe("close");
    const targets = experience.targets();
    expect(targets.map((t) => t.label)).toEqual(["error action"]);
    targets[0]?.handle("select-start");
    targets[0]?.handle("select-end");
    // Nothing to fall back to, so the panel never leaves a dead lens (viro-external d25f0e7).
    expect(experience.view.errorPanel?.kind).toBe("scene-no-fallback");
    expect(experience.targets().length).toBe(1);
  });
});

// Text wrapping: the state panels and scene decorations lay out with the
// vendored Lens functions (layoutViroSpecsStatePanel, layoutViroSpecsButtonError)
// and the rasterizer's own measure, so a long message wraps inside its panel
// as it does on Lens. Evidence label: portable-test-passed.
describe("preview experience text wrapping", () => {
  const D = tokens.distance.defaultMeters;
  const m = (deg: number, d = D): number => viroSpecsAngleToMeters(deg, d) * 100;
  const measure = createFixedAdvanceRasterizer().measure;
  const lines = (mesh: Mesh | undefined): readonly string[] => (mesh?.userData.lines as string[] | undefined) ?? [];
  /** Width of each drawn line, cm, with the font the layer draws in. */
  const lineWidths = (mesh: Mesh | undefined): number[] => {
    const layout = mesh?.userData.layout as { font: TextFont; lineHeightCm: number } | undefined;
    if (!layout) return [Number.POSITIVE_INFINITY];
    return lines(mesh).map((line) => measure(line, layout.font, layout.lineHeightCm));
  };

  it("wraps a long error message inside the 20-degree panel and grows the backing to fit every row", () => {
    const { stage, experience } = setup();
    const invalid = json("__test__/fixtures/specs/manifest-v2/invalid/missing-parent.json") as unknown as { manifest: unknown };
    expect(stage.controller.present(invalid.manifest).status).toBe("rejected");
    const root = experience.overlay.getObjectByName("ViroSpecsExperience-error");
    if (!root) throw new Error("no error panel");
    const part = (name: string): Mesh | undefined => root.getObjectByName(name) as Mesh | undefined;
    const backing = part("backing");
    const body = part("body");
    const panelWidth = m(20);
    const pad = m(tokens.space.mdDeg);
    const gap = m(tokens.space.smDeg);
    const wrap = panelWidth - 2 * pad;
    expect(backing?.scale.x).toBeCloseTo(panelWidth, 6);
    // No drawn line and no text quad runs past the panel's inner width.
    expect((body?.scale.x ?? Number.POSITIVE_INFINITY) / 2).toBeLessThanOrEqual(wrap / 2 + 1e-6);
    const rows = ["title", "body", "detail"].map(part).filter((mesh): mesh is Mesh => mesh?.visible === true);
    expect(rows.length).toBe(3);
    for (const mesh of rows) {
      expect(Math.abs(mesh.position.x) + mesh.scale.x / 2).toBeLessThanOrEqual(wrap / 2 + 1e-6);
      for (const w of lineWidths(mesh)) expect(w).toBeLessThanOrEqual(wrap + 1e-6);
    }

    // The rejected-scene message is far longer than one 20-degree line.
    expect(experience.view.errorPanel?.message.length).toBeGreaterThan(80);
    expect(lines(body).length).toBeGreaterThan(1);

    // Backing height = padding + every row + the gaps between them, so it
    // grows with the body's line count, and the rows stack without overlap.
    const actionBacking = part("action-backing");
    const action = root.getObjectByName("action");
    const rowHeight = (mesh: Mesh, deg: number): number => lines(mesh).length * tokens.type.lineHeight * m(deg);
    const heights = [rowHeight(rows[0] as Mesh, tokens.type.bodyDeg), rowHeight(rows[1] as Mesh, tokens.type.bodyDeg), rowHeight(rows[2] as Mesh, tokens.type.labelDeg)];
    const actionHeight = actionBacking?.scale.y ?? 0;
    expect(backing?.scale.y).toBeCloseTo(2 * pad + heights.reduce((a, b) => a + b, 0) + actionHeight + 3 * gap, 6);
    const spans = [
      ...rows.map((mesh, i) => ({ top: mesh.position.y + (heights[i] as number) / 2, bottom: mesh.position.y - (heights[i] as number) / 2 })),
      { top: (action?.position.y ?? 0) + actionHeight / 2, bottom: (action?.position.y ?? 0) - actionHeight / 2 },
    ];
    const half = (backing?.scale.y ?? 0) / 2;
    expect(spans[0]?.top).toBeCloseTo(half - pad, 6);
    expect(spans[3]?.bottom).toBeCloseTo(-half + pad, 6);
    for (let i = 1; i < spans.length; i++) expect((spans[i - 1]?.bottom ?? 0) - (spans[i]?.top ?? 0)).toBeCloseTo(gap, 6);
  });

  it("a notice panel is sized to its body's line count", () => {
    const { stage, experience } = setup();
    stage.controller.present(navigationWithoutImages());
    stage.step(0.016, 1280, 720);
    experience.setCapabilities({ "hand-tracking": "temporarily-unavailable" });
    const notice = experience.overlay.getObjectByName("ViroSpecsExperience-notice");
    const body = notice?.getObjectByName("body") as Mesh | undefined;
    expect(experience.view.notice).toBeDefined();
    for (const w of lineWidths(body)) expect(w).toBeLessThanOrEqual(m(20) - 2 * m(tokens.space.mdDeg) + 1e-6);
    const backing = notice?.getObjectByName("backing") as Mesh | undefined;
    const pad = m(tokens.space.mdDeg);
    const action = notice?.getObjectByName("action-backing") as Mesh | undefined;
    expect(backing?.scale.y).toBeCloseTo(2 * pad + lines(body).length * tokens.type.lineHeight * m(tokens.type.bodyDeg) + m(tokens.space.smDeg) + (action?.scale.y ?? 0), 6);
  });

  it("wraps a SpatialPanel title and a PanelButton errorMessage at the panel's inner width", () => {
    const { stage, experience } = setup();
    const base = panelButtonScene("error");
    const longTitle = { type: "spatial-panel", title: "Account settings for this headset and every paired phone" } as const;
    const scene = { ...base, nodes: base.nodes.map((n) => (n.id === "pb-panel" ? { ...n, component: longTitle } : n)) };
    expect(stage.controller.present(readPreviewInput(scene).scene).status).toBe("committed");
    stage.step(0.016, 1280, 720);
    experience.update();
    const handle = stage.controller.getNodeHandle("pb-button");
    // The setup camera sits at z 0.01 cm; the layer measures from it.
    const distance = handle ? handle.object.getWorldPosition(new Vector3()).distanceTo(new Vector3(0, 0, 0.01)) / 100 : D;
    const wrap = 36 - 2 * m(tokens.space.mdDeg, distance);

    const error = child(stage, "pb-button", "viro-experience-error:pb-button");
    expect(lines(error).length).toBeGreaterThan(1);
    for (const w of lineWidths(error)) expect(w).toBeLessThanOrEqual(wrap + 1e-6);
    // Centred on the panel (the button sits at x 0) and below the button's bottom edge.
    expect(Math.abs(error?.position.x ?? 1) + (error?.scale.x ?? 0) / 2).toBeLessThanOrEqual(wrap / 2 + 1e-6);
    const em = m(tokens.type.labelDeg, distance);
    expect((error?.position.y ?? 0) + (lines(error).length * tokens.type.lineHeight * em) / 2).toBeCloseTo(-8.4 / 2 - m(tokens.space.xsDeg, distance), 6);

    // The story scene reserves the row: the last line ends inside the panel's padding.
    const buttonY = (handle?.object.position.y ?? 0);
    const errorBottom = buttonY + (error?.position.y ?? 0) - (lines(error).length * tokens.type.lineHeight * em) / 2;
    expect(errorBottom).toBeGreaterThanOrEqual(-30 / 2 + m(tokens.space.mdDeg, distance) - 1e-6);

    const title = child(stage, "pb-panel", "viro-experience-title:pb-panel");
    expect(lines(title).length).toBeGreaterThan(1);
    for (const w of lineWidths(title)) expect(w).toBeLessThanOrEqual(wrap + 1e-6);
  });

  it("PanelText with extents and maxLines wraps inside its box (scene text, Lens setText rules)", () => {
    const { stage } = setup();
    expect(stage.controller.present(readPreviewInput(spatialPanelScene()).scene).status).toBe("committed");
    const body = stage.controller.getNodeHandle("sp-body")?.text?.layout;
    expect(body?.lines.length).toBe(2);
    for (const line of body?.lines ?? []) expect(measure(line, body!.font, body!.lineHeightCm)).toBeLessThanOrEqual(46 + 1e-6);
  });
});

// Overlay order and the loading ring, as ViroSpecsExperienceLensView draws
// them: state panels after scene content with depth test off (render order
// 100 backing, 101 controls, 102 text), and the ring from viroSpecsLoadingRing
// in a reserved row above the title. Evidence label: portable-test-passed.
describe("preview experience overlay and loading ring", () => {
  const ORDER = { backing: 100, control: 101, text: 102 };
  const RING_SEGMENTS = 24;

  function loadingSetup(): { stage: PreviewStage; experience: PreviewExperience; clock: { now: number } } {
    const clock = { now: 0 };
    const rasterizer = createFixedAdvanceRasterizer();
    const stage = new PreviewStage({ rasterizer });
    const camera = new PerspectiveCamera(70, 1, 1, 5000);
    camera.position.set(0, 0, 0.01);
    camera.lookAt(0, 0, -120);
    const experience = new PreviewExperience({ stage, rasterizer, camera, nowMs: () => clock.now });
    return { stage, experience, clock };
  }

  /** Opens the loading panel with `pending` of `total` assets left (total 0: unknown progress). */
  function openLoading(experience: PreviewExperience, clock: { now: number }, pending: number, total: number): void {
    experience.controller.onSceneLifecycle("loading", { pending, total });
    clock.now += tokens.motion.fastMs + 1;
    experience.controller.onSceneLifecycle("loading", { pending, total });
  }

  const ring = (experience: PreviewExperience): Object3D | undefined =>
    experience.overlay.getObjectByName("ViroSpecsExperience-loading")?.getObjectByName("ring");
  const segments = (experience: PreviewExperience): Mesh[] => (ring(experience)?.children ?? []) as Mesh[];
  const litCount = (experience: PreviewExperience): number => segments(experience).filter((s) => hex(s) === tokens.color.focus).length;

  it("draws every state-panel part after scene content with depth test off, at the Lens render orders", () => {
    const { stage, experience } = setup();
    const invalid = json("__test__/fixtures/specs/manifest-v2/invalid/missing-parent.json") as unknown as { manifest: unknown };
    stage.controller.present(invalid.manifest);
    const root = experience.overlay.getObjectByName("ViroSpecsExperience-error");
    if (!root) throw new Error("no error panel");
    const want: Record<string, number> = {
      backing: ORDER.backing,
      "action-backing": ORDER.control,
      title: ORDER.text,
      body: ORDER.text,
      detail: ORDER.text,
      "action-label": ORDER.text,
    };
    for (const [name, order] of Object.entries(want)) {
      const mesh = root.getObjectByName(name) as Mesh | undefined;
      const material = mesh?.material as MeshBasicMaterial | undefined;
      expect({ name, order: mesh?.renderOrder, depthTest: material?.depthTest, depthWrite: material?.depthWrite, transparent: material?.transparent }).toEqual({
        name,
        order,
        depthTest: false,
        depthWrite: false,
        // In three.js's transparent pass, which draws after every opaque and
        // transparent scene object with a lower render order.
        transparent: true,
      });
    }
    // Opaque fill, as on Lens.
    expect((root.getObjectByName("backing") as Mesh).material).toMatchObject({ opacity: 1 });
  });

  it("known progress fills the arc from the top and never turns; the ring row sits above the title", () => {
    const { experience, clock } = loadingSetup();
    openLoading(experience, clock, 1, 2);
    expect(experience.view.loading.visible && experience.view.loading.indicator).toBe("ring-arc");
    expect(segments(experience).length).toBe(RING_SEGMENTS);
    expect(ring(experience)?.visible).toBe(true);
    const lit = segments(experience).map((s) => hex(s) === tokens.color.focus);
    expect(lit).toEqual(Array.from({ length: RING_SEGMENTS }, (_, i) => i < RING_SEGMENTS / 2));
    for (const s of segments(experience)) {
      expect(s.renderOrder).toBe(ORDER.control);
      expect((s.material as MeshBasicMaterial).depthTest).toBe(false);
      if (hex(s) !== tokens.color.focus) expect(hex(s)).toBe(tokens.color.border);
    }
    // Segment 0 at the top of the ring.
    const first = segments(experience)[0];
    expect(first?.position.x).toBeCloseTo(0, 6);
    expect(first?.position.y).toBeGreaterThan(0);
    clock.now += 700;
    experience.controller.onSceneLifecycle("loading", { pending: 1, total: 2 });
    expect(ring(experience)?.rotation.z).toBe(0);

    // Layout: ring row 3 body ems tall at the top, then space.sm, then the title.
    const root = experience.overlay.getObjectByName("ViroSpecsExperience-loading");
    const backing = root?.getObjectByName("backing") as Mesh;
    const title = root?.getObjectByName("title") as Mesh;
    const D = tokens.distance.defaultMeters;
    const m = (deg: number): number => viroSpecsAngleToMeters(deg, D) * 100;
    const diameter = 3 * m(tokens.type.bodyDeg);
    expect((ring(experience)?.position.y ?? 0) + diameter / 2).toBeCloseTo(backing.scale.y / 2 - m(tokens.space.mdDeg), 6);
    const titleTop = title.position.y + (tokens.type.lineHeight * m(tokens.type.bodyDeg)) / 2;
    expect((ring(experience)?.position.y ?? 0) - diameter / 2 - titleTop).toBeCloseTo(m(tokens.space.smDeg), 6);
    // The ring shows the fraction; the body keeps the counts, as on Lens.
    expect((root?.getObjectByName("body") as Mesh).userData.lines).toEqual([experience.view.loading.visible ? experience.view.loading.line : ""]);
  });

  it("unknown progress spins a quarter ring, one turn per motion.progressLoopMs", () => {
    const { experience, clock } = loadingSetup();
    openLoading(experience, clock, 0, 0);
    expect(experience.view.loading.visible && experience.view.loading.indicator).toBe("ring-spin");
    expect(litCount(experience)).toBe(RING_SEGMENTS / 4);
    const start = ring(experience)?.rotation.z ?? 0;
    clock.now += tokens.motion.progressLoopMs / 4;
    experience.update();
    const turned = (ring(experience)?.rotation.z ?? 0) - start;
    // A quarter turn clockwise as the wearer sees it.
    expect(turned).toBeCloseTo(-Math.PI / 2, 6);
  });

  it("reduced motion with unknown progress lights every third segment and stays still", () => {
    const { experience, clock } = loadingSetup();
    experience.controller.setPreferences({ highContrast: false, reducedMotion: true });
    openLoading(experience, clock, 0, 0);
    expect(experience.view.loading.visible && experience.view.loading.indicator).toBe("dots");
    expect(segments(experience).map((s) => hex(s) === tokens.color.focus)).toEqual(Array.from({ length: RING_SEGMENTS }, (_, i) => i % 3 === 0));
    clock.now += tokens.motion.progressLoopMs / 3;
    experience.update();
    expect(ring(experience)?.rotation.z).toBe(0);
  });

  it("reduced motion with known progress keeps a static arc", () => {
    const { experience, clock } = loadingSetup();
    experience.controller.setPreferences({ highContrast: false, reducedMotion: true });
    openLoading(experience, clock, 3, 4);
    expect(experience.view.loading.visible && experience.view.loading.indicator).toBe("arc-static");
    expect(litCount(experience)).toBe(RING_SEGMENTS / 4);
    expect(ring(experience)?.rotation.z).toBe(0);
  });
});
