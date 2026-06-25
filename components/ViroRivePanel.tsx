/**
 * ViroRivePanel
 *
 * The native Rive bridge. Sister panel to ViroGpuPanel — different runtime
 * (no GPUCanvasContext), same lifecycle. Consumers supply a Rive runtime
 * adapter that knows how to draw into the CanvasSurface's backing buffer
 * (AHardwareBuffer on Android, IOSurface on Apple).
 *
 *   <ViroRivePanel
 *     width={1.2} height={0.8}
 *     position={[0, 1.45, -2.0]}
 *     init={{
 *       createRuntime: async (surface) => {
 *         // attach a Rive runtime to the surface's backing buffer here
 *         return {
 *           advance(dt) { stateMachine.advance(dt) },
 *           draw()      { riveRenderer.draw(skSurface.getCanvas()) },
 *           release()   { riveRenderer.release() },
 *         };
 *       },
 *     }}
 *   />
 *
 * Note: the native shim that bridges @rive-app/react-native's runtime to a
 * Viro material is the missing piece — `@rive-app/react-native` ships a
 * `<RiveView>` for screen rendering but does not expose its renderer for
 * off-screen targeting today. Until that native bridge lands the producer
 * is dormant; the JS surface is here so plug-in is one render-runtime
 * change once it does.
 */
import * as React from "react";
import {
  CanvasSurface,
  RiveProducer,
  RiveProducerInit,
} from "nitro-canvas-in-Vision";
import { ViroNode } from "./ViroNode";
import { ViroQuad } from "./ViroQuad";
import { useCanvasPanel } from "./CanvasPanel/useCanvasPanel";

type Vec3 = [number, number, number];

export type ViroRivePanelProps = {
  init: RiveProducerInit;
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

export type ViroRivePanelHandle = {
  surface: CanvasSurface | null;
  producer: RiveProducer | null;
  materialName: string;
};

export const ViroRivePanel = React.forwardRef<
  ViroRivePanelHandle,
  ViroRivePanelProps
>(function ViroRivePanel(props, ref) {
  const {
    init,
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

  const state = useCanvasPanel<RiveProducer>({
    producerFactory: () => new RiveProducer(init),
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
      surface: state.surface,
      producer: state.producer,
      materialName: state.materialName,
    }),
    [state.surface, state.producer, state.materialName]
  );

  return (
    <ViroNode position={position} rotation={rotation}>
      <ViroQuad width={width} height={height} materials={[state.materialName]} />
    </ViroNode>
  );
});
