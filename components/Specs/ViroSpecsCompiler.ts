import * as React from "react";
import { ViroAnimations } from "../Animation/ViroAnimations";
import { Viro3DObject } from "../Viro3DObject";
import { ViroAmbientLight } from "../ViroAmbientLight";
import { ViroDirectionalLight } from "../ViroDirectionalLight";
import { ViroImage } from "../ViroImage";
import { ViroNode } from "../ViroNode";
import { ViroOmniLight } from "../ViroOmniLight";
import { ViroPolyline } from "../ViroPolyline";
import { ViroSpotLight } from "../ViroSpotLight";
import { ViroText } from "../ViroText";
import type {
  ViroSpecsAnimationLookup,
  ViroSpecsAnimationPlan as CoreAnimationPlan,
} from "./core/animation";
import { createViroSpecsDiagnostic, type ViroSpecsDiagnostic } from "./core/diagnostic";
import { VIRO_SPECS_NO_ORIGIN } from "./core/diagnostics";
import type {
  ViroSpecsManifestV2,
  ViroSpecsVec3,
  ViroSpecsWireNode,
  ViroSpecsWireSceneSnapshot,
} from "./core/manifest";
import {
  VIRO_SPECS_ROOT_SCOPE,
  ViroSpecsSceneBuilder,
  type ViroSpecsScope,
  type ViroSpecsSourceResolution,
} from "./core/scene";

type Vec3 = [number, number, number];
type Props = Readonly<Record<string, unknown>>;

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

/** Animation action for the runtime transport. */
export type ViroSpecsAnimationPlan = CoreAnimationPlan;

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
  scene: ViroSpecsSceneSnapshot;
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function defaultSourceResolver(source: unknown): string {
  if (typeof source === "string") return source;
  if (typeof source === "number") return "react-native-asset:" + source;
  if (isRecord(source) && typeof source.uri === "string") return source.uri;
  throw new Error(
    "Specs source needs a stable string ID. Pass sourceResolver to ViroSpecsScene for bundled assets."
  );
}

function asCallback<T>(value: unknown): T | undefined {
  // Viro callbacks are opaque functions; the prop types define their signatures.
  return typeof value === "function" ? (value as T) : undefined;
}

const lookupRegisteredAnimation: ViroSpecsAnimationLookup = (name) => {
  const registered = ViroAnimations.getRegisteredAnimation(name);
  if (registered === undefined) return undefined;
  if (Array.isArray(registered)) return "chain";
  return registered;
};

function isBlankText(child: React.ReactNode): boolean {
  return typeof child === "string" && child.trim() === "";
}

/**
 * Compiles a Viro JSX tree into the portable Specs scene.
 *
 * Every rule about what an element compiles to lives in the shared core
 * (`components/Specs/core/scene.ts`), which `viro-specs-compile` also uses, so
 * both compilers produce the same manifest for the same tree. This function
 * only walks React elements and keeps the callbacks.
 *
 * Components without a Specs mapping, props the manifest does not carry and
 * values it cannot represent are reported in `diagnostics` with a code from
 * `docs/specs-diagnostics.md`. Unsupported features (portals, physics, Rive,
 * video, audio, native textures, custom rendering) are capability errors;
 * nothing is emitted in their place.
 */
export function compileViroSpecsChildren(
  children: React.ReactNode,
  sourceResolver: ViroSpecsSourceResolver = defaultSourceResolver
): ViroSpecsCompiledScene {
  const callbacks = new Map<string, ViroSpecsCallbackRecord>();
  const builder = new ViroSpecsSceneBuilder({
    generator: "viro-specs-runtime",
    lookupAnimation: lookupRegisteredAnimation,
    resolveSource: (value, kind): ViroSpecsSourceResolution => {
      try {
        return { id: sourceResolver(value, kind) };
      } catch (error) {
        return {
          issue: {
            code: "VS3008",
            prop: "source",
            message: (error instanceof Error ? error.message : String(error)),
          },
        };
      }
    },
  });

  const visit = (child: React.ReactNode, scope: ViroSpecsScope): void => {
    if (typeof child === "string" || typeof child === "number") {
      if (isBlankText(child)) return;
      builder.report(
        createViroSpecsDiagnostic(
          "VS3001",
          "Text child " + JSON.stringify(String(child)) + " has no Specs mapping. Use ViroText.",
          scope.nodeId !== undefined ? { nodeId: scope.nodeId } : {}
        )
      );
      return;
    }
    if (!React.isValidElement(child)) return;
    const props = child.props as Props;

    if (child.type === React.Fragment) {
      React.Children.forEach(props.children as React.ReactNode, (nested) => visit(nested, scope));
      return;
    }

    const name = componentName(child.type);
    const elementChildren = React.Children.toArray(props.children as React.ReactNode);
    const result = builder.addElement(scope, {
      name,
      props,
      writtenProps: Object.keys(props).filter((prop) => prop !== "children" && props[prop] !== undefined),
      ...(child.key !== null ? { key: String(child.key) } : {}),
      hasChildren: elementChildren.some((nested) => !isBlankText(nested)),
      origin: VIRO_SPECS_NO_ORIGIN,
    });
    if (result.kind !== "compiled") return;

    const record: ViroSpecsCallbackRecord = {};
    const onHover = asCallback<ViroSpecsCallbackRecord["onHover"]>(props.onHover);
    const onClick =
      asCallback<ViroSpecsCallbackRecord["onClick"]>(props.onClick) ??
      asCallback<ViroSpecsCallbackRecord["onClick"]>(props.onClickState);
    const onDrag = asCallback<ViroSpecsCallbackRecord["onDrag"]>(props.onDrag);
    if (onHover) record.onHover = onHover;
    if (onClick) record.onClick = onClick;
    if (onDrag) record.onDrag = onDrag;
    if (isRecord(props.animation)) {
      const onStart = asCallback<() => void>(props.animation.onStart);
      const onFinish = asCallback<() => void>(props.animation.onFinish);
      if (onStart) record.onAnimationStart = onStart;
      if (onFinish) record.onAnimationFinish = onFinish;
    }
    if (Object.keys(record).length) callbacks.set(result.id, record);

    const childScope = result.childScope;
    if (childScope) {
      React.Children.forEach(props.children as React.ReactNode, (nested) => visit(nested, childScope));
    }
  };

  React.Children.forEach(children, (child) => visit(child, VIRO_SPECS_ROOT_SCOPE));

  const built = builder.finish();
  // The runtime compiler never fills `materials`; materials come from the Lens
  // registry, so VS1011 (info) would repeat for every materialId on every render.
  const diagnostics = [
    ...built.diagnostics.filter((diagnostic) => diagnostic.code !== "VS1011"),
    ...built.loweringDiagnostics,
  ];

  return {
    manifest: built.manifest,
    scene: built.scene,
    polylines: built.polylines.map((polyline) => ({
      id: polyline.id,
      points: polyline.points,
      radiusMeters: polyline.radiusMeters,
      ...(polyline.materialId !== undefined ? { materialId: polyline.materialId } : {}),
    })),
    animations: [...built.plans],
    callbacks,
    diagnostics,
  };
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
