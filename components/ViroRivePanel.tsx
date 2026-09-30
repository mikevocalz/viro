/** Native Rive panel. Its runtime owns the idle-aware frame clock. */
import * as React from "react";
import { Platform } from "react-native";
import type { CanvasSurface, RiveProducer, RiveProducerInit, RiveCanvasOptions, RivePanel, CanvasInViroInputOptions, CanvasInViroInputProps } from "./CanvasPanel/nitroCanvas";
import { requireNitroCanvas } from "./CanvasPanel/nitroCanvas";
import { ViroNode } from "./ViroNode";
import { ViroQuad } from "./ViroQuad";
import { useCanvasPanel } from "./CanvasPanel/useCanvasPanel";

type Vec3 = [number, number, number];

export type ViroRiveBindingValue =
  | string
  | number
  | boolean
  | { kind: "enum"; value: string }
  | { kind: "color"; value: number }
  | { kind: "trigger"; serial: number };

export type ViroRiveBindings = Record<string, ViroRiveBindingValue>;

type ViroRivePanelCommonProps = {
  /**
   * Rive Data Binding values keyed by View Model property path.
   *
   * Primitive strings/numbers/booleans map directly. Enum/color bindings use
   * typed wrappers. Trigger bindings fire only when their serial changes.
   */
  bindings?: ViroRiveBindings;
  /** Current world transform and optional live ray. Grip movement belongs to the parent. */
  input?: Omit<CanvasInViroInputOptions, "size" | "onPointer">;
  /** The native file is loaded. Surface attachment and frames are available on this handle. */
  onRuntimeReady?: (panel: RivePanel) => void;
  width: number;
  height: number;
  position?: Vec3;
  rotation?: Vec3;
  resolution?: { width: number; height: number };
  sRGB?: boolean;
  androidRoute?: "ahb" | "surface-texture";
  lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
  fallbackColor?: string;
  materialName?: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  autoTick?: boolean;
};

/** A native source or a custom adapter. Replacing either object reloads the producer. */
export type ViroRivePanelProps = ViroRivePanelCommonProps & (
  | { source: RiveCanvasOptions; init?: never }
  | { init: RiveProducerInit; source?: never }
);

export type ViroRivePanelHandle = {
  surface: CanvasSurface | null;
  producer: RiveProducer | null;
  materialName: string;
  runtime: RivePanel | null;
};

export const ViroRivePanel = React.forwardRef<
  ViroRivePanelHandle,
  ViroRivePanelProps
>(function ViroRivePanel(props, ref) {
  const {
    init,
    source,
    input,
    onRuntimeReady,
    width,
    height,
    position = [0, 1.45, -2.0],
    rotation,
    resolution = { width: 1024, height: 1024 },
    sRGB,
    androidRoute = Platform.OS === "android" ? "ahb" : "surface-texture",
    lightingModel,
    fallbackColor,
    materialName,
    onReady,
    onError,
    autoTick,
    bindings,
  } = props;

  const runtime = React.useRef<RivePanel | null>(null);
  const latestBindings = React.useRef<ViroRiveBindings | undefined>(bindings);
  latestBindings.current = bindings;
  const appliedBindings = React.useRef(new Map<string, string>());
  React.useEffect(() => () => { runtime.current = null; }, [source, init]);
  const ready = React.useRef(onRuntimeReady);
  ready.current = onRuntimeReady;
  const state = useCanvasPanel<RiveProducer>({
    resourceKey: source ?? init,
    producerFactory: () => {
      if ((source == null) === (init == null)) throw new Error("Provide exactly one of source or init");
      return new (requireNitroCanvas().RiveProducer)(init ?? {
        createRuntime: async (surface) => {
          const result = await requireNitroCanvas().createRiveCanvasRuntime(surface, source!);
          return result;
        },
      });
    },
    resolution,
    sRGB,
    androidRoute,
    lightingModel,
    fallbackColor,
    materialName,
    onReady: ({ producer }) => {
      const value = producer.runtime;
      runtime.current =
        value && typeof value === "object" && "panel" in value
          ? (value.panel as RivePanel)
          : (value as RivePanel | null);
      if (runtime.current) {
        applyBindings(runtime.current, latestBindings.current, appliedBindings.current);
        ready.current?.(runtime.current);
      }
      onReady?.();
    },
    onError,
    autoTick,
  });

  React.useEffect(() => {
    if (!runtime.current) return;
    applyBindings(runtime.current, bindings, appliedBindings.current);
  }, [bindings]);

  React.useImperativeHandle(
    ref,
    () => ({
      get runtime() { return state ? runtime.current : null; },
      surface: state?.surface ?? null,
      producer: state?.producer ?? null,
      materialName: state?.materialName ?? "",
    }),
    [state]
  );

  if (!state) return null;

  return (
    <ViroNode position={position} rotation={rotation}>
      {input ? <InteractiveRiveQuad width={width} height={height}
        materialName={state.materialName} input={input} producer={state.producer}
        runtime={runtime} fit={source?.fit ?? "contain"} resolution={resolution} />
        : <ViroQuad width={width} height={height} materials={[state.materialName]} />}
    </ViroNode>
  );
});


function InteractiveRiveQuad({ width, height, materialName, input, producer, runtime, fit, resolution }: {
  width: number; height: number; materialName: string;
  input: NonNullable<ViroRivePanelProps["input"]>;
  producer: RiveProducer; runtime: React.RefObject<RivePanel | null>;
  fit: "contain" | "cover" | "fill"; resolution: { width: number; height: number };
}) {
  const sink = React.useRef<ReturnType<ReturnType<typeof requireNitroCanvas>["artboardPointerSink"]> | null>(null);
  const pointer = React.useCallback((event: Parameters<NonNullable<typeof sink.current>>[0]) => {
    const panel = runtime.current;
    if (!panel) return;
    if (!sink.current || event.phase === "down") sink.current = requireNitroCanvas().artboardPointerSink({
      artboard: { width: panel.artboardWidth, height: panel.artboardHeight },
      surface: resolution, fit,
    }, ({ phase, x, y }) => producer.onPointer(phase, x, y));
    sink.current(event);
  }, [producer, fit, resolution.width, resolution.height]);
  const handlers: CanvasInViroInputProps = requireNitroCanvas().useCanvasInViroInput({
    ...input, size: { width, height }, onPointer: pointer,
  });
  // The input adapter requires a point on the panel plane, not its world AABB.
  return <ViroQuad width={width} height={height} materials={[materialName]} {...handlers}
    highAccuracyEvents
    dragPlane={{ ...handlers.dragPlane, planePoint: [...handlers.dragPlane.planePoint],
      planeNormal: [...handlers.dragPlane.planeNormal] }} />;
}


function bindingFingerprint(value: ViroRiveBindingValue): string {
  if (typeof value === "object") {
    return value.kind + ":" + String(value.kind === "trigger" ? value.serial : value.value);
  }
  return typeof value + ":" + String(value);
}

function applyBindings(
  panel: RivePanel,
  bindings: ViroRiveBindings | undefined,
  applied: Map<string, string>
) {
  if (!bindings) return;

  for (const [path, value] of Object.entries(bindings)) {
    const fingerprint = bindingFingerprint(value);
    if (applied.get(path) === fingerprint) continue;

    if (typeof value === "string") {
      panel.setString?.(path, value);
    } else if (typeof value === "number") {
      panel.setNumber?.(path, value);
    } else if (typeof value === "boolean") {
      panel.setBoolean?.(path, value);
    } else if (value.kind === "enum") {
      panel.setEnum?.(path, value.value);
    } else if (value.kind === "color") {
      panel.setColor?.(path, value.value);
    } else if (value.kind === "trigger") {
      panel.fireTrigger?.(path);
    }

    applied.set(path, fingerprint);
  }
}
