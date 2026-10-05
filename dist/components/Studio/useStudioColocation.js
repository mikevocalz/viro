import { useSyncExternalStore } from "react";
import { studioColocationStore } from "./domain/colocationStore";
const IDLE = { status: "idle" };
const subscribe = (onChange) => studioColocationStore.subscribe(onChange);
/**
 * Subscribe to the shared session StudioSceneNavigator is running (its
 * `colocation` prop). Hosts build their own co-location UI with this, or render
 * <StudioColocationIndicator /> in their own chrome. The server snapshot is idle:
 * see the note in useStudioPlacement.
 */
export function useStudioColocation() {
    return useSyncExternalStore(subscribe, () => studioColocationStore.getState(), () => IDLE);
}
