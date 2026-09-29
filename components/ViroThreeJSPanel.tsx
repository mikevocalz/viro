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
import type { CanvasSurface, GLES3Producer, GLES3ProducerInit } from "./CanvasPanel/nitroCanvas";
import { requireNitroCanvas } from "./CanvasPanel/nitroCanvas";
import { ViroNode } from "./ViroNode";
import { ViroQuad } from "./ViroQuad";
import { useCanvasPanel } from "./CanvasPanel/useCanvasPanel";

type Vec3 = [number, number, number];

export type ViroThreeJSPanelProps = {
  /** `import * as THREE from 'three'`. */
  three: GLES3ProducerInit["three"];
  /** Build the scene + return the per-frame render callback. */
  setup: GLES3ProducerInit["setup"];

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

export type ViroThreeJSPanelHandle = {
  surface: CanvasSurface | null;
  producer: GLES3Producer | null;
  materialName: string;
};

export const ViroThreeJSPanel = React.forwardRef<
  ViroThreeJSPanelHandle,
  ViroThreeJSPanelProps
>(function ViroThreeJSPanel(props, ref) {
  const {
    three,
    setup,
    width,
    height,
    position = [0, 1.45, -2.0],
    rotation,
    resolution = { width: 1024, height: 1024 },
    sRGB,
    androidRoute,
    lightingModel,
    fallbackColor,
    materialName,
    onReady,
    onError,
    autoTick,
  } = props;

  // ponytail: init is captured on first mount; changing `three` or `setup`
  // mid-life requires remount. Standard for renderer-owning components.
  const initRef = React.useRef<GLES3ProducerInit>({ three, setup });

  const state = useCanvasPanel<GLES3Producer>({
    producerFactory: () => new (requireNitroCanvas().GLES3Producer)(initRef.current),
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

  React.useImperativeHandle(
    ref,
    () => ({
      surface: state?.surface ?? null,
      producer: state?.producer ?? null,
      materialName: state?.materialName ?? "",
    }),
    [state]
  );

  if (!state) return null;

  return (
    <ViroNode position={position} rotation={rotation}>
      <ViroQuad width={width} height={height} materials={[state.materialName]} />
    </ViroNode>
  );
});
