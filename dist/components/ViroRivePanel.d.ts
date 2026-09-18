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
import { RiveProducer, type RiveProducerInit } from "nitro-canvas-in-Vision";
import { type ViroCanvasPanelHandle, type ViroCanvasPanelSurfaceProps } from "./CanvasPanel/ViroCanvasPanel";
export type ViroRivePanelProps = ViroCanvasPanelSurfaceProps & {
    init: RiveProducerInit;
};
export type ViroRivePanelHandle = ViroCanvasPanelHandle<RiveProducer>;
export declare const ViroRivePanel: React.ForwardRefExoticComponent<ViroCanvasPanelSurfaceProps & {
    init: RiveProducerInit;
} & React.RefAttributes<ViroRivePanelHandle>>;
