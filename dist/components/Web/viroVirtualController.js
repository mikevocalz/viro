/**
 * viroVirtualController.ts
 *
 * Web-side controller-state registry for ViroVirtualJoystick / ViroVirtualButton.
 *
 * On native, these on-screen controls write into a process-wide
 * VROVirtualControllerRegistry read from C++ (a VROFrameListener peeks the
 * aggregated VROInputState). There is no such C++ registry on web, so this
 * module is the web equivalent: a JS registry that the overlay components write
 * to and that app code reads via the `useVirtualController` hook. Multiple input
 * sources targeting the same `controllerId` aggregate into one state, matching
 * the native semantics.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import { useEffect, useState } from "react";
const states = new Map();
const listeners = new Map();
function makeDefault() {
    return { left: { x: 0, y: 0 }, right: { x: 0, y: 0 }, buttons: {} };
}
function ensure(id) {
    let s = states.get(id);
    if (!s) {
        s = makeDefault();
        states.set(id, s);
    }
    return s;
}
function emit(id) {
    const subs = listeners.get(id);
    if (!subs)
        return;
    const snapshot = peek(id);
    subs.forEach((cb) => cb(snapshot));
}
/** Read-only snapshot of a controller's current aggregated state. */
export function peek(id) {
    const s = ensure(id);
    return {
        left: { ...s.left },
        right: { ...s.right },
        buttons: { ...s.buttons },
    };
}
/** Write a stick deflection (x/y in [-1, 1]) for one controller. */
export function setStick(id, side, x, y) {
    const s = ensure(id);
    s[side] = { x, y };
    emit(id);
}
/** Write a button press/release for one controller. */
export function setButton(id, name, pressed) {
    const s = ensure(id);
    if (pressed)
        s.buttons[name] = true;
    else
        delete s.buttons[name];
    emit(id);
}
/** Subscribe to a controller's state changes. Returns an unsubscribe fn. */
export function subscribe(id, cb) {
    let subs = listeners.get(id);
    if (!subs) {
        subs = new Set();
        listeners.set(id, subs);
    }
    subs.add(cb);
    return () => {
        subs.delete(cb);
    };
}
/**
 * React hook returning the live aggregated state of a virtual controller.
 * Re-renders whenever any input source (joystick, button, …) targeting the same
 * `controllerId` updates. This is the web read-path equivalent of native code
 * peeking VROVirtualControllerRegistry each frame.
 */
export function useVirtualController(id) {
    const [state, setState] = useState(() => peek(id));
    useEffect(() => {
        setState(peek(id));
        return subscribe(id, setState);
    }, [id]);
    return state;
}
