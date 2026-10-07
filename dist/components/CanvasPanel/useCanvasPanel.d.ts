import type { CanvasProducer, CanvasSurface } from "./nitroCanvas";
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
    /**
     * Material blend mode. Defaults to the bridge's Alpha, which composites
     * the surface's alpha against the scene behind — the see-through panel
     * look on headsets. "None" renders the texture fully opaque.
     */
    blendMode?: "None" | "Alpha" | "Add" | "Subtract" | "Multiply" | "Screen";
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
