import {
  createViroSpecsDiagnostic,
  hasViroSpecsErrors,
  type ViroSpecsDiagnostic,
} from "./core/diagnostic";
import { toSpecsSceneSnapshot } from "./core/lower";
import type { ViroSpecsManifestV2 } from "./core/manifest";
import { parseSpecsManifest } from "./core/parse";
import { validateSpecsSceneSnapshot } from "./core/validate";
import type { ViroSpecsSceneTransport } from "./ViroSpecsScene";

/** Result of {@linkcode applySpecsManifest}. */
export interface ViroSpecsApplyResult {
  /** True when the scene reached the transport. */
  readonly applied: boolean;
  /** The manifest that was applied, after migration. */
  readonly manifest?: ViroSpecsManifestV2;
  readonly diagnostics: readonly ViroSpecsDiagnostic[];
}

/**
 * Applies a manifest that did not come from {@linkcode compileViroSpecsChildren}:
 * hand-written JSON, a file produced by `viro-specs-compile`, or a plan built
 * by app code. The input goes through the same gates as compiled scenes:
 * version check and v1 migration, manifest validation, lowering to scene
 * protocol 1 and the protocol check. Nothing reaches the transport when any
 * gate reports an error.
 *
 * Only the scene snapshot and polylines are sent. Animations and interactions
 * in a hand-written manifest are host-side data; this function does not
 * start them.
 *
 * @example
 * ```ts
 * const result = await applySpecsManifest(transport, JSON.parse(text), { file: "scene.json" });
 * if (!result.applied) result.diagnostics.forEach((d) => console.error(formatViroSpecsDiagnostic(d)));
 * ```
 */
export async function applySpecsManifest(
  transport: ViroSpecsSceneTransport,
  input: unknown,
  context: { readonly file?: string } = {}
): Promise<ViroSpecsApplyResult> {
  const parsed = parseSpecsManifest(input, context);
  if (!parsed.ok) return { applied: false, diagnostics: parsed.diagnostics };

  const lowered = toSpecsSceneSnapshot(parsed.value);
  const gate = validateSpecsSceneSnapshot(lowered.snapshot, context);
  const diagnostics = [...parsed.diagnostics, ...lowered.diagnostics, ...gate.diagnostics];
  if (!gate.ok || hasViroSpecsErrors(diagnostics)) {
    return { applied: false, manifest: parsed.value, diagnostics };
  }

  try {
    await transport.applyScene(gate.value);
    await transport.clearPolylines?.();
    for (const polyline of parsed.value.polylines) {
      await transport.presentPolyline?.(polyline);
    }
  } catch (error) {
    diagnostics.push(
      createViroSpecsDiagnostic(
        "VS3011",
        "Transport failed: " + (error instanceof Error ? error.message : String(error)),
        context.file !== undefined ? { file: context.file } : {}
      )
    );
    return { applied: false, manifest: parsed.value, diagnostics };
  }
  return { applied: true, manifest: parsed.value, diagnostics };
}
