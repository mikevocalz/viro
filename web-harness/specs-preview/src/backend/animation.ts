import { AnimationClip, Euler, NumberKeyframeTrack, Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack, type KeyframeTrack, type Object3D } from "three";
import type { ViroSpecsAnimationEasing, ViroSpecsAnimationTrackPlan, ViroSpecsNativeAnimationPlan } from "../vendor/lens-core/ViroSpecsProtocol";
import { CM_PER_METER, EASING_CONTROL_POINTS } from "./lensSemantics";

/** Keyframes sampled per clip. The Lens runtime evaluates the curve exactly; 32 samples keep the error under 0.2 %. */
export const ANIMATION_SAMPLES = 32;

const DEG_TO_RAD = Math.PI / 180;

/** Control points `[x1, y1, x2, y2]` for an easing, as `ViroSpecsAnimationRuntime.resolveEasing` returns them. */
export function easingControlPoints(easing: ViroSpecsAnimationEasing): readonly [number, number, number, number] {
  return typeof easing === "object" ? easing.cubicBezier : EASING_CONTROL_POINTS[easing];
}

/** CSS-style cubic bezier: maps progress `x` in 0..1 to eased progress. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const bx = (t: number): number => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number): number => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 40; i++) {
      t = (lo + hi) / 2;
      if (bx(t) < x) lo = t;
      else hi = t;
    }
    return by(t);
  };
}

/**
 * Where a plan starts and ends, read from the object when the clip starts
 * (after any delay), as the Lens runtime does: tracks go from the current
 * value to an absolute target.
 */
export interface AnimationEndpoints {
  readonly position?: { readonly from: readonly [number, number, number]; readonly to: readonly [number, number, number] };
  readonly scale?: { readonly from: readonly [number, number, number]; readonly to: readonly [number, number, number] };
  /** Euler angles in radians, XYZ order. */
  readonly rotation?: { readonly from: readonly [number, number, number]; readonly to: readonly [number, number, number] };
  readonly opacity?: { readonly from: number; readonly to: number };
}

const target = (tracks: readonly ViroSpecsAnimationTrackPlan[], name: ViroSpecsAnimationTrackPlan["target"]): number | undefined =>
  tracks.find((t) => t.target === name)?.to;

/**
 * Resolves start and end values. Position targets are meters and become
 * centimeters; rotation targets are degrees; scale and opacity are unitless.
 * An axis without a track keeps its current value. A channel whose start and
 * end are equal is left out, as the Lens runtime skips it.
 */
export function resolveEndpoints(object: Object3D, plan: ViroSpecsNativeAnimationPlan, currentOpacity: number): AnimationEndpoints {
  const tracks = plan.tracks;
  const p = object.position;
  const px = target(tracks, "transform.position.x");
  const py = target(tracks, "transform.position.y");
  const pz = target(tracks, "transform.position.z");
  const positionTo: [number, number, number] = [
    px === undefined ? p.x : px * CM_PER_METER,
    py === undefined ? p.y : py * CM_PER_METER,
    pz === undefined ? p.z : pz * CM_PER_METER,
  ];
  const s = object.scale;
  const scaleTo: [number, number, number] = [
    target(tracks, "transform.scale.x") ?? s.x,
    target(tracks, "transform.scale.y") ?? s.y,
    target(tracks, "transform.scale.z") ?? s.z,
  ];
  const e = new Euler().setFromQuaternion(object.quaternion, "XYZ");
  const rx = target(tracks, "transform.rotation.x");
  const ry = target(tracks, "transform.rotation.y");
  const rz = target(tracks, "transform.rotation.z");
  const rotationTo: [number, number, number] = [
    rx === undefined ? e.x : rx * DEG_TO_RAD,
    ry === undefined ? e.y : ry * DEG_TO_RAD,
    rz === undefined ? e.z : rz * DEG_TO_RAD,
  ];
  const opacityTo = target(tracks, "material.opacity");
  const same = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => v === b[i]);
  const positionFrom: [number, number, number] = [p.x, p.y, p.z];
  const scaleFrom: [number, number, number] = [s.x, s.y, s.z];
  const rotationFrom: [number, number, number] = [e.x, e.y, e.z];
  return {
    ...(same(positionFrom, positionTo) ? {} : { position: { from: positionFrom, to: positionTo } }),
    ...(same(scaleFrom, scaleTo) ? {} : { scale: { from: scaleFrom, to: scaleTo } }),
    ...(same(rotationFrom, rotationTo) ? {} : { rotation: { from: rotationFrom, to: rotationTo } }),
    ...(opacityTo === undefined ? {} : { opacity: { from: currentOpacity, to: Math.max(0, Math.min(1, opacityTo)) } }),
  };
}

/**
 * Builds the clip for one plan. Transform channels bind to the node's
 * Object3D; opacity binds to `opacityDriver.position.x`, which the backend
 * copies into the node's materials every frame (opacity spans several
 * materials, so no single three.js property can carry it).
 */
export function buildAnimationClip(
  name: string,
  plan: ViroSpecsNativeAnimationPlan,
  endpoints: AnimationEndpoints,
  objectName: string,
  opacityDriverName: string
): AnimationClip {
  const [x1, y1, x2, y2] = easingControlPoints(plan.easing);
  const ease = cubicBezier(x1, y1, x2, y2);
  const times: number[] = [];
  const eased: number[] = [];
  for (let i = 0; i <= ANIMATION_SAMPLES; i++) {
    const x = i / ANIMATION_SAMPLES;
    times.push(x * plan.durationSeconds);
    eased.push(ease(x));
  }
  const lerp3 = (from: readonly number[], to: readonly number[]): number[] =>
    eased.flatMap((k) => [0, 1, 2].map((i) => (from[i] ?? 0) + ((to[i] ?? 0) - (from[i] ?? 0)) * k));
  const tracks: KeyframeTrack[] = [];
  if (endpoints.position) tracks.push(new VectorKeyframeTrack(objectName + ".position", times, lerp3(endpoints.position.from, endpoints.position.to)));
  if (endpoints.scale) tracks.push(new VectorKeyframeTrack(objectName + ".scale", times, lerp3(endpoints.scale.from, endpoints.scale.to)));
  if (endpoints.rotation) {
    // The Lens runtime interpolates Euler angles and rebuilds the quaternion
    // each frame, so sample the Euler path rather than slerping.
    const values: number[] = [];
    const angles = lerp3(endpoints.rotation.from, endpoints.rotation.to);
    const q = new Quaternion();
    const euler = new Euler();
    for (let i = 0; i < angles.length; i += 3) {
      q.setFromEuler(euler.set(angles[i] ?? 0, angles[i + 1] ?? 0, angles[i + 2] ?? 0, "XYZ"));
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new QuaternionKeyframeTrack(objectName + ".quaternion", times, values));
  }
  if (endpoints.opacity) {
    const { from, to } = endpoints.opacity;
    tracks.push(new NumberKeyframeTrack(opacityDriverName + ".position[x]", times, eased.map((k) => from + (to - from) * k)));
  }
  return new AnimationClip(name, plan.durationSeconds, tracks);
}
