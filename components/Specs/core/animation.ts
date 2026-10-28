import type { ViroSpecsIssue } from "./diagnostics";
import type {
  ViroSpecsAnimationTarget,
  ViroSpecsAnimationTrack,
  ViroSpecsEasing,
  ViroSpecsManifestAnimation,
  ViroSpecsVec3,
} from "./manifest";

const EASINGS: Readonly<Record<string, ViroSpecsEasing>> = {
  linear: "linear",
  easein: "ease-in",
  "ease-in": "ease-in",
  easeout: "ease-out",
  "ease-out": "ease-out",
  easeineaseout: "ease-in-out",
  "ease-in-out": "ease-in-out",
};

/** Maps a Viro easing name to a Specs easing, or `undefined` when Specs has no exact match. */
export function normalizeSpecsEasing(easing: unknown): ViroSpecsEasing | undefined {
  const key = easing === undefined ? "linear" : String(easing).toLowerCase();
  return EASINGS[key];
}

const TARGETS: Readonly<Record<string, ViroSpecsAnimationTarget>> = {
  positionX: "transform.position.x",
  positionY: "transform.position.y",
  positionZ: "transform.position.z",
  translateX: "transform.position.x",
  translateY: "transform.position.y",
  translateZ: "transform.position.z",
  scaleX: "transform.scale.x",
  scaleY: "transform.scale.y",
  scaleZ: "transform.scale.z",
  rotateX: "transform.rotation.x",
  rotateY: "transform.rotation.y",
  rotateZ: "transform.rotation.z",
  opacity: "material.opacity",
};

/** Animation target for a Viro animation property, or `undefined` when unsupported. */
export function specsAnimationTarget(property: string): ViroSpecsAnimationTarget | undefined {
  return TARGETS[property];
}

/**
 * Resolves a Viro animation value against the element's current value.
 * Relative strings (`"+=0.5"`, `"*=2"`) apply to `base`; `translate*`
 * properties are offsets, so numbers add to `base`.
 * Returns `undefined` when the value cannot be resolved.
 */
export function resolveSpecsAnimationValue(
  value: unknown,
  base: number,
  translate: boolean
): number | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return translate ? base + value : value;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const relative = /^([+\-*/])=(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (relative) {
    const operand = Number(relative[2]);
    switch (relative[1]) {
      case "+":
        return base + operand;
      case "-":
        return base - operand;
      case "*":
        return base * operand;
      default:
        return operand === 0 ? undefined : base / operand;
    }
  }
  if (trimmed === "") return undefined;
  const absolute = Number(trimmed);
  if (!Number.isFinite(absolute)) return undefined;
  return translate ? base + absolute : absolute;
}

/**
 * The element values relative animation values resolve against. Rotation is
 * Euler degrees, as authored.
 */
export interface ViroSpecsAnimationBase {
  readonly position?: ViroSpecsVec3;
  readonly rotation?: ViroSpecsVec3;
  readonly scale?: ViroSpecsVec3;
  readonly opacity?: number;
}

/** The value an animation property starts from on an element. */
export function specsAnimationBaseValue(property: string, base: ViroSpecsAnimationBase): number {
  const position = base.position ?? [0, 0, 0];
  const scale = base.scale ?? [1, 1, 1];
  const rotation = base.rotation ?? [0, 0, 0];
  switch (property) {
    case "positionX":
    case "translateX":
      return position[0];
    case "positionY":
    case "translateY":
      return position[1];
    case "positionZ":
    case "translateZ":
      return position[2];
    case "scaleX":
      return scale[0];
    case "scaleY":
      return scale[1];
    case "scaleZ":
      return scale[2];
    case "rotateX":
      return rotation[0];
    case "rotateY":
      return rotation[1];
    case "rotateZ":
      return rotation[2];
    case "opacity":
      return base.opacity ?? 1;
    default:
      return 0;
  }
}

/**
 * One animation as registered with `ViroAnimations.registerAnimations`, read
 * from the runtime registry or from source. Fields are `unknown` because the
 * static compiler reads them from the AST.
 */
export interface ViroSpecsRegisteredAnimation {
  readonly properties?: unknown;
  readonly duration?: unknown;
  readonly delay?: unknown;
  readonly easing?: unknown;
}

/**
 * Finds a registered animation by name: the definition, `"chain"` for an
 * animation chain (an array), or `undefined` when nothing is registered.
 */
export type ViroSpecsAnimationLookup = (
  name: string
) => ViroSpecsRegisteredAnimation | "chain" | undefined;

/** The `animation` prop of one element, after its values are known. */
export interface ViroSpecsAnimationRequest {
  readonly nodeId: string;
  readonly name: string;
  readonly run: boolean;
  readonly loop: boolean;
  /** Element-level `animation.delay`, milliseconds. Added to the registered delay. */
  readonly delayMs: number;
  readonly base: ViroSpecsAnimationBase;
}

/** Lens package that provides the AnimationPlayer the manifest names. */
export const VIRO_SPECS_ANIMATION_BACKEND = "AnimationExamples";

/** Completion event the Lens host fires when an animation ends. */
export function specsAnimationCompletionEvent(nodeId: string, name: string): string {
  return "viro-animation-complete:" + nodeId + ":" + name;
}

/** Output of {@linkcode resolveSpecsAnimation}. */
export type ViroSpecsAnimationResolution =
  | { readonly kind: "none"; readonly issues: readonly ViroSpecsIssue[] }
  | { readonly kind: "stop"; readonly issues: readonly ViroSpecsIssue[] }
  | {
      readonly kind: "play";
      readonly manifest: ViroSpecsManifestAnimation;
      /** Resolved absolute values keyed by Viro property, `translate*` renamed to `position*`. */
      readonly properties: Readonly<Record<string, number>>;
      readonly durationMs: number;
      readonly delayMs: number;
      readonly issues: readonly ViroSpecsIssue[];
    };

function isTiming(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Resolves one element animation into a manifest animation. Both compilers
 * call this, so easing, targets, relative values, timings and the completion
 * event cannot differ between them.
 *
 * Problems come back as issues for the caller to locate; any issue means no
 * animation is emitted (`kind: "none"`).
 */
export function resolveSpecsAnimation(
  request: ViroSpecsAnimationRequest,
  lookup: ViroSpecsAnimationLookup
): ViroSpecsAnimationResolution {
  const { nodeId, name } = request;
  if (!request.run) return { kind: "stop", issues: [] };

  const registered = lookup(name);
  if (registered === undefined || registered === "chain") {
    return {
      kind: "none",
      issues: [
        {
          code: "VS3003",
          prop: "animation",
          message:
            "Animation " + name + " on " + nodeId +
            (registered === "chain" ? " is an animation chain." : " is not registered."),
        },
      ],
    };
  }

  const issues: ViroSpecsIssue[] = [];
  const easing = normalizeSpecsEasing(registered.easing);
  if (!easing) {
    issues.push({
      code: "VS3006",
      prop: "animation",
      message: "Animation " + name + " uses easing " + String(registered.easing) + ", which Specs does not play.",
    });
  }

  if (!isTiming(registered.duration)) {
    issues.push({
      code: "VS3014",
      prop: "animation",
      message: "Animation " + name + " duration " + String(registered.duration) + " is not a finite number of milliseconds >= 0.",
    });
  }
  const registeredDelay = registered.delay === undefined ? 0 : registered.delay;
  if (!isTiming(registeredDelay)) {
    issues.push({
      code: "VS3014",
      prop: "animation",
      message: "Animation " + name + " delay " + String(registered.delay) + " is not a finite number of milliseconds >= 0.",
    });
  }
  if (!isTiming(request.delayMs)) {
    issues.push({
      code: "VS3014",
      prop: "animation",
      message: "animation.delay " + String(request.delayMs) + " on " + nodeId + " is not a finite number of milliseconds >= 0.",
    });
  }

  const properties: Record<string, number> = {};
  const tracks: ViroSpecsAnimationTrack[] = [];
  const entries =
    typeof registered.properties === "object" && registered.properties !== null && !Array.isArray(registered.properties)
      ? Object.entries(registered.properties)
      : [];
  for (const [property, value] of entries) {
    if (value === undefined) continue;
    const target = specsAnimationTarget(property);
    if (!target) {
      issues.push({
        code: "VS3004",
        prop: "animation",
        message: "Animation " + name + " property " + property + " is not supported on Specs.",
      });
      continue;
    }
    const resolved = resolveSpecsAnimationValue(
      value,
      specsAnimationBaseValue(property, request.base),
      property.startsWith("translate")
    );
    if (resolved === undefined) {
      issues.push({
        code: "VS3005",
        prop: "animation",
        message: "Animation " + name + " cannot resolve " + property + "=" + String(value) + ".",
      });
      continue;
    }
    properties[property.replace(/^translate/, "position")] = resolved;
    tracks.push({ target, from: "current", to: resolved });
  }
  if (tracks.length === 0 && issues.length === 0) {
    issues.push({
      code: "VS3004",
      prop: "animation",
      message: "Animation " + name + " has no properties Specs can animate.",
    });
  }

  if (issues.length > 0 || !easing || !isTiming(registered.duration) || !isTiming(registeredDelay)) {
    return { kind: "none", issues };
  }

  const durationMs = registered.duration;
  const delayMs = registeredDelay + request.delayMs;
  return {
    kind: "play",
    properties,
    durationMs,
    delayMs,
    issues,
    manifest: {
      nodeId,
      name,
      plan: {
        engine: "AnimationPlayer",
        backendPackage: VIRO_SPECS_ANIMATION_BACKEND,
        durationSeconds: durationMs / 1000,
        delaySeconds: delayMs / 1000,
        easing,
        playbackMode: request.loop ? "loop" : "single",
        completionEvent: specsAnimationCompletionEvent(nodeId, name),
        tracks,
      },
    },
  };
}

/**
 * Animation action the runtime transport runs: `playAnimation` for `play`,
 * `stopAnimation` for `stop` (an element with `animation.run === false`).
 */
export type ViroSpecsAnimationPlan =
  | {
      readonly action: "play";
      readonly nodeId: string;
      readonly name: string;
      readonly definition: {
        readonly properties: Readonly<Record<string, number>>;
        readonly durationMs: number;
        readonly delayMs?: number;
        readonly easing?: string;
        readonly loop?: boolean;
        readonly completionEvent?: string;
      };
    }
  | {
      readonly action: "stop";
      readonly nodeId: string;
      readonly name: string;
    };
