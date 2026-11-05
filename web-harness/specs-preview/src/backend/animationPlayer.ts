import { AnimationMixer, LoopOnce, LoopRepeat, Object3D, type AnimationAction } from "three";
import type { ViroSpecsNativeAnimationPlan } from "../vendor/lens-core/ViroSpecsProtocol";
import type { ViroSpecsCancel, ViroSpecsHostScheduler } from "../vendor/lens-core/ViroSpecsSceneBackend";
import { buildAnimationClip, resolveEndpoints } from "./animation";
import { ALPHA_TARGET } from "./visuals";

const OPACITY_DRIVER = "viroOpacityDriver";

/** One running clip, for inspection. */
export interface PlayingAnimation {
  readonly nodeId: string;
  readonly plan: ViroSpecsNativeAnimationPlan;
  /** False until the delay elapses. */
  started: boolean;
  stopped: boolean;
}

type Entry = {
  playing: PlayingAnimation;
  mixer?: AnimationMixer;
  action?: AnimationAction;
  driver?: Object3D;
  animatesOpacity: boolean;
};

/**
 * Plays animation plans with AnimationMixer, following
 * `ViroSpecsAnimationRuntime.playOn`: a delay before start, start values
 * read when the clip starts, `durationSeconds === 0` applied at once with an
 * immediate completion, `single` firing `onComplete` once, `loop` repeating,
 * and nothing firing after stop.
 */
export class PreviewAnimationPlayer {
  private readonly entries = new Set<Entry>();

  constructor(private readonly scheduler: ViroSpecsHostScheduler) {}

  /** Animations started and not stopped. */
  get active(): readonly PlayingAnimation[] {
    return Array.from(this.entries, (e) => e.playing).filter((p) => !p.stopped);
  }

  play(
    nodeId: string,
    object: Object3D,
    plan: ViroSpecsNativeAnimationPlan,
    currentOpacity: () => number,
    onComplete: () => void
  ): ViroSpecsCancel {
    const entry: Entry = { playing: { nodeId, plan, started: false, stopped: false }, animatesOpacity: false };
    this.entries.add(entry);
    let cancelDelay: ViroSpecsCancel | undefined;
    const stop = (): void => {
      if (entry.playing.stopped) return;
      entry.playing.stopped = true;
      cancelDelay?.();
      if (entry.action) entry.action.stop();
      if (entry.mixer) entry.mixer.uncacheRoot(object);
      if (entry.driver) object.remove(entry.driver);
      this.entries.delete(entry);
    };

    const start = (): void => {
      if (entry.playing.stopped) return;
      entry.playing.started = true;
      const endpoints = resolveEndpoints(object, plan, currentOpacity());
      if (plan.durationSeconds === 0) {
        if (endpoints.position) object.position.fromArray(endpoints.position.to);
        if (endpoints.scale) object.scale.fromArray(endpoints.scale.to);
        if (endpoints.rotation) object.rotation.set(endpoints.rotation.to[0], endpoints.rotation.to[1], endpoints.rotation.to[2], "XYZ");
        if (endpoints.opacity) setAlphaRecursive(object, endpoints.opacity.to);
        entry.playing.stopped = true;
        this.entries.delete(entry);
        onComplete();
        return;
      }
      const driver = new Object3D();
      driver.name = OPACITY_DRIVER;
      driver.position.x = endpoints.opacity?.from ?? 1;
      object.add(driver);
      const mixer = new AnimationMixer(object);
      const clip = buildAnimationClip(nodeId + ":" + plan.completionEvent, plan, endpoints, "", OPACITY_DRIVER);
      const action = mixer.clipAction(clip);
      if (plan.playbackMode === "loop") action.setLoop(LoopRepeat, Infinity);
      else {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
        mixer.addEventListener("finished", (event) => {
          if (event.action !== action || entry.playing.stopped) return;
          entry.playing.stopped = true;
          this.entries.delete(entry);
          onComplete();
        });
      }
      action.play();
      entry.mixer = mixer;
      entry.action = action;
      entry.driver = driver;
      entry.animatesOpacity = endpoints.opacity !== undefined;
    };

    if (plan.delaySeconds > 0) cancelDelay = this.scheduler.after(plan.delaySeconds, start);
    else start();
    return stop;
  }

  /** Advances every mixer and writes animated opacity into materials. */
  update(deltaSeconds: number): void {
    for (const entry of Array.from(this.entries)) {
      if (!entry.mixer || entry.playing.stopped) continue;
      entry.mixer.update(deltaSeconds);
      if (entry.animatesOpacity && entry.driver?.parent) setAlphaRecursive(entry.driver.parent, entry.driver.position.x);
    }
  }

  stopAll(): void {
    this.entries.clear();
  }
}

/**
 * Sets the alpha of every text, image and model visual under `object`,
 * like the Lens runtime's `setOpacityRecursive` (absolute, not multiplied).
 */
export function setAlphaRecursive(object: Object3D, alpha: number): void {
  const clamped = Math.max(0, Math.min(1, alpha));
  object.traverse((child) => {
    if (!child.userData[ALPHA_TARGET]) return;
    const material = (child as Object3D & { material?: { opacity: number; transparent: boolean } | { opacity: number; transparent: boolean }[] }).material;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of list) {
      m.opacity = clamped;
      m.transparent = true;
    }
  });
}
