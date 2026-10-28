// The preview's experience layer: decorations, PanelButton hover, the
// sceneVisible gate, the error panel and VS5025, driven by the vendored
// ViroSpecsExperienceController. Evidence label: portable-test-passed.
import { readFileSync } from "node:fs";
import { MeshBasicMaterial, PerspectiveCamera, type Mesh } from "three";
import { describe, expect, it } from "vitest";
import { createFixedAdvanceRasterizer } from "../src/backend/textRaster";
import { PreviewExperience } from "../src/experience";
import { PreviewStage } from "../src/stage";
import { parseViroSpecsColor } from "../src/vendor/lens-core/ViroSpecsSceneDocument";
import { VIRO_SPECS_LENS_SPATIAL_TOKENS } from "../src/vendor/lens-core/ViroSpecsExperienceTokens";

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
