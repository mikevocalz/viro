/**
 * React-side snapshot of the generic renderer-surface concept.
 *
 * This intentionally does not expose native GPU pointers or reinterpret the
 * CanvasSurface id as the native VROEngineHandle. Native handle exchange stays
 * behind the bridge.
 */
export function describeCanvasSurface(surface, kind) {
    if (!surface)
        return null;
    return {
        kind,
        surfaceId: surface.id,
        width: surface.width,
        height: surface.height,
        origin: "top-left",
        route: surface.route ?? "unspecified",
    };
}
