// Small shared helpers for the Studio runtime domain.
/** True only in a dev build; gates verbose runtime logging in the Studio stores. */
export const isDev = () => typeof __DEV__ !== "undefined" && __DEV__;
/** A set of subscribers notified together (variable + sound stores). */
export class GlobalListeners {
    listeners = new Set();
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    notify() {
        // Snapshot first: a listener may (un)subscribe during its own callback.
        [...this.listeners].forEach((fn) => fn());
    }
}
/** Subscribers partitioned by key; notify(key) wakes only that key's set
 * (the visibility store's per-asset variant). */
export class KeyedListeners {
    listeners = new Map();
    subscribe(key, listener) {
        let set = this.listeners.get(key);
        if (!set) {
            set = new Set();
            this.listeners.set(key, set);
        }
        set.add(listener);
        return () => {
            set?.delete(listener);
        };
    }
    notify(key) {
        // Snapshot first: a listener may (un)subscribe during its own callback.
        const set = this.listeners.get(key);
        if (set)
            [...set].forEach((fn) => fn());
    }
    notifyAll() {
        this.listeners.forEach((set) => [...set].forEach((fn) => fn()));
    }
}
export class ChangeListeners {
    listeners = new Set();
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    notify(key, origin) {
        [...this.listeners].forEach((fn) => fn(key, origin));
    }
}
