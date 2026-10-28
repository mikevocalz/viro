import { canonicalSpecsSceneDocument } from "../../components/Specs/core/serialize";
import type { ViroSpecsManifestV2 } from "../../components/Specs/core/manifest";

/** What {@linkcode renderSpecsLensHost} needs: the manifest to present. */
export interface SpecsLensHostInput {
  readonly manifest: ViroSpecsManifestV2;
}

/**
 * Generated Lens Studio host: a thin orchestrator over
 * ViroSpecsSceneControllerHost from @viro-external/specs. The scene constant
 * is a scene protocol 2 document ({@linkcode canonicalSpecsSceneDocument}),
 * so text style, extents, maxLines, opacity, materials and lights reach the
 * Lens. Validation, staging, asset placeholders, interaction binding,
 * animation start and teardown are the controller's job; this file only
 * presents the document and forwards what the controller reports.
 *
 * The host calls only `present` and `clear`, which ViroSpecsSceneControllerHost
 * exposes. Lens Studio rejects calls to methods a host does not declare
 * (TS2339), which is how `interaction.remove()` and `animation.stop()` broke
 * the protocol 1 host.
 */
export function renderSpecsLensHost(result: SpecsLensHostInput): string {
  const scene = JSON.stringify(canonicalSpecsSceneDocument(result.manifest), null, 2);

  return `import { ViroSpecsSceneControllerHost } from "../lens/ViroSpecsSceneControllerHost";
import type { ViroSpecsSceneDocumentV2 } from "../lens/ViroSpecsProtocol";

const GENERATED_SCENE: ViroSpecsSceneDocumentV2 = ${scene};

@component
export class ViroGeneratedSceneHost extends BaseScriptComponent {
  @input
  @hint("SceneObject hosting ViroSpecsSceneControllerHost")
  sceneHostObject: SceneObject;

  private host: ViroSpecsSceneControllerHost | null = null;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.restartGeneratedScene());
    this.createEvent("OnDestroyEvent").bind(() => this.stopGeneratedScene());
  }

  /** Presents the generated scene. Problems go to the Lens log as VS5xxx diagnostics; nothing throws. */
  restartGeneratedScene(): void {
    const host = this.sceneHostObject
      ? (this.sceneHostObject.getComponent(ViroSpecsSceneControllerHost.getTypeName()) as ViroSpecsSceneControllerHost | null)
      : null;
    if (!host) {
      print("[viro-specs-host] error: ViroGeneratedSceneHost needs ViroSpecsSceneControllerHost on sceneHostObject.");
      return;
    }
    this.host = host;
    host.present(GENERATED_SCENE);
  }

  stopGeneratedScene(): void {
    if (this.host && !isNull(this.host)) this.host.clear();
    this.host = null;
  }
}
`;
}
