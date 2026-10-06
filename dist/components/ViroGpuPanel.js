/**
 * ViroGpuPanel
 *
 * The one panel for WebGPU-backed rendering: three.js (`three/webgpu`),
 * Skia (@next, Graphite backend), TypeGPU, raw WGSL, react-three-fiber —
 * all pick a renderer over the same `GPUCanvasContext`; the panel owns
 * the surface, the material binding, and the frame pump.
 *
 * (Rive in React Native ships native via `rive-react-native` and doesn't
 *  expose a JS `GPUCanvasContext`, so it lives outside this panel.)
 *
 * Pattern matches wcandillon/react-native-webgpu's Canvas but renders into
 * a Viro material instead of a screen view.
 *
 *   import * as ThreeWgpu from 'three/webgpu';
 *
 *   <ViroGpuPanel
 *     width={1.6} height={1.6}
 *     position={[0, 1.45, -2.2]}
 *     init={{
 *       importContext: async (surface) => {
 *         // wire react-native-wgpu / Dawn-imported context here
 *         return { context, present };
 *       },
 *       setup: ({ context, width, height }) => {
 *         // three.js — scene graph + GLTFLoader + post-FX
 *         const renderer = new ThreeWgpu.WebGPURenderer({ context });
 *         const scene = new ThreeWgpu.Scene();
 *         const camera = new ThreeWgpu.PerspectiveCamera(45, width/height, 0.1, 100);
 *         return { render(dt) { renderer.render(scene, camera); } };
 *
 *         // — OR — Skia (Graphite over the same context)
 *         // const sk = await Skia.MakeFromGPUContext(context, width, height);
 *         // return { render(dt) { draw(sk.getCanvas()); sk.flush(); } };
 *
 *         // — OR — TypeGPU / raw WGSL
 *         // const root = await tgpu.init(context.device);
 *         // return { render(dt) { root.execute(...); } };
 *       },
 *     }}
 *   />
 *
 * Pair with `useEnsureWgpuAdapter` in the expo-router root layout so every
 * mount finds an initialized WebGPU runtime.
 */
import * as React from "react";
import { requireNitroCanvas } from "./CanvasPanel/nitroCanvas";
import { ViroNode } from "./ViroNode";
import { ViroQuad } from "./ViroQuad";
import { useCanvasPanel } from "./CanvasPanel/useCanvasPanel";
import { describeCanvasSurface } from "./CanvasPanel/engineSurfaceAdapter";
export const ViroGpuPanel = React.forwardRef(function ViroGpuPanel(props, ref) {
    const { init, width, height, position = [0, 1.45, -2.0], rotation, resolution = { width: 1024, height: 1024 }, sRGB, androidRoute, lightingModel, fallbackColor, materialName, onReady, onError, autoTick, } = props;
    const state = useCanvasPanel({
        producerFactory: () => new (requireNitroCanvas().GLES3Producer)(init),
        resolution,
        sRGB,
        androidRoute,
        lightingModel,
        fallbackColor,
        materialName,
        onReady,
        onError,
        autoTick,
    });
    React.useImperativeHandle(ref, () => ({
        surface: state?.surface ?? null,
        producer: state?.producer ?? null,
        materialName: state?.materialName ?? "",
        engineSurface: describeCanvasSurface(state?.surface, "gpu"),
    }), [state]);
    if (!state)
        return null;
    return (<ViroNode position={position} rotation={rotation}>
      <ViroQuad width={width} height={height} materials={[state.materialName]}/>
    </ViroNode>);
});
