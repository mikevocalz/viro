import { GlobalListeners } from "./utils";
/**
 * Quest has no 2D overlay surface, so ALERT (and the TAKE_PHOTO failure
 * alert, which shares this path) can't show a native Alert.alert dialog the
 * way phones do. This module singleton is the single active message; the
 * ALERT dispatch arm in sceneNavigationHandler writes it, and
 * StudioQuestAlertOverlay subscribes to render it in-scene, head-locked.
 */
class QuestAlertStore {
    activeTitle = null;
    activeMessage = null;
    listeners = new GlobalListeners();
    isActive() {
        return this.activeMessage !== null;
    }
    title() {
        return this.activeTitle;
    }
    message() {
        return this.activeMessage;
    }
    subscribe(listener) {
        return this.listeners.subscribe(listener);
    }
    show(title, message) {
        this.activeTitle = title || null;
        this.activeMessage = message;
        this.listeners.notify();
    }
    dismiss() {
        if (this.activeMessage === null)
            return;
        this.activeTitle = null;
        this.activeMessage = null;
        this.listeners.notify();
    }
    /** Force idle so a torn-down scene can't wedge an alert on for the next one. */
    reset() {
        this.dismiss();
    }
}
export const questAlertStore = new QuestAlertStore();
