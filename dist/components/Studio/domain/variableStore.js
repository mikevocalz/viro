import { valueMatchesType, } from "./expressionEvaluator";
import { ChangeListeners, GlobalListeners, isDev, } from "./utils";
/**
 * Per-session variable store. One instance is owned by the navigator and
 * survives scene pushes; it resets only when the AR/VR session ends.
 *
 * Identity is by NAME: scenes declaring the same name share one value, and
 * seed() only initialises names not already present (initialize-if-absent),
 * so values carry across scene transitions.
 */
export class StudioVariableStore {
    values = new Map();
    listeners = new GlobalListeners();
    changes = new ChangeListeners();
    get(name) {
        return this.values.get(name);
    }
    /** Subscribe to value changes (set/reset); returns an unsubscribe fn. */
    subscribe(listener) {
        return this.listeners.subscribe(listener);
    }
    /** Each change with the variable's name (null after reset) and its origin. */
    subscribeChanges(listener) {
        return this.changes.subscribe(listener);
    }
    set(name, value, origin = "local") {
        // Values are primitives; skip the no-op write so unchanged values don't
        // log or wake subscribers.
        if (Object.is(this.values.get(name), value))
            return;
        this.values.set(name, value);
        if (isDev()) {
            console.log(`[Studio] Variable "${name}" =`, value);
        }
        this.listeners.notify();
        this.changes.notify(name, origin);
    }
    seed(declarations) {
        for (const decl of declarations) {
            if (!decl?.name)
                continue;
            if (!valueMatchesType(decl.initial_value, decl.type)) {
                console.warn(`[Studio] Variable "${decl.name}": initial value does not match type ${decl.type}; skipping seed.`);
                continue;
            }
            const existing = this.values.get(decl.name);
            if (existing !== undefined) {
                if (!valueMatchesType(existing, decl.type)) {
                    console.warn(`[Studio] Variable "${decl.name}" already holds a ${typeof existing} this session, but this scene declares ${decl.type}; keeping the existing value.`);
                }
                continue;
            }
            this.values.set(decl.name, decl.initial_value);
        }
    }
    reset() {
        this.values.clear();
        this.listeners.notify();
        this.changes.notify(null, "local");
    }
    snapshot() {
        const out = {};
        this.values.forEach((value, name) => {
            out[name] = value;
        });
        return out;
    }
}
