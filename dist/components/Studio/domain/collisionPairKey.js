/**
 * Canonical collision pair — matches DB constraint where asset_x_id < asset_y_id lexicographically.
 */
export function canonicalizeCollisionAssetIds(a, b) {
    return a < b
        ? { asset_x_id: a, asset_y_id: b }
        : { asset_x_id: b, asset_y_id: a };
}
export function collisionPairKey(assetX, assetY) {
    return `${assetX}|${assetY}`;
}
