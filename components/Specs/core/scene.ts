import {
  readSpecsActionProp,
  specsTriggerEvents,
  type ViroSpecsActionDeclaration,
  type ViroSpecsActionTrigger,
} from "./actions";
import {
  resolveSpecsAnimation,
  type ViroSpecsAnimationLookup,
  type ViroSpecsAnimationPlan,
} from "./animation";
import {
  checkSpecsProps,
  classifySpecsComponent,
  normalizeSpecsColor,
  specsModelFormat,
  unsupportedComponentDiagnostic,
} from "./compileSupport";
import { createViroSpecsDiagnostic, type ViroSpecsDiagnostic, type ViroSpecsDiagnosticDetails } from "./diagnostic";
import {
  formatViroSpecsLocation,
  locateViroSpecsIssue,
  type ViroSpecsElementOrigin,
  type ViroSpecsIssue,
} from "./diagnostics";
import { ViroSpecsIdAllocator } from "./ids";
import { toSpecsSceneDocument, toSpecsSceneSnapshot } from "./lower";
import {
  VIRO_SPECS_COMPONENT_NODE_KIND,
  VIRO_SPECS_MANIFEST_SCHEMA_ID,
  type ViroSpecsComponentType,
  type ViroSpecsNodeBase,
  type ViroSpecsExtents,
  type ViroSpecsLight,
  type ViroSpecsManifestAnimation,
  type ViroSpecsManifestInteraction,
  type ViroSpecsManifestNode,
  type ViroSpecsManifestPolyline,
  type ViroSpecsManifestV2,
  type ViroSpecsSceneDocument,
  type ViroSpecsScroll,
  type ViroSpecsTextStyle,
  type ViroSpecsVec3,
  type ViroSpecsWireSceneSnapshot,
} from "./manifest";
import {
  composeSpecsTransform,
  eulerDegreesToSpecsQuaternion,
  isSpecsVec3,
  specsPolylineRadiusMeters,
  transformSpecsPoint,
  VIRO_SPECS_IDENTITY_TRANSFORM,
  type ViroSpecsLocalTransform,
  type ViroSpecsTransform,
} from "./transform";
import { validateSpecsManifestV2 } from "./validate";
import { checkSpecsExperience, VIRO_SPECS_TEXT_EM_METERS_PER_POINT } from "./experience";
import {
  specsAngleToMeters,
  VIRO_SPECS_DEFAULT_THEME,
  VIRO_SPECS_SPATIAL_TOKENS,
  type ViroSpecsSpatialTokens,
  type ViroSpecsTheme,
} from "./tokens";

/** Lens package that provides the polyline primitive the manifest names. */
export const VIRO_SPECS_POLYLINE_BACKEND = "VolumetricLine";

/** Default ViroPolyline thickness in meters. */
export const VIRO_SPECS_DEFAULT_POLYLINE_THICKNESS = 0.01;

/**
 * Result of resolving an asset `source` prop: the asset ID, or the issue to
 * report. Each compiler decides what a source value means (a Metro module ID
 * through `sourceResolver`, or a `require()` path from source).
 */
export type ViroSpecsSourceResolution =
  | { readonly id: string }
  | { readonly issue: ViroSpecsIssue };

/** Options for {@linkcode ViroSpecsSceneBuilder}. */
export interface ViroSpecsSceneBuilderOptions {
  /** Written to `generator.name`. */
  readonly generator: string;
  /** Entry file, written to the manifest `source`. */
  readonly source?: string;
  readonly lookupAnimation: ViroSpecsAnimationLookup;
  readonly resolveSource: (value: unknown, kind: "image" | "model") => ViroSpecsSourceResolution;
  /**
   * Theme written to the manifest. Defaults to {@linkcode VIRO_SPECS_DEFAULT_THEME}
   * when a premium component compiled; with neither, the manifest has no theme.
   */
  readonly theme?: ViroSpecsTheme;
}

/** What {@linkcode ViroSpecsSceneBuilder} passes to premium component compilation. */
interface PremiumContext {
  readonly props: Readonly<Record<string, unknown>>;
  readonly written: (prop: string) => boolean;
  readonly unresolved: ReadonlySet<string>;
  readonly issues: ViroSpecsIssue[];
  readonly name: string;
  readonly id: string;
  readonly source: string | undefined;
  /** Distance from the wearer used to turn angular tokens into meters. */
  readonly distance: number;
}

/**
 * Distance used to size premium components: the node's distance from the
 * scene origin, clamped into the comfort band. A node at the origin (no
 * position yet) uses `distance.defaultMeters`.
 */
export function specsComfortDistance(
  position: ViroSpecsVec3,
  tokens: ViroSpecsSpatialTokens = VIRO_SPECS_SPATIAL_TOKENS
): number {
  const d = Math.sqrt(position[0] * position[0] + position[1] * position[1] + position[2] * position[2]);
  if (d < 1e-6) return tokens.distance.defaultMeters;
  return Math.min(tokens.distance.maxMeters, Math.max(tokens.distance.minMeters, d));
}

/**
 * Where children of an element attach: the enclosing node, its world
 * transform, and whether a runtime condition hides it (static compiler only).
 */
export interface ViroSpecsScope {
  readonly nodeId?: string;
  readonly transform: ViroSpecsTransform;
  readonly hidden: boolean;
}

/** The scene root. */
export const VIRO_SPECS_ROOT_SCOPE: ViroSpecsScope = {
  transform: VIRO_SPECS_IDENTITY_TRANSFORM,
  hidden: false,
};

/** One Viro element as a compiler sees it, with prop values already known. */
export interface ViroSpecsElementInput {
  /** Component name, for example `ViroText`. */
  readonly name: string;
  /** Prop values. Props the static compiler could not resolve are absent. */
  readonly props: Readonly<Record<string, unknown>>;
  /** Every prop the author wrote, resolved or not. */
  readonly writtenProps: readonly string[];
  /**
   * Written props whose value is not statically known. The caller has
   * already reported them; the builder skips them without a second diagnostic.
   */
  readonly unresolvedProps?: ReadonlySet<string>;
  /** React `key`, when present. */
  readonly key?: string;
  /** True when the element has element children (or non-blank text). */
  readonly hasChildren: boolean;
  /**
   * True for the root of a branch whose condition is only known at runtime.
   * The node is emitted with `visible: false`.
   */
  readonly conditionalRoot?: boolean;
  readonly origin: ViroSpecsElementOrigin;
}

/** Outcome of {@linkcode ViroSpecsSceneBuilder.addElement}. */
export type ViroSpecsElementResult =
  | { readonly kind: "skipped" }
  | {
      readonly kind: "compiled";
      readonly id: string;
      /** Scope for children, or `undefined` when children are not compiled. */
      readonly childScope?: ViroSpecsScope;
    };

/**
 * Scene-level inputs, from `ViroSpecsScene` props. Both compilers pass them
 * to {@linkcode ViroSpecsSceneBuilder.setScene}.
 */
export interface ViroSpecsSceneInput {
  /** Route of the scene. A new route is navigation on the Lens host. */
  readonly route?: string;
  /** Actions the tree's `specsAction` triggers may fire. Copied to the manifest. */
  readonly actions?: readonly ViroSpecsActionDeclaration[];
}

/** Portable polyline the runtime transport presents. */
export interface ViroSpecsScenePolyline {
  readonly id: string;
  readonly points: readonly ViroSpecsVec3[];
  readonly radiusMeters: number;
  readonly materialId?: string;
}

/** Output of {@linkcode ViroSpecsSceneBuilder.finish}. */
export interface ViroSpecsBuiltScene {
  readonly manifest: ViroSpecsManifestV2;
  /** Scene protocol 2 document carrying every manifest field. */
  readonly document: ViroSpecsSceneDocument;
  /** Scene protocol 1 snapshot lowered from the manifest. */
  readonly scene: ViroSpecsWireSceneSnapshot;
  /** Compile and validation findings, located where the compiler could. */
  readonly diagnostics: readonly ViroSpecsDiagnostic[];
  /** `VS1015` findings from lowering; only relevant when the wire is used. */
  readonly loweringDiagnostics: readonly ViroSpecsDiagnostic[];
  readonly polylines: readonly ViroSpecsScenePolyline[];
  readonly plans: readonly ViroSpecsAnimationPlan[];
}

const TEXT_STYLE_KEYS: readonly string[] = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "color",
  "textAlign",
  "textAlignVertical",
];

const FONT_WEIGHTS = ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;
type FontWeight = (typeof FONT_WEIGHTS)[number];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFontWeight(value: unknown): value is FontWeight {
  return typeof value === "string" && (FONT_WEIGHTS as readonly string[]).includes(value);
}

function describe(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "function") return "a function";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Reads ViroText `style` into the manifest text style. Accepts an object or
 * an array of objects (merged in order, falsy entries skipped, as React
 * Native does). Keys and values the manifest cannot carry are reported with
 * `VS3002`, colors that are not hex with `VS3009`; both are left out.
 */
export function readSpecsTextStyle(
  value: unknown,
  label: string
): { readonly style?: ViroSpecsTextStyle; readonly issues: readonly ViroSpecsIssue[] } {
  const issues: ViroSpecsIssue[] = [];
  let merged: Record<string, unknown> | undefined;
  if (isRecord(value)) {
    merged = { ...value };
  } else if (Array.isArray(value)) {
    merged = {};
    for (const entry of value) {
      if (isRecord(entry)) Object.assign(merged, entry);
      else if (entry !== false && entry !== null && entry !== undefined) {
        issues.push({ code: "VS3002", prop: "style", message: label + " style entry " + describe(entry) + " is not an object and was left out." });
      }
    }
  }
  if (merged === undefined) {
    return { issues: [{ code: "VS3002", prop: "style", message: label + " style " + describe(value) + " is not an object and was left out." }] };
  }

  const out: { -readonly [K in keyof ViroSpecsTextStyle]: ViroSpecsTextStyle[K] } = {};
  const leftOut = (key: string, why: string) =>
    issues.push({ code: "VS3002", prop: "style", message: label + " style." + key + " " + why });

  for (const [key, entry] of Object.entries(merged)) {
    if (entry === undefined) continue;
    if (!TEXT_STYLE_KEYS.includes(key)) {
      leftOut(key, "is not carried to Specs.");
      continue;
    }
    switch (key) {
      case "fontFamily":
        if (typeof entry === "string") out.fontFamily = entry;
        else leftOut(key, describe(entry) + " is not a string and was left out.");
        break;
      case "fontSize":
        if (isPositiveNumber(entry)) out.fontSize = entry;
        else leftOut(key, describe(entry) + " is not a positive number and was left out.");
        break;
      case "fontWeight": {
        const weight = typeof entry === "number" ? String(entry) : entry;
        if (isFontWeight(weight)) out.fontWeight = weight;
        else leftOut(key, describe(entry) + " is not carried to Specs.");
        break;
      }
      case "fontStyle":
        if (entry === "normal" || entry === "italic") out.fontStyle = entry;
        else leftOut(key, describe(entry) + " is not carried to Specs.");
        break;
      case "color": {
        const color = normalizeSpecsColor(entry);
        if (color) out.color = color;
        else issues.push({ code: "VS3009", prop: "style", message: label + " style.color " + describe(entry) + " is not hex; it was left out." });
        break;
      }
      case "textAlign":
        if (entry === "left" || entry === "center" || entry === "right") out.textAlign = entry;
        else leftOut(key, describe(entry) + " is not carried to Specs.");
        break;
      case "textAlignVertical":
        if (entry === "top" || entry === "center" || entry === "bottom") out.textAlignVertical = entry;
        else leftOut(key, describe(entry) + " is not carried to Specs.");
        break;
    }
  }
  return Object.keys(out).length ? { style: out, issues } : { issues };
}

/**
 * Builds one manifest v2 from Viro elements. Both compilers walk their tree
 * (React elements or a Babel AST) and call {@linkcode addElement} for each
 * element in document order; every rule about what an element compiles to
 * lives here, so the two compilers cannot drift.
 *
 * @example
 * ```ts
 * const builder = new ViroSpecsSceneBuilder({ generator: "viro-specs-runtime", lookupAnimation, resolveSource });
 * const result = builder.addElement(VIRO_SPECS_ROOT_SCOPE, { name: "ViroNode", props, writtenProps, hasChildren: true, origin });
 * if (result.kind === "compiled" && result.childScope) visitChildren(result.childScope);
 * const built = builder.finish();
 * ```
 */
export class ViroSpecsSceneBuilder {
  private readonly options: ViroSpecsSceneBuilderOptions;
  private readonly ids = new ViroSpecsIdAllocator();
  private readonly nodes: ViroSpecsManifestNode[] = [];
  private readonly polylines: ViroSpecsManifestPolyline[] = [];
  private readonly portablePolylines: ViroSpecsScenePolyline[] = [];
  private readonly lights: ViroSpecsLight[] = [];
  private readonly interactions: ViroSpecsManifestInteraction[] = [];
  private readonly animations: ViroSpecsManifestAnimation[] = [];
  private readonly plans: ViroSpecsAnimationPlan[] = [];
  private readonly diagnostics: ViroSpecsDiagnostic[] = [];
  private readonly locations = new Map<string, ViroSpecsDiagnosticDetails[]>();
  private scene: ViroSpecsSceneInput = {};
  private usesPremium = false;
  /** SpatialScrollView node IDs and viewports, laid out in finish(). */
  private readonly scrollViews = new Map<string, { readonly width: number; readonly height: number }>();

  constructor(options: ViroSpecsSceneBuilderOptions) {
    this.options = options;
  }

  /** Adds a diagnostic found outside element compilation (static analysis). */
  report(diagnostic: ViroSpecsDiagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  /**
   * Sets the scene's `route` and `actions`. The manifest copies them; an
   * empty `actions` list is left out. Validation in {@linkcode finish} checks
   * them and every trigger against them (`VS1016`-`VS1019`).
   */
  setScene(scene: ViroSpecsSceneInput): void {
    this.scene = scene;
  }

  /** True once any element, polyline or light compiled. */
  get hasContent(): boolean {
    return this.nodes.length + this.polylines.length + this.lights.length > 0;
  }

  /** Compiles one element under `scope`. */
  addElement(scope: ViroSpecsScope, input: ViroSpecsElementInput): ViroSpecsElementResult {
    const { name, props, origin } = input;
    const unresolved = input.unresolvedProps ?? new Set<string>();
    const written = (prop: string) => input.writtenProps.includes(prop) && !unresolved.has(prop);
    const issues: ViroSpecsIssue[] = [];

    const classification = classifySpecsComponent(name);
    const tag = typeof props.viroTag === "string" && props.viroTag !== "" ? props.viroTag : undefined;
    if (classification.kind !== "supported") {
      this.diagnostics.push(
        unsupportedComponentDiagnostic(name, {
          ...origin.detailsFor(undefined),
          ...(tag !== undefined ? { nodeId: tag } : {}),
        })
      );
      return { kind: "skipped" };
    }
    const target = classification.target;
    const nodeKind: ViroSpecsManifestNode["kind"] | undefined =
      target.category === "node"
        ? target.kind
        : target.category === "premium"
          ? VIRO_SPECS_COMPONENT_NODE_KIND[target.component]
          : undefined;
    if (target.category === "premium") this.usesPremium = true;
    if (written("viroTag") && tag === undefined) {
      issues.push({ code: "VS1004", prop: "viroTag", message: name + " viroTag " + describe(props.viroTag) + " is not a non-empty string." });
    }

    // Source first: the asset ID is part of a content-hash ID.
    let source: string | undefined;
    let sourceFailed = false;
    if (nodeKind === "image" || nodeKind === "model") {
      if (unresolved.has("source")) {
        sourceFailed = true;
      } else if (props.source === undefined) {
        issues.push({ code: "VS3008", prop: "source", message: name + " has no source." });
        sourceFailed = true;
      } else {
        const resolution = this.options.resolveSource(props.source, nodeKind);
        if ("id" in resolution) source = resolution.id;
        else {
          issues.push(resolution.issue);
          sourceFailed = true;
        }
      }
    }

    const idKind = nodeKind ?? (target.category === "polyline" ? "polyline" : "light");
    const content =
      target.category === "light"
        ? target.type
        : target.category === "polyline"
          ? Array.isArray(props.points) ? JSON.stringify(props.points) : ""
          : nodeKind === "text"
            ? typeof props.text === "string" ? props.text : ""
            : target.category === "premium" && target.component === "panel-button"
              ? typeof props.label === "string" ? props.label : ""
              : target.category === "premium" && target.component === "spatial-panel"
                ? typeof props.title === "string" ? props.title : ""
                : source ?? "";
    let id: string;
    if (tag !== undefined) {
      id = tag;
    } else {
      id = this.ids.allocate({
        kind: idKind,
        parentId: scope.nodeId,
        content,
        ...(input.key !== undefined ? { key: input.key } : {}),
      });
      if (!unresolved.has("viroTag")) {
        issues.push({
          code: "VS3012",
          message: name + " has no viroTag; it was given content-hash ID " + id + ".",
        });
      }
    }
    const recorded = this.locations.get(id) ?? [];
    recorded.push(origin.detailsFor(undefined));
    this.locations.set(id, recorded);

    const flush = () => {
      for (const issue of issues) this.diagnostics.push(locateViroSpecsIssue(issue, origin, id));
      issues.length = 0;
    };

    for (const diagnostic of checkSpecsProps(
      name,
      input.writtenProps,
      (prop) => ({ ...origin.detailsFor(prop), nodeId: id })
    )) {
      this.diagnostics.push(diagnostic);
    }

    const local: { -readonly [K in keyof ViroSpecsLocalTransform]: ViroSpecsLocalTransform[K] } = {};
    for (const transformName of ["position", "rotation", "scale"] as const) {
      if (!written(transformName) || props[transformName] === undefined) continue;
      const value = props[transformName];
      if (isSpecsVec3(value)) local[transformName] = value;
      else {
        issues.push({
          code: "VS1004",
          prop: transformName,
          message: name + " " + id + " " + transformName + " " + describe(value) + " is not three finite numbers.",
        });
      }
    }
    const world = composeSpecsTransform(scope.transform, local);
    const hidden = scope.hidden || input.conditionalRoot === true;

    if (target.category === "polyline" || target.category === "light") {
      if (hidden) {
        issues.push({
          code: "VS2017",
          message: name + " " + id + " is inside JSX whose condition is only known at runtime, and Specs cannot hide a " + (target.category === "light" ? "light" : "polyline") + ".",
        });
      }
      if (input.hasChildren) {
        issues.push({ code: "VS3015", prop: "children", message: name + " " + id + " has children; Specs " + (target.category === "light" ? "lights" : "polylines") + " cannot contain elements, so they were not compiled." });
      }
    }

    if (target.category === "light") {
      const light = this.compileLight(target.type, id, scope, props, written, issues, name);
      flush();
      if (light) this.lights.push(light);
      return { kind: "compiled", id };
    }

    const materialId = this.readMaterial(props, written, issues, name, id);

    if (target.category === "polyline") {
      for (const prop of ["animation", "onHover", "onClick", "onClickState", "onDrag", "visible", "opacity"]) {
        if (written(prop) && props[prop] !== undefined) {
          issues.push({ code: "VS3002", prop, message: "ViroPolyline " + id + " prop `" + prop + "` is not carried to Specs." });
        }
      }
      const points = props.points;
      let ok = true;
      if (unresolved.has("points")) ok = false;
      else if (!Array.isArray(points) || points.length < 2 || !points.every(isSpecsVec3)) {
        issues.push({ code: "VS1004", prop: "points", message: "ViroPolyline " + id + " points " + describe(points) + " is not at least two [x, y, z] points." });
        ok = false;
      }
      let thickness = VIRO_SPECS_DEFAULT_POLYLINE_THICKNESS;
      if (written("thickness") && props.thickness !== undefined) {
        if (isPositiveNumber(props.thickness)) thickness = props.thickness;
        else {
          issues.push({ code: "VS1004", prop: "thickness", message: "ViroPolyline " + id + " thickness " + describe(props.thickness) + " is not a positive number of meters." });
          ok = false;
        }
      }
      flush();
      if (ok && Array.isArray(points) && points.every(isSpecsVec3)) {
        const portable: ViroSpecsScenePolyline = {
          id,
          points: points.map((point) => transformSpecsPoint(world, point)),
          radiusMeters: specsPolylineRadiusMeters(thickness, world),
          ...(materialId !== undefined ? { materialId } : {}),
        };
        this.portablePolylines.push(portable);
        this.polylines.push({ ...portable, primitive: "volumetric-line", backendPackage: VIRO_SPECS_POLYLINE_BACKEND });
      }
      return { kind: "compiled", id };
    }

    // Nodes.
    let visible: boolean | undefined;
    if (written("visible") && props.visible !== undefined) {
      if (typeof props.visible === "boolean") visible = props.visible;
      else issues.push({ code: "VS1004", prop: "visible", message: name + " " + id + " visible " + describe(props.visible) + " is not a boolean." });
    }
    if (input.conditionalRoot === true) visible = false;
    let opacity: number | undefined;
    if (written("opacity") && props.opacity !== undefined) {
      if (typeof props.opacity === "number" && Number.isFinite(props.opacity)) opacity = props.opacity;
      else issues.push({ code: "VS1004", prop: "opacity", message: name + " " + id + " opacity " + describe(props.opacity) + " is not a number." });
    }

    const labelProp = target.category === "premium" ? "label" : "accessibilityLabel";
    let label: string | undefined;
    if (written(labelProp) && props[labelProp] !== undefined) {
      const value = props[labelProp];
      if (typeof value === "string" && value.trim() !== "") label = value;
      else issues.push({ code: "VS1004", prop: labelProp, message: name + " " + id + " " + labelProp + " " + describe(value) + " is not a non-empty string." });
    }

    const base = {
      id,
      ...(label !== undefined ? { label } : {}),
      ...(scope.nodeId !== undefined ? { parentId: scope.nodeId } : {}),
      ...(local.position !== undefined ? { position: local.position } : {}),
      ...(local.rotation !== undefined ? { rotation: eulerDegreesToSpecsQuaternion(local.rotation) } : {}),
      ...(local.scale !== undefined ? { scale: local.scale } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
      ...(materialId !== undefined ? { materialId } : {}),
    };

    let node: ViroSpecsManifestNode | undefined;
    if (target.category === "premium") {
      node = this.compilePremium(target.component, base, {
        props,
        written,
        unresolved,
        issues,
        name,
        id,
        source: sourceFailed ? undefined : source,
        distance: specsComfortDistance(world.position, (this.options.theme ?? VIRO_SPECS_DEFAULT_THEME).tokens),
      });
    } else switch (target.kind) {
      case "group": {
        const scroll = this.readScroll(props, written, issues, id);
        node = { ...base, kind: "group", ...(scroll !== undefined ? { scroll } : {}) };
        break;
      }
      case "text": {
        let text: string | undefined;
        if (unresolved.has("text")) text = undefined;
        else if (props.text === undefined) {
          issues.push({ code: "VS1005", prop: "text", message: "ViroText " + id + " has no text." });
        } else if (typeof props.text !== "string") {
          issues.push({ code: "VS1004", prop: "text", message: "ViroText " + id + " text " + describe(props.text) + " is not a string." });
        } else {
          text = props.text;
        }
        let style: ViroSpecsTextStyle | undefined;
        if (written("style") && props.style !== undefined) {
          const read = readSpecsTextStyle(props.style, "ViroText " + id);
          issues.push(...read.issues);
          style = read.style;
        }
        const extents = this.readExtents(props, written, issues, name, id);
        let maxLines: number | undefined;
        if (written("maxLines") && props.maxLines !== undefined) {
          if (typeof props.maxLines === "number") maxLines = props.maxLines;
          else issues.push({ code: "VS1004", prop: "maxLines", message: "ViroText " + id + " maxLines " + describe(props.maxLines) + " is not a number." });
        }
        if (text !== undefined) {
          node = {
            ...base,
            kind: "text",
            text,
            ...(style ? { style } : {}),
            ...(extents ? { extents } : {}),
            ...(maxLines !== undefined ? { maxLines } : {}),
          };
        }
        break;
      }
      case "image": {
        const extents = this.readExtents(props, written, issues, name, id);
        if (!sourceFailed && source !== undefined) {
          node = { ...base, kind: "image", source, ...(extents ? { extents } : {}) };
        }
        break;
      }
      case "model": {
        let failed = sourceFailed;
        let format: ReturnType<typeof specsModelFormat>;
        if (written("type") && props.type !== undefined) {
          format = specsModelFormat(props.type);
          if (format === "vrx") {
            issues.push({ code: "VS3013", prop: "type", message: "Viro3DObject " + id + " uses VRX." });
            failed = true;
          } else if (format === undefined) {
            issues.push({ code: "VS3002", prop: "type", message: "Viro3DObject " + id + " type " + describe(props.type) + " is not a model format Specs knows; format was left out." });
          }
        }
        if (!failed && source !== undefined) {
          node = { ...base, kind: "model", source, ...(format !== undefined && format !== "vrx" ? { format } : {}) };
        }
        break;
      }
    }

    if (node !== undefined) {
      this.compileInteraction(props, written, unresolved, issues, name, id);
      this.compileAnimation(props, written, unresolved, id, local, opacity, issues, name);
    }
    flush();
    if (node === undefined) return { kind: "skipped" };
    this.nodes.push(node);
    return { kind: "compiled", id, childScope: { nodeId: id, transform: world, hidden } };
  }

  /** Builds the node for a premium component. Returns `undefined` when a required prop failed. */
  private compilePremium(
    component: ViroSpecsComponentType,
    base: ViroSpecsNodeBase,
    context: PremiumContext
  ): ViroSpecsManifestNode | undefined {
    const { props, written, unresolved, issues, name, id, distance } = context;
    const tokens = (this.options.theme ?? VIRO_SPECS_DEFAULT_THEME).tokens;
    const invalid = (prop: string, expected: string) =>
      issues.push({ code: "VS3022", prop, message: name + " " + id + " " + prop + " " + describe(props[prop]) + " is not " + expected + "." });
    const has = (prop: string) => written(prop) && props[prop] !== undefined;
    const readString = (prop: string): string | undefined => {
      if (!has(prop)) return undefined;
      const value = props[prop];
      if (typeof value === "string" && value !== "") return value;
      invalid(prop, "a non-empty string");
      return undefined;
    };
    const readPositive = (prop: string): number | undefined => {
      if (!has(prop)) return undefined;
      if (isPositiveNumber(props[prop])) return props[prop];
      invalid(prop, "a positive number of meters");
      return undefined;
    };
    const readBoolean = (prop: string, fallback: boolean): boolean => {
      if (!has(prop)) return fallback;
      if (typeof props[prop] === "boolean") return props[prop];
      invalid(prop, "a boolean");
      return fallback;
    };
    const readChoice = <T extends string>(prop: string, allowed: readonly T[], fallback: T): T => {
      if (!has(prop)) return fallback;
      const value = props[prop];
      const match = allowed.find((entry) => entry === value);
      if (match !== undefined) return match;
      invalid(prop, "one of " + allowed.join(", "));
      return fallback;
    };
    /** Both sides or neither: one side alone cannot size a text box or image (VS3022). */
    const pairedExtents = (): ViroSpecsExtents | undefined => {
      const width = readPositive("width");
      const height = readPositive("height");
      if (width !== undefined && height !== undefined) return { width, height };
      if ((width === undefined) !== (height === undefined)) {
        const given = width !== undefined ? "width" : "height";
        issues.push({ code: "VS3022", prop: given, message: name + " " + id + " has " + given + " without " + (given === "width" ? "height" : "width") + "; give both in meters or neither. The extents were left out." });
      }
      return undefined;
    };
    const extentsOr = (width: number, height: number): ViroSpecsExtents => ({
      width: readPositive("width") ?? width,
      height: readPositive("height") ?? height,
    });
    const meters = (deg: number) => specsAngleToMeters(deg, distance);

    switch (component) {
      case "spatial-panel": {
        const title = readString("title");
        return {
          ...base,
          kind: "panel",
          extents: extentsOr(meters(20), meters(12)),
          component: { type: "spatial-panel", ...(title !== undefined ? { title } : {}) },
        };
      }
      case "panel-text": {
        if (unresolved.has("text")) return undefined;
        if (typeof props.text !== "string") {
          issues.push({ code: "VS1005", prop: "text", message: "PanelText " + id + " has no text." });
          return undefined;
        }
        const role = readChoice("role", ["title", "body", "label"] as const, "body");
        const tone = readChoice("tone", ["default", "muted"] as const, "default");
        const roleDeg = role === "title" ? tokens.type.titleDeg : role === "body" ? tokens.type.bodyDeg : tokens.type.labelDeg;
        const angle = Math.max(roleDeg, tokens.type.minAngleDeg);
        // Round up to 0.1 pt so the compiled size never falls under the angle.
        const fontSize = Math.ceil((meters(angle) / VIRO_SPECS_TEXT_EM_METERS_PER_POINT) * 10) / 10;
        let maxLines = role === "body" ? 4 : 2;
        if (has("maxLines")) {
          const value = props.maxLines;
          if (typeof value === "number" && Number.isInteger(value) && value >= 1) maxLines = value;
          else invalid("maxLines", "a positive integer");
        }
        const extents = pairedExtents();
        return {
          ...base,
          kind: "text",
          text: props.text,
          style: {
            fontSize,
            fontWeight: role === "title" ? "600" : role === "label" ? "500" : "400",
            color: tone === "muted" ? tokens.color.textMuted : tokens.color.text,
          },
          ...(extents !== undefined ? { extents } : {}),
          maxLines,
          component: { type: "panel-text", role, tone },
        };
      }
      case "panel-button": {
        if (base.label === undefined) {
          if (!unresolved.has("label")) {
            issues.push({ code: "VS3022", prop: "label", message: "PanelButton " + id + " has no label; the label is also the button's visible text." });
          }
          return undefined;
        }
        const state = readChoice("state", ["idle", "selected", "disabled", "loading", "error"] as const, "idle");
        const errorMessage = readString("errorMessage");
        const labelMeters = meters(tokens.type.labelDeg);
        const height = labelMeters * tokens.type.lineHeight + 2 * meters(tokens.space.smDeg);
        // Width estimate: 0.55 em per character plus md padding each side; the host re-measures.
        const width = Math.max(height * 2.5, base.label.length * 0.55 * labelMeters + 2 * meters(tokens.space.mdDeg));
        return {
          ...base,
          kind: "panel",
          extents: extentsOr(width, height),
          component: { type: "panel-button", state, ...(errorMessage !== undefined ? { errorMessage } : {}) },
        };
      }
      case "panel-image": {
        if (context.source === undefined) return undefined;
        const extents = pairedExtents();
        return {
          ...base,
          kind: "image",
          source: context.source,
          ...(extents !== undefined ? { extents } : {}),
          component: { type: "panel-image" },
        };
      }
      case "scroll-view": {
        const width = readPositive("width");
        const height = readPositive("height");
        const itemHeight = readPositive("itemHeight");
        if (width === undefined || height === undefined || itemHeight === undefined) {
          for (const prop of ["width", "height", "itemHeight"]) {
            if (!has(prop) && !unresolved.has(prop)) {
              issues.push({ code: "VS3022", prop, message: "SpatialScrollView " + id + " needs " + prop + " in meters." });
            }
          }
          return undefined;
        }
        let initialIndex = 0;
        if (has("initialIndex")) {
          const value = props.initialIndex;
          if (typeof value === "number" && Number.isInteger(value) && value >= 0) initialIndex = value;
          else invalid("initialIndex", "an integer >= 0");
        }
        // contentHeight is a placeholder until finish() has seen the children.
        this.scrollViews.set(id, { width, height });
        return {
          ...base,
          kind: "group",
          scroll: { width, height, contentHeight: height },
          component: { type: "scroll-view", itemHeightMeters: itemHeight, initialIndex },
        };
      }
      case "model-viewer": {
        if (context.source === undefined) return undefined;
        let format: ReturnType<typeof specsModelFormat>;
        if (has("type")) {
          format = specsModelFormat(props.type);
          if (format === "vrx") {
            issues.push({ code: "VS3013", prop: "type", message: "ModelViewer " + id + " uses VRX." });
            return undefined;
          }
          if (format === undefined) invalid("type", "glb, gltf, obj or fbx");
        }
        return {
          ...base,
          kind: "model",
          source: context.source,
          ...(format !== undefined && format !== "vrx" ? { format } : {}),
          component: {
            type: "model-viewer",
            autoRotate: readBoolean("autoRotate", false),
            resettable: readBoolean("resettable", true),
          },
        };
      }
    }
  }

  private readMaterial(
    props: Readonly<Record<string, unknown>>,
    written: (prop: string) => boolean,
    issues: ViroSpecsIssue[],
    name: string,
    id: string
  ): string | undefined {
    if (!written("materials") || props.materials === undefined) return undefined;
    const value = props.materials;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string")) {
      if (value.length > 1) {
        issues.push({ code: "VS3002", prop: "materials", message: name + " " + id + " materials has " + value.length + " entries; Specs carries only the first, " + JSON.stringify(value[0]) + "." });
      }
      return value[0];
    }
    issues.push({ code: "VS1004", prop: "materials", message: name + " " + id + " materials " + describe(value) + " is not a string or a non-empty string array." });
    return undefined;
  }

  private readScroll(
    props: Readonly<Record<string, unknown>>,
    written: (prop: string) => boolean,
    issues: ViroSpecsIssue[],
    id: string
  ): ViroSpecsScroll | undefined {
    if (!written("specsScroll") || props.specsScroll === undefined) return undefined;
    const value = props.specsScroll;
    if (isRecord(value)) {
      const { width, height, contentHeight } = value;
      if (typeof width === "number" && typeof height === "number" && typeof contentHeight === "number") {
        // Ranges are checked by validation (VS1004 with a fieldPath).
        return { width, height, contentHeight };
      }
    }
    issues.push({
      code: "VS1004",
      prop: "specsScroll",
      message: "ViroNode " + id + " specsScroll " + describe(value) + " needs numeric width, height and contentHeight; it was left out.",
    });
    return undefined;
  }

  private readExtents(
    props: Readonly<Record<string, unknown>>,
    written: (prop: string) => boolean,
    issues: ViroSpecsIssue[],
    name: string,
    id: string
  ): ViroSpecsExtents | undefined {
    const hasWidth = written("width") && props.width !== undefined;
    const hasHeight = written("height") && props.height !== undefined;
    if (!hasWidth && !hasHeight) return undefined;
    if (isPositiveNumber(props.width) && isPositiveNumber(props.height)) {
      return { width: props.width, height: props.height };
    }
    issues.push({
      code: "VS3002",
      prop: hasWidth ? "width" : "height",
      message: name + " " + id + " extents need width and height as positive numbers of meters; got width " + describe(props.width) + ", height " + describe(props.height) + ". They were left out.",
    });
    return undefined;
  }

  private compileLight(
    type: ViroSpecsLight["type"],
    id: string,
    scope: ViroSpecsScope,
    props: Readonly<Record<string, unknown>>,
    written: (prop: string) => boolean,
    issues: ViroSpecsIssue[],
    name: string
  ): ViroSpecsLight | undefined {
    let color: string | undefined;
    if (written("color") && props.color !== undefined) {
      color = normalizeSpecsColor(props.color);
      if (color === undefined) {
        issues.push({ code: "VS3009", prop: "color", message: name + " " + id + " color " + describe(props.color) + " is not hex; it was left out." });
      }
    }
    const number = (prop: string): number | undefined => {
      if (!written(prop) || props[prop] === undefined) return undefined;
      const value = props[prop];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      issues.push({ code: "VS1004", prop, message: name + " " + id + " " + prop + " " + describe(value) + " is not a number." });
      return undefined;
    };
    const vector = (prop: string, fallback: ViroSpecsVec3): ViroSpecsVec3 => {
      if (!written(prop) || props[prop] === undefined) return fallback;
      const value = props[prop];
      if (isSpecsVec3(value)) return value;
      issues.push({ code: "VS1004", prop, message: name + " " + id + " " + prop + " " + describe(value) + " is not three finite numbers." });
      return fallback;
    };
    const intensity = number("intensity");
    const base = {
      id,
      ...(scope.nodeId !== undefined ? { parentId: scope.nodeId } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(intensity !== undefined ? { intensity } : {}),
    };
    switch (type) {
      case "ambient":
        return { ...base, type };
      case "directional":
        return { ...base, type, direction: vector("direction", [0, 0, -1]) };
      case "omni":
        return { ...base, type, position: vector("position", [0, 0, 0]) };
      case "spot": {
        const innerAngle = number("innerAngle");
        const outerAngle = number("outerAngle");
        return {
          ...base,
          type,
          position: vector("position", [0, 0, 0]),
          direction: vector("direction", [0, 0, -1]),
          ...(innerAngle !== undefined ? { innerAngle } : {}),
          ...(outerAngle !== undefined ? { outerAngle } : {}),
        };
      }
    }
  }

  private compileInteraction(
    props: Readonly<Record<string, unknown>>,
    written: (prop: string) => boolean,
    unresolved: ReadonlySet<string>,
    issues: ViroSpecsIssue[],
    name: string,
    id: string
  ): void {
    let triggers: readonly ViroSpecsActionTrigger[] = [];
    // An unresolved specsAction was already reported (VS2014) by the caller.
    if (written("specsAction") && !unresolved.has("specsAction") && props.specsAction !== undefined) {
      const read = readSpecsActionProp(props.specsAction);
      for (const message of read.invalid) {
        issues.push({ code: "VS3023", prop: "specsAction", message: name + " " + id + " " + message });
      }
      triggers = read.triggers;
    }
    const triggerEvents = specsTriggerEvents(triggers);
    const hover = typeof props.onHover === "function" || triggerEvents.includes("hover");
    const select =
      typeof props.onClick === "function" ||
      typeof props.onClickState === "function" ||
      typeof props.onPress === "function" ||
      triggerEvents.includes("select");
    const drag = typeof props.onDrag === "function";
    if (!hover && !select && !drag) return;
    this.interactions.push({
      nodeId: id,
      interactable: true,
      manipulation: drag,
      events: [
        ...(hover ? (["hover"] as const) : []),
        ...(select ? (["select"] as const) : []),
        ...(drag ? (["drag"] as const) : []),
      ],
      ...(triggers.length > 0 ? { triggers } : {}),
    });
  }

  private compileAnimation(
    props: Readonly<Record<string, unknown>>,
    written: (prop: string) => boolean,
    unresolved: ReadonlySet<string>,
    id: string,
    local: ViroSpecsLocalTransform,
    opacity: number | undefined,
    issues: ViroSpecsIssue[],
    name: string
  ): void {
    if (unresolved.has("animation") || !written("animation") || props.animation === undefined) return;
    const animation = props.animation;
    if (!isRecord(animation)) {
      issues.push({ code: "VS1004", prop: "animation", message: name + " " + id + " animation " + describe(animation) + " is not an object." });
      return;
    }
    if (typeof animation.name !== "string") {
      issues.push({ code: "VS1004", prop: "animation", message: name + " " + id + " animation.name " + describe(animation.name) + " is not a string." });
      return;
    }
    const animationName = animation.name;
    if (animation.run === false) {
      this.plans.push({ action: "stop", nodeId: id, name: animationName });
      return;
    }
    if (animation.run !== true) return;

    const resolution = resolveSpecsAnimation(
      {
        nodeId: id,
        name: animationName,
        run: true,
        loop: animation.loop === true,
        delayMs: animation.delay === undefined ? 0 : typeof animation.delay === "number" ? animation.delay : Number.NaN,
        base: {
          ...(local.position !== undefined ? { position: local.position } : {}),
          ...(local.rotation !== undefined ? { rotation: local.rotation } : {}),
          ...(local.scale !== undefined ? { scale: local.scale } : {}),
          ...(opacity !== undefined ? { opacity } : {}),
        },
      },
      this.options.lookupAnimation
    );
    issues.push(...resolution.issues);
    if (resolution.kind !== "play") return;
    this.animations.push(resolution.manifest);
    this.plans.push({
      action: "play",
      nodeId: id,
      name: animationName,
      definition: {
        properties: resolution.properties,
        durationMs: resolution.durationMs,
        delayMs: resolution.delayMs,
        easing: resolution.manifest.plan.easing,
        loop: resolution.manifest.plan.playbackMode === "loop",
        completionEvent: resolution.manifest.plan.completionEvent,
      },
    });
  }

  /**
   * Lays out each SpatialScrollView as a scroll group. Authors place rows
   * around the viewport center at the node origin, which is also how ViroCore
   * shows them. The Lens host puts `y = 0` of a scroll group's content at the
   * window's top edge, so each direct child moves down by half the viewport
   * and shows where it was authored while the list is at its top.
   *
   * `contentHeight` runs from the viewport top to the lowest child's bottom
   * edge (its extents height, or one row for a child without extents), then
   * up to a whole number of rows past the viewport so every scroll step lands
   * on a row.
   */
  private layoutScrollViews(): void {
    for (const [id, viewport] of this.scrollViews) {
      const index = this.nodes.findIndex((node) => node.id === id);
      const view = this.nodes[index];
      if (view === undefined || view.kind !== "group" || view.component?.type !== "scroll-view") continue;
      const row = view.component.itemHeightMeters;
      const half = viewport.height / 2;
      let bottom = half;
      this.nodes.forEach((node, at) => {
        if (node.parentId !== id) return;
        const y = node.position?.[1] ?? 0;
        const height = ("extents" in node && node.extents !== undefined ? node.extents.height : row) * Math.abs(node.scale?.[1] ?? 1);
        bottom = Math.min(bottom, y - height / 2);
        const position = node.position ?? [0, 0, 0];
        this.nodes[at] = { ...node, position: [position[0], roundMeters(y - half), position[2]] };
      });
      const overflow = half - bottom - viewport.height;
      const rows = overflow > 1e-9 ? Math.ceil(overflow / row - 1e-9) : 0;
      this.nodes[index] = { ...view, scroll: { ...viewport, contentHeight: roundMeters(viewport.height + rows * row) } };
    }
  }

  /**
   * Assembles the manifest, validates it, and converts it to a scene protocol 2
   * document and a scene protocol 1 snapshot.
   * Validation findings about an element get that element's location;
   * a duplicate ID points at the second element and names the first.
   */
  finish(): ViroSpecsBuiltScene {
    this.layoutScrollViews();
    const theme = this.options.theme ?? (this.usesPremium ? VIRO_SPECS_DEFAULT_THEME : undefined);
    const manifest: ViroSpecsManifestV2 = {
      $schema: VIRO_SPECS_MANIFEST_SCHEMA_ID,
      version: 2,
      generator: { name: this.options.generator },
      ...(this.options.source !== undefined ? { source: this.options.source } : {}),
      ...(this.scene.route !== undefined ? { route: this.scene.route } : {}),
      ...(this.scene.actions !== undefined && this.scene.actions.length > 0 ? { actions: this.scene.actions } : {}),
      nodes: this.nodes,
      polylines: this.polylines,
      lights: this.lights,
      materials: [],
      interactions: this.interactions,
      animations: this.animations,
      ...(theme !== undefined ? { theme } : {}),
    };
    const diagnostics = [...this.diagnostics];
    const validation = validateSpecsManifestV2(manifest);
    const findings = [
      ...validation.diagnostics,
      ...(validation.ok ? checkSpecsExperience(validation.value) : []),
    ];
    for (const diagnostic of findings) {
      const recorded = diagnostic.nodeId !== undefined ? this.locations.get(diagnostic.nodeId) : undefined;
      if (!recorded || recorded.length === 0) {
        diagnostics.push(diagnostic);
        continue;
      }
      const at = recorded[recorded.length - 1];
      let message = diagnostic.message;
      if (diagnostic.code === "VS1007" && recorded.length > 1) {
        const first = formatViroSpecsLocation(recorded[0]);
        if (first !== undefined) message += " First declared at " + first + ".";
      }
      diagnostics.push(
        createViroSpecsDiagnostic(diagnostic.code, message, {
          ...at,
          nodeId: diagnostic.nodeId,
          ...(diagnostic.fieldPath !== undefined ? { fieldPath: diagnostic.fieldPath } : {}),
          hint: diagnostic.hint,
        })
      );
    }
    const lowered = toSpecsSceneSnapshot(manifest);
    return {
      manifest,
      document: toSpecsSceneDocument(manifest),
      scene: lowered.snapshot,
      diagnostics,
      loweringDiagnostics: lowered.diagnostics,
      polylines: this.portablePolylines,
      plans: this.plans,
    };
  }
}

/** Rounds to a micrometer so layout arithmetic does not leak float noise into manifests. */
function roundMeters(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
