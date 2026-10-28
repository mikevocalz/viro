import {
  VIRO_SPECS_COMPONENTS,
  VIRO_SPECS_HANDLED_PROPS,
  VIRO_SPECS_UNSUPPORTED_COMPONENTS,
  VIRO_SPECS_UNSUPPORTED_FEATURE_CODES,
  VIRO_SPECS_UNSUPPORTED_PROPS,
  type ViroSpecsComponentTarget,
  type ViroSpecsUnsupportedFeature,
} from "./capabilities";
import {
  createViroSpecsDiagnostic,
  type ViroSpecsDiagnostic,
  type ViroSpecsDiagnosticDetails,
} from "./diagnostic";
import type {
  ViroSpecsAnimationTarget,
  ViroSpecsEasing,
  ViroSpecsModelFormat,
} from "./manifest";

/** How a compiler should treat one JSX component. */
export type ViroSpecsComponentClass =
  | { readonly kind: "supported"; readonly target: ViroSpecsComponentTarget }
  | { readonly kind: "unsupported-feature"; readonly feature: ViroSpecsUnsupportedFeature }
  | { readonly kind: "unknown" };

/** Classifies a component by its JSX name. */
export function classifySpecsComponent(name: string): ViroSpecsComponentClass {
  const target = VIRO_SPECS_COMPONENTS[name];
  if (target) return { kind: "supported", target };
  const feature = VIRO_SPECS_UNSUPPORTED_COMPONENTS[name];
  if (feature) return { kind: "unsupported-feature", feature };
  return { kind: "unknown" };
}

/**
 * Diagnostic for a component that does not compile: a `VS4xxx` capability
 * error for known unsupported features, `VS3001` otherwise.
 */
export function unsupportedComponentDiagnostic(
  name: string,
  details: ViroSpecsDiagnosticDetails
): ViroSpecsDiagnostic {
  const feature = VIRO_SPECS_UNSUPPORTED_COMPONENTS[name];
  if (feature) {
    return createViroSpecsDiagnostic(
      VIRO_SPECS_UNSUPPORTED_FEATURE_CODES[feature],
      name + " needs " + feature + ", which the Specs target does not implement. It was not compiled and no stand-in was emitted.",
      details
    );
  }
  return createViroSpecsDiagnostic(
    "VS3001",
    name + " has no Specs mapping. It and its children were not compiled.",
    details
  );
}

/**
 * Reports props a supported component carries that the manifest does not:
 * capability errors for physics props, `VS3002` warnings for the rest.
 * `detailsFor` supplies the location of each prop.
 */
export function checkSpecsProps(
  componentName: string,
  propNames: readonly string[],
  detailsFor: (prop: string) => ViroSpecsDiagnosticDetails
): ViroSpecsDiagnostic[] {
  const handled = VIRO_SPECS_HANDLED_PROPS[componentName] ?? [];
  const diagnostics: ViroSpecsDiagnostic[] = [];
  for (const prop of propNames) {
    if (handled.includes(prop)) continue;
    const feature = VIRO_SPECS_UNSUPPORTED_PROPS[prop];
    if (feature) {
      diagnostics.push(
        createViroSpecsDiagnostic(
          VIRO_SPECS_UNSUPPORTED_FEATURE_CODES[feature],
          componentName + " prop `" + prop + "` needs " + feature + ", which the Specs target does not implement.",
          detailsFor(prop)
        )
      );
    } else {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3002",
          componentName + " prop `" + prop + "` is not carried to Specs.",
          detailsFor(prop)
        )
      );
    }
  }
  return diagnostics;
}

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

/** Normalizes `#RGB`, `#RRGGBB` and `#RRGGBBAA` to lower-case hex; `undefined` for anything else. */
export function normalizeSpecsColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(value);
  if (short) return ("#" + short[1] + short[1] + short[2] + short[2] + short[3] + short[3]).toLowerCase();
  if (/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) return value.toLowerCase();
  return undefined;
}

/**
 * Maps Viro3DObject `type` to a manifest model format. `vrx` is returned so
 * the caller can report `VS3013`; other unknown values return `undefined`.
 */
export function specsModelFormat(type: unknown): ViroSpecsModelFormat | "vrx" | undefined {
  if (typeof type !== "string") return undefined;
  const lower = type.toLowerCase();
  if (lower === "glb" || lower === "gltf" || lower === "obj" || lower === "fbx" || lower === "vrx") {
    return lower;
  }
  return undefined;
}
