import { canonicalizeCollisionAssetIds, collisionPairKey } from "./collisionPairKey";
import { executeFunctionWithRelations, } from "./sceneNavigationHandler";
const DEFAULT_COOLDOWN_MS = 750;
function pairCooldownKey(pairKey, functionId) {
    return `${pairKey}::${functionId}`;
}
/**
 * Dispatches scene functions for collision bindings matching the canonical pair.
 * Cooldown prevents per-frame spam while physics contacts overlap.
 */
export function dispatchCollisionBindingActions(params) {
    const { selfPlacementId, otherTag, bindingsByPairKey, sceneNavigator, animations, onSceneChange, onAnimationTrigger, cooldownMs = DEFAULT_COOLDOWN_MS, lastFiredRef, runtimeCtx, canDispatch, } = params;
    if (!otherTag)
        return;
    if (canDispatch && !canDispatch())
        return;
    const { asset_x_id, asset_y_id } = canonicalizeCollisionAssetIds(selfPlacementId, otherTag);
    const pKey = collisionPairKey(asset_x_id, asset_y_id);
    const rows = bindingsByPairKey.get(pKey);
    if (!rows?.length)
        return;
    const now = Date.now();
    const map = lastFiredRef.current;
    for (const row of rows) {
        const fn = row.scene_function;
        if (!fn)
            continue;
        const ck = pairCooldownKey(pKey, row.function_id);
        const last = map.get(ck) ?? 0;
        if (now - last < cooldownMs)
            continue;
        map.set(ck, now);
        executeFunctionWithRelations(fn, sceneNavigator, animations, onAnimationTrigger, 0, onSceneChange, runtimeCtx);
    }
}
/**
 * Returns an onCollision handler for a given placement asset ID.
 */
export function createPlacementCollisionHandler(placementId, bindingsByPairKey, sceneNavigator, animations, lastFiredRef, onAnimationTrigger, onSceneChange, runtimeCtx, canDispatch) {
    return (viroTag) => {
        dispatchCollisionBindingActions({
            selfPlacementId: placementId,
            otherTag: viroTag,
            bindingsByPairKey,
            sceneNavigator,
            animations,
            onSceneChange,
            onAnimationTrigger,
            lastFiredRef,
            runtimeCtx,
            canDispatch,
        });
    };
}
