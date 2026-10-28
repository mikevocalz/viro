// The preview copies constants out of the Lens-only backend and animation
// runtime. These tests read the vendored copies of those files and fail when
// a constant drifts, so a Lens change cannot silently break preview parity.
import { readFileSync } from "node:fs";
import { Group } from "three";
import { describe, expect, it } from "vitest";
import { ANIMATION_SAMPLES, buildAnimationClip, cubicBezier, resolveEndpoints } from "../src/backend/animation";
import { PreviewAnimationPlayer } from "../src/backend/animationPlayer";
import * as lens from "../src/backend/lensSemantics";
import { layoutText } from "../src/backend/textLayout";
import { createFixedAdvanceRasterizer } from "../src/backend/textRaster";
import { FrameScheduler } from "../src/scheduler";
import type { ViroSpecsNativeAnimationPlan } from "../src/vendor/lens-core/ViroSpecsProtocol";

const reference = (name: string): string =>
  readFileSync(new URL("../src/vendor/lens-reference/" + name + ".txt", import.meta.url), "utf8");
const backend = reference("ViroSpecsLensSceneBackend.ts");
const runtime = reference("ViroSpecsAnimationRuntime.ts");
const constant = (source: string, name: string): string => {
  const match = source.match(new RegExp("const " + name + "\\s*=\\s*([^;]+);"));
  if (!match?.[1]) throw new Error(name + " not found in the Lens reference source");
  return match[1].trim();
};

describe("constants match the vendored Lens backend", () => {
  it("units, text and placeholder", () => {
    expect(Number(constant(backend, "CM_PER_METER"))).toBe(lens.CM_PER_METER);
    expect(Number(constant(backend, "DEFAULT_TEXT_SIZE"))).toBe(lens.DEFAULT_TEXT_SIZE);
    expect(Number(constant(backend, "VIRO_SPECS_LENS_TEXT_SIZE_PER_POINT"))).toBe(lens.TEXT_SIZE_PER_POINT);
    expect(Number(constant(backend, "LINE_HEIGHT_CM_PER_SIZE"))).toBe(lens.LINE_HEIGHT_CM_PER_SIZE);
    expect(constant(backend, "PLACEHOLDER_TINT")).toBe("new vec4(" + lens.PLACEHOLDER_TINT.join(", ") + ")");
    expect(backend).toContain("Rect.create(-" + lens.DEFAULT_TEXT_HALF_WIDTH_CM + ", " + lens.DEFAULT_TEXT_HALF_WIDTH_CM + ", -" + lens.DEFAULT_TEXT_HALF_HEIGHT_CM + ", " + lens.DEFAULT_TEXT_HALF_HEIGHT_CM + ")");
    expect(backend).toContain("(light.intensity ?? " + lens.LUMENS_PER_LENS_INTENSITY + ") / " + lens.LUMENS_PER_LENS_INTENSITY);
    expect(backend).toContain('const d = node.kind === "model" ? Math.min(w, h) : 1;');
    expect(backend).toContain("new quat(w, x, y, z)");
    expect(backend).toContain("component.radius = line.radiusMeters * CM_PER_METER;");
  });

  it("easing control points", () => {
    for (const [name, points] of Object.entries(lens.EASING_CONTROL_POINTS)) {
      if (name === "linear") continue;
      expect(runtime).toContain('case "' + name + '":\n        return [' + points.join(", ") + "];");
    }
    expect(runtime).toContain("return [0, 0, 1, 1];");
  });
});

describe("text layout follows Lens setText", () => {
  const measure = createFixedAdvanceRasterizer().measure;
  it("unstyled text uses size 48 and the 72 x 8 cm default rect, overflowing", () => {
    const l = layoutText({ text: "Viro Cross-Platform Lab", style: {} }, measure);
    expect([l.size, l.rectWidthCm, l.rectHeightCm, l.horizontalOverflow, l.verticalOverflow]).toEqual([48, 72, 8, "overflow", "overflow"]);
    expect(l.lines).toEqual(["Viro Cross-Platform Lab"]);
    expect(l.color).toEqual([1, 1, 1, 1]);
  });
  it("maxLines sizes the box to maxLines x size x 0.1 cm and truncates at the box, as Lens does (VS5008)", () => {
    const words = Array.from({ length: 120 }, (_, i) => "word" + i).join(" ");
    const l = layoutText({ text: words, style: { fontSize: 20 }, extents: { width: 0.1, height: 0.5 }, maxLines: 2 }, measure);
    expect(l.rectWidthCm).toBe(10);
    expect(l.rectHeightCm).toBeCloseTo(4);
    // Glyphs follow the Lens type scale (43.886 per cm em), so a 4 cm box holds more than 2 lines.
    expect(l.lineHeightCm).toBeCloseTo(20 * (1 / 43.886) * 1.2, 6);
    expect(l.lines.length).toBe(Math.floor(4 / l.lineHeightCm));
    expect(l.truncated).toBe(true);
  });
  it("protocol 1 lensSize and rgba apply when fontSize and color are absent", () => {
    const l = layoutText({ text: "Hi", style: { lensSize: 40, rgba: [1, 0, 0, 1] } }, measure);
    expect(l.size).toBe(40);
    expect(l.color).toEqual([1, 0, 0, 1]);
  });
});

describe("animation", () => {
  const plan = (over: Partial<ViroSpecsNativeAnimationPlan>): ViroSpecsNativeAnimationPlan => ({
    engine: "AnimationPlayer", backendPackage: "AnimationExamples", durationSeconds: 0.5, delaySeconds: 0,
    easing: "ease-in-out", playbackMode: "single", completionEvent: "done", tracks: [], ...over,
  });

  it("cubic bezier hits the ends and the ease-in-out midpoint", () => {
    const ease = cubicBezier(0.42, 0, 0.58, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 3);
    expect(cubicBezier(0.42, 0, 1, 1)(0.25)).toBeLessThan(0.25);
  });

  it("position targets are meters and become cm; untouched axes keep their value", () => {
    const o = new Group();
    o.position.set(10, 20, -150);
    const e = resolveEndpoints(o, plan({ tracks: [{ target: "transform.position.y", from: "current", to: 0.5 }] }), 1);
    expect(e.position).toEqual({ from: [10, 20, -150], to: [10, 50, -150] });
    expect(e.scale).toBeUndefined();
  });

  it("the clip has one track per channel and lasts durationSeconds", () => {
    const o = new Group();
    const p = plan({ tracks: [{ target: "transform.scale.x", from: "current", to: 1.15 }, { target: "material.opacity", from: "current", to: 0.8 }] });
    const clip = buildAnimationClip("c", p, resolveEndpoints(o, p, 1), "", "driver");
    expect(clip.duration).toBe(0.5);
    expect(clip.tracks.map((t) => t.name)).toEqual([".scale", "driver.position[x]"]);
    expect(clip.tracks[0]?.times.length).toBe(ANIMATION_SAMPLES + 1);
  });

  it("single playback completes once, after the delay plus duration; loop never completes", () => {
    const scheduler = new FrameScheduler();
    const player = new PreviewAnimationPlayer(scheduler);
    const o = new Group();
    let single = 0;
    let loop = 0;
    player.play("a", o, plan({ delaySeconds: 0.2, tracks: [{ target: "transform.scale.x", from: "current", to: 2 }] }), () => 1, () => single++);
    player.play("b", new Group(), plan({ playbackMode: "loop", tracks: [{ target: "transform.scale.y", from: "current", to: 2 }] }), () => 1, () => loop++);
    for (let i = 0; i < 60; i++) {
      scheduler.tick(16);
      player.update(0.016);
    }
    expect(single).toBe(1);
    expect(loop).toBe(0);
    expect(o.scale.x).toBeCloseTo(2);
    expect(player.active.map((a) => a.nodeId)).toEqual(["b"]);
  });

  it("stop before the delay cancels the start and the completion", () => {
    const scheduler = new FrameScheduler();
    const player = new PreviewAnimationPlayer(scheduler);
    const o = new Group();
    let done = 0;
    const stop = player.play("a", o, plan({ delaySeconds: 1, tracks: [{ target: "transform.scale.x", from: "current", to: 2 }] }), () => 1, () => done++);
    stop();
    for (let i = 0; i < 120; i++) {
      scheduler.tick(16);
      player.update(0.016);
    }
    expect(done).toBe(0);
    expect(o.scale.x).toBe(1);
  });

  it("zero duration applies the target at once and completes synchronously", () => {
    const player = new PreviewAnimationPlayer(new FrameScheduler());
    const o = new Group();
    let done = 0;
    player.play("a", o, plan({ durationSeconds: 0, tracks: [{ target: "transform.rotation.y", from: "current", to: 90 }] }), () => 1, () => done++);
    expect(done).toBe(1);
    expect(o.rotation.y).toBeCloseTo(Math.PI / 2);
  });
});
