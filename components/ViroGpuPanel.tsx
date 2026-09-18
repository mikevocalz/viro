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
import { GpuProducer, type GpuProducerInit } from "nitro-canvas-in-Vision";
import {
  ViroCanvasPanel,
  type ViroCanvasPanelHandle,
  type ViroCanvasPanelSurfaceProps,
} from "./CanvasPanel/ViroCanvasPanel";

export type ViroGpuPanelProps = ViroCanvasPanelSurfaceProps & {
  init: GpuProducerInit;
};

export type ViroGpuPanelHandle = ViroCanvasPanelHandle<GpuProducer>;

export const ViroGpuPanel = React.forwardRef<ViroGpuPanelHandle, ViroGpuPanelProps>(
  function ViroGpuPanel({ init, ...surface }, ref) {
    return (
      <ViroCanvasPanel<GpuProducer>
        ref={ref}
        producerFactory={() => new GpuProducer(init)}
        {...surface}
      />
    );
  }
);
