import { GlobalListeners } from "./utils";
const NO_ITEMS = [];
/**
 * The navigator's `questMenuItems`, for the menu in StudioQuestSceneHudOverlay.
 * The scene runs in VRActivity's React root, which the navigator's props never
 * reach, so they cross here. The latest navigator to write owns the items, and
 * an older one unmounting leaves them alone.
 */
class QuestMenuStore {
    items = NO_ITEMS;
    owner = null;
    listeners = new GlobalListeners();
    getItems() {
        return this.items;
    }
    subscribe(listener) {
        return this.listeners.subscribe(listener);
    }
    set(items, owner) {
        this.owner = owner;
        const next = items ?? NO_ITEMS;
        if (this.items === next)
            return;
        this.items = next;
        this.listeners.notify();
    }
    clear(owner) {
        if (this.owner !== owner)
            return;
        this.owner = null;
        if (this.items === NO_ITEMS)
            return;
        this.items = NO_ITEMS;
        this.listeners.notify();
    }
}
export const questMenuStore = new QuestMenuStore();
