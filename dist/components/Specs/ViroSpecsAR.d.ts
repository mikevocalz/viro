export type ViroSpecsHitTestRequest = {
    origin: [number, number, number];
    direction: [number, number, number];
    maxDistance?: number;
    classifications?: readonly ("floor" | "wall" | "ceiling" | "table" | "seat" | "unknown")[];
};
export type ViroSpecsHitTestResult = {
    position: [number, number, number];
    normal?: [number, number, number];
    distance: number;
    surface: "floor" | "wall" | "ceiling" | "table" | "seat" | "unknown";
    confidence?: number;
};
export type ViroSpecsPlacementMode = "near-surface" | "horizontal" | "vertical";
export type ViroSpecsPlacementPose = {
    position: [number, number, number];
    rotation: [number, number, number, number];
    surface?: ViroSpecsHitTestResult["surface"];
};
export type ViroSpecsARRuntime = {
    hitTest(request: ViroSpecsHitTestRequest): Promise<readonly ViroSpecsHitTestResult[]>;
    startPlacement(mode: ViroSpecsPlacementMode, onPose: (pose: ViroSpecsPlacementPose) => void): () => void;
};
/**
 * Stable public facade over the Specs WorldQuery/surface-placement backend.
 * Apps can keep AR feature code platform-neutral and provide the concrete
 * runtime from @viro-external/specs.
 */
export declare function createViroSpecsARRuntime(runtime: ViroSpecsARRuntime): ViroSpecsARRuntime;
