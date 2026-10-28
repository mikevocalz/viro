import { parseSpecsManifest } from "../../../components/Specs/core/parse";
import { toSpecsSceneDocument } from "../../../components/Specs/core/lower";
import type { ViroSpecsDiagnostic } from "../../../components/Specs/core/diagnostic";

/** What the preview hands the controller, plus what viro's validator said about it. */
export interface PreviewInput {
  /** Passed to `ViroSpecsSceneController.present`. */
  readonly scene: unknown;
  /** Manifest diagnostics from `parseSpecsManifest` (VS1xxx-VS4xxx). */
  readonly manifestDiagnostics: readonly ViroSpecsDiagnostic[];
  /** How the input was read. */
  readonly route: "manifest" | "scene-document";
}

/**
 * Reads any JSON the Specs pipeline produces: a manifest v2, a manifest v1
 * (migrated, VS1002), or a scene protocol 1/2 document from
 * `viro-specs-compile --format scene-json`.
 *
 * A valid manifest is lowered with `toSpecsSceneDocument`, the call the
 * compiler makes for `scene-json`. Input that is not a valid manifest goes
 * to the controller unchanged, so the controller's own validation (VS5xxx)
 * decides, exactly as it would in the Lens: scene documents carry fields
 * such as `scroll` that the manifest does not.
 */
export function readPreviewInput(json: unknown, file?: string): PreviewInput {
  const parsed = parseSpecsManifest(json, file !== undefined ? { file } : {});
  if (parsed.ok) {
    return { scene: toSpecsSceneDocument(parsed.value), manifestDiagnostics: parsed.diagnostics, route: "manifest" };
  }
  return { scene: json, manifestDiagnostics: parsed.diagnostics, route: "scene-document" };
}
