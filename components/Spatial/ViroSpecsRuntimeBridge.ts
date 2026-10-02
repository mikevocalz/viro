import {
  ViroAnimations,
  type ViroRegisterableAnimation,
} from "../Animation/ViroAnimations";
import {
  dispatchViroSpecsInteraction,
  type ViroSpecsJSXCompilation,
  type ViroSpecsPortableInteraction,
  type ViroSpecsPortablePolyline,
} from "./ViroSpecsJSXCompiler";
import {
  registerViroXRRuntimeProvider,
  type ViroXRCapability,
  type ViroXRCapabilityState,
  type ViroXRRuntimeSnapshot,
} from "./ViroXRRuntime";

export type ViroSpecsBackendCapabilityReport = Record<
  string,
  ViroXRCapabilityState
>;

export interface ViroSpecsAnimationTrackPlan {
  target:
    | "transform.position.x"
    | "transform.position.y"
    | "transform.position.z"
    | "transform.scale.x"
    | "transform.scale.y"
    | "transform.scale.z"
    | "transform.rotation.x"
    | "transform.rotation.y"
    | "transform.rotation.z"
    | "material.opacity";
  from: "current";
  to: number;
}

export interface ViroSpecsNativeAnimationPlan {
  engine: "AnimationPlayer";
  backendPackage: "AnimationExamples";
  durationSeconds: number;
  delaySeconds: number;
  easing:
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | { cubicBezier: [number, number, number, number] };
  playbackMode: "single" | "loop";
  completionEvent: string;
  tracks: ViroSpecsAnimationTrackPlan[];
}

export interface ViroSpecsAnimationRuntime {
  play(
    nodeId: string,
    plan: ViroSpecsNativeAnimationPlan,
    onComplete?: () => void
  ): Promise<void> | void;
}

export interface ViroSpecsWorldQueryRequest {
  origin: [number, number, number];
  direction: [number, number, number];
  maxDistance?: number;
  classifications?: readonly (
    | "floor"
    | "wall"
    | "ceiling"
    | "table"
    | "seat"
    | "unknown"
  )[];
}

export interface ViroSpecsHitTestResult {
  position: [number, number, number];
  normal?: [number, number, number];
  distance: number;
  surface:
    | "floor"
    | "wall"
    | "ceiling"
    | "table"
    | "seat"
    | "unknown";
  confidence?: number;
}

export type ViroSpecsSurfacePlacementMode =
  | "near-surface"
  | "horizontal"
  | "vertical";

export interface ViroSpecsPlacementPose {
  position: [number, number, number];
  rotation: [number, number, number, number];
  surface?: ViroSpecsHitTestResult["surface"];
}

export interface ViroSpecsWorldRuntime {
  hitTest(
    request: ViroSpecsWorldQueryRequest
  ): Promise<readonly ViroSpecsHitTestResult[]>;
  startPlacement(
    mode: ViroSpecsSurfacePlacementMode,
    onPose: (pose: ViroSpecsPlacementPose) => void
  ): (() => void) | Promise<() => void>;
}

export interface ViroSpecsGeoCoordinate {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
}

export interface ViroSpecsNavigationRoute {
  id: string;
  points: readonly ViroSpecsGeoCoordinate[];
  destination?: {
    id: string;
    name?: string;
    coordinate: ViroSpecsGeoCoordinate;
  };
}

export interface ViroSpecsNavigationPlan {
  route: ViroSpecsNavigationRoute;
  line: {
    widthMeters: number;
    verticalOffsetMeters?: number;
    materialId?: string;
  };
  packages: readonly ["SpecsNavigationKit", "VolumetricLine"];
}

export interface ViroSpecsVolumetricLinePlan {
  primitive: "volumetric-line";
  backendPackage: "VolumetricLine";
  points: readonly [number, number, number][];
  radiusMeters: number;
  materialId?: string;
}

export interface ViroSpecsNavigationRuntime {
  presentRoute(plan: ViroSpecsNavigationPlan): Promise<void> | void;
  presentPolyline(plan: ViroSpecsVolumetricLinePlan): Promise<void> | void;
  clearRoute(): Promise<void> | void;
}

export interface ViroSpecsSceneRuntime {
  applyScene(scene: ViroSpecsJSXCompilation["scene"]): Promise<void> | void;
  onInteraction(
    listener: (event: ViroSpecsPortableInteraction) => void
  ): () => void;
  getCapabilities(): ViroSpecsBackendCapabilityReport;
  clear?(): Promise<void> | void;
}

export interface ViroSpecsBackendRuntime extends ViroSpecsSceneRuntime {
  animation?: ViroSpecsAnimationRuntime;
  world?: ViroSpecsWorldRuntime;
  navigation?: ViroSpecsNavigationRuntime;
}

export interface ViroSpecsMountOptions {
  playAnimations?: boolean;
  presentPolylines?: boolean;
}

export interface ViroSpecsMountedScene {
  dispose(): Promise<void>;
  hitTest(
    request: ViroSpecsWorldQueryRequest
  ): Promise<readonly ViroSpecsHitTestResult[]>;
  startPlacement(
    mode: ViroSpecsSurfacePlacementMode,
    onPose: (pose: ViroSpecsPlacementPose) => void
  ): Promise<() => void>;
  presentRoute(plan: ViroSpecsNavigationPlan): Promise<void>;
}

const CAPABILITY_MAP: Partial<Record<string, ViroXRCapability>> = {
  "immersive-rendering": "immersive-rendering",
  "world-query": "world-query",
  "surface-placement": "surface-placement",
  anchors: "anchors",
  "hand-tracking": "hand-tracking",
  "gaze-targeting": "gaze-targeting",
  "eye-gaze": "eye-gaze",
  pinch: "pinch",
  "drag-manipulation": "drag-manipulation",
  camera: "camera",
  depth: "depth",
  "location-navigation": "location-navigation",
  "volumetric-line": "volumetric-line",
};

function runtimeSnapshot(
  capabilities: ViroSpecsBackendCapabilityReport
): ViroXRRuntimeSnapshot {
  const mapped: ViroXRRuntimeSnapshot["capabilities"] = {};
  for (const [backendName, state] of Object.entries(capabilities)) {
    const capability = CAPABILITY_MAP[backendName];
    if (capability) mapped[capability] = state;
  }

  const globals = globalThis as typeof globalThis & {
    __VIRO_SIMULATOR__?: boolean;
    __VIRO_PHYSICAL_DEVICE__?: boolean;
  };

  return {
    platform: "specs",
    runtime: "lens-studio",
    deviceFamily: "specs",
    isSpecs: true,
    isHorizon: false,
    isPico: false,
    isVisionOS: false,
    isWeb: false,
    isPhysicalDevice: globals.__VIRO_PHYSICAL_DEVICE__ === true,
    isSimulator: globals.__VIRO_SIMULATOR__ === true,
    isEditor:
      globals.__VIRO_SIMULATOR__ === true ||
      globals.__VIRO_PHYSICAL_DEVICE__ !== true,
    capabilities: mapped,
  };
}

const ANIMATION_TARGETS = {
  positionX: "transform.position.x",
  positionY: "transform.position.y",
  positionZ: "transform.position.z",
  scaleX: "transform.scale.x",
  scaleY: "transform.scale.y",
  scaleZ: "transform.scale.z",
  rotateX: "transform.rotation.x",
  rotateY: "transform.rotation.y",
  rotateZ: "transform.rotation.z",
  opacity: "material.opacity",
} as const;

function normalizeEasing(
  easing?: string
): ViroSpecsNativeAnimationPlan["easing"] {
  switch (easing) {
    case "ease-in":
    case "ease-out":
    case "ease-in-out":
    case "linear":
      return easing;
    default:
      return "linear";
  }
}

export function compileRegisteredViroAnimationForSpecs(
  name: string,
  options: { loop?: boolean; delayMs?: number } = {}
): ViroSpecsNativeAnimationPlan {
  const definition = ViroAnimations.getRegisteredAnimation(name);
  if (!definition) {
    throw new Error(`Viro animation "${name}" is not registered.`);
  }
  if (Array.isArray(definition)) {
    throw new Error(
      `Viro animation chain "${name}" requires sequence support and cannot be flattened safely.`
    );
  }

  const animation = definition as ViroRegisterableAnimation;
  const tracks: ViroSpecsAnimationTrackPlan[] = [];
  for (const [property, target] of Object.entries(ANIMATION_TARGETS)) {
    const value = animation.properties[property as keyof typeof animation.properties];
    if (typeof value === "number" && Number.isFinite(value)) {
      tracks.push({ target, from: "current", to: value });
    }
  }

  if (tracks.length === 0) {
    throw new Error(
      `Viro animation "${name}" has no SPECS-compatible numeric transform/opacity properties.`
    );
  }

  return {
    engine: "AnimationPlayer",
    backendPackage: "AnimationExamples",
    durationSeconds: Math.max(0, animation.duration) / 1000,
    delaySeconds: Math.max(0, options.delayMs ?? animation.delay ?? 0) / 1000,
    easing: normalizeEasing(animation.easing),
    playbackMode: options.loop ? "loop" : "single",
    completionEvent: `viro-animation:${name}:complete`,
    tracks,
  };
}

function polylinePlan(
  polyline: ViroSpecsPortablePolyline
): ViroSpecsVolumetricLinePlan {
  // Portable polyline points remain meters all the way to the SPECS backend.
  // The Lens runtime owns meter -> centimeter conversion.
  return {
    primitive: "volumetric-line",
    backendPackage: "VolumetricLine",
    points: polyline.points,
    radiusMeters: polyline.widthMeters / 2,
    ...(polyline.materialId ? { materialId: polyline.materialId } : {}),
  };
}

export async function mountViroSpecsCompilation(
  compilation: ViroSpecsJSXCompilation,
  backend: ViroSpecsBackendRuntime,
  options: ViroSpecsMountOptions = {}
): Promise<ViroSpecsMountedScene> {
  const unregisterRuntime = registerViroXRRuntimeProvider({
    getSnapshot: () => runtimeSnapshot(backend.getCapabilities()),
  });

  await backend.applyScene(compilation.scene);

  const unsubscribeInteraction = backend.onInteraction((event) => {
    dispatchViroSpecsInteraction(compilation, event);
  });

  if (options.presentPolylines !== false && backend.navigation) {
    for (const polyline of compilation.polylines) {
      await backend.navigation.presentPolyline(polylinePlan(polyline));
    }
  }

  if (options.playAnimations !== false && backend.animation) {
    for (const animation of compilation.animations ?? []) {
      if (!animation.run || !animation.name) continue;
      const plan = compileRegisteredViroAnimationForSpecs(animation.name, {
        loop: animation.loop,
        delayMs: animation.delayMs,
      });
      await backend.animation.play(
        animation.nodeId,
        plan,
        animation.onFinish
      );
    }
  }

  let disposed = false;

  return {
    async dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeInteraction();
      unregisterRuntime();
      await backend.navigation?.clearRoute();
      await backend.clear?.();
    },

    async hitTest(request) {
      if (!backend.world) {
        throw new Error("The active SPECS backend does not expose WorldQuery.");
      }
      return backend.world.hitTest(request);
    },

    async startPlacement(mode, onPose) {
      if (!backend.world) {
        throw new Error(
          "The active SPECS backend does not expose surface placement."
        );
      }
      return await backend.world.startPlacement(mode, onPose);
    },

    async presentRoute(plan) {
      if (!backend.navigation) {
        throw new Error(
          "The active SPECS backend does not expose navigation."
        );
      }
      await backend.navigation.presentRoute(plan);
    },
  };
}
