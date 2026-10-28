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
import { toSpecsSceneSnapshot } from "./lower";
import {
  VIRO_SPECS_MANIFEST_SCHEMA_ID,
  type ViroSpecsExtents,
  type ViroSpecsLight,
  type ViroSpecsManifestAnimation,
  type ViroSpecsManifestInteraction,
  type ViroSpecsManifestNode,
  type ViroSpecsManifestPolyline,
  type ViroSpecsManifestV2,
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

  constructor(options: ViroSpecsSceneBuilderOptions) {
    this.options = options;
  }

  /** Adds a diagnostic found outside element compilation (static analysis). */
  report(diagnostic: ViroSpecsDiagnostic): void {
    this.diagnostics.push(diagnostic);
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
    if (written("viroTag") && tag === undefined) {
      issues.push({ code: "VS1004", prop: "viroTag", message: name + " viroTag " + describe(props.viroTag) + " is not a non-empty string." });
    }

    // Source first: the asset ID is part of a content-hash ID.
    let source: string | undefined;
    let sourceFailed = false;
    if (target.category === "node" && (target.kind === "image" || target.kind === "model")) {
      if (unresolved.has("source")) {
        sourceFailed = true;
      } else if (props.source === undefined) {
        issues.push({ code: "VS3008", prop: "source", message: name + " has no source." });
        sourceFailed = true;
      } else {
        const resolution = this.options.resolveSource(props.source, target.kind);
        if ("id" in resolution) source = resolution.id;
        else {
          issues.push(resolution.issue);
          sourceFailed = true;
        }
      }
    }

    const idKind =
      target.category === "node" ? target.kind : target.category === "polyline" ? "polyline" : "light";
    const content =
      target.category === "light"
        ? target.type
        : target.category === "polyline"
          ? Array.isArray(props.points) ? JSON.stringify(props.points) : ""
          : target.kind === "text"
            ? typeof props.text === "string" ? props.text : ""
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

    if (target.category !== "node") {
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

    const base = {
      id,
      ...(scope.nodeId !== undefined ? { parentId: scope.nodeId } : {}),
      ...(local.position !== undefined ? { position: local.position } : {}),
      ...(local.rotation !== undefined ? { rotation: eulerDegreesToSpecsQuaternion(local.rotation) } : {}),
      ...(local.scale !== undefined ? { scale: local.scale } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
      ...(materialId !== undefined ? { materialId } : {}),
    };

    let node: ViroSpecsManifestNode | undefined;
    switch (target.kind) {
      case "group":
        node = { ...base, kind: "group" };
        break;
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

    this.compileInteraction(props, id);
    if (node !== undefined) this.compileAnimation(props, written, unresolved, id, local, opacity, issues, name);
    flush();
    if (node === undefined) return { kind: "skipped" };
    this.nodes.push(node);
    return { kind: "compiled", id, childScope: { nodeId: id, transform: world, hidden } };
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

  private compileInteraction(props: Readonly<Record<string, unknown>>, id: string): void {
    const hover = typeof props.onHover === "function";
    const select = typeof props.onClick === "function" || typeof props.onClickState === "function";
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
   * Assembles the manifest, validates it, and lowers it to scene protocol 1.
   * Validation findings about an element get that element's location;
   * a duplicate ID points at the second element and names the first.
   */
  finish(): ViroSpecsBuiltScene {
    const manifest: ViroSpecsManifestV2 = {
      $schema: VIRO_SPECS_MANIFEST_SCHEMA_ID,
      version: 2,
      generator: { name: this.options.generator },
      ...(this.options.source !== undefined ? { source: this.options.source } : {}),
      nodes: this.nodes,
      polylines: this.polylines,
      lights: this.lights,
      materials: [],
      interactions: this.interactions,
      animations: this.animations,
    };
    const diagnostics = [...this.diagnostics];
    for (const diagnostic of validateSpecsManifestV2(manifest).diagnostics) {
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
      scene: lowered.snapshot,
      diagnostics,
      loweringDiagnostics: lowered.diagnostics,
      polylines: this.portablePolylines,
      plans: this.plans,
    };
  }
}
