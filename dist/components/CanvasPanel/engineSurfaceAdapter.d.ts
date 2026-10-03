import type { CanvasSurface } from "./nitroCanvas";
export type ViroPanelSurfaceKind = "rive";
export interface ViroPanelSurfaceSnapshot {
    kind: ViroPanelSurfaceKind;
    surfaceId: number;
    width: number;
    height: number;
    origin: "top-left";
    route: "ahb" | "surface-texture" | "unspecified";
}
/**
 * React-side snapshot of the generic renderer-surface concept.
 *
 * This intentionally does not expose native GPU pointers or reinterpret the
 * CanvasSurface id as the native VROEngineHandle. Native handle exchange stays
 * behind the bridge.
 */
export declare function describeCanvasSurface(surface: CanvasSurface | null | undefined, kind: ViroPanelSurfaceKind): ViroPanelSurfaceSnapshot | null;
