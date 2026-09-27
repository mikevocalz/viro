import type { CanvasProducer, CanvasSurface } from "nitro-canvas-in-Vision";
export type CanvasPanelOpts<P extends CanvasProducer> = {
    resourceKey?: unknown;
    producerFactory: () => P;
    resolution: {
        width: number;
        height: number;
    };
    sRGB?: boolean;
    androidRoute?: "ahb" | "surface-texture";
    lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
    fallbackColor?: string;
    materialName?: string;
    /** Producer initialized; native Surface/frame readiness is exposed by the runtime. */
    onReady?: (state: CanvasPanelState<P>) => void;
    onError?: (error: Error) => void;
    /** JS producers tick at display cadence; native producers own their frame clock. */
    autoTick?: boolean;
};
export type CanvasPanelState<P extends CanvasProducer> = {
    surface: CanvasSurface;
    producer: P;
    materialName: string;
};
/** Allocate after commit, then render the quad only after its material exists. */
export declare function useCanvasPanel<P extends CanvasProducer>(opts: CanvasPanelOpts<P>): CanvasPanelState<P> | null;
