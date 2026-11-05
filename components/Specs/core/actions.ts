/**
 * Typed semantic actions: declarations, triggers and payload checks.
 *
 * A trigger on a node fires a declared action with a fixed, JSON-only
 * payload. Nothing here holds a function, so a manifest with triggers is the
 * same document on the phone, in the Lens and in a file. The Lens-side copy
 * of these rules is `lens/ViroSpecsActionContract.ts` in
 * `@viro-external/specs`.
 */

/** Value type of one payload field. `integer` is a whole `number`. */
export type ViroSpecsActionFieldType = "string" | "number" | "integer" | "boolean";

/** One field of a payload declaration. `enum` is valid on `string` fields only. */
export interface ViroSpecsActionField {
  readonly type: ViroSpecsActionFieldType;
  /** Allowed values of a `string` field. */
  readonly enum?: readonly string[];
  /** When true the field may be absent. Default false. */
  readonly optional?: boolean;
}

/**
 * Declares one action: a stable ID matching
 * {@linkcode VIRO_SPECS_ACTION_ID_PATTERN} and the type of its payload.
 *
 * @see {@linkcode defineSpecsActions}
 */
export interface ViroSpecsActionDeclaration {
  readonly id: string;
  /** Field name to type. Absent means an empty payload. */
  readonly payload?: Readonly<Record<string, ViroSpecsActionField>>;
}

/** Lowercase dot-separated segments: `exhibit.open`, `settings.set-units`. */
export const VIRO_SPECS_ACTION_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;

/** A payload value. */
export type ViroSpecsActionValue = string | number | boolean;

/** A payload: flat and JSON-safe. */
export type ViroSpecsActionPayload = Readonly<Record<string, ViroSpecsActionValue>>;

/** Interaction moment that fires a trigger. `select` is a completed pinch or click. */
export type ViroSpecsActionTriggerEvent = "select" | "hover-enter" | "hover-exit";

/**
 * Fires a declared action when its node sees `on`. In JSX it is the
 * `specsAction` prop; in a manifest it sits in the node's interaction entry.
 *
 * @see {@linkcode specsTrigger}
 */
export interface ViroSpecsActionTrigger {
  readonly on: ViroSpecsActionTriggerEvent;
  readonly actionId: string;
  /** Checked against the declaration. Absent means `{}`. */
  readonly payload?: ViroSpecsActionPayload;
}

/** One problem in a payload or declaration. `path` is a JSON Pointer relative to the checked value. */
export interface ViroSpecsActionProblem {
  readonly path: string;
  readonly message: string;
}

const FIELD_TYPES: readonly string[] = ["string", "number", "integer", "boolean"];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pointer(key: string): string {
  return "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Problems with a declaration's shape. Empty when valid. */
export function checkSpecsActionDeclaration(value: unknown): ViroSpecsActionProblem[] {
  if (!isRecord(value)) return [{ path: "", message: "Expected an action declaration object." }];
  const problems: ViroSpecsActionProblem[] = [];
  for (const key of Object.keys(value)) {
    if (key !== "id" && key !== "payload") problems.push({ path: pointer(key), message: "Unknown field `" + key + "`." });
  }
  if (typeof value.id !== "string" || !VIRO_SPECS_ACTION_ID_PATTERN.test(value.id)) {
    problems.push({ path: "/id", message: "Expected an action ID such as exhibit.open (lowercase segments separated by dots)." });
  }
  if (value.payload === undefined) return problems;
  if (!isRecord(value.payload)) {
    problems.push({ path: "/payload", message: "Expected an object of field declarations." });
    return problems;
  }
  for (const [name, field] of Object.entries(value.payload)) {
    const at = "/payload" + pointer(name);
    if (!isRecord(field)) {
      problems.push({ path: at, message: "Expected a field declaration object." });
      continue;
    }
    for (const key of Object.keys(field)) {
      if (key !== "type" && key !== "enum" && key !== "optional") {
        problems.push({ path: at + pointer(key), message: "Unknown field `" + key + "`." });
      }
    }
    if (typeof field.type !== "string" || !FIELD_TYPES.includes(field.type)) {
      problems.push({ path: at + "/type", message: "Expected one of: " + FIELD_TYPES.join(", ") + "." });
    }
    if (field.optional !== undefined && typeof field.optional !== "boolean") {
      problems.push({ path: at + "/optional", message: "Expected a boolean." });
    }
    if (field.enum !== undefined) {
      const values = field.enum;
      if (field.type !== "string") {
        problems.push({ path: at + "/enum", message: "enum is only valid on string fields." });
      } else if (
        !Array.isArray(values) ||
        values.length === 0 ||
        !values.every((v: unknown) => typeof v === "string") ||
        new Set(values).size !== values.length
      ) {
        problems.push({ path: at + "/enum", message: "Expected a non-empty array of unique strings." });
      }
    }
  }
  return problems;
}

/**
 * Problems with `payload` against a valid `declaration`: missing required
 * fields, unknown fields, wrong types, non-integers for `integer`, values
 * outside `enum`. Empty when the payload matches.
 */
export function checkSpecsActionPayload(
  declaration: ViroSpecsActionDeclaration,
  payload: unknown
): ViroSpecsActionProblem[] {
  const value = payload === undefined ? {} : payload;
  if (!isRecord(value)) return [{ path: "", message: "Expected a payload object." }];
  const fields = declaration.payload ?? {};
  const problems: ViroSpecsActionProblem[] = [];
  for (const key of Object.keys(value)) {
    if (!(key in fields)) {
      problems.push({ path: pointer(key), message: "Field `" + key + "` is not declared by " + declaration.id + "." });
    }
  }
  for (const [name, field] of Object.entries(fields)) {
    const at = pointer(name);
    const entry = value[name];
    if (entry === undefined) {
      if (field.optional !== true) problems.push({ path: at, message: "Missing required field `" + name + "`." });
      continue;
    }
    switch (field.type) {
      case "string":
        if (typeof entry !== "string") problems.push({ path: at, message: "Expected a string." });
        else if (field.enum !== undefined && !field.enum.includes(entry)) {
          problems.push({ path: at, message: "Expected one of: " + field.enum.join(", ") + "." });
        }
        break;
      case "boolean":
        if (typeof entry !== "boolean") problems.push({ path: at, message: "Expected a boolean." });
        break;
      case "number":
      case "integer":
        if (typeof entry !== "number" || !Number.isFinite(entry)) problems.push({ path: at, message: "Expected a finite number." });
        else if (field.type === "integer" && !Number.isInteger(entry)) problems.push({ path: at, message: "Expected a whole number." });
        break;
    }
  }
  return problems;
}

/**
 * Whether `value` can cross a transport as a payload: a plain object of
 * strings, finite numbers and booleans. Functions (React closures),
 * `undefined`, nested objects and class instances are not.
 */
export function isSpecsActionPayload(value: unknown): value is ViroSpecsActionPayload {
  if (!isRecord(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value).every(
    (v) => typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))
  );
}

// ---------------------------------------------------------------------------
// Typed declarations

/** Field declarations of one action, as written in {@linkcode defineSpecsActions}. */
export type ViroSpecsActionFields = Readonly<Record<string, ViroSpecsActionField>>;

/** Map from action ID to its payload fields. */
export type ViroSpecsActionSpec = Readonly<Record<string, { readonly payload?: ViroSpecsActionFields }>>;

type FieldValue<F> = F extends { readonly type: "string"; readonly enum: readonly (infer E)[] }
  ? E
  : F extends { readonly type: "string" }
    ? string
    : F extends { readonly type: "boolean" }
      ? boolean
      : number;

type RequiredKeys<P> = { [K in keyof P]: P[K] extends { readonly optional: true } ? never : K }[keyof P];
type OptionalKeys<P> = { [K in keyof P]: P[K] extends { readonly optional: true } ? K : never }[keyof P];

/** TypeScript payload type of a field map. */
export type ViroSpecsPayloadOf<P> = { readonly [K in RequiredKeys<P>]: FieldValue<P[K]> } & {
  readonly [K in OptionalKeys<P>]?: FieldValue<P[K]>;
};

/** Payload type per action ID of a spec. */
export type ViroSpecsActionPayloads<T extends ViroSpecsActionSpec> = {
  readonly [K in keyof T & string]: T[K] extends { readonly payload: infer P } ? ViroSpecsPayloadOf<P> : Readonly<Record<string, never>>;
};

/**
 * Typed set of declarations returned by {@linkcode defineSpecsActions}.
 * `declarations` is the plain list for `ViroSpecsScene`'s `actions` prop and
 * the manifest; `T` carries the payload types for handlers and triggers.
 */
export interface ViroSpecsActionSet<T extends ViroSpecsActionSpec> {
  readonly declarations: readonly ViroSpecsActionDeclaration[];
  /** Phantom field for type inference only; always undefined at runtime. */
  readonly spec?: T;
}

/**
 * Declares actions once, typed. Write the spec with `as const` so enums
 * become literal unions.
 *
 * @example
 * export const LAB_ACTIONS = defineSpecsActions({
 *   "exhibit.open": { payload: { exhibitId: { type: "string" } } },
 *   "settings.set-units": { payload: { units: { type: "string", enum: ["metric", "imperial"] } } },
 *   "nav.back": {},
 * } as const);
 */
export function defineSpecsActions<const T extends ViroSpecsActionSpec>(spec: T): ViroSpecsActionSet<T> {
  const declarations = Object.entries(spec).map(([id, entry]): ViroSpecsActionDeclaration =>
    entry.payload !== undefined ? { id, payload: entry.payload } : { id }
  );
  return { declarations };
}

/**
 * Builds a `specsAction` trigger whose payload is type-checked against the
 * action set.
 *
 * @example
 * <ViroText viroTag={"card-" + id} specsAction={specsTrigger(LAB_ACTIONS, "exhibit.open", { exhibitId: id })} />
 */
export function specsTrigger<T extends ViroSpecsActionSpec, K extends keyof T & string>(
  _actions: ViroSpecsActionSet<T>,
  actionId: K,
  payload: ViroSpecsActionPayloads<T>[K],
  on: ViroSpecsActionTriggerEvent = "select"
): ViroSpecsActionTrigger {
  const values = payload as Readonly<Record<string, ViroSpecsActionValue>>;
  return Object.keys(values).length > 0 ? { on, actionId, payload: values } : { on, actionId };
}

// ---------------------------------------------------------------------------
// Compiler support

/** Result of {@linkcode readSpecsActionProp}. */
export interface ViroSpecsActionPropRead {
  /** Triggers that are valid JSON, with `on` defaulted to `select`. */
  readonly triggers: readonly ViroSpecsActionTrigger[];
  /** One message per entry that is not a JSON trigger (`VS3023`). */
  readonly invalid: readonly string[];
}

const TRIGGER_EVENTS: readonly string[] = ["select", "hover-enter", "hover-exit"];

/**
 * Reads a `specsAction` prop value: one trigger or an array of them. Both
 * compilers use it, so they accept and reject the same values.
 */
export function readSpecsActionProp(value: unknown): ViroSpecsActionPropRead {
  const entries = Array.isArray(value) ? value : [value];
  const triggers: ViroSpecsActionTrigger[] = [];
  const invalid: string[] = [];
  entries.forEach((entry: unknown, index: number) => {
    const label = Array.isArray(value) ? "specsAction[" + index + "]" : "specsAction";
    if (!isRecord(entry)) {
      invalid.push(label + " is " + (typeof entry === "function" ? "a function" : "not an object") + ".");
      return;
    }
    const extra = Object.keys(entry).filter((key) => key !== "actionId" && key !== "on" && key !== "payload");
    if (extra.length > 0) {
      invalid.push(label + " has unknown field " + extra.map((k) => "`" + k + "`").join(", ") + ".");
      return;
    }
    if (typeof entry.actionId !== "string" || entry.actionId.length === 0) {
      invalid.push(label + ".actionId is not a string.");
      return;
    }
    const on = entry.on === undefined ? "select" : entry.on;
    if (typeof on !== "string" || !TRIGGER_EVENTS.includes(on)) {
      invalid.push(label + ".on must be select, hover-enter or hover-exit.");
      return;
    }
    if (entry.payload !== undefined && !isSpecsActionPayload(entry.payload)) {
      invalid.push(label + ".payload must be a flat object of strings, finite numbers and booleans; functions and nested objects cannot reach the Lens.");
      return;
    }
    const payload = entry.payload as ViroSpecsActionPayload | undefined;
    triggers.push({
      on: on as ViroSpecsActionTriggerEvent,
      actionId: entry.actionId,
      ...(payload !== undefined && Object.keys(payload).length > 0 ? { payload: { ...payload } } : {}),
    });
  });
  return { triggers, invalid };
}

/** Interaction events a set of triggers needs, in manifest order. */
export function specsTriggerEvents(triggers: readonly ViroSpecsActionTrigger[]): ("hover" | "select")[] {
  const events: ("hover" | "select")[] = [];
  if (triggers.some((t) => t.on !== "select")) events.push("hover");
  if (triggers.some((t) => t.on === "select")) events.push("select");
  return events;
}
