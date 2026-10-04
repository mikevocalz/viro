"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installExtendedWebInput = installExtendedWebInput;
exports.uninstallExtendedWebInput = uninstallExtendedWebInput;
exports.missingWebInput = missingWebInput;
exports.warnIfWebInputUnavailable = warnIfWebInputUnavailable;
exports.configureWebDrag = configureWebDrag;
const installed = new WeakMap();
function distance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
/**
 * Adds the event actions the published web renderer does not yet understand:
 * Viro OnDrag (8) and OnPinch (10).
 *
 * The WASM binary remains feature-detected so a JS bundle can still load
 * against an older renderer; those two capabilities simply stay unavailable.
 */
function installExtendedWebInput(renderer) {
    const existing = installed.get(renderer);
    if (existing)
        return existing;
    const handlers = new Map();
    const cleanups = [];
    const state = {
        handlers,
        detach: () => {
            for (const cleanup of cleanups.splice(0))
                cleanup();
        },
    };
    installed.set(renderer, state);
    const module = renderer.wasmModule;
    const ownSet = Object.getOwnPropertyDescriptor(renderer, "setNodeEventHandlers");
    const ownClear = Object.getOwnPropertyDescriptor(renderer, "clearNodeEventHandlers");
    const originalSet = renderer.setNodeEventHandlers.bind(renderer);
    const originalClear = renderer.clearNodeEventHandlers.bind(renderer);
    // Keep the renderer's public registration methods useful after replacing the
    // WASM callback. React-Viro and direct renderer users both flow into this map.
    renderer.setNodeEventHandlers = ((handle, next) => {
        handlers.set(handle, next);
        originalSet(handle, next);
    });
    renderer.clearNodeEventHandlers = ((handle) => {
        handlers.delete(handle);
        originalClear(handle);
    });
    cleanups.push(() => {
        // Put back exactly what was there: the class methods live on the
        // prototype, so usually that means deleting the shadowing own property.
        const target = renderer;
        if (ownSet)
            Object.defineProperty(renderer, "setNodeEventHandlers", ownSet);
        else
            delete target.setNodeEventHandlers;
        if (ownClear)
            Object.defineProperty(renderer, "clearNodeEventHandlers", ownClear);
        else
            delete target.clearNodeEventHandlers;
        handlers.clear();
    });
    // Nodes that registered before this install went only into the renderer's
    // own map. Replacing the WASM callback below would silently drop their click
    // and hover events, so fall back to that map for any handle missing here.
    const rendererHandlers = renderer.eventHandlers;
    module.viroSetEventCallback?.((handle, action, source, intArg, x, y, z) => {
        const nodeHandlers = handlers.get(handle) ?? rendererHandlers?.get(handle);
        if (!nodeHandlers)
            return;
        const position = [x, y, z];
        switch (action) {
            case 1:
                nodeHandlers.onHover?.(intArg === 1, source, position);
                break;
            case 2:
                nodeHandlers.onClick?.(intArg, source, position);
                break;
            case 7:
                nodeHandlers.onScroll?.(source, position);
                break;
            case 8:
                nodeHandlers.onDrag?.(source, position);
                break;
            case 10:
                nodeHandlers.onPinch?.(source, x, intArg);
                break;
        }
    });
    const canvas = renderer.canvasElement;
    // Browser wheel / trackpad -> Viro OnScroll. Refresh the hit ray at the
    // pointer location first so scrolling targets the panel actually under the
    // cursor, not the node last clicked.
    if (module.viroOnScroll && module.viroOnTouch) {
        const onWheel = (event) => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0)
                return;
            const x = (event.clientX - rect.left) * (canvas.width / rect.width);
            const y = (event.clientY - rect.top) * (canvas.height / rect.height);
            module.viroOnTouch?.(1, x, y);
            module.viroOnScroll?.(event.deltaX, event.deltaY);
            event.preventDefault();
        };
        canvas.addEventListener("wheel", onWheel, { passive: false });
        cleanups.push(() => canvas.removeEventListener("wheel", onWheel));
    }
    // Browser two-pointer pinch -> Viro's existing native pinch pipeline.
    // Single-pointer dragging is already fed by ViroWebRenderer's pointer events.
    if (module.viroOnPinch) {
        const pointers = new Map();
        let pinchStartDistance = null;
        let lastScale = 1;
        const onDown = (event) => {
            pointers.set(event.pointerId, event);
            try {
                canvas.setPointerCapture(event.pointerId);
            }
            catch {
                // Some synthetic/browser pointer implementations do not support capture.
            }
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                if (!a || !b)
                    return;
                pinchStartDistance = Math.max(1, distance(a, b));
                lastScale = 1;
                module.viroOnPinch?.(1, 1);
            }
        };
        const onMove = (event) => {
            if (!pointers.has(event.pointerId))
                return;
            pointers.set(event.pointerId, event);
            if (pointers.size !== 2 || pinchStartDistance == null)
                return;
            const [a, b] = [...pointers.values()];
            if (!a || !b)
                return;
            lastScale = distance(a, b) / pinchStartDistance;
            module.viroOnPinch?.(lastScale, 2);
        };
        const finishPointer = (event) => {
            const wasPinching = pinchStartDistance != null && pointers.size >= 2;
            pointers.delete(event.pointerId);
            try {
                canvas.releasePointerCapture(event.pointerId);
            }
            catch {
                // See setPointerCapture above.
            }
            if (wasPinching && pointers.size < 2) {
                module.viroOnPinch?.(lastScale, 3);
                pinchStartDistance = null;
                lastScale = 1;
            }
        };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", finishPointer);
        canvas.addEventListener("pointercancel", finishPointer);
        cleanups.push(() => {
            canvas.removeEventListener("pointerdown", onDown);
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("pointerup", finishPointer);
            canvas.removeEventListener("pointercancel", finishPointer);
            pointers.clear();
        });
    }
    return state;
}
/**
 * Undo installExtendedWebInput: remove the wheel and pinch listeners it put on
 * the canvas. Called when the renderer is torn down. Without it the listeners
 * outlived the renderer, and a canvas that got a new renderer fed every wheel
 * and pinch into the old module as well.
 */
function uninstallExtendedWebInput(renderer) {
    const state = installed.get(renderer);
    if (!state)
        return;
    installed.delete(renderer);
    state.detach();
}
/**
 * The renderer bindings each extended input needs. All three arrived together in
 * mikevocalz/virocore#79, so a renderer missing one is missing all of them.
 */
const REQUIRED_EXPORTS = {
    drag: "viroSetNodeDragConfig",
    pinch: "viroOnPinch",
    scroll: "viroOnScroll",
};
/** Which of the requested inputs the loaded renderer cannot deliver. */
function missingWebInput(renderer, wanted) {
    const module = renderer.wasmModule;
    return wanted.filter((kind) => typeof module[REQUIRED_EXPORTS[kind]] !== "function");
}
const warned = new WeakSet();
/**
 * Warn once per renderer when a node asks for drag, pinch or scroll that the
 * loaded binary cannot deliver. Without this the props are accepted and then
 * nothing happens, which is what @reactvision/viro-web-renderer 1.0.1 does.
 * Returns true if it warned.
 */
function warnIfWebInputUnavailable(renderer, wanted) {
    if (wanted.length === 0 || warned.has(renderer))
        return false;
    const missing = missingWebInput(renderer, wanted);
    if (missing.length === 0)
        return false;
    warned.add(renderer);
    console.warn(`[Viro web] ${missing.join(", ")} input is off: the loaded WASM renderer has no ` +
        missing.map((kind) => REQUIRED_EXPORTS[kind]).join(", ") +
        ". Serve the renderer shipped in @reactvision/react-viro/web/renderer and pass " +
        "webRendererOptions={{ assetBaseUrl }} pointing at it. See docs/WEB_PANEL_INPUT_PARITY.md.");
    return true;
}
function configureWebDrag(renderer, handle, config) {
    const module = renderer.wasmModule;
    if (!module.viroSetNodeDragConfig || config.dragType === "Gizmo")
        return false;
    const dragType = (() => {
        switch (config.dragType) {
            case "FixedDistanceOrigin": return 1;
            case "FixedToPlane": return 2;
            case "FixedToWorld": return 3;
            case "FixedDistance":
            default:
                return 0;
        }
    })();
    const point = config.dragPlane?.planePoint ?? [0, 0, 0];
    const normal = config.dragPlane?.planeNormal ?? [0, 0, 0];
    const maxDistance = config.dragPlane?.maxDistance ?? 1000;
    module.viroSetNodeDragConfig(handle, dragType, point[0], point[1], point[2], normal[0], normal[1], normal[2], maxDistance);
    return true;
}
