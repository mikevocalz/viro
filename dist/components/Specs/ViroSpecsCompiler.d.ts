import * as React from "react";
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
export type ViroSpecsPortableNode = {
    id: string;
    kind: "group" | "text" | "image" | "model" | "panel";
    parentId?: string;
    position?: Vec3;
    rotation?: Quat;
    scale?: Vec3;
    source?: string;
    text?: string;
    visible?: boolean;
};
export type ViroSpecsPortablePolyline = {
    id: string;
    points: readonly Vec3[];
    radiusMeters: number;
    materialId?: string;
};
export type ViroSpecsInteractionEvent = {
    source: string;
    phase: "hover-enter" | "hover-move" | "hover-exit" | "select-start" | "select-end" | "drag" | "cancel";
    targetId?: string;
    position?: Vec3;
    direction?: Vec3;
    timestampMs?: number;
};
export type ViroSpecsAnimationEvent = {
    nodeId: string;
    name: string;
    phase: "start" | "finish";
    completionEvent?: string;
};
export type ViroSpecsSceneSnapshot = {
    version: 1;
    nodes: ViroSpecsPortableNode[];
};
export type ViroSpecsSourceResolver = (source: unknown, kind: "image" | "model") => string;
export type ViroSpecsAnimationPlan = {
    action: "play";
    nodeId: string;
    name: string;
    definition: {
        properties: Record<string, number>;
        durationMs: number;
        delayMs?: number;
        easing?: string;
        loop?: boolean;
        completionEvent?: string;
    };
} | {
    action: "stop";
    nodeId: string;
    name: string;
};
export type ViroSpecsCompiledScene = {
    scene: ViroSpecsSceneSnapshot;
    polylines: ViroSpecsPortablePolyline[];
    animations: ViroSpecsAnimationPlan[];
    callbacks: Map<string, ViroSpecsCallbackRecord>;
    diagnostics: string[];
};
export type ViroSpecsCallbackRecord = {
    onHover?: (isHovering: boolean, position: Vec3, source: number) => void;
    onClick?: (position: Vec3, source: number) => void;
    onDrag?: (position: Vec3, source: number) => void;
    onAnimationStart?: () => void;
    onAnimationFinish?: () => void;
};
export declare function compileViroSpecsChildren(children: React.ReactNode, sourceResolver?: ViroSpecsSourceResolver): ViroSpecsCompiledScene;
export declare function dispatchViroSpecsInteraction(event: ViroSpecsInteractionEvent, callbacks: ReadonlyMap<string, ViroSpecsCallbackRecord>): void;
export declare function dispatchViroSpecsAnimationEvent(event: ViroSpecsAnimationEvent, callbacks: ReadonlyMap<string, ViroSpecsCallbackRecord>): void;
export {};
