/** Native Rive panel. Its runtime owns the idle-aware frame clock. */
import * as React from "react";
import { requireNitroCanvas } from "./CanvasPanel/nitroCanvas";
import { ViroNode } from "./ViroNode";
import { ViroQuad } from "./ViroQuad";
import { useCanvasPanel } from "./CanvasPanel/useCanvasPanel";
import { describeCanvasSurface } from "./CanvasPanel/engineSurfaceAdapter";
export const ViroRivePanel = React.forwardRef(function ViroRivePanel(props, ref) {
    const { init, source, input, onRuntimeReady, width, height, position = [0, 1.45, -2.0], rotation, resolution = { width: 1024, height: 1024 }, sRGB, 
    // The native Rive renderer draws into the panel's producer Surface; the
    // zero-copy AHardwareBuffer route is for GPU producers, not Rive.
    androidRoute = "surface-texture", lightingModel, fallbackColor, materialName, blendMode, onReady, onError, autoTick, bindings, } = props;
    const runtime = React.useRef(null);
    const latestBindings = React.useRef(bindings);
    latestBindings.current = bindings;
    const appliedBindings = React.useRef(new Map());
    React.useEffect(() => () => { runtime.current = null; }, [source, init]);
    const ready = React.useRef(onRuntimeReady);
    ready.current = onRuntimeReady;
    const state = useCanvasPanel({
        resourceKey: source ?? init,
        producerFactory: () => {
            if ((source == null) === (init == null))
                throw new Error("Provide exactly one of source or init");
            return new (requireNitroCanvas().RiveProducer)(init ?? {
                createRuntime: async (surface) => {
                    const result = await requireNitroCanvas().createRiveCanvasRuntime(surface, source);
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
        blendMode,
        onReady: ({ producer }) => {
            const value = producer.runtime;
            runtime.current =
                value && typeof value === "object" && "panel" in value
                    ? value.panel
                    : value;
            // A fresh runtime has none of the previous runtime's inputs; the
            // fingerprint map must not carry over or unchanged bindings are skipped.
            appliedBindings.current.clear();
            if (runtime.current) {
                // A newly mounted native runtime has its own binding state. Never
                // reuse fingerprints from the previous artboard/runtime instance.
                appliedBindings.current.clear();
                applyBindings(runtime.current, latestBindings.current, appliedBindings.current);
                ready.current?.(runtime.current);
            }
            onReady?.();
        },
        onError,
        autoTick,
    });
    React.useEffect(() => {
        if (!runtime.current)
            return;
        applyBindings(runtime.current, bindings, appliedBindings.current);
    }, [bindings]);
    React.useImperativeHandle(ref, () => ({
        get runtime() { return state ? runtime.current : null; },
        surface: state?.surface ?? null,
        producer: state?.producer ?? null,
        materialName: state?.materialName ?? "",
        engineSurface: describeCanvasSurface(state?.surface, "rive"),
    }), [state]);
    if (!state)
        return null;
    return (<ViroNode position={position} rotation={rotation}>
      {input ? <InteractiveRiveQuad width={width} height={height} materialName={state.materialName} input={input} producer={state.producer} runtime={runtime} fit={source?.fit ?? "contain"} resolution={resolution}/>
            : <ViroQuad width={width} height={height} materials={[state.materialName]}/>}
    </ViroNode>);
});
function InteractiveRiveQuad({ width, height, materialName, input, producer, runtime, fit, resolution }) {
    const sink = React.useRef(null);
    const pointer = React.useCallback((event) => {
        const panel = runtime.current;
        if (!panel)
            return;
        if (!sink.current || event.phase === "down")
            sink.current = requireNitroCanvas().artboardPointerSink({
                artboard: { width: panel.artboardWidth, height: panel.artboardHeight },
                surface: resolution, fit,
            }, ({ phase, x, y }) => producer.onPointer(phase, x, y));
        sink.current(event);
    }, [producer, fit, resolution.width, resolution.height]);
    const handlers = requireNitroCanvas().useCanvasInViroInput({
        ...input, size: { width, height }, onPointer: pointer,
    });
    // The input adapter requires a point on the panel plane, not its world AABB.
    return <ViroQuad width={width} height={height} materials={[materialName]} {...handlers} highAccuracyEvents dragPlane={{ ...handlers.dragPlane, planePoint: [...handlers.dragPlane.planePoint],
            planeNormal: [...handlers.dragPlane.planeNormal] }}/>;
}
export function bindingFingerprint(value) {
    if (typeof value === "object") {
        return value.kind + ":" + String(value.kind === "trigger" ? value.serial : value.value);
    }
    return typeof value + ":" + String(value);
}
export function applyBindings(panel, bindings, applied) {
    if (!bindings)
        return;
    for (const [path, value] of Object.entries(bindings)) {
        const fingerprint = bindingFingerprint(value);
        if (applied.get(path) === fingerprint)
            continue;
        if (typeof value === "string") {
            panel.setString?.(path, value);
        }
        else if (typeof value === "number") {
            panel.setNumber?.(path, value);
        }
        else if (typeof value === "boolean") {
            panel.setBoolean?.(path, value);
        }
        else if (value.kind === "enum") {
            panel.setEnum?.(path, value.value);
        }
        else if (value.kind === "color") {
            panel.setColor?.(path, value.value);
        }
        else if (value.kind === "trigger") {
            panel.fireTrigger?.(path);
        }
        applied.set(path, fingerprint);
    }
}
