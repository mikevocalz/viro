/** Native Rive panel. Its runtime owns the idle-aware frame clock. */
import * as React from "react";
import type { CanvasSurface, RiveProducer, RiveProducerInit, RiveCanvasOptions, RivePanel, CanvasInViroInputOptions } from "nitro-canvas-in-Vision";
type Vec3 = [number, number, number];
type ViroRivePanelCommonProps = {
    /** Current world transform and optional live ray. Grip movement belongs to the parent. */
    input?: Omit<CanvasInViroInputOptions, "size" | "onPointer">;
    /** The native file is loaded. Surface attachment and frames are available on this handle. */
    onRuntimeReady?: (panel: RivePanel) => void;
    width: number;
    height: number;
    position?: Vec3;
    rotation?: Vec3;
    resolution?: {
        width: number;
        height: number;
    };
    sRGB?: boolean;
    androidRoute?: "ahb" | "surface-texture";
    lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
    fallbackColor?: string;
    materialName?: string;
    onReady?: () => void;
    onError?: (error: Error) => void;
    autoTick?: boolean;
};
/** A native source or a custom adapter. Replacing either object reloads the producer. */
export type ViroRivePanelProps = ViroRivePanelCommonProps & ({
    source: RiveCanvasOptions;
    init?: never;
} | {
    init: RiveProducerInit;
    source?: never;
});
export type ViroRivePanelHandle = {
    surface: CanvasSurface | null;
    producer: RiveProducer | null;
    materialName: string;
    runtime: RivePanel | null;
};
export declare const ViroRivePanel: React.ForwardRefExoticComponent<ViroRivePanelProps & React.RefAttributes<ViroRivePanelHandle>>;
export {};
