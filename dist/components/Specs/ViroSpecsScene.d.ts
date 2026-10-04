import * as React from "react";
import { type ViroSpecsAnimationEvent, type ViroSpecsAnimationPlan, type ViroSpecsInteractionEvent, type ViroSpecsPortablePolyline, type ViroSpecsSceneSnapshot, type ViroSpecsSourceResolver } from "./ViroSpecsCompiler";
export type ViroSpecsSceneTransport = {
    applyScene(scene: ViroSpecsSceneSnapshot): Promise<void> | void;
    presentPolyline?(polyline: ViroSpecsPortablePolyline): Promise<void> | void;
    clearPolylines?(): Promise<void> | void;
    playAnimation?(animation: Extract<ViroSpecsAnimationPlan, {
        action: "play";
    }>): Promise<void> | void;
    stopAnimation?(nodeId: string, name: string): Promise<void> | void;
    onInteraction?(listener: (event: ViroSpecsInteractionEvent) => void): () => void;
    onAnimationEvent?(listener: (event: ViroSpecsAnimationEvent) => void): () => void;
};
export type ViroSpecsSceneProps = {
    children?: React.ReactNode;
    transport: ViroSpecsSceneTransport;
    sourceResolver?: ViroSpecsSourceResolver;
    onDiagnostic?: (message: string) => void;
    renderNativeFallback?: boolean;
};
/**
 * Compiles familiar Viro JSX into the portable scene consumed by the validated
 * SPECS 27 Lens backend. Outside Specs it renders the same children without
 * evaluating Specs-only asset resolution.
 *
 * Use viroTag for stable cross-renderer node IDs.
 */
export declare function ViroSpecsScene({ children, transport, sourceResolver, onDiagnostic, renderNativeFallback, }: ViroSpecsSceneProps): React.ReactElement | null;
