import type {
  ViroSpecsManifestV1,
  ViroSpecsManifestV2,
  ViroSpecsWireSceneSnapshot,
} from "./manifest";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Restructures a v1 document into the v2 layout without judging its values.
 * Field-level checks are left to v2 validation, so a bad v1 value surfaces as
 * a v2 diagnostic with a v2 field path.
 */
export function migrateUnknownSpecsManifestV1(input: JsonRecord): JsonRecord {
  // A bare scene snapshot `{ version: 1, nodes }` has no `scene` wrapper.
  const scene = isRecord(input.scene) ? input.scene : input;
  const migrated: JsonRecord = {
    version: 2,
    generator: { name: "migrateSpecsManifest", version: "1" },
  };
  if (typeof input.source === "string") migrated.source = input.source;
  migrated.nodes = arrayOrEmpty(scene.nodes);
  migrated.polylines = arrayOrEmpty(input.polylines);
  migrated.lights = [];
  migrated.materials = [];
  migrated.interactions = arrayOrEmpty(input.interactions);
  migrated.animations = arrayOrEmpty(input.animations);
  return migrated;
}

/**
 * Converts a manifest v1 document, or a bare scene protocol 1 snapshot, to
 * manifest v2.
 *
 * The mapping is lossless: v1 node, polyline, interaction and animation
 * objects already have their v2 shape, `scene.nodes` moves to `nodes`, and
 * `lights` and `materials` start empty. The v1 `diagnostics` array is dropped
 * because diagnostics are no longer part of the manifest.
 *
 * The result is not validated. A v1 image or model without `source` produces
 * a v2 manifest that fails validation with `VS1005`. Use
 * {@linkcode parseSpecsManifest} to migrate and validate in one step.
 *
 * @example
 * ```ts
 * const v2 = migrateSpecsManifest(JSON.parse(fs.readFileSync("scene.v1.json", "utf8")));
 * fs.writeFileSync("scene.json", JSON.stringify(v2, null, 2));
 * ```
 */
export function migrateSpecsManifest(
  manifest: ViroSpecsManifestV1 | ViroSpecsWireSceneSnapshot
): ViroSpecsManifestV2 {
  // The input type guarantees the v1 field shapes, which are the v2 shapes.
  return migrateUnknownSpecsManifestV1({ ...manifest }) as unknown as ViroSpecsManifestV2;
}
