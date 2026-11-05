import { createViroSpecsDiagnostic, type ViroSpecsDiagnostic } from "./diagnostic";
import type { ViroSpecsManifestV2 } from "./manifest";
import { migrateUnknownSpecsManifestV1 } from "./migrate";
import {
  validateSpecsManifestV2,
  type ViroSpecsValidationContext,
  type ViroSpecsValidationResult,
} from "./validate";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a manifest of any supported version from a parsed JSON value. This is
 * the entry point for hand-written manifests and for any plan that reaches a
 * host without passing through a compiler.
 *
 * - Version 2 is validated as is.
 * - Version 1 (a v1 document or a bare scene snapshot) is migrated with
 *   {@linkcode migrateSpecsManifest}, reported with warning `VS1002`, then
 *   validated as version 2.
 * - Anything else fails with `VS1001` or `VS1003`.
 *
 * @example
 * ```ts
 * const result = parseSpecsManifest(json, { file: "scene.json" });
 * if (!result.ok) {
 *   for (const d of result.diagnostics) console.error(formatViroSpecsDiagnostic(d));
 *   return;
 * }
 * applyManifest(result.value);
 * ```
 */
export function parseSpecsManifest(
  input: unknown,
  context: ViroSpecsValidationContext = {}
): ViroSpecsValidationResult<ViroSpecsManifestV2> {
  const located = context.file !== undefined ? { file: context.file } : {};
  if (!isRecord(input)) {
    return {
      ok: false,
      diagnostics: [
        createViroSpecsDiagnostic(
          "VS1001",
          "Expected a manifest object, got " +
            (Array.isArray(input) ? "an array" : input === null ? "null" : typeof input) +
            ".",
          { ...located, fieldPath: "" }
        ),
      ],
    };
  }

  if (input.version === 2) return validateSpecsManifestV2(input, context);

  if (input.version === 1) {
    const deprecation = createViroSpecsDiagnostic(
      "VS1002",
      "Read a version 1 manifest and migrated it to version 2.",
      { ...located, fieldPath: "/version" }
    );
    const result = validateSpecsManifestV2(migrateUnknownSpecsManifestV1(input), context);
    const diagnostics: ViroSpecsDiagnostic[] = [deprecation, ...result.diagnostics];
    return result.ok
      ? { ok: true, value: result.value, diagnostics }
      : { ok: false, diagnostics };
  }

  return {
    ok: false,
    diagnostics: [
      createViroSpecsDiagnostic(
        "VS1003",
        "Manifest version " + JSON.stringify(input.version) + " is not supported. This SDK reads versions 1 and 2.",
        { ...located, fieldPath: "/version" }
      ),
    ],
  };
}

/**
 * Parses manifest JSON text and reads it with {@linkcode parseSpecsManifest}.
 * A JSON syntax error is reported as `VS1000` instead of thrown.
 */
export function parseSpecsManifestJson(
  text: string,
  context: ViroSpecsValidationContext = {}
): ViroSpecsValidationResult<ViroSpecsManifestV2> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        createViroSpecsDiagnostic(
          "VS1000",
          error instanceof Error ? error.message : String(error),
          context.file !== undefined ? { file: context.file } : {}
        ),
      ],
    };
  }
  return parseSpecsManifest(value, context);
}
