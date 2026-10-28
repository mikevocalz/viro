import { ViroSpecsAnimationHost } from "../lens/ViroSpecsAnimationHost";
import { ViroSpecsInteractionHost } from "../lens/ViroSpecsInteractionHost";
import { ViroSpecsNavigationHost } from "../lens/ViroSpecsNavigationHost";
import { ViroSpecsRuntimeHost } from "../lens/ViroSpecsRuntimeHost";

const GENERATED_SCENE: any = {
  "version": 1,
  "nodes": [
    {
      "id": "platform-lab-root",
      "kind": "group",
      "position": [
        0,
        0,
        -1.5
      ]
    },
    {
      "id": "platform-lab-title",
      "kind": "text",
      "parentId": "platform-lab-root",
      "position": [
        0,
        0.25,
        0
      ],
      "text": "Viro Cross-Platform Lab"
    },
    {
      "id": "platform-lab-model",
      "kind": "model",
      "parentId": "platform-lab-root",
      "position": [
        -0.2,
        -0.05,
        0
      ],
      "scale": [
        0.18,
        0.18,
        0.18
      ],
      "source": "examples/visionos-sweep/assets/shiba.glb"
    }
  ]
};
const GENERATED_POLYLINES: any[] = [
  {
    "id": "platform-lab-route",
    "primitive": "volumetric-line",
    "backendPackage": "VolumetricLine",
    "points": [
      [
        -0.3,
        -0.2,
        -1.38
      ],
      [
        0,
        0.02,
        -1.38
      ],
      [
        0.3,
        -0.08,
        -1.38
      ]
    ],
    "radiusMeters": 0.004
  }
];
const GENERATED_INTERACTIONS: any[] = [
  {
    "nodeId": "platform-lab-model",
    "interactable": true,
    "manipulation": true,
    "events": [
      "select",
      "drag"
    ]
  }
];
const GENERATED_ANIMATIONS: any[] = [
  {
    "nodeId": "platform-lab-title",
    "name": "platformLabPulse",
    "plan": {
      "engine": "AnimationPlayer",
      "backendPackage": "AnimationExamples",
      "durationSeconds": 0.5,
      "delaySeconds": 0,
      "easing": "ease-in-out",
      "playbackMode": "loop",
      "completionEvent": "viro-animation-complete:platform-lab-title:platformLabPulse",
      "tracks": [
        {
          "target": "transform.scale.x",
          "from": "current",
          "to": 1.15
        },
        {
          "target": "transform.scale.y",
          "from": "current",
          "to": 1.15
        },
        {
          "target": "transform.scale.z",
          "from": "current",
          "to": 1.15
        },
        {
          "target": "material.opacity",
          "from": "current",
          "to": 0.8
        }
      ]
    }
  }
];

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
