import * as React from "react";
import {
  ViroAnimations,
  type ViroRegisterableAnimation,
} from "../Animation/ViroAnimations";
import { Viro3DObject } from "../Viro3DObject";
import { ViroAmbientLight } from "../ViroAmbientLight";
import { ViroDirectionalLight } from "../ViroDirectionalLight";
import { ViroImage } from "../ViroImage";
import { ViroNode } from "../ViroNode";
import { ViroOmniLight } from "../ViroOmniLight";
import { ViroPolyline } from "../ViroPolyline";
import { ViroSpotLight } from "../ViroSpotLight";
import { ViroText } from "../ViroText";
import {
  checkSpecsProps,
  classifySpecsComponent,
  normalizeSpecsColor,
  normalizeSpecsEasing,
  resolveSpecsAnimationValue,
  specsAnimationTarget,
  specsModelFormat,
  unsupportedComponentDiagnostic,
} from "./core/compileSupport";
import {
  createViroSpecsDiagnostic,
  type ViroSpecsDiagnostic,
} from "./core/diagnostic";
import { toSpecsSceneDocument, toSpecsSceneSnapshot } from "./core/lower";
import {
  readSpecsActionProp,
  specsTriggerEvents,
  type ViroSpecsActionDeclaration,
  type ViroSpecsActionTrigger,
} from "./core/actions";
import type {
  ViroSpecsAnimationTrack,
  ViroSpecsExtents,
  ViroSpecsLight,
  ViroSpecsManifestAnimation,
  ViroSpecsManifestInteraction,
  ViroSpecsManifestNode,
  ViroSpecsManifestPolyline,
  ViroSpecsManifestV2,
  ViroSpecsSceneDocument,
  ViroSpecsTextStyle,
  ViroSpecsVec3,
  ViroSpecsWireNode,
  ViroSpecsWireSceneSnapshot,
} from "./core/manifest";
import { validateSpecsManifestV2 } from "./core/validate";

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
type Props = Readonly<Record<string, unknown>>;

type Transform = {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
};

/** Node in the scene snapshot sent to the Lens runtime (scene protocol 1). */
export type ViroSpecsPortableNode = ViroSpecsWireNode;

/** World-space polyline passed to {@linkcode ViroSpecsSceneTransport.presentPolyline}. */
export type ViroSpecsPortablePolyline = {
  id: string;
  points: readonly ViroSpecsVec3[];
  radiusMeters: number;
  materialId?: string;
};

export type ViroSpecsInteractionEvent = {
  source: string;
  phase:
    | "hover-enter"
    | "hover-move"
    | "hover-exit"
    | "select-start"
    | "select-end"
    | "drag"
    | "cancel";
  targetId?: string;
  position?: Vec3;
  direction?: Vec3;
  timestampMs?: number;
};

export type ViroSpecsAnimationEvent = {
  nodeId: string;
  name: string;
  phase: "start" | "finish";
  completionEvent?: string;
};

/** Scene protocol 1 snapshot passed to {@linkcode ViroSpecsSceneTransport.applyScene}. */
export type ViroSpecsSceneSnapshot = ViroSpecsWireSceneSnapshot;

export type ViroSpecsSourceResolver = (
  source: unknown,
  kind: "image" | "model"
) => string;

export type ViroSpecsAnimationPlan =
  | {
      action: "play";
      nodeId: string;
      name: string;
      definition: {
        properties: Record<string, number>;
        durationMs: number;
        delayMs?: number;
        easing?: string;
        loop?: boolean;
        completionEvent?: string;
      };
    }
  | {
      action: "stop";
      nodeId: string;
      name: string;
    };

/**
 * Output of {@linkcode compileViroSpecsChildren}.
 *
 * `manifest` is the manifest v2 for the tree. `scene`, `polylines` and
 * `animations` are the transport payloads derived from it. When
 * `diagnostics` contains an error, {@linkcode ViroSpecsScene} does not apply
 * the result.
 */
export type ViroSpecsCompiledScene = {
  manifest: ViroSpecsManifestV2;
  /**
   * Scene protocol 2 document with every manifest field. `ViroSpecsScene`
   * sends it to transports that implement `applySceneDocument`.
   */
  document: ViroSpecsSceneDocument;
  /** Scene protocol 1 snapshot for transports that only implement `applyScene`. */
  scene: ViroSpecsSceneSnapshot;
  /**
   * `VS1015` warnings for fields `scene` drops. Reported by `ViroSpecsScene`
   * only when it has to fall back to `applyScene`; `diagnostics` does not
   * include them.
   */
  loweringDiagnostics: ViroSpecsDiagnostic[];
  polylines: ViroSpecsPortablePolyline[];
  animations: ViroSpecsAnimationPlan[];
  callbacks: Map<string, ViroSpecsCallbackRecord>;
  diagnostics: ViroSpecsDiagnostic[];
};

export type ViroSpecsCallbackRecord = {
  onHover?: (
    isHovering: boolean,
    position: Vec3,
    source: number
  ) => void;
  onClick?: (position: Vec3, source: number) => void;
  onDrag?: (position: Vec3, source: number) => void;
  onAnimationStart?: () => void;
  onAnimationFinish?: () => void;
};

const IDENTITY: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

const COMPONENT_NAMES = new Map<unknown, string>([
  [ViroNode, "ViroNode"],
  [ViroText, "ViroText"],
  [ViroImage, "ViroImage"],
  [Viro3DObject, "Viro3DObject"],
  [ViroPolyline, "ViroPolyline"],
  [ViroAmbientLight, "ViroAmbientLight"],
  [ViroDirectionalLight, "ViroDirectionalLight"],
  [ViroOmniLight, "ViroOmniLight"],
  [ViroSpotLight, "ViroSpotLight"],
]);

function isFiniteVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Name used in diagnostics. Supported components are matched by identity;
 * other components fall back to displayName or function name, which is
 * enough to classify capability errors such as ViroRivePanel.
 */
function componentName(type: unknown): string {
  const known = COMPONENT_NAMES.get(type);
  if (known) return known;
  if (typeof type === "string") return type;
  if (typeof type === "function" || isRecord(type)) {
    const named = type as { displayName?: unknown; name?: unknown; render?: unknown };
    if (typeof named.displayName === "string") return named.displayName;
    if (typeof named.name === "string" && named.name !== "") return named.name;
    if (typeof named.render === "function" && named.render.name !== "") {
      return named.render.name;
    }
  }
  return "anonymous component";
}

function degreesToQuaternion(rotation: Vec3): Quat {
  const [x, y, z] = rotation.map((value) => (value * Math.PI) / 180);
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);

  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

function multiplyQuat(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function rotatePoint(rotation: Quat, point: Vec3): Vec3 {
  const [qx, qy, qz, qw] = rotation;
  const [x, y, z] = point;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function composeTransform(parent: Transform, props: Props): Transform {
  const localPosition: Vec3 = isFiniteVec3(props.position) ? props.position : [0, 0, 0];
  const localScale: Vec3 = isFiniteVec3(props.scale) ? props.scale : [1, 1, 1];
  const localRotation: Quat = isFiniteVec3(props.rotation)
    ? degreesToQuaternion(props.rotation)
    : [0, 0, 0, 1];

  const scaledLocal: Vec3 = [
    localPosition[0] * parent.scale[0],
    localPosition[1] * parent.scale[1],
    localPosition[2] * parent.scale[2],
  ];
  const rotatedLocal = rotatePoint(parent.rotation, scaledLocal);

  return {
    position: [
      parent.position[0] + rotatedLocal[0],
      parent.position[1] + rotatedLocal[1],
      parent.position[2] + rotatedLocal[2],
    ],
    rotation: multiplyQuat(parent.rotation, localRotation),
    scale: [
      parent.scale[0] * localScale[0],
      parent.scale[1] * localScale[1],
      parent.scale[2] * localScale[2],
    ],
  };
}

function transformPoint(transform: Transform, point: Vec3): Vec3 {
  const scaled: Vec3 = [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2],
  ];
  const rotated = rotatePoint(transform.rotation, scaled);
  return [
    transform.position[0] + rotated[0],
    transform.position[1] + rotated[1],
    transform.position[2] + rotated[2],
  ];
}

function defaultSourceResolver(source: unknown): string {
  if (typeof source === "string") return source;
  if (typeof source === "number") return "react-native-asset:" + source;
  if (isRecord(source) && typeof source.uri === "string") return source.uri;
  throw new Error(
    "Specs source needs a stable string ID. Pass sourceResolver to ViroSpecsScene for bundled assets."
  );
}

function animationBase(property: string, props: Props): number {
  const position: Vec3 = isFiniteVec3(props.position) ? props.position : [0, 0, 0];
  const scale: Vec3 = isFiniteVec3(props.scale) ? props.scale : [1, 1, 1];
  const rotation: Vec3 = isFiniteVec3(props.rotation) ? props.rotation : [0, 0, 0];

  switch (property) {
    case "positionX":
    case "translateX":
      return position[0];
    case "positionY":
    case "translateY":
      return position[1];
    case "positionZ":
    case "translateZ":
      return position[2];
    case "scaleX":
      return scale[0];
    case "scaleY":
      return scale[1];
    case "scaleZ":
      return scale[2];
    case "rotateX":
      return rotation[0];
    case "rotateY":
      return rotation[1];
    case "rotateZ":
      return rotation[2];
    case "opacity":
      return typeof props.opacity === "number" ? props.opacity : 1;
    default:
      return 0;
  }
}

function asCallback<T>(value: unknown): T | undefined {
  // Viro callbacks are opaque functions; the prop types define their signatures.
  return typeof value === "function" ? (value as T) : undefined;
}

function firstMaterial(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function readExtents(props: Props): ViroSpecsExtents | undefined {
  if (isPositiveNumber(props.width) && isPositiveNumber(props.height)) {
    return { width: props.width, height: props.height };
  }
  return undefined;
}

/** Scene-level inputs of {@linkcode compileViroSpecsChildren}, from `ViroSpecsScene` props. */
export type ViroSpecsCompileOptions = {
  /** Actions the tree's `specsAction` triggers may fire. Copied to the manifest. */
  readonly actions?: readonly ViroSpecsActionDeclaration[];
  /** Route of the scene. A new route is navigation on the Lens host. */
  readonly route?: string;
};

/**
 * Compiles a Viro JSX tree into the portable Specs scene.
 *
 * Components without a Specs mapping, props the manifest does not carry and
 * values it cannot represent are reported in `diagnostics` with a code from
 * `docs/specs-diagnostics.md`. Unsupported features (portals, physics, Rive,
 * video, audio, native textures, custom rendering) are capability errors;
 * nothing is emitted in their place.
 */
export function compileViroSpecsChildren(
  children: React.ReactNode,
  sourceResolver: ViroSpecsSourceResolver = defaultSourceResolver,
  options: ViroSpecsCompileOptions = {}
): ViroSpecsCompiledScene {
  const nodes: ViroSpecsManifestNode[] = [];
  const manifestPolylines: ViroSpecsManifestPolyline[] = [];
  const lights: ViroSpecsLight[] = [];
  const interactions: ViroSpecsManifestInteraction[] = [];
  const manifestAnimations: ViroSpecsManifestAnimation[] = [];
  const polylines: ViroSpecsPortablePolyline[] = [];
  const animations: ViroSpecsAnimationPlan[] = [];
  const callbacks = new Map<string, ViroSpecsCallbackRecord>();
  const diagnostics: ViroSpecsDiagnostic[] = [];
  let ordinal = 0;

  const resolveSource = (
    props: Props,
    kind: "image" | "model",
    id: string,
    name: string
  ): string | undefined => {
    if (props.source === undefined) {
      diagnostics.push(
        createViroSpecsDiagnostic("VS3008", name + " " + id + " has no source.", { nodeId: id })
      );
      return undefined;
    }
    try {
      return sourceResolver(props.source, kind);
    } catch (error) {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3008",
          name + " " + id + ": " + (error instanceof Error ? error.message : String(error)),
          { nodeId: id }
        )
      );
      return undefined;
    }
  };

  const compileAnimation = (props: Props, id: string): void => {
    const animation = props.animation;
    if (!isRecord(animation) || typeof animation.name !== "string") return;
    const animationName = animation.name;

    if (animation.run === false) {
      animations.push({ action: "stop", nodeId: id, name: animationName });
      return;
    }
    if (animation.run !== true) return;

    const registered: ViroRegisterableAnimation | ViroRegisterableAnimation[] | undefined =
      ViroAnimations.getRegisteredAnimation(animationName);
    if (!registered || Array.isArray(registered)) {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3003",
          "Animation " + animationName + " on " + id + " is not registered or is an animation chain.",
          { nodeId: id }
        )
      );
      return;
    }

    const easing = normalizeSpecsEasing(registered.easing);
    if (!easing) {
      diagnostics.push(
        createViroSpecsDiagnostic(
          "VS3006",
          "Animation " + animationName + " uses easing " + String(registered.easing) + ", which Specs does not play.",
          { nodeId: id }
        )
      );
    }

    const resolvedProperties: Record<string, number> = {};
    const tracks: ViroSpecsAnimationTrack[] = [];
    for (const [property, value] of Object.entries(registered.properties ?? {})) {
      if (value === undefined) continue;
      const target = specsAnimationTarget(property);
      if (!target) {
        diagnostics.push(
          createViroSpecsDiagnostic(
            "VS3004",
            "Animation " + animationName + " property " + property + " is not supported on Specs.",
            { nodeId: id }
          )
        );
        continue;
      }
      const resolved = resolveSpecsAnimationValue(
        value,
        animationBase(property, props),
        property.startsWith("translate")
      );
      if (resolved === undefined) {
        diagnostics.push(
          createViroSpecsDiagnostic(
            "VS3005",
            "Animation " + animationName + " cannot resolve " + property + "=" + String(value) + ".",
            { nodeId: id }
          )
        );
        continue;
      }
      resolvedProperties[property.replace(/^translate/, "position")] = resolved;
      tracks.push({ target, from: "current", to: resolved });
    }

    if (!easing || tracks.length === 0) return;

    const elementDelay = typeof animation.delay === "number" ? animation.delay : 0;
    const delayMs = (registered.delay ?? 0) + elementDelay;
    const loop = animation.loop === true;
    const completionEvent = "viro-animation-complete:" + id + ":" + animationName;

    animations.push({
      action: "play",
      nodeId: id,
      name: animationName,
      definition: {
        properties: resolvedProperties,
        durationMs: registered.duration,
        delayMs,
        easing,
        loop,
        completionEvent,
      },
    });
    manifestAnimations.push({
      nodeId: id,
      name: animationName,
      plan: {
        engine: "AnimationPlayer",
        durationSeconds: registered.duration / 1000,
        delaySeconds: delayMs / 1000,
        easing,
        playbackMode: loop ? "loop" : "single",
        completionEvent,
        tracks,
      },
    });
  };

  const visit = (
    child: React.ReactNode,
    parentId: string | undefined,
    parentTransform: Transform
  ): void => {
    if (!React.isValidElement(child)) return;
    const props = child.props as Props;

    if (child.type === React.Fragment) {
      React.Children.forEach(props.children as React.ReactNode, (nested) =>
        visit(nested, parentId, parentTransform)
      );
      return;
    }

    const name = componentName(child.type);
    const classification = classifySpecsComponent(name);
    const explicitId =
      typeof props.viroTag === "string"
        ? props.viroTag
        : child.key != null
          ? String(child.key)
          : undefined;

    if (classification.kind !== "supported") {
      diagnostics.push(
        unsupportedComponentDiagnostic(
          name,
          explicitId !== undefined ? { nodeId: explicitId } : {}
        )
      );
      return;
    }

    const id = explicitId ?? "viro-specs-" + ordinal++;
    if (explicitId === undefined) {
      diagnostics.push(
        createViroSpecsDiagnostic("VS3012", name + " was given ordinal ID " + id + ".", { nodeId: id })
      );
    }
    diagnostics.push(
      ...checkSpecsProps(
        name,
        Object.keys(props).filter((prop) => props[prop] !== undefined),
        () => ({ nodeId: id })
      )
    );
    const target = classification.target;

    for (const transformName of ["position", "rotation", "scale"] as const) {
      if (props[transformName] !== undefined && !isFiniteVec3(props[transformName])) {
        diagnostics.push(
          createViroSpecsDiagnostic(
            "VS1004",
            name + " " + id + " " + transformName + " must be three finite numbers.",
            { nodeId: id }
          )
        );
      }
    }
    const worldTransform = composeTransform(parentTransform, props);

    if (target.category === "light") {
      const color = props.color === undefined ? undefined : normalizeSpecsColor(props.color);
      if (props.color !== undefined && color === undefined) {
        diagnostics.push(
          createViroSpecsDiagnostic("VS3009", name + " " + id + " color " + String(props.color) + " is not hex; it was left out.", { nodeId: id })
        );
      }
      const base = {
        id,
        ...(parentId ? { parentId } : {}),
        ...(color ? { color } : {}),
        ...(typeof props.intensity === "number" ? { intensity: props.intensity } : {}),
      };
      const direction: Vec3 = isFiniteVec3(props.direction) ? props.direction : [0, 0, -1];
      const position: Vec3 = isFiniteVec3(props.position) ? props.position : [0, 0, 0];
      switch (target.type) {
        case "ambient":
          lights.push({ ...base, type: "ambient" });
          break;
        case "directional":
          lights.push({ ...base, type: "directional", direction });
          break;
        case "omni":
          lights.push({ ...base, type: "omni", position });
          break;
        case "spot":
          lights.push({
            ...base,
            type: "spot",
            position,
            direction,
            ...(typeof props.innerAngle === "number" ? { innerAngle: props.innerAngle } : {}),
            ...(typeof props.outerAngle === "number" ? { outerAngle: props.outerAngle } : {}),
          });
          break;
      }
      return;
    }

    const callbackRecord: ViroSpecsCallbackRecord = {};
    const onHover = asCallback<ViroSpecsCallbackRecord["onHover"]>(props.onHover);
    const onClick =
      asCallback<ViroSpecsCallbackRecord["onClick"]>(props.onClick) ??
      asCallback<ViroSpecsCallbackRecord["onClick"]>(props.onClickState);
    const onDrag = asCallback<ViroSpecsCallbackRecord["onDrag"]>(props.onDrag);
    if (onHover) callbackRecord.onHover = onHover;
    if (onClick) callbackRecord.onClick = onClick;
    if (onDrag) callbackRecord.onDrag = onDrag;
    if (isRecord(props.animation)) {
      const onStart = asCallback<() => void>(props.animation.onStart);
      const onFinish = asCallback<() => void>(props.animation.onFinish);
      if (onStart) callbackRecord.onAnimationStart = onStart;
      if (onFinish) callbackRecord.onAnimationFinish = onFinish;
    }
    if (Object.keys(callbackRecord).length) callbacks.set(id, callbackRecord);
    let triggers: readonly ViroSpecsActionTrigger[] = [];
    if (props.specsAction !== undefined) {
      const read = readSpecsActionProp(props.specsAction);
      for (const message of read.invalid) {
        diagnostics.push(createViroSpecsDiagnostic("VS3014", name + " " + id + " " + message, { nodeId: id }));
      }
      triggers = read.triggers;
    }
    const triggerEvents = specsTriggerEvents(triggers);
    const hover = onHover !== undefined || triggerEvents.includes("hover");
    const select = onClick !== undefined || triggerEvents.includes("select");
    if (hover || select || onDrag) {
      interactions.push({
        nodeId: id,
        interactable: true,
        manipulation: onDrag !== undefined,
        events: [
          ...(hover ? (["hover"] as const) : []),
          ...(select ? (["select"] as const) : []),
          ...(onDrag ? (["drag"] as const) : []),
        ],
        ...(triggers.length > 0 ? { triggers } : {}),
      });
    }

    const materialId = firstMaterial(props.materials);

    if (target.category === "polyline") {
      const points = props.points;
      if (!Array.isArray(points) || points.length < 2 || !points.every(isFiniteVec3)) {
        diagnostics.push(
          createViroSpecsDiagnostic("VS1004", "ViroPolyline " + id + " needs at least two [x, y, z] points.", { nodeId: id })
        );
        return;
      }
      const thickness = isPositiveNumber(props.thickness) ? props.thickness : 0.01;
      const polyline: ViroSpecsPortablePolyline = {
        id,
        points: points.map((point) => transformPoint(worldTransform, point)),
        radiusMeters:
          (thickness / 2) *
          Math.max(
            Math.abs(worldTransform.scale[0]),
            Math.abs(worldTransform.scale[1]),
            Math.abs(worldTransform.scale[2])
          ),
        ...(materialId ? { materialId } : {}),
      };
      polylines.push(polyline);
      manifestPolylines.push({ ...polyline, primitive: "volumetric-line" });
      return;
    }

    const base = {
      id,
      ...(parentId ? { parentId } : {}),
      ...(isFiniteVec3(props.position) ? { position: props.position } : {}),
      ...(isFiniteVec3(props.rotation) ? { rotation: degreesToQuaternion(props.rotation) } : {}),
      ...(isFiniteVec3(props.scale) ? { scale: props.scale } : {}),
      ...(typeof props.visible === "boolean" ? { visible: props.visible } : {}),
      ...(typeof props.opacity === "number" ? { opacity: props.opacity } : {}),
      ...(materialId ? { materialId } : {}),
    };

    let compiled: ViroSpecsManifestNode | undefined;
    switch (target.kind) {
      case "group":
        compiled = { ...base, kind: "group" };
        break;
      case "text": {
        if (typeof props.text !== "string") {
          diagnostics.push(
            createViroSpecsDiagnostic("VS1005", "ViroText " + id + " has no text string.", { nodeId: id })
          );
          break;
        }
        const style = readTextStyle(props.style, id, diagnostics);
        const extents = readExtents(props);
        compiled = {
          ...base,
          kind: "text",
          text: props.text,
          ...(style ? { style } : {}),
          ...(extents ? { extents } : {}),
          ...(typeof props.maxLines === "number" ? { maxLines: props.maxLines } : {}),
        };
        break;
      }
      case "image": {
        const source = resolveSource(props, "image", id, name);
        if (source === undefined) break;
        const extents = readExtents(props);
        compiled = { ...base, kind: "image", source, ...(extents ? { extents } : {}) };
        break;
      }
      case "model": {
        const source = resolveSource(props, "model", id, name);
        if (source === undefined) break;
        const format = specsModelFormat(props.type);
        if (format === "vrx") {
          diagnostics.push(
            createViroSpecsDiagnostic("VS3013", "Viro3DObject " + id + " uses VRX.", { nodeId: id })
          );
          break;
        }
        compiled = { ...base, kind: "model", source, ...(format ? { format } : {}) };
        break;
      }
    }
    if (!compiled) return;
    nodes.push(compiled);
    compileAnimation(props, id);

    if (props.children) {
      React.Children.forEach(props.children as React.ReactNode, (nested) =>
        visit(nested, id, worldTransform)
      );
    }
  };

  React.Children.forEach(children, (child) => visit(child, undefined, IDENTITY));

  const manifest: ViroSpecsManifestV2 = {
    version: 2,
    generator: { name: "viro-specs-runtime" },
    ...(options.route !== undefined ? { route: options.route } : {}),
    ...(options.actions !== undefined && options.actions.length > 0 ? { actions: options.actions } : {}),
    nodes,
    polylines: manifestPolylines,
    lights,
    materials: [],
    interactions,
    animations: manifestAnimations,
  };
  const validation = validateSpecsManifestV2(manifest);
  // The runtime compiler never fills `materials`; materials come from the Lens
  // registry, so VS1011 (info) would repeat for every materialId on every render.
  diagnostics.push(...validation.diagnostics.filter((diagnostic) => diagnostic.code !== "VS1011"));
  const lowered = toSpecsSceneSnapshot(manifest);

  return {
    manifest,
    document: toSpecsSceneDocument(manifest),
    scene: lowered.snapshot,
    loweringDiagnostics: [...lowered.diagnostics],
    polylines,
    animations,
    callbacks,
    diagnostics,
  };
}

const TEXT_STYLE_KEYS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "color",
  "textAlign",
  "textAlignVertical",
] as const;

function readTextStyle(
  value: unknown,
  id: string,
  diagnostics: ViroSpecsDiagnostic[]
): ViroSpecsTextStyle | undefined {
  if (value === undefined) return undefined;
  // StyleSheet.create returns plain objects in React Native 0.88.
  const style = Array.isArray(value)
    ? Object.assign({}, ...value.filter(isRecord))
    : isRecord(value)
      ? value
      : undefined;
  if (!style) {
    diagnostics.push(
      createViroSpecsDiagnostic("VS3002", "ViroText " + id + " style is not an object and was left out.", { nodeId: id })
    );
    return undefined;
  }
  const out: { -readonly [K in keyof ViroSpecsTextStyle]: ViroSpecsTextStyle[K] } = {};
  for (const key of Object.keys(style)) {
    if (!(TEXT_STYLE_KEYS as readonly string[]).includes(key)) {
      diagnostics.push(
        createViroSpecsDiagnostic("VS3002", "ViroText " + id + " style." + key + " is not carried to Specs.", { nodeId: id })
      );
    }
  }
  if (typeof style.fontFamily === "string") out.fontFamily = style.fontFamily;
  if (isPositiveNumber(style.fontSize)) out.fontSize = style.fontSize;
  const weight = typeof style.fontWeight === "number" ? String(style.fontWeight) : style.fontWeight;
  if (
    weight === "normal" || weight === "bold" || weight === "100" || weight === "200" ||
    weight === "300" || weight === "400" || weight === "500" || weight === "600" ||
    weight === "700" || weight === "800" || weight === "900"
  ) {
    out.fontWeight = weight;
  }
  if (style.fontStyle === "normal" || style.fontStyle === "italic") out.fontStyle = style.fontStyle;
  if (style.color !== undefined) {
    const color = normalizeSpecsColor(style.color);
    if (color) out.color = color;
    else {
      diagnostics.push(
        createViroSpecsDiagnostic("VS3009", "ViroText " + id + " style.color " + String(style.color) + " is not hex; it was left out.", { nodeId: id })
      );
    }
  }
  if (style.textAlign === "left" || style.textAlign === "center" || style.textAlign === "right") {
    out.textAlign = style.textAlign;
  }
  if (
    style.textAlignVertical === "top" ||
    style.textAlignVertical === "center" ||
    style.textAlignVertical === "bottom"
  ) {
    out.textAlignVertical = style.textAlignVertical;
  }
  return Object.keys(out).length ? out : undefined;
}

export function dispatchViroSpecsInteraction(
  event: ViroSpecsInteractionEvent,
  callbacks: ReadonlyMap<string, ViroSpecsCallbackRecord>
): void {
  if (!event.targetId) return;
  const record = callbacks.get(event.targetId);
  if (!record) return;

  const position = event.position ?? [0, 0, 0];
  const source = 0;

  switch (event.phase) {
    case "hover-enter":
      record.onHover?.(true, position, source);
      break;
    case "hover-exit":
      record.onHover?.(false, position, source);
      break;
    case "select-end":
      record.onClick?.(position, source);
      break;
    case "drag":
      record.onDrag?.(position, source);
      break;
  }
}

export function dispatchViroSpecsAnimationEvent(
  event: ViroSpecsAnimationEvent,
  callbacks: ReadonlyMap<string, ViroSpecsCallbackRecord>
): void {
  const record = callbacks.get(event.nodeId);
  if (!record) return;

  if (event.phase === "start") {
    record.onAnimationStart?.();
  } else {
    record.onAnimationFinish?.();
  }
}
