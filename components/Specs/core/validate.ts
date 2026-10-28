import {
  createViroSpecsDiagnostic,
  hasViroSpecsErrors,
  type ViroSpecsDiagnostic,
} from "./diagnostic";
import type { ViroSpecsDiagnosticCode } from "./diagnosticCodes";
import {
  checkSpecsActionDeclaration,
  checkSpecsActionPayload,
  isSpecsActionPayload,
  type ViroSpecsActionDeclaration,
} from "./actions";
import {
  VIRO_SPECS_COMPONENT_NODE_KIND,
  type ViroSpecsComponentType,
  type ViroSpecsManifestV2,
  type ViroSpecsWireSceneSnapshot,
} from "./manifest";
import { VIRO_SPECS_HIGH_CONTRAST_TOKENS, VIRO_SPECS_SPATIAL_TOKENS } from "./tokens";

/** Result of validating one manifest or snapshot. */
export type ViroSpecsValidationResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly ViroSpecsDiagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly ViroSpecsDiagnostic[] };

/** Where the validated document came from, copied onto every diagnostic. */
export interface ViroSpecsValidationContext {
  readonly file?: string;
}

type JsonRecord = Record<string, unknown>;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FONT_WEIGHTS = [
  "normal",
  "bold",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
];
const ANIMATION_TARGETS = [
  "transform.position.x",
  "transform.position.y",
  "transform.position.z",
  "transform.scale.x",
  "transform.scale.y",
  "transform.scale.z",
  "transform.rotation.x",
  "transform.rotation.y",
  "transform.rotation.z",
  "material.opacity",
];

const V2_NODE_COMMON = [
  "id",
  "kind",
  "parentId",
  "position",
  "rotation",
  "scale",
  "visible",
  "opacity",
  "materialId",
  "label",
  "component",
];

const V2_NODE_FIELDS: Readonly<
  Record<string, { readonly required: readonly string[]; readonly optional: readonly string[] }>
> = {
  group: { required: [], optional: ["scroll"] },
  text: { required: ["text"], optional: ["style", "extents", "maxLines"] },
  image: { required: ["source"], optional: ["extents"] },
  model: { required: ["source"], optional: ["format"] },
  panel: { required: ["extents"], optional: [] },
  video: { required: ["source"], optional: ["extents", "loop", "muted"] },
  sound: { required: ["source"], optional: ["loop", "volume"] },
};

const WIRE_NODE_FIELDS = [
  "id",
  "kind",
  "parentId",
  "position",
  "rotation",
  "scale",
  "source",
  "text",
  "visible",
];
const WIRE_KINDS = ["group", "text", "image", "model", "panel"];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pointer(base: string, key: string | number): string {
  return base + "/" + String(key).replace(/~/g, "~0").replace(/\//g, "~1");
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  const json = JSON.stringify(value);
  return json.length > 60 ? json.slice(0, 57) + "..." : json;
}

/** Collects diagnostics for one document. */
class Checker {
  readonly diagnostics: ViroSpecsDiagnostic[] = [];

  constructor(private readonly context: ViroSpecsValidationContext) {}

  report(
    code: ViroSpecsDiagnosticCode,
    message: string,
    fieldPath: string,
    nodeId?: string
  ): void {
    this.diagnostics.push(
      createViroSpecsDiagnostic(code, message, {
        fieldPath,
        ...(nodeId !== undefined ? { nodeId } : {}),
        ...(this.context.file !== undefined ? { file: this.context.file } : {}),
      })
    );
  }

  /** Reports missing required and unknown fields. Returns false when a required field is missing. */
  fields(
    record: JsonRecord,
    path: string,
    required: readonly string[],
    optional: readonly string[],
    nodeId?: string
  ): boolean {
    let complete = true;
    for (const key of required) {
      if (!(key in record)) {
        this.report("VS1005", "Missing required field `" + key + "`.", pointer(path, key), nodeId);
        complete = false;
      }
    }
    for (const key of Object.keys(record)) {
      if (!required.includes(key) && !optional.includes(key)) {
        this.report("VS1006", "Unknown field `" + key + "`.", pointer(path, key), nodeId);
      }
    }
    return complete;
  }

  invalid(path: string, expected: string, value: unknown, nodeId?: string): void {
    this.report("VS1004", "Expected " + expected + ", got " + describe(value) + ".", path, nodeId);
  }

  string(record: JsonRecord, key: string, path: string, nodeId?: string): void {
    if (!(key in record)) return;
    const value = record[key];
    if (typeof value !== "string" || value.length === 0) {
      this.invalid(pointer(path, key), "a non-empty string", value, nodeId);
    }
  }

  boolean(record: JsonRecord, key: string, path: string, nodeId?: string): void {
    if (key in record && typeof record[key] !== "boolean") {
      this.invalid(pointer(path, key), "a boolean", record[key], nodeId);
    }
  }

  number(
    record: JsonRecord,
    key: string,
    path: string,
    range: { readonly min?: number; readonly max?: number; readonly exclusiveMin?: number; readonly integer?: boolean },
    nodeId?: string
  ): void {
    if (!(key in record)) return;
    const value = record[key];
    const ok =
      isFiniteNumber(value) &&
      (range.min === undefined || value >= range.min) &&
      (range.max === undefined || value <= range.max) &&
      (range.exclusiveMin === undefined || value > range.exclusiveMin) &&
      (!range.integer || Number.isInteger(value));
    if (!ok) {
      const parts: string[] = [range.integer ? "an integer" : "a finite number"];
      if (range.min !== undefined) parts.push(">= " + range.min);
      if (range.exclusiveMin !== undefined) parts.push("> " + range.exclusiveMin);
      if (range.max !== undefined) parts.push("<= " + range.max);
      this.invalid(pointer(path, key), parts.join(" "), value, nodeId);
    }
  }

  oneOf(record: JsonRecord, key: string, path: string, allowed: readonly string[], nodeId?: string): void {
    if (!(key in record)) return;
    const value = record[key];
    if (typeof value !== "string" || !allowed.includes(value)) {
      this.invalid(pointer(path, key), "one of " + allowed.join(", "), value, nodeId);
    }
  }

  color(record: JsonRecord, key: string, path: string, nodeId?: string): void {
    if (!(key in record)) return;
    const value = record[key];
    if (typeof value !== "string" || !HEX_COLOR.test(value)) {
      this.invalid(pointer(path, key), "a #RRGGBB or #RRGGBBAA color", value, nodeId);
    }
  }

  tuple(record: JsonRecord, key: string, path: string, length: 3 | 4, nodeId?: string): void {
    if (!(key in record)) return;
    const value = record[key];
    if (!Array.isArray(value) || value.length !== length || !value.every(isFiniteNumber)) {
      this.invalid(pointer(path, key), "an array of " + length + " finite numbers", value, nodeId);
    }
  }

  extents(record: JsonRecord, key: string, path: string, nodeId?: string): void {
    if (!(key in record)) return;
    const value = record[key];
    const at = pointer(path, key);
    if (!isRecord(value)) {
      this.invalid(at, "an object with width and height", value, nodeId);
      return;
    }
    this.fields(value, at, ["width", "height"], [], nodeId);
    this.number(value, "width", at, { exclusiveMin: 0 }, nodeId);
    this.number(value, "height", at, { exclusiveMin: 0 }, nodeId);
  }

  array(record: JsonRecord, key: string, path: string): readonly unknown[] {
    if (!(key in record)) return [];
    const value = record[key];
    if (!Array.isArray(value)) {
      this.invalid(pointer(path, key), "an array", value);
      return [];
    }
    return value;
  }
}

function idOf(record: JsonRecord): string | undefined {
  return typeof record.id === "string" ? record.id : undefined;
}

function checkTextStyle(checker: Checker, node: JsonRecord, path: string, nodeId?: string): void {
  if (!("style" in node)) return;
  const style = node.style;
  const at = pointer(path, "style");
  if (!isRecord(style)) {
    checker.invalid(at, "an object", style, nodeId);
    return;
  }
  checker.fields(
    style,
    at,
    [],
    ["fontFamily", "fontSize", "fontWeight", "fontStyle", "color", "textAlign", "textAlignVertical"],
    nodeId
  );
  checker.string(style, "fontFamily", at, nodeId);
  checker.number(style, "fontSize", at, { exclusiveMin: 0 }, nodeId);
  checker.oneOf(style, "fontWeight", at, FONT_WEIGHTS, nodeId);
  checker.oneOf(style, "fontStyle", at, ["normal", "italic"], nodeId);
  checker.color(style, "color", at, nodeId);
  checker.oneOf(style, "textAlign", at, ["left", "center", "right"], nodeId);
  checker.oneOf(style, "textAlignVertical", at, ["top", "center", "bottom"], nodeId);
}

const COMPONENT_FIELDS: Readonly<
  Record<ViroSpecsComponentType, { readonly required: readonly string[]; readonly optional: readonly string[] }>
> = {
  "spatial-panel": { required: [], optional: ["title"] },
  "panel-text": { required: ["role", "tone"], optional: [] },
  "panel-button": { required: ["state"], optional: ["errorMessage"] },
  "panel-image": { required: [], optional: [] },
  "scroll-view": { required: ["itemHeightMeters", "initialIndex"], optional: [] },
  "model-viewer": { required: ["autoRotate", "resettable"], optional: [] },
};

function isComponentType(value: unknown): value is ViroSpecsComponentType {
  return typeof value === "string" && value in COMPONENT_FIELDS;
}

/** Checks `node.component` and that it sits on the node kind it needs. */
function checkComponent(checker: Checker, node: JsonRecord, kind: string, path: string, nodeId?: string): void {
  if (!("component" in node)) return;
  const component = node.component;
  const at = pointer(path, "component");
  if (!isRecord(component)) {
    checker.invalid(at, "a component object", component, nodeId);
    return;
  }
  const type = component.type;
  if (!isComponentType(type)) {
    checker.invalid(pointer(at, "type"), "one of " + Object.keys(COMPONENT_FIELDS).join(", "), type, nodeId);
    return;
  }
  const spec = COMPONENT_FIELDS[type];
  checker.fields(component, at, ["type", ...spec.required], spec.optional, nodeId);
  const expectedKind = VIRO_SPECS_COMPONENT_NODE_KIND[type];
  if (kind !== expectedKind) {
    checker.invalid(pointer(at, "type"), "a component for node kind " + kind + " (" + type + " needs " + expectedKind + ")", type, nodeId);
  }
  checker.string(component, "title", at, nodeId);
  checker.oneOf(component, "role", at, ["title", "body", "label"], nodeId);
  checker.oneOf(component, "tone", at, ["default", "muted"], nodeId);
  checker.oneOf(component, "state", at, ["idle", "selected", "disabled", "loading", "error"], nodeId);
  checker.string(component, "errorMessage", at, nodeId);
  checker.number(component, "itemHeightMeters", at, { exclusiveMin: 0 }, nodeId);
  checker.number(component, "initialIndex", at, { min: 0, integer: true }, nodeId);
  checker.boolean(component, "autoRotate", at, nodeId);
  checker.boolean(component, "resettable", at, nodeId);
}

/**
 * Checks a token group against the default tokens: the same keys, numbers
 * where the default is a number, hex colors where it is a string.
 */
function checkTokenGroup(checker: Checker, value: unknown, reference: Readonly<Record<string, unknown>>, at: string): void {
  if (!isRecord(value)) {
    checker.invalid(at, "an object", value);
    return;
  }
  const keys = Object.keys(reference);
  checker.fields(value, at, keys, []);
  for (const key of keys) {
    const expected = reference[key];
    if (typeof expected === "number") checker.number(value, key, at, { min: 0 });
    else if (typeof expected === "string") checker.color(value, key, at);
    else if (isRecord(expected)) {
      if (key in value) checkTokenGroup(checker, value[key], expected, pointer(at, key));
    }
  }
}

/** Checks the manifest `theme` block against the token contract in `tokens.ts`. */
function checkTheme(checker: Checker, theme: unknown): void {
  const at = "/theme";
  if (!isRecord(theme)) {
    checker.invalid(at, "a theme object", theme);
    return;
  }
  checker.fields(theme, at, ["version", "tokens", "highContrast", "preferences"], []);
  if ("version" in theme && theme.version !== 1) {
    checker.invalid(pointer(at, "version"), "1", theme.version);
  }
  if ("tokens" in theme) checkTokenGroup(checker, theme.tokens, VIRO_SPECS_SPATIAL_TOKENS, pointer(at, "tokens"));
  if ("highContrast" in theme) {
    checkTokenGroup(checker, theme.highContrast, VIRO_SPECS_HIGH_CONTRAST_TOKENS, pointer(at, "highContrast"));
  }
  if ("preferences" in theme) {
    const preferences = theme.preferences;
    const prefAt = pointer(at, "preferences");
    if (!isRecord(preferences)) {
      checker.invalid(prefAt, "an object", preferences);
    } else {
      checker.fields(preferences, prefAt, ["highContrast", "reducedMotion"], []);
      checker.boolean(preferences, "highContrast", prefAt);
      checker.boolean(preferences, "reducedMotion", prefAt);
    }
  }
}

function checkV2Node(checker: Checker, node: unknown, path: string): void {
  if (!isRecord(node)) {
    checker.invalid(path, "a node object", node);
    return;
  }
  const nodeId = idOf(node);
  const kind = node.kind;
  if (typeof kind !== "string" || !(kind in V2_NODE_FIELDS)) {
    if (!("kind" in node)) {
      checker.report("VS1005", "Missing required field `kind`.", pointer(path, "kind"), nodeId);
    } else {
      checker.report("VS1012", "Unknown node kind " + describe(kind) + ".", pointer(path, "kind"), nodeId);
    }
    return;
  }
  const spec = V2_NODE_FIELDS[kind];
  checker.fields(node, path, ["id", "kind", ...spec.required], [...V2_NODE_COMMON, ...spec.optional], nodeId);
  checker.string(node, "id", path, nodeId);
  checker.string(node, "parentId", path, nodeId);
  checker.tuple(node, "position", path, 3, nodeId);
  checker.tuple(node, "rotation", path, 4, nodeId);
  checker.tuple(node, "scale", path, 3, nodeId);
  checker.boolean(node, "visible", path, nodeId);
  checker.number(node, "opacity", path, { min: 0, max: 1 }, nodeId);
  checker.string(node, "materialId", path, nodeId);
  checker.string(node, "label", path, nodeId);
  checkComponent(checker, node, kind, path, nodeId);

  if ("text" in node && typeof node.text !== "string") {
    checker.invalid(pointer(path, "text"), "a string", node.text, nodeId);
  }
  checker.string(node, "source", path, nodeId);
  checkTextStyle(checker, node, path, nodeId);
  checker.extents(node, "extents", path, nodeId);
  if ("scroll" in node) {
    const scroll = node.scroll;
    const at = pointer(path, "scroll");
    if (!isRecord(scroll)) {
      checker.invalid(at, "an object with width, height and contentHeight", scroll, nodeId);
    } else {
      checker.fields(scroll, at, ["width", "height", "contentHeight"], [], nodeId);
      checker.number(scroll, "width", at, { exclusiveMin: 0, max: 10 }, nodeId);
      checker.number(scroll, "height", at, { exclusiveMin: 0, max: 10 }, nodeId);
      checker.number(scroll, "contentHeight", at, { min: 0 }, nodeId);
    }
  }
  checker.number(node, "maxLines", path, { min: 1, integer: true }, nodeId);
  checker.oneOf(node, "format", path, ["glb", "gltf", "obj", "fbx"], nodeId);
  checker.boolean(node, "loop", path, nodeId);
  checker.boolean(node, "muted", path, nodeId);
  checker.number(node, "volume", path, { min: 0, max: 1 }, nodeId);

  if (kind === "video") {
    checker.report(
      "VS4004",
      "Node " + describe(nodeId) + " is a video node. No Specs host plays video.",
      pointer(path, "kind"),
      nodeId
    );
  }
  if (kind === "sound") {
    checker.report(
      "VS4005",
      "Node " + describe(nodeId) + " is a sound node. No Specs host plays audio.",
      pointer(path, "kind"),
      nodeId
    );
  }
}

function checkPolyline(checker: Checker, polyline: unknown, path: string): void {
  if (!isRecord(polyline)) {
    checker.invalid(path, "a polyline object", polyline);
    return;
  }
  const nodeId = idOf(polyline);
  checker.fields(
    polyline,
    path,
    ["id", "points", "radiusMeters"],
    ["materialId", "primitive", "backendPackage"],
    nodeId
  );
  checker.string(polyline, "id", path, nodeId);
  checker.number(polyline, "radiusMeters", path, { exclusiveMin: 0 }, nodeId);
  checker.string(polyline, "materialId", path, nodeId);
  checker.oneOf(polyline, "primitive", path, ["volumetric-line"], nodeId);
  checker.string(polyline, "backendPackage", path, nodeId);
  if ("points" in polyline) {
    const points = polyline.points;
    const valid =
      Array.isArray(points) &&
      points.length >= 2 &&
      points.every(
        (point: unknown) => Array.isArray(point) && point.length === 3 && point.every(isFiniteNumber)
      );
    if (!valid) {
      checker.invalid(pointer(path, "points"), "at least two [x, y, z] arrays of finite numbers", points, nodeId);
    }
  }
}

function checkLight(checker: Checker, light: unknown, path: string): void {
  if (!isRecord(light)) {
    checker.invalid(path, "a light object", light);
    return;
  }
  const nodeId = idOf(light);
  const common = ["id", "type", "parentId", "color", "intensity"];
  const byType: Readonly<Record<string, { readonly required: readonly string[]; readonly optional: readonly string[] }>> = {
    ambient: { required: [], optional: [] },
    directional: { required: ["direction"], optional: [] },
    omni: { required: ["position"], optional: [] },
    spot: { required: ["position", "direction"], optional: ["innerAngle", "outerAngle"] },
  };
  const type = light.type;
  if (typeof type !== "string" || !(type in byType)) {
    checker.invalid(pointer(path, "type"), "one of ambient, directional, omni, spot", type, nodeId);
    return;
  }
  const spec = byType[type];
  checker.fields(light, path, ["id", "type", ...spec.required], [...common, ...spec.optional], nodeId);
  checker.string(light, "id", path, nodeId);
  checker.string(light, "parentId", path, nodeId);
  checker.color(light, "color", path, nodeId);
  checker.number(light, "intensity", path, { min: 0 }, nodeId);
  checker.tuple(light, "direction", path, 3, nodeId);
  checker.tuple(light, "position", path, 3, nodeId);
  checker.number(light, "innerAngle", path, { min: 0, max: 180 }, nodeId);
  checker.number(light, "outerAngle", path, { min: 0, max: 180 }, nodeId);
}

function checkMaterial(checker: Checker, material: unknown, path: string): void {
  if (!isRecord(material)) {
    checker.invalid(path, "a material object", material);
    return;
  }
  checker.fields(material, path, ["id"], ["id", "color", "opacity", "texture", "lightingModel"]);
  checker.string(material, "id", path);
  checker.color(material, "color", path);
  checker.number(material, "opacity", path, { min: 0, max: 1 });
  checker.string(material, "texture", path);
  checker.oneOf(material, "lightingModel", path, ["constant", "lambert", "blinn", "phong", "pbr"]);
}

function checkInteraction(checker: Checker, interaction: unknown, path: string): void {
  if (!isRecord(interaction)) {
    checker.invalid(path, "an interaction object", interaction);
    return;
  }
  const nodeId = typeof interaction.nodeId === "string" ? interaction.nodeId : undefined;
  checker.fields(interaction, path, ["nodeId", "interactable", "manipulation", "events"], ["triggers"], nodeId);
  checker.string(interaction, "nodeId", path, nodeId);
  if ("interactable" in interaction && interaction.interactable !== true) {
    checker.invalid(pointer(path, "interactable"), "true", interaction.interactable, nodeId);
  }
  checker.boolean(interaction, "manipulation", path, nodeId);
  if ("events" in interaction) {
    const events = interaction.events;
    const allowed = ["hover", "select", "drag"];
    const valid =
      Array.isArray(events) &&
      events.length > 0 &&
      events.every((event: unknown) => typeof event === "string" && allowed.includes(event)) &&
      new Set(events).size === events.length;
    if (!valid) {
      checker.invalid(pointer(path, "events"), "a non-empty array of unique hover, select, drag", events, nodeId);
    }
  }
  if (!("triggers" in interaction)) return;
  const triggers = interaction.triggers;
  const at = pointer(path, "triggers");
  if (!Array.isArray(triggers) || triggers.length === 0) {
    checker.invalid(at, "a non-empty array of triggers", triggers, nodeId);
    return;
  }
  triggers.forEach((trigger: unknown, index: number) => {
    const triggerAt = pointer(at, index);
    if (!isRecord(trigger)) {
      checker.invalid(triggerAt, "a trigger object", trigger, nodeId);
      return;
    }
    checker.fields(trigger, triggerAt, ["on", "actionId"], ["payload"], nodeId);
    checker.oneOf(trigger, "on", triggerAt, ["select", "hover-enter", "hover-exit"], nodeId);
    checker.string(trigger, "actionId", triggerAt, nodeId);
    if ("payload" in trigger && !isSpecsActionPayload(trigger.payload)) {
      checker.invalid(pointer(triggerAt, "payload"), "a flat object of strings, finite numbers and booleans", trigger.payload, nodeId);
    }
  });
}

function checkActions(checker: Checker, actions: readonly unknown[]): Map<string, ViroSpecsActionDeclaration> {
  const declared = new Map<string, ViroSpecsActionDeclaration>();
  const firstAt = new Map<string, string>();
  actions.forEach((action, index) => {
    const at = pointer("/actions", index);
    const problems = checkSpecsActionDeclaration(action);
    for (const problem of problems) checker.report("VS1004", problem.message, at + problem.path);
    if (problems.length > 0 || !isRecord(action) || typeof action.id !== "string") return;
    const first = firstAt.get(action.id);
    if (first !== undefined) {
      checker.report("VS1016", "Action " + describe(action.id) + " is already declared at " + first + ".", pointer(at, "id"));
      return;
    }
    firstAt.set(action.id, pointer(at, "id"));
    // Shape checked above.
    declared.set(action.id, action as unknown as ViroSpecsActionDeclaration);
  });
  return declared;
}

const TRIGGER_NEEDS: Readonly<Record<string, string>> = { select: "select", "hover-enter": "hover", "hover-exit": "hover" };

function checkTriggerReferences(
  checker: Checker,
  interactions: readonly unknown[],
  declared: ReadonlyMap<string, ViroSpecsActionDeclaration>
): void {
  interactions.forEach((interaction, index) => {
    if (!isRecord(interaction) || !Array.isArray(interaction.triggers)) return;
    const nodeId = typeof interaction.nodeId === "string" ? interaction.nodeId : undefined;
    const events = Array.isArray(interaction.events) ? interaction.events : [];
    interaction.triggers.forEach((trigger: unknown, t: number) => {
      if (!isRecord(trigger)) return;
      const at = pointer(pointer(pointer("/interactions", index), "triggers"), t);
      const needs = typeof trigger.on === "string" ? TRIGGER_NEEDS[trigger.on] : undefined;
      if (needs !== undefined && !events.includes(needs)) {
        checker.report("VS1019", "Trigger on " + String(trigger.on) + " needs " + describe(needs) + " in events.", pointer(at, "on"), nodeId);
      }
      if (typeof trigger.actionId !== "string") return;
      const declaration = declared.get(trigger.actionId);
      if (!declaration) {
        checker.report("VS1017", "Trigger fires undeclared action " + describe(trigger.actionId) + ".", pointer(at, "actionId"), nodeId);
        return;
      }
      if (!isSpecsActionPayload(trigger.payload ?? {})) return;
      for (const problem of checkSpecsActionPayload(declaration, trigger.payload)) {
        checker.report("VS1018", trigger.actionId + ": " + problem.message, pointer(at, "payload") + problem.path, nodeId);
      }
    });
  });
}

function checkAnimation(checker: Checker, animation: unknown, path: string): void {
  if (!isRecord(animation)) {
    checker.invalid(path, "an animation object", animation);
    return;
  }
  const nodeId = typeof animation.nodeId === "string" ? animation.nodeId : undefined;
  checker.fields(animation, path, ["nodeId", "name", "plan"], [], nodeId);
  checker.string(animation, "nodeId", path, nodeId);
  checker.string(animation, "name", path, nodeId);
  if (!("plan" in animation)) return;
  const plan = animation.plan;
  const at = pointer(path, "plan");
  if (!isRecord(plan)) {
    checker.invalid(at, "an animation plan object", plan, nodeId);
    return;
  }
  checker.fields(
    plan,
    at,
    ["engine", "durationSeconds", "delaySeconds", "easing", "playbackMode", "completionEvent", "tracks"],
    ["backendPackage"],
    nodeId
  );
  checker.oneOf(plan, "engine", at, ["AnimationPlayer"], nodeId);
  checker.string(plan, "backendPackage", at, nodeId);
  checker.number(plan, "durationSeconds", at, { min: 0 }, nodeId);
  checker.number(plan, "delaySeconds", at, { min: 0 }, nodeId);
  checker.oneOf(plan, "easing", at, ["linear", "ease-in", "ease-out", "ease-in-out"], nodeId);
  checker.oneOf(plan, "playbackMode", at, ["single", "loop"], nodeId);
  checker.string(plan, "completionEvent", at, nodeId);
  if (!("tracks" in plan)) return;
  const tracks = plan.tracks;
  const tracksAt = pointer(at, "tracks");
  if (!Array.isArray(tracks) || tracks.length === 0) {
    checker.invalid(tracksAt, "a non-empty array of tracks", tracks, nodeId);
    return;
  }
  tracks.forEach((track: unknown, index: number) => {
    const trackAt = pointer(tracksAt, index);
    if (!isRecord(track)) {
      checker.invalid(trackAt, "a track object", track, nodeId);
      return;
    }
    checker.fields(track, trackAt, ["target", "from", "to"], [], nodeId);
    checker.oneOf(track, "target", trackAt, ANIMATION_TARGETS, nodeId);
    checker.oneOf(track, "from", trackAt, ["current"], nodeId);
    checker.number(track, "to", trackAt, {}, nodeId);
  });
}

interface IdEntry {
  readonly id: string;
  readonly path: string;
}

function collectIds(items: readonly unknown[], path: string): IdEntry[] {
  const entries: IdEntry[] = [];
  items.forEach((item, index) => {
    if (isRecord(item) && typeof item.id === "string") {
      entries.push({ id: item.id, path: pointer(pointer(path, index), "id") });
    }
  });
  return entries;
}

function checkDuplicates(
  checker: Checker,
  entries: readonly IdEntry[],
  code: "VS1007" | "VS1013"
): void {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const first = seen.get(entry.id);
    if (first !== undefined) {
      checker.report(code, "ID " + describe(entry.id) + " is already used at " + first + ".", entry.path, entry.id);
    } else {
      seen.set(entry.id, entry.path);
    }
  }
}

function checkHierarchy(checker: Checker, nodes: readonly unknown[], lights: readonly unknown[]): void {
  const parentOf = new Map<string, string>();
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (isRecord(node) && typeof node.id === "string") nodeIds.add(node.id);
  }

  const checkParent = (items: readonly unknown[], collection: string): void => {
    items.forEach((item, index) => {
      if (!isRecord(item) || typeof item.parentId !== "string") return;
      const id = idOf(item);
      if (!nodeIds.has(item.parentId)) {
        checker.report(
          "VS1008",
          "parentId " + describe(item.parentId) + " does not match any node.",
          pointer(pointer("/" + collection, index), "parentId"),
          id
        );
      } else if (collection === "nodes" && id !== undefined) {
        parentOf.set(id, item.parentId);
      }
    });
  };
  checkParent(nodes, "nodes");
  checkParent(lights, "lights");

  const reported = new Set<string>();
  nodes.forEach((node, index) => {
    if (!isRecord(node)) return;
    const start = idOf(node);
    if (start === undefined || reported.has(start)) return;
    const chain: string[] = [start];
    let cursor = parentOf.get(start);
    while (cursor !== undefined) {
      if (cursor === start) {
        chain.forEach((id) => reported.add(id));
        checker.report(
          "VS1009",
          "Parent chain " + [...chain, start].join(" -> ") + " is a cycle.",
          pointer(pointer("/nodes", index), "parentId"),
          start
        );
        return;
      }
      if (chain.includes(cursor)) return;
      chain.push(cursor);
      cursor = parentOf.get(cursor);
    }
  });
}

function checkReferences(
  checker: Checker,
  nodes: readonly unknown[],
  polylines: readonly unknown[],
  materials: readonly unknown[],
  interactions: readonly unknown[],
  animations: readonly unknown[]
): void {
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (isRecord(node) && typeof node.id === "string") nodeIds.add(node.id);
  }
  const targets = (items: readonly unknown[], collection: string): void => {
    items.forEach((item, index) => {
      if (isRecord(item) && typeof item.nodeId === "string" && !nodeIds.has(item.nodeId)) {
        checker.report(
          "VS1010",
          collection.slice(0, -1) + " targets unknown node " + describe(item.nodeId) + ".",
          pointer(pointer("/" + collection, index), "nodeId"),
          item.nodeId
        );
      }
    });
  };
  targets(interactions, "interactions");
  targets(animations, "animations");

  const materialIds = new Set<string>();
  for (const material of materials) {
    if (isRecord(material) && typeof material.id === "string") materialIds.add(material.id);
  }
  const materialRefs = (items: readonly unknown[], collection: string): void => {
    items.forEach((item, index) => {
      if (isRecord(item) && typeof item.materialId === "string" && !materialIds.has(item.materialId)) {
        checker.report(
          "VS1011",
          "Material " + describe(item.materialId) + " is not in `materials`; the Lens material registry must provide it.",
          pointer(pointer("/" + collection, index), "materialId"),
          idOf(item)
        );
      }
    });
  };
  materialRefs(nodes, "nodes");
  materialRefs(polylines, "polylines");
}

/**
 * Validates a manifest v2 document: structure (the same rules as
 * `schemas/viro-specs-manifest.v2.json`) plus the semantic rules a JSON Schema
 * cannot express: unique IDs, resolvable parents and targets, no parent cycles
 * and capability errors for video and sound nodes.
 *
 * Missing optional arrays are filled with `[]` in the returned manifest.
 * Use {@linkcode parseSpecsManifest} for input whose version is not known.
 */
export function validateSpecsManifestV2(
  input: unknown,
  context: ViroSpecsValidationContext = {}
): ViroSpecsValidationResult<ViroSpecsManifestV2> {
  const checker = new Checker(context);
  if (!isRecord(input)) {
    checker.report("VS1001", "Expected a manifest object, got " + describe(input) + ".", "");
    return { ok: false, diagnostics: checker.diagnostics };
  }
  checker.fields(
    input,
    "",
    ["version", "nodes"],
    ["$schema", "generator", "source", "route", "actions", "polylines", "lights", "materials", "interactions", "animations", "theme"]
  );
  if (input.version !== 2) {
    checker.report("VS1003", "validateSpecsManifestV2 reads version 2, got " + describe(input.version) + ".", "/version");
    return { ok: false, diagnostics: checker.diagnostics };
  }
  checker.string(input, "$schema", "");
  checker.string(input, "source", "");
  checker.string(input, "route", "");
  if ("generator" in input) {
    const generator = input.generator;
    if (!isRecord(generator)) {
      checker.invalid("/generator", "an object", generator);
    } else {
      checker.fields(generator, "/generator", ["name"], ["version"]);
      checker.string(generator, "name", "/generator");
      checker.string(generator, "version", "/generator");
    }
  }

  if ("theme" in input) checkTheme(checker, input.theme);

  const nodes = checker.array(input, "nodes", "");
  const polylines = checker.array(input, "polylines", "");
  const lights = checker.array(input, "lights", "");
  const materials = checker.array(input, "materials", "");
  const interactions = checker.array(input, "interactions", "");
  const animations = checker.array(input, "animations", "");
  const actions = checker.array(input, "actions", "");

  nodes.forEach((node, index) => checkV2Node(checker, node, pointer("/nodes", index)));
  polylines.forEach((polyline, index) => checkPolyline(checker, polyline, pointer("/polylines", index)));
  lights.forEach((light, index) => checkLight(checker, light, pointer("/lights", index)));
  materials.forEach((material, index) => checkMaterial(checker, material, pointer("/materials", index)));
  interactions.forEach((interaction, index) =>
    checkInteraction(checker, interaction, pointer("/interactions", index))
  );
  animations.forEach((animation, index) => checkAnimation(checker, animation, pointer("/animations", index)));

  checkDuplicates(
    checker,
    [...collectIds(nodes, "/nodes"), ...collectIds(polylines, "/polylines"), ...collectIds(lights, "/lights")],
    "VS1007"
  );
  checkDuplicates(checker, collectIds(materials, "/materials"), "VS1013");
  checkHierarchy(checker, nodes, lights);
  checkReferences(checker, nodes, polylines, materials, interactions, animations);
  checkTriggerReferences(checker, interactions, checkActions(checker, actions));

  if (hasViroSpecsErrors(checker.diagnostics)) {
    return { ok: false, diagnostics: checker.diagnostics };
  }
  // Every field was checked above; the structure now matches the type.
  const manifest = {
    ...input,
    nodes,
    polylines,
    lights,
    materials,
    interactions,
    animations,
  } as unknown as ViroSpecsManifestV2;
  return { ok: true, value: manifest, diagnostics: checker.diagnostics };
}

/**
 * Validates a scene protocol 1 snapshot, the payload the Lens runtime's
 * `applySceneSnapshot` reads. Rejects other protocol versions (`VS1014`),
 * node kinds the protocol does not carry (`VS1012`), unknown fields, bad
 * values, duplicate IDs and unresolved parents.
 */
export function validateSpecsSceneSnapshot(
  input: unknown,
  context: ViroSpecsValidationContext = {}
): ViroSpecsValidationResult<ViroSpecsWireSceneSnapshot> {
  const checker = new Checker(context);
  if (!isRecord(input)) {
    checker.report("VS1001", "Expected a scene snapshot object, got " + describe(input) + ".", "");
    return { ok: false, diagnostics: checker.diagnostics };
  }
  checker.fields(input, "", ["version", "nodes"], []);
  if (input.version !== 1) {
    checker.report(
      "VS1014",
      "Scene snapshots use protocol version 1, got " + describe(input.version) + ".",
      "/version"
    );
    return { ok: false, diagnostics: checker.diagnostics };
  }
  const nodes = checker.array(input, "nodes", "");
  nodes.forEach((node, index) => {
    const path = pointer("/nodes", index);
    if (!isRecord(node)) {
      checker.invalid(path, "a node object", node);
      return;
    }
    const nodeId = idOf(node);
    checker.fields(node, path, ["id", "kind"], WIRE_NODE_FIELDS, nodeId);
    if ("kind" in node && (typeof node.kind !== "string" || !WIRE_KINDS.includes(node.kind))) {
      checker.report(
        "VS1012",
        "Scene protocol 1 does not carry node kind " + describe(node.kind) + ".",
        pointer(path, "kind"),
        nodeId
      );
    }
    checker.string(node, "id", path, nodeId);
    checker.string(node, "parentId", path, nodeId);
    checker.tuple(node, "position", path, 3, nodeId);
    checker.tuple(node, "rotation", path, 4, nodeId);
    checker.tuple(node, "scale", path, 3, nodeId);
    checker.string(node, "source", path, nodeId);
    if ("text" in node && typeof node.text !== "string") {
      checker.invalid(pointer(path, "text"), "a string", node.text, nodeId);
    }
    checker.boolean(node, "visible", path, nodeId);
  });
  checkDuplicates(checker, collectIds(nodes, "/nodes"), "VS1007");
  checkHierarchy(checker, nodes, []);

  if (hasViroSpecsErrors(checker.diagnostics)) {
    return { ok: false, diagnostics: checker.diagnostics };
  }
  // Every field was checked above; the structure now matches the type.
  const snapshot = { version: 1, nodes } as unknown as ViroSpecsWireSceneSnapshot;
  return { ok: true, value: snapshot, diagnostics: checker.diagnostics };
}
