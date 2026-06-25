import { CanvasProducer, CanvasSurface } from "nitro-canvas-in-Vision";
/**
 * Common lifecycle for every Viro "canvas panel" (ViroThreeJSPanel,
 * ViroWgpuPanel, ViroSkiaPanel, ViroRivePanel, ...): allocate a
 * CanvasSurface, register a Viro material that samples it, attach the
 * producer, drive a microtask render loop while mounted, and dispose
 * idempotently on unmount.
 *
 * The only thing each panel kind has to provide is a producer factory
 * — everything else is shared here.
 */
export type CanvasPanelOpts<P extends CanvasProducer> = {
    /** Allocates the producer. Called once per surface identity. */
    producerFactory: () => P;
    /** Pixel resolution of the underlying CanvasSurface. */
    resolution: {
        width: number;
        height: number;
    };
    /** sRGB output. */
    sRGB?: boolean;
    /** Android-side import route. */
    androidRoute?: "ahb" | "surface-texture";
    /** Material lighting model. */
    lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
    /** Optional fallback color shown until the first frame lands. */
    fallbackColor?: string;
    /** Material name override; auto-derived from surface id otherwise. */
    materialName?: string;
    /** Fired after the producer attaches and the first frame is queued. */
    onReady?: () => void;
    /** Fired if `producer.attach()` throws. The panel does not retry. */
    onError?: (error: Error) => void;
    /**
     * If true (default), the panel pumps the producer on every microtask.
     * Set false if your scene drives a shared clock and you'll call
     * `producer.renderFrame()` yourself.
     */
    autoTick?: boolean;
};
export type CanvasPanelState<P extends CanvasProducer> = {
    surface: CanvasSurface;
    producer: P;
    materialName: string;
};
export declare function useCanvasPanel<P extends CanvasProducer>(opts: CanvasPanelOpts<P>): CanvasPanelState<P>;
