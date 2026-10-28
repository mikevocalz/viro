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
import type { ViroSpecsModelFormat } from "./manifest";

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
