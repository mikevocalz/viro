"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroRivePanel = void 0;
exports.bindingFingerprint = bindingFingerprint;
exports.applyBindings = applyBindings;
/** Native Rive panel. Its runtime owns the idle-aware frame clock. */
const React = __importStar(require("react"));
const nitroCanvas_1 = require("./CanvasPanel/nitroCanvas");
const ViroNode_1 = require("./ViroNode");
const ViroQuad_1 = require("./ViroQuad");
const useCanvasPanel_1 = require("./CanvasPanel/useCanvasPanel");
const engineSurfaceAdapter_1 = require("./CanvasPanel/engineSurfaceAdapter");
exports.ViroRivePanel = React.forwardRef(function ViroRivePanel(props, ref) {
    const { init, source, input, onRuntimeReady, width, height, position = [0, 1.45, -2.0], rotation, resolution = { width: 1024, height: 1024 }, sRGB, 
    // The native Rive renderer draws into the panel's producer Surface; the
    // zero-copy AHardwareBuffer route is for GPU producers, not Rive.
    androidRoute = "surface-texture", lightingModel, fallbackColor, materialName, onReady, onError, autoTick, bindings, } = props;
    const runtime = React.useRef(null);
    const latestBindings = React.useRef(bindings);
    latestBindings.current = bindings;
    const appliedBindings = React.useRef(new Map());
    React.useEffect(() => () => { runtime.current = null; }, [source, init]);
    const ready = React.useRef(onRuntimeReady);
    ready.current = onRuntimeReady;
    const state = (0, useCanvasPanel_1.useCanvasPanel)({
        resourceKey: source ?? init,
        producerFactory: () => {
            if ((source == null) === (init == null))
                throw new Error("Provide exactly one of source or init");
            return new ((0, nitroCanvas_1.requireNitroCanvas)().RiveProducer)(init ?? {
                createRuntime: async (surface) => {
                    const result = await (0, nitroCanvas_1.requireNitroCanvas)().createRiveCanvasRuntime(surface, source);
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
                    ? value.panel
                    : value;
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
        if (!runtime.current)
            return;
        applyBindings(runtime.current, bindings, appliedBindings.current);
    }, [bindings]);
    React.useImperativeHandle(ref, () => ({
        get runtime() { return state ? runtime.current : null; },
        surface: state?.surface ?? null,
        producer: state?.producer ?? null,
        materialName: state?.materialName ?? "",
        engineSurface: (0, engineSurfaceAdapter_1.describeCanvasSurface)(state?.surface, "rive"),
    }), [state]);
    if (!state)
        return null;
    return (<ViroNode_1.ViroNode position={position} rotation={rotation}>
      {input ? <InteractiveRiveQuad width={width} height={height} materialName={state.materialName} input={input} producer={state.producer} runtime={runtime} fit={source?.fit ?? "contain"} resolution={resolution}/>
            : <ViroQuad_1.ViroQuad width={width} height={height} materials={[state.materialName]}/>}
    </ViroNode_1.ViroNode>);
});
function InteractiveRiveQuad({ width, height, materialName, input, producer, runtime, fit, resolution }) {
    const sink = React.useRef(null);
    const pointer = React.useCallback((event) => {
        const panel = runtime.current;
        if (!panel)
            return;
        if (!sink.current || event.phase === "down")
            sink.current = (0, nitroCanvas_1.requireNitroCanvas)().artboardPointerSink({
                artboard: { width: panel.artboardWidth, height: panel.artboardHeight },
                surface: resolution, fit,
            }, ({ phase, x, y }) => producer.onPointer(phase, x, y));
        sink.current(event);
    }, [producer, fit, resolution.width, resolution.height]);
    const handlers = (0, nitroCanvas_1.requireNitroCanvas)().useCanvasInViroInput({
        ...input, size: { width, height }, onPointer: pointer,
    });
    // The input adapter requires a point on the panel plane, not its world AABB.
    return <ViroQuad_1.ViroQuad width={width} height={height} materials={[materialName]} {...handlers} highAccuracyEvents dragPlane={{ ...handlers.dragPlane, planePoint: [...handlers.dragPlane.planePoint],
            planeNormal: [...handlers.dragPlane.planeNormal] }}/>;
}
function bindingFingerprint(value) {
    if (typeof value === "object") {
        return value.kind + ":" + String(value.kind === "trigger" ? value.serial : value.value);
    }
    return typeof value + ":" + String(value);
}
function applyBindings(panel, bindings, applied) {
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
