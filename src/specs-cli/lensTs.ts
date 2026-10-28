import { canonicalizeSpecsManifest } from "../../components/Specs/core/serialize";
import type { ViroSpecsManifestV2, ViroSpecsWireSceneSnapshot } from "../../components/Specs/core/manifest";

/** What {@linkcode renderSpecsLensHost} needs: a manifest and its lowered wire snapshot. */
export interface SpecsLensHostInput {
  readonly manifest: ViroSpecsManifestV2;
  readonly scene: ViroSpecsWireSceneSnapshot;
}

/**
 * Generated Lens Studio host. The scene constant is the scene protocol 1
 * snapshot lowered from the manifest; polylines, interactions and animations
 * keep the wire shapes the Lens runtime reads today (protocol 1). WS3 moves
 * this host onto ViroSpecsSceneController; until then the output must stay
 * byte-compatible with the host the Lens lane builds against.
 */
export function renderSpecsLensHost(result: SpecsLensHostInput): string {
  const manifest = canonicalizeSpecsManifest(result.manifest);
  const scene = JSON.stringify(result.scene, null, 2);
  const polylines = JSON.stringify(manifest.polylines, null, 2);
  const interactions = JSON.stringify(manifest.interactions, null, 2);
  const animations = JSON.stringify(manifest.animations, null, 2);

  return `import { ViroSpecsAnimationHost } from "../lens/ViroSpecsAnimationHost";
import { ViroSpecsInteractionHost } from "../lens/ViroSpecsInteractionHost";
import { ViroSpecsNavigationHost } from "../lens/ViroSpecsNavigationHost";
import { ViroSpecsRuntimeHost } from "../lens/ViroSpecsRuntimeHost";

const GENERATED_SCENE: any = ${scene};
const GENERATED_POLYLINES: any[] = ${polylines};
const GENERATED_INTERACTIONS: any[] = ${interactions};
const GENERATED_ANIMATIONS: any[] = ${animations};

@component
export class ViroGeneratedSceneHost extends BaseScriptComponent {
  @input runtimeHostObject: SceneObject;
  @input interactionHostObject: SceneObject;
  @input animationHostObject: SceneObject;
  @input navigationHostObject: SceneObject;

  private teardown: (() => void) | null = null;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.restartGeneratedScene());
    this.createEvent("OnDestroyEvent").bind(() => this.stopGeneratedScene());
  }

  stopGeneratedScene(): void {
    this.teardown?.();
    this.teardown = null;
  }

  restartGeneratedScene(): void {
    this.stopGeneratedScene();
    const runtime = this.runtimeHostObject.getComponent(
      ViroSpecsRuntimeHost.getTypeName()
    ) as ViroSpecsRuntimeHost | null;
    const interaction = this.interactionHostObject.getComponent(
      ViroSpecsInteractionHost.getTypeName()
    ) as ViroSpecsInteractionHost | null;
    const animation = this.animationHostObject.getComponent(
      ViroSpecsAnimationHost.getTypeName()
    ) as ViroSpecsAnimationHost | null;
    const navigation = this.navigationHostObject.getComponent(
      ViroSpecsNavigationHost.getTypeName()
    ) as ViroSpecsNavigationHost | null;

    if (!runtime) {
      throw new Error("Generated Viro scene requires ViroSpecsRuntimeHost.");
    }

    if (GENERATED_INTERACTIONS.length && !interaction) throw new Error("Generated Viro interactions require ViroSpecsInteractionHost.");
    if (GENERATED_ANIMATIONS.length && !animation) throw new Error("Generated Viro animations require ViroSpecsAnimationHost.");
    if (GENERATED_POLYLINES.length && !navigation) throw new Error("Generated Viro polylines require ViroSpecsNavigationHost.");

    this.teardown = () => {
      if (interaction && !isNull(interaction)) for (const item of GENERATED_INTERACTIONS) interaction.remove(item.nodeId);
      if (animation && !isNull(animation)) for (const item of GENERATED_ANIMATIONS) animation.stop(item.nodeId);
      if (navigation && !isNull(navigation)) navigation.clearRoute();
      if (!isNull(runtime)) runtime.clear();
    };
    runtime.applySceneSnapshot(GENERATED_SCENE);

    if (interaction) {
      for (const item of GENERATED_INTERACTIONS) {
        interaction.setInteractable(item.nodeId, true);
        if (item.manipulation) {
          interaction.setManipulationEnabled(item.nodeId, true);
        }
      }
    }

    if (animation) {
      for (const item of GENERATED_ANIMATIONS) {
        animation.play(item.nodeId, item.plan);
      }
    }

    if (navigation) {
      for (const line of GENERATED_POLYLINES) {
        navigation.presentPolyline(line);
      }
    }
  }
}
`;
}
