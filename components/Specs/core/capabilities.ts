import type { ViroSpecsDiagnosticCode } from "./diagnosticCodes";

/**
 * Evidence labels, weakest to strongest. A label is only claimed when its
 * evidence exists; a static capability flag is never device certification.
 */
export type ViroSpecsEvidenceLabel =
  | "none"
  | "implemented"
  | "portable-test-passed"
  | "lens-compiled"
  | "preview-validated"
  | "hardware-validated";

/**
 * Status of one capability on one Specs target, with each question answered
 * separately. A single "supported" flag cannot express "the code exists but
 * the Lens package is missing" or "it works but the wearer denied permission".
 */
export interface ViroSpecsCapabilityStatus {
  /** Capability name, for example `video` or `hand-tracking`. */
  readonly capability: string;
  /** Whether this SDK has code for the capability on Specs. */
  readonly implemented: boolean;
  /** Whether the Lens project has the packages the capability needs. */
  readonly installed: "present" | "missing" | "unknown";
  /** Runtime permission state on the device. */
  readonly permission: "granted" | "denied" | "prompt" | "not-required" | "unknown";
  /** Strongest evidence recorded for the capability. */
  readonly evidence: ViroSpecsEvidenceLabel;
}

/** Features Specs does not implement and refuses to approximate. */
export type ViroSpecsUnsupportedFeature =
  | "portal"
  | "physics"
  | "rive"
  | "video"
  | "audio"
  | "native-texture"
  | "custom-rendering";

/** Capability error code for each {@linkcode ViroSpecsUnsupportedFeature}. */
export const VIRO_SPECS_UNSUPPORTED_FEATURE_CODES = {
  portal: "VS4001",
  physics: "VS4002",
  rive: "VS4003",
  video: "VS4004",
  audio: "VS4005",
  "native-texture": "VS4006",
  "custom-rendering": "VS4007",
} as const satisfies Record<ViroSpecsUnsupportedFeature, ViroSpecsDiagnosticCode>;

/**
 * Current status of each unsupported feature. `implemented: false` is the
 * reason the compilers report a capability error instead of emitting a
 * stand-in node.
 */
export const VIRO_SPECS_UNSUPPORTED_FEATURE_STATUS: readonly ViroSpecsCapabilityStatus[] =
  (
    Object.keys(VIRO_SPECS_UNSUPPORTED_FEATURE_CODES) as ViroSpecsUnsupportedFeature[]
  ).map((capability) => ({
    capability,
    implemented: false,
    installed: "unknown",
    permission: "unknown",
    evidence: "none",
  }));

/** Viro components whose Specs compilation is a capability error. */
export const VIRO_SPECS_UNSUPPORTED_COMPONENTS: Readonly<
  Record<string, ViroSpecsUnsupportedFeature>
> = {
  ViroPortal: "portal",
  ViroPortalScene: "portal",
  ViroRivePanel: "rive",
  ViroVideo: "video",
  Viro360Video: "video",
  ViroExternalVideo: "video",
  ViroSound: "audio",
  ViroSpatialSound: "audio",
  ViroSoundField: "audio",
  ViroCameraTexture: "native-texture",
  ViroMaterialVideo: "native-texture",
  ViroGpuPanel: "custom-rendering",
  ViroThreeJSPanel: "custom-rendering",
  ViroGeometry: "custom-rendering",
  ViroParticleEmitter: "custom-rendering",
};

/** Props whose presence on any Specs element is a capability error. */
export const VIRO_SPECS_UNSUPPORTED_PROPS: Readonly<
  Record<string, ViroSpecsUnsupportedFeature>
> = {
  physicsBody: "physics",
  onCollision: "physics",
};

/** What a supported Viro component compiles to. */
export type ViroSpecsComponentTarget =
  | { readonly category: "node"; readonly kind: "group" | "text" | "image" | "model" }
  | { readonly category: "polyline" }
  | {
      readonly category: "light";
      readonly type: "ambient" | "directional" | "omni" | "spot";
    };

/** Supported component name to manifest target. */
export const VIRO_SPECS_COMPONENTS: Readonly<Record<string, ViroSpecsComponentTarget>> = {
  ViroNode: { category: "node", kind: "group" },
  ViroText: { category: "node", kind: "text" },
  ViroImage: { category: "node", kind: "image" },
  Viro3DObject: { category: "node", kind: "model" },
  ViroPolyline: { category: "polyline" },
  ViroAmbientLight: { category: "light", type: "ambient" },
  ViroDirectionalLight: { category: "light", type: "directional" },
  ViroOmniLight: { category: "light", type: "omni" },
  ViroSpotLight: { category: "light", type: "spot" },
};

const COMMON_PROPS = [
  "viroTag",
  "key",
  "ref",
  "children",
  "position",
  "rotation",
  "scale",
  "visible",
  "opacity",
  "animation",
  "onHover",
  "onClick",
  "onClickState",
  "onDrag",
  "specsAction",
];

const LIGHT_PROPS = ["viroTag", "key", "ref", "color", "intensity"];

/**
 * Props each supported component carries into the manifest. Any other prop is
 * reported: `VS4xxx` when listed in {@linkcode VIRO_SPECS_UNSUPPORTED_PROPS},
 * otherwise warning `VS3002`.
 */
export const VIRO_SPECS_HANDLED_PROPS: Readonly<Record<string, readonly string[]>> = {
  ViroNode: COMMON_PROPS,
  ViroText: [
    ...COMMON_PROPS,
    "text",
    "style",
    "width",
    "height",
    "maxLines",
    "materials",
  ],
  ViroImage: [...COMMON_PROPS, "source", "width", "height", "materials"],
  Viro3DObject: [...COMMON_PROPS, "source", "type", "materials"],
  ViroPolyline: [...COMMON_PROPS, "points", "thickness", "materials"],
  ViroAmbientLight: LIGHT_PROPS,
  ViroDirectionalLight: [...LIGHT_PROPS, "direction"],
  ViroOmniLight: [...LIGHT_PROPS, "position"],
  ViroSpotLight: [...LIGHT_PROPS, "position", "direction", "innerAngle", "outerAngle"],
};
