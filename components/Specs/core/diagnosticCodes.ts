/**
 * How a {@linkcode ViroSpecsDiagnostic} affects a build.
 *
 * - `error`: the manifest would misrepresent the source. Producers must not
 *   emit or apply it.
 * - `warning`: the manifest is faithful but drops or approximates something
 *   the author wrote. `viro-specs-compile --strict` treats warnings as errors.
 * - `info`: no effect on output.
 */
export type ViroSpecsDiagnosticSeverity = "error" | "warning" | "info";

/**
 * Catalog entry for one diagnostic code. The severity is fixed per code so a
 * code means the same thing in every producer.
 */
export interface ViroSpecsDiagnosticDefinition {
  /** Fixed severity for every diagnostic carrying this code. */
  readonly severity: ViroSpecsDiagnosticSeverity;
  /** One-line description used as the heading in `docs/specs-diagnostics.md`. */
  readonly title: string;
  /** Default fix suggestion. Producers may replace it with a more specific one. */
  readonly hint: string;
}

/**
 * Every diagnostic code a Specs producer can emit.
 *
 * Ranges: `VS1xxx` manifest and protocol validation, `VS2xxx` static source
 * analysis (`viro-specs-compile`), `VS3xxx` compile semantics shared by the
 * runtime and static compilers and the runtime transport, `VS4xxx` capability
 * errors for features the Specs target does not implement.
 *
 * Codes are append-only. A retired code keeps its entry so old logs stay
 * searchable.
 */
export const VIRO_SPECS_DIAGNOSTICS = {
  VS1000: {
    severity: "error",
    title: "Manifest JSON could not be parsed",
    hint: "Check the file for a JSON syntax error at the reported position.",
  },
  VS1001: {
    severity: "error",
    title: "Manifest is not a JSON object",
    hint: "A manifest is an object with a numeric `version` and a `nodes` array.",
  },
  VS1002: {
    severity: "warning",
    title: "Manifest version 1 is deprecated",
    hint: "The manifest was migrated to version 2 in memory. Recompile with viro-specs-compile or call migrateSpecsManifest() and save the result.",
  },
  VS1003: {
    severity: "error",
    title: "Unsupported manifest version",
    hint: "This SDK reads manifest versions 1 and 2. Upgrade @reactvision/react-viro to read newer manifests.",
  },
  VS1004: {
    severity: "error",
    title: "Field has an invalid value",
    hint: "See docs/specs-manifest.md for the field's type and range.",
  },
  VS1005: {
    severity: "error",
    title: "Required field is missing",
    hint: "See docs/specs-manifest.md for the required fields of this object.",
  },
  VS1006: {
    severity: "error",
    title: "Unknown field",
    hint: "Remove the field or check its spelling. Manifests reject unknown fields so typos cannot pass silently.",
  },
  VS1007: {
    severity: "error",
    title: "Duplicate ID",
    hint: "Node, polyline and light IDs share one namespace. Give each element a unique viroTag.",
  },
  VS1008: {
    severity: "error",
    title: "Parent ID does not match any node",
    hint: "Set parentId to the id of a node in the same manifest, or remove it to attach the node to the scene root.",
  },
  VS1009: {
    severity: "error",
    title: "Parent chain forms a cycle",
    hint: "A node cannot be its own ancestor. Fix the parentId values in the reported chain.",
  },
  VS1010: {
    severity: "error",
    title: "Reference to an unknown node",
    hint: "Interactions and animations must target the id of a node in the same manifest.",
  },
  VS1011: {
    severity: "info",
    title: "Material is not defined in the manifest",
    hint: "The Lens material registry must provide this material ID, or add it to `materials`.",
  },
  VS1012: {
    severity: "error",
    title: "Unknown node kind",
    hint: "Use one of: group, text, image, model, panel, video, sound.",
  },
  VS1013: {
    severity: "error",
    title: "Duplicate material ID",
    hint: "Each entry in `materials` needs a unique id.",
  },
  VS1014: {
    severity: "error",
    title: "Unsupported scene protocol version",
    hint: "The Lens runtime reads scene snapshots with version 1. Lower a v2 manifest with toSpecsSceneSnapshot().",
  },
  VS1015: {
    severity: "warning",
    title: "Field is not carried by scene protocol 1",
    hint: "The Lens runtime does not render this field yet. The manifest keeps it; the wire snapshot omits it.",
  },
  VS2001: {
    severity: "error",
    title: "No ViroSpecsScene root",
    hint: "Wrap the Specs content of the entry file in <ViroSpecsScene>.",
  },
  VS2002: {
    severity: "error",
    title: "ViroSpecsScene has no supported static content",
    hint: "Add at least one ViroNode, ViroText, ViroImage, Viro3DObject or ViroPolyline with static props.",
  },
  VS2003: {
    severity: "error",
    title: "Element is inside JSX the static compiler cannot expand",
    hint: "Static conditions, ternaries, && and .map() over static arrays compile. Move the element out of other calls, loops or IIFEs, and control it with a static visible prop.",
  },
  VS2004: {
    severity: "error",
    title: "Transform must be a static finite [x, y, z]",
    hint: "Use a literal array or a top-level const of three finite numbers.",
  },
  VS2005: {
    severity: "error",
    title: "visible must be a static boolean",
    hint: "Use visible={true} or visible={false}, or a top-level const boolean.",
  },
  VS2006: {
    severity: "error",
    title: "Polyline needs at least two static finite points",
    hint: "Pass points as a literal array of [x, y, z] arrays.",
  },
  VS2007: {
    severity: "error",
    title: "Polyline thickness must be a positive static number",
    hint: "Use a literal number greater than 0, in meters.",
  },
  VS2008: {
    severity: "error",
    title: "Material name must be static",
    hint: "Pass materials as a string literal or an array whose first element is a string literal.",
  },
  VS2009: {
    severity: "error",
    title: "ViroText needs static text",
    hint: "Pass text as a string literal or a top-level const string.",
  },
  VS2010: {
    severity: "error",
    title: "Asset source must be static",
    hint: "Use require(\"./asset.glb\"), a string asset ID or { uri: \"...\" } with a literal URI.",
  },
  VS2011: {
    severity: "error",
    title: "animation must be a static object",
    hint: "Pass animation={{ name: \"...\", run: true }} with literal values.",
  },
  VS2012: {
    severity: "error",
    title: "animation needs static name and run",
    hint: "Set name to a string literal and run to true or false.",
  },
  VS2013: {
    severity: "error",
    title: "Spread props cannot be resolved statically",
    hint: "Spread a top-level const object (in the entry file or imported from a relative module), or write the props out on the element. The spread's props were ignored.",
  },
  VS2014: {
    severity: "error",
    title: "Expression cannot be resolved statically",
    hint: "Use a literal, a top-level const, a const imported from a relative module, or a .map() parameter. The message quotes the expression.",
  },
  VS2015: {
    severity: "error",
    title: "Entry file could not be parsed",
    hint: "Fix the syntax error at the reported position.",
  },
  VS2016: {
    severity: "warning",
    title: "Condition is only known at runtime; both branches were emitted hidden",
    hint: "The static manifest emits every branch of the condition with visible: false, and the Lens shows none of them until the host sets visibility. Use a static condition, or give each branch a viroTag and drive visibility from the app.",
  },
  VS2017: {
    severity: "error",
    title: "Polyline or light inside a runtime condition",
    hint: "Polylines and lights have no visible flag on Specs, so they cannot be emitted hidden. Move them out of the condition.",
  },
  VS2018: {
    severity: "error",
    title: "Import cannot be resolved",
    hint: "The static compiler follows relative imports of .ts, .tsx, .js and .jsx modules and treats other relative files as assets. Package imports are not read; inline the value or move it into the project.",
  },
  VS2019: {
    severity: "error",
    title: ".map() cannot be expanded statically",
    hint: "Call .map() on a static array with a callback whose body is, or returns, one JSX element. Callbacks with statements other than one return are not expanded.",
  },
  VS3001: {
    severity: "error",
    title: "Component has no Specs mapping",
    hint: "Specs supports ViroNode, ViroText, ViroImage, Viro3DObject, ViroPolyline and the four Viro lights. Render other components outside ViroSpecsScene.",
  },
  VS3002: {
    severity: "warning",
    title: "Prop is ignored on Specs",
    hint: "The Specs target does not carry this prop. Remove it from the Specs scene or accept the difference.",
  },
  VS3003: {
    severity: "error",
    title: "Animation is not registered or is a chain",
    hint: "Register a single animation with ViroAnimations.registerAnimations. Animation chains are not compiled.",
  },
  VS3004: {
    severity: "error",
    title: "Animation property is not supported",
    hint: "Specs animates position, translate, scale, rotate and opacity.",
  },
  VS3005: {
    severity: "error",
    title: "Animation value cannot be resolved",
    hint: "Use a number or a relative string such as \"+=0.5\", \"-=1\", \"*=2\" or \"/=2\".",
  },
  VS3006: {
    severity: "error",
    title: "Animation easing is not supported",
    hint: "Use Linear, EaseIn, EaseOut or EaseInEaseOut. Specs will not substitute a different curve.",
  },
  VS3008: {
    severity: "error",
    title: "Asset source has no stable ID",
    hint: "Pass sourceResolver to ViroSpecsScene to map bundled assets to Lens asset IDs.",
  },
  VS3009: {
    severity: "warning",
    title: "Color is not a hex value",
    hint: "Specs manifests store colors as #RRGGBB or #RRGGBBAA.",
  },
  VS3010: {
    severity: "error",
    title: "Transport cannot run an animation action",
    hint: "Implement playAnimation and stopAnimation on the ViroSpecsSceneTransport.",
  },
  VS3011: {
    severity: "error",
    title: "Transport call failed",
    hint: "The transport threw or rejected. The previous scene stays applied.",
  },
  VS3012: {
    severity: "warning",
    title: "Element has no viroTag",
    hint: "Without viroTag the ID is a content hash of kind, parent, text or source, and React key, so it changes when that content changes. Add a unique viroTag; --strict requires one.",
  },
  VS3013: {
    severity: "error",
    title: "Model format is not supported on Specs",
    hint: "Lens Studio cannot import VRX. Export the model as GLB.",
  },
  VS3014: {
    severity: "error",
    title: "Animation timing is not a finite non-negative number",
    hint: "Set duration and delay in milliseconds as numbers >= 0, both in registerAnimations and in the element's animation.delay.",
  },
  VS3015: {
    severity: "error",
    title: "Element cannot have children on Specs",
    hint: "Specs polylines and lights are leaves. Move the children into a ViroNode.",
  },
  VS4001: {
    severity: "error",
    title: "Portals are not supported on Specs",
    hint: "No Specs equivalent ships. Render portals on ViroCore only.",
  },
  VS4002: {
    severity: "error",
    title: "Physics is not supported on Specs",
    hint: "Remove physicsBody and onCollision from the Specs scene. Specs will not fake physics with a static node.",
  },
  VS4003: {
    severity: "error",
    title: "Rive is not supported on Specs",
    hint: "Render ViroRivePanel on ViroCore only.",
  },
  VS4004: {
    severity: "error",
    title: "Video is not supported on Specs",
    hint: "The Specs host has no video player. Render video on ViroCore only.",
  },
  VS4005: {
    severity: "error",
    title: "Audio is not supported on Specs",
    hint: "The Specs host has no audio player. Play sound on ViroCore only.",
  },
  VS4006: {
    severity: "error",
    title: "Native textures are not supported on Specs",
    hint: "Camera and video textures need a native surface the Lens runtime does not expose.",
  },
  VS4007: {
    severity: "error",
    title: "Custom rendering is not supported on Specs",
    hint: "GPU, three.js, custom geometry and particle surfaces do not compile to Lens content.",
  },
} as const satisfies Record<string, ViroSpecsDiagnosticDefinition>;

/** A code from {@linkcode VIRO_SPECS_DIAGNOSTICS}. */
export type ViroSpecsDiagnosticCode = keyof typeof VIRO_SPECS_DIAGNOSTICS;
