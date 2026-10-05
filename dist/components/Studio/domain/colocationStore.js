import { GlobalListeners } from "./utils";
const IDLE = { status: "idle" };
/** Calls that pass no owner, as a single writer would. */
const UNOWNED = {};
/**
 * The native pose channel is process-wide, so a device is in one shared session
 * at a time and this module singleton mirrors it. The navigator writes the
 * state; the indicator and useStudioColocation() read it wherever the host
 * renders them. The indicator's Done button reaches the running session
 * through the handler the navigator registers here.
 *
 * More than one navigator can be mounted (a screen pushed over another), so
 * each writes with its own owner token. The first to report a session owns the
 * store until it reports idle again or unmounts; meanwhile the others' writes
 * and resets are ignored, so unmounting one navigator never clears another's
 * live session.
 */
class StudioColocationStore {
    state = IDLE;
    failure = null;
    originPrompt = null;
    owner = null;
    finishScanHandlers = new Map();
    builtInIndicator = new Map();
    listeners = new GlobalListeners();
    getState() {
        return this.state;
    }
    subscribe(listener) {
        return this.listeners.subscribe(listener);
    }
    /**
     * The last session's failure, kept through the idle that follows it: a host
     * that clears its `colocation` prop on failure makes the state idle at once,
     * and the Quest HUD still has to say why. The next session's first state,
     * or clearFailure(), drops it.
     */
    getFailure() {
        return this.failure;
    }
    /** Ignored while another owner's session is reported. */
    set(state, owner = UNOWNED) {
        if (!this.writable(owner))
            return;
        this.owner = state.status === "idle" ? null : owner;
        if (this.state === state)
            return;
        this.state = state;
        if (state.status === "failed")
            this.failure = state;
        else if (state.status !== "idle")
            this.failure = null;
        this.listeners.notify();
    }
    /** A new session was asked for, whose first state comes only once the relay answers. */
    clearFailure(owner = UNOWNED) {
        if (!this.writable(owner) || this.failure === null)
            return;
        this.failure = null;
        this.listeners.notify();
    }
    getOriginPrompt() {
        return this.originPrompt;
    }
    setOriginPrompt(prompt, owner = UNOWNED) {
        if (!this.writable(owner) || this.originPrompt === prompt)
            return;
        this.originPrompt = prompt;
        this.listeners.notify();
    }
    /** The owning navigator's `colocationIndicator`, which the Quest HUD honours too. */
    isBuiltInIndicatorShown() {
        return this.builtInIndicator.get(this.owner ?? UNOWNED) ?? true;
    }
    setBuiltInIndicatorShown(shown, owner = UNOWNED) {
        const before = this.isBuiltInIndicatorShown();
        this.builtInIndicator.set(owner, shown);
        if (this.isBuiltInIndicatorShown() !== before)
            this.listeners.notify();
    }
    setFinishScanHandler(handler, owner = UNOWNED) {
        if (handler)
            this.finishScanHandlers.set(owner, handler);
        else
            this.finishScanHandlers.delete(owner);
    }
    /** The owning session's scan. False when none is scanning or it cannot finish yet. */
    finishScan() {
        return this.finishScanHandlers.get(this.owner ?? UNOWNED)?.() ?? false;
    }
    /**
     * A navigator unmounting: forgets its handler and indicator setting, and
     * forces idle when it owns the store (or nothing does), so a torn-down
     * session cannot leave the indicator showing. With no owner, resets all.
     */
    reset(owner) {
        if (owner === undefined) {
            this.finishScanHandlers.clear();
            this.builtInIndicator.clear();
        }
        else {
            this.finishScanHandlers.delete(owner);
            this.builtInIndicator.delete(owner);
            if (!this.writable(owner))
                return;
        }
        this.owner = null;
        if (this.state.status === "idle" && !this.originPrompt && !this.failure) {
            return;
        }
        this.state = IDLE;
        this.originPrompt = null;
        this.failure = null;
        this.listeners.notify();
    }
    writable(owner) {
        return this.owner === null || this.owner === owner;
    }
}
export const studioColocationStore = new StudioColocationStore();
