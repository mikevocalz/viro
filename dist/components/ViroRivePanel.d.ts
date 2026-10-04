/** Native Rive panel. Its runtime owns the idle-aware frame clock. */
import * as React from "react";
import type { CanvasSurface, RiveProducer, RiveProducerInit, RiveCanvasOptions, RivePanel, CanvasInViroInputOptions } from "./CanvasPanel/nitroCanvas";
import { type ViroPanelSurfaceSnapshot } from "./CanvasPanel/engineSurfaceAdapter";
type Vec3 = [number, number, number];
export type ViroRiveBindingValue = string | number | boolean | {
    kind: "enum";
    value: string;
} | {
    kind: "color";
    value: number;
} | {
    kind: "trigger";
    serial: number;
};
export type ViroRiveBindings = Record<string, ViroRiveBindingValue>;
type ViroRivePanelCommonProps = {
    /**
     * Rive Data Binding values keyed by View Model property path.
     *
     * Primitive strings/numbers/booleans map directly. Enum/color bindings use
     * typed wrappers. Trigger bindings fire only when their serial changes.
     */
    bindings?: ViroRiveBindings;
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
    /** Backend-neutral surface metadata; never a native GPU pointer. */
    engineSurface: ViroPanelSurfaceSnapshot | null;
};
export declare const ViroRivePanel: React.ForwardRefExoticComponent<ViroRivePanelProps & React.RefAttributes<ViroRivePanelHandle>>;
export {};
