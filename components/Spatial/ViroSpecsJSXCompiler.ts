import * as React from "react";
import { ViroARScene } from "../AR/ViroARScene";
import { Viro3DObject } from "../Viro3DObject";
import { ViroFlexView } from "../ViroFlexView";
import { ViroImage } from "../ViroImage";
import { ViroNode } from "../ViroNode";
import { ViroPolyline } from "../ViroPolyline";
import { ViroScene } from "../ViroScene";
import { ViroSurface } from "../ViroSurface";
import { ViroText } from "../ViroText";
import { ViroEventSource } from "../Types/ViroUtils";

export type ViroSpecsPortableNodeKind =
  | "group"
  | "text"
  | "image"
  | "model"
  | "panel";

export interface ViroSpecsPortableNode {
  id: string;
  kind: ViroSpecsPortableNodeKind;
  parentId?: string;
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  source?: string;
  text?: string;
  visible?: boolean;
}

export interface ViroSpecsPortablePolyline {
  id: string;
  parentId?: string;
  points: readonly [number, number, number][];
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  widthMeters: number;
  materialId?: string;
}

export interface ViroSpecsPortableSceneSnapshot {
  version: 1;
  nodes: ViroSpecsPortableNode[];
}

export type ViroSpecsPortableInteractionSource =
  | "gaze"
  | "hand"
  | "pinch"
  | "voice";

export type ViroSpecsPortableInteractionPhase =
  | "hover-enter"
  | "hover-move"
  | "hover-exit"
  | "select-start"
  | "select-end"
  | "drag"
  | "cancel";

export interface ViroSpecsPortableInteraction {
  source: ViroSpecsPortableInteractionSource;
  phase: ViroSpecsPortableInteractionPhase;
  targetId?: string;
  position?: [number, number, number];
  direction?: [number, number, number];
  timestampMs?: number;
}

export interface ViroSpecsInteractionBinding {
  nodeId: string;
  hover: boolean;
  gaze: boolean;
  select: boolean;
  drag: boolean;
}

type HandlerProps = {
  onHover?: (
    isHovering: boolean,
    position: [number, number, number],
    source: number
  ) => void;
  onGaze?: (
    isHovering: boolean,
    position: [number, number, number],
    source: number
  ) => void;
  onClick?: (position: [number, number, number], source: number) => void;
  onDrag?: (position: [number, number, number], source: number) => void;
};

export interface ViroSpecsAnimationBinding {
  nodeId: string;
  name?: string;
  run: boolean;
  loop?: boolean;
  delayMs?: number;
  onFinish?: () => void;
}

export interface ViroSpecsJSXCompilation {
  scene: ViroSpecsPortableSceneSnapshot;
  polylines: ViroSpecsPortablePolyline[];
  bindings: ViroSpecsInteractionBinding[];
  animations: ViroSpecsAnimationBinding[];
  diagnostics: string[];
  /**
   * Runtime-only callback table. This is intentionally excluded from
   * serializeViroSpecsCompilation().
   */
  handlers: Map<string, HandlerProps>;
}

export interface ViroSpecsJSXCompilerOptions {
  /**
   * Resolve React Native asset references into stable Lens Studio registry IDs.
   * Returning undefined leaves an asset diagnostic in the compilation.
   */
  resolveAssetId?: (
    source: unknown,
    context: { id: string; kind: "image" | "model" }
  ) => string | undefined;
  /**
   * Override deterministic node IDs. Useful when an app owns a canonical
   * scene/document ID space outside React keys/viroTag.
   */
  resolveNodeId?: (
    element: React.ReactElement<any>,
    context: { kind: ViroSpecsPortableNodeKind | "polyline"; index: number }
  ) => string | undefined;
}

function asVec3(value: unknown): [number, number, number] | undefined {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    value.slice(0, 3).some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    return undefined;
  }
  return [value[0], value[1], value[2]];
}

export function viroEulerDegreesToQuaternion(
  rotation: readonly [number, number, number]
): [number, number, number, number] {
  const halfX = (rotation[0] * Math.PI) / 360;
  const halfY = (rotation[1] * Math.PI) / 360;
  const halfZ = (rotation[2] * Math.PI) / 360;

  const sx = Math.sin(halfX);
  const cx = Math.cos(halfX);
  const sy = Math.sin(halfY);
  const cy = Math.cos(halfY);
  const sz = Math.sin(halfZ);
  const cz = Math.cos(halfZ);

  // Match VROQuaternion::set(float x, float y, float z) exactly. ViroCore's
  // composition order is part of observable Viro JSX semantics, so a generic
  // textbook XYZ quaternion formula is not interchangeable here.
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

function defaultAssetId(source: unknown): string | undefined {
  if (typeof source === "string") return source;
  if (typeof source === "number") return `react-native-asset:${source}`;

  const value = Array.isArray(source) ? source[0] : source;
  if (value && typeof value === "object") {
    const uri = (value as { uri?: unknown }).uri;
    if (typeof uri === "string" && uri.length > 0) return uri;
  }

  return undefined;
}

function sourceNumber(source: ViroSpecsPortableInteractionSource): number {
  return source === "gaze" ? ViroEventSource.EYE_GAZE : 0;
}

function safeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/^-+|-+$/g, "");
}

function propsFor(element: React.ReactElement<any>): Record<string, any> {
  return (element.props ?? {}) as Record<string, any>;
}

function componentKind(
  type: React.ElementType
): ViroSpecsPortableNodeKind | "polyline" | "scene" | null {
  if (type === ViroARScene || type === ViroScene) return "scene";
  if (type === ViroNode) return "group";
  if (type === ViroText) return "text";
  if (type === ViroImage) return "image";
  if (type === Viro3DObject) return "model";
  if (type === ViroPolyline) return "polyline";
  if (type === ViroFlexView || type === ViroSurface) return "panel";
  return null;
}

export function compileViroSpecsJSX(
  root: React.ReactNode,
  options: ViroSpecsJSXCompilerOptions = {}
): ViroSpecsJSXCompilation {
  const nodes: ViroSpecsPortableNode[] = [];
  const polylines: ViroSpecsPortablePolyline[] = [];
  const bindings: ViroSpecsInteractionBinding[] = [];
  const animations: ViroSpecsAnimationBinding[] = [];
  const diagnostics: string[] = [];
  const handlers = new Map<string, HandlerProps>();
  const usedIds = new Set<string>();
  let index = 0;

  const registerHandlers = (
    id: string,
    props: Record<string, any>
  ): void => {
    const handlerProps: HandlerProps = {
      onHover: props.onHover,
      onGaze: props.onGaze,
      onClick: props.onClick,
      onDrag: props.onDrag,
    };
    const binding: ViroSpecsInteractionBinding = {
      nodeId: id,
      hover: typeof props.onHover === "function",
      gaze: typeof props.onGaze === "function",
      select: typeof props.onClick === "function",
      drag: typeof props.onDrag === "function",
    };

    if (binding.hover || binding.gaze || binding.select || binding.drag) {
      bindings.push(binding);
      handlers.set(id, handlerProps);
    }
  };

  const claimId = (
    candidate: string,
    path: string
  ): string => {
    if (!usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }

    const suffix = safeIdPart(path) || String(index);
    let resolved = `${candidate}--${suffix}`;
    let collision = 2;
    while (usedIds.has(resolved)) {
      resolved = `${candidate}--${suffix}-${collision++}`;
    }

    usedIds.add(resolved);
    diagnostics.push(
      `Duplicate portable scene id "${candidate}" was disambiguated as "${resolved}".`
    );
    return resolved;
  };

  const visit = (
    value: React.ReactNode,
    parentId?: string,
    parentPath = "root"
  ): void => {
    React.Children.forEach(value, (child, childIndex) => {
      if (child == null || typeof child === "boolean") return;

      if (!React.isValidElement(child)) {
        diagnostics.push(
          `Ignored non-element Specs scene child of type ${typeof child}.`
        );
        return;
      }

      const element = child as React.ReactElement<any>;

      const childPath = `${parentPath}.${
        element.key != null ? String(element.key) : childIndex
      }`;

      if (element.type === React.Fragment) {
        visit(propsFor(element).children, parentId, childPath);
        return;
      }

      const kind = componentKind(element.type as React.ElementType);
      if (!kind) {
        const name =
          typeof element.type === "string"
            ? element.type
            : (element.type as any)?.displayName ??
              (element.type as any)?.name ??
              "AnonymousComponent";
        diagnostics.push(
          `Unsupported Viro Specs JSX component: ${name}. Resolve custom components before compilation.`
        );
        return;
      }

      if (kind === "scene") {
        visit(propsFor(element).children, parentId, childPath);
        return;
      }

      const props = propsFor(element);
      const currentIndex = index++;
      const resolverId = options.resolveNodeId?.(element, {
        kind,
        index: currentIndex,
      });
      const viroTag =
        typeof props.viroTag === "string" && props.viroTag.length > 0
          ? props.viroTag
          : undefined;
      const keyId =
        element.key != null
          ? `${parentPath}:${String(element.key)}`
          : undefined;
      const candidate = safeIdPart(
        resolverId ?? viroTag ?? keyId ?? `${kind}-${childPath}`
      );
      const id = claimId(candidate || `${kind}-${currentIndex}`, childPath);

      if (kind === "polyline") {
        const points = Array.isArray(props.points)
          ? (props.points
              .map(asVec3)
              .filter(Boolean) as [number, number, number][])
          : [];
        const position = asVec3(props.position);
        const euler = asVec3(props.rotation);
        const scale = asVec3(props.scale);

        if (points.length < 2) {
          diagnostics.push(
            `Polyline ${id} requires at least two finite points.`
          );
        } else {
          const material =
            typeof props.materials === "string"
              ? props.materials
              : Array.isArray(props.materials)
                ? props.materials[0]
                : undefined;
          polylines.push({
            id,
            ...(parentId ? { parentId } : {}),
            points,
            ...(position ? { position } : {}),
            ...(euler
              ? { rotation: viroEulerDegreesToQuaternion(euler) }
              : {}),
            ...(scale ? { scale } : {}),
            widthMeters:
              typeof props.thickness === "number" && props.thickness > 0
                ? props.thickness
                : 0.01,
            ...(typeof material === "string"
              ? { materialId: material }
              : {}),
          });
        }

        registerHandlers(id, props);
        return;
      }

      const position = asVec3(props.position);
      const euler = asVec3(props.rotation);
      const scale = asVec3(props.scale);

      const node: ViroSpecsPortableNode = {
        id,
        kind,
        ...(parentId ? { parentId } : {}),
        ...(position ? { position } : {}),
        ...(euler ? { rotation: viroEulerDegreesToQuaternion(euler) } : {}),
        ...(scale ? { scale } : {}),
        ...(typeof props.visible === "boolean" ? { visible: props.visible } : {}),
      };

      if (kind === "text") {
        node.text = typeof props.text === "string" ? props.text : String(props.text ?? "");
      }

      if (kind === "image" || kind === "model") {
        const resolver = options.resolveAssetId ?? ((source: unknown) => defaultAssetId(source));
        const source = resolver(props.source, { id, kind });
        if (source) {
          node.source = source;
        } else {
          diagnostics.push(
            `${kind} ${id} has no portable Specs asset ID. Provide resolveAssetId().`
          );
        }
      }

      nodes.push(node);

      if (props.animation && typeof props.animation === "object") {
        animations.push({
          nodeId: id,
          name:
            typeof props.animation.name === "string"
              ? props.animation.name
              : undefined,
          run: props.animation.run !== false,
          ...(typeof props.animation.loop === "boolean"
            ? { loop: props.animation.loop }
            : {}),
          ...(typeof props.animation.delay === "number"
            ? { delayMs: props.animation.delay }
            : {}),
          ...(typeof props.animation.onFinish === "function"
            ? { onFinish: props.animation.onFinish }
            : {}),
        });
      }

      registerHandlers(id, props);
      visit(props.children, id, childPath);
    });
  };

  visit(root);

  return {
    scene: { version: 1, nodes },
    polylines,
    bindings,
    animations,
    diagnostics,
    handlers,
  };
}

export function dispatchViroSpecsInteraction(
  compilation: ViroSpecsJSXCompilation,
  event: ViroSpecsPortableInteraction
): boolean {
  if (!event.targetId) return false;
  const handlers = compilation.handlers.get(event.targetId);
  if (!handlers) return false;

  const position = event.position ?? [0, 0, 0];
  const source = sourceNumber(event.source);

  switch (event.phase) {
    case "hover-enter":
      handlers.onHover?.(true, position, source);
      if (event.source === "gaze") handlers.onGaze?.(true, position, source);
      return true;
    case "hover-exit":
    case "cancel":
      handlers.onHover?.(false, position, source);
      if (event.source === "gaze") handlers.onGaze?.(false, position, source);
      return true;
    case "select-end":
      handlers.onClick?.(position, source);
      return true;
    case "drag":
      handlers.onDrag?.(position, source);
      return true;
    case "hover-move":
      handlers.onHover?.(true, position, source);
      if (event.source === "gaze") handlers.onGaze?.(true, position, source);
      return true;
    case "select-start":
      return true;
  }
}

export function serializeViroSpecsCompilation(
  compilation: ViroSpecsJSXCompilation
): string {
  return JSON.stringify(
    {
      version: 1,
      scene: compilation.scene,
      polylines: compilation.polylines,
      bindings: compilation.bindings,
      animations: compilation.animations.map(
        ({ onFinish: _onFinish, ...animation }) => animation
      ),
      diagnostics: compilation.diagnostics,
    },
    null,
    2
  );
}
