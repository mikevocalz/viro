import type { CanvasSurface } from "./nitroCanvas";

export type ViroPanelSurfaceKind = "gpu" | "rive" | "three";

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
export function describeCanvasSurface(
  surface: CanvasSurface | null | undefined,
  kind: ViroPanelSurfaceKind
): ViroPanelSurfaceSnapshot | null {
  if (!surface) return null;
  return {
    kind,
    surfaceId: surface.id,
    width: surface.width,
    height: surface.height,
    origin: "top-left",
    route: surface.route ?? "unspecified",
  };
}
