/**
 * ViroThreeJSPanel
 *
 * three.js (regular `three`, WebGL2) panel — sibling of ViroGpuPanel.
 * Owns an expo-gl headless context, instantiates a `THREE.WebGLRenderer`
 * against it, hands it to the consumer's `setup` callback, and pumps the
 * frame loop. Pixels readback into the CanvasSurface (CPU path).
 *
 *   import * as THREE from 'three';
 *
 *   <ViroThreeJSPanel
 *     three={THREE}
 *     width={1.6}
 *     height={1.6}
 *     position={[0, 1.45, -2.2]}
 *     resolution={{ width: 1024, height: 1024 }}
 *     setup={({ renderer, width, height }) => {
 *       const scene = new THREE.Scene();
 *       const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 100);
 *       return { render(dt) { renderer.render(scene, camera); } };
 *     }}
 *   />
 *
 * ponytail: CPU readback ceiling lives in GLES3Producer. When perf bites,
 * the upgrade is native EGL/IOSurface binding — same JS API, faster path.
 */
import * as React from "react";
import { GLES3Producer, type GLES3ProducerInit } from "nitro-canvas-in-Vision";
import {
  ViroCanvasPanel,
  type ViroCanvasPanelHandle,
  type ViroCanvasPanelSurfaceProps,
} from "./CanvasPanel/ViroCanvasPanel";

export type ViroThreeJSPanelProps = ViroCanvasPanelSurfaceProps & {
  init: GLES3ProducerInit;
};

export type ViroThreeJSPanelHandle = ViroCanvasPanelHandle<GLES3Producer>;

export const ViroThreeJSPanel = React.forwardRef<ViroThreeJSPanelHandle, ViroThreeJSPanelProps>(
  function ViroThreeJSPanel({ init, ...surface }, ref) {
    return (
      <ViroCanvasPanel<GLES3Producer>
        ref={ref}
        producerFactory={() => new GLES3Producer(init)}
        {...surface}
      />
    );
  }
);
