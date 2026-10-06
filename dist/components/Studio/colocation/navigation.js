import { ChangeListeners, } from "../domain/utils";
export const STUDIO_COLOCATION_CURRENT_SCENE_ENTITY = "scene:current";
/**
 * This device's copy of `scene:current`, for one session. A local set is this
 * device navigating and is written to the room; a remote one is the room
 * navigating and reaches `onRemote`, which follows it.
 */
export class StudioRoomSceneStore {
    value;
    onRemote;
    changes = new ChangeListeners();
    constructor(value, onRemote) {
        this.value = value;
        this.onRemote = onRemote;
    }
    get() {
        return this.value;
    }
    set(next, origin = "local") {
        const prev = this.value;
        if (prev.sceneId === next.sceneId && prev.n === next.n)
            return;
        this.value = next;
        this.changes.notify("", origin);
        if (origin === "remote")
            this.onRemote(next, prev);
    }
    /** The one key is "". */
    subscribeChanges(listener) {
        return this.changes.subscribe(listener);
    }
}
/**
 * Whether a device whose copy was `prev` has to change scenes for `next`. A
 * joiner already on the room's scene stays, whatever the room's count says.
 */
export function roomSceneNeedsNavigation(prev, next) {
    if (prev.sceneId !== next.sceneId)
        return true;
    return prev.n !== null && prev.n !== next.n;
}
