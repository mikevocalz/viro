import type { ViroHandle, ViroWebRenderer } from "@reactvision/viro-web-renderer";
type Vec3 = [number, number, number];
export type ExtendedWebNodeHandlers = {
    onClick?: (clickState: number, source: number, position: Vec3) => void;
    onHover?: (isHovering: boolean, source: number, position: Vec3) => void;
    onScroll?: (source: number, delta: Vec3) => void;
    onDrag?: (source: number, position: Vec3) => void;
    onPinch?: (source: number, scaleFactor: number, pinchState: number) => void;
};
type ExtendedState = {
    handlers: Map<ViroHandle, ExtendedWebNodeHandlers>;
    /** Removes the canvas listeners and restores the renderer's own methods. */
    detach: () => void;
};
/**
 * Adds the event actions the published web renderer does not yet understand:
 * Viro OnDrag (8) and OnPinch (10).
 *
 * The WASM binary remains feature-detected so a JS bundle can still load
 * against an older renderer; those two capabilities simply stay unavailable.
 */
export declare function installExtendedWebInput(renderer: ViroWebRenderer): ExtendedState;
/**
 * Undo installExtendedWebInput: remove the wheel and pinch listeners it put on
 * the canvas. Called when the renderer is torn down. Without it the listeners
 * outlived the renderer, and a canvas that got a new renderer fed every wheel
 * and pinch into the old module as well.
 */
export declare function uninstallExtendedWebInput(renderer: ViroWebRenderer): void;
/**
 * The renderer bindings each extended input needs. All three arrived together in
 * mikevocalz/virocore#79, so a renderer missing one is missing all of them.
 */
declare const REQUIRED_EXPORTS: {
    readonly drag: "viroSetNodeDragConfig";
    readonly pinch: "viroOnPinch";
    readonly scroll: "viroOnScroll";
};
export type ExtendedInputKind = keyof typeof REQUIRED_EXPORTS;
/** Which of the requested inputs the loaded renderer cannot deliver. */
export declare function missingWebInput(renderer: ViroWebRenderer, wanted: readonly ExtendedInputKind[]): ExtendedInputKind[];
/**
 * Warn once per renderer when a node asks for drag, pinch or scroll that the
 * loaded binary cannot deliver. Without this the props are accepted and then
 * nothing happens, which is what @reactvision/viro-web-renderer 1.0.1 does.
 * Returns true if it warned.
 */
export declare function warnIfWebInputUnavailable(renderer: ViroWebRenderer, wanted: readonly ExtendedInputKind[]): boolean;
export type WebDragConfig = {
    dragType?: "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane" | "Gizmo";
    dragPlane?: {
        planePoint: Vec3;
        planeNormal: Vec3;
        maxDistance: number;
    };
};
export declare function configureWebDrag(renderer: ViroWebRenderer, handle: ViroHandle, config: WebDragConfig): boolean;
export {};
