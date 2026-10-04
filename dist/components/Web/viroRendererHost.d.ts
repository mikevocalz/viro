/**
 * One WASM renderer per <canvas>, shared by every mount of a navigator on it.
 *
 * React StrictMode mounts a component, unmounts it and mounts it again, keeping
 * the same DOM. A navigator that created its renderer in an effect therefore
 * started a second WASM module on the same canvas while the first was still
 * loading. Both modules got the same WebGL context, the first one's dispose()
 * left its main loop running, and whichever loop drew last each frame won:
 * usually the stale one, with an empty scene.
 *
 * Here a mount takes a reference on the canvas's renderer and an unmount drops
 * it. Teardown waits one macrotask, so StrictMode's immediate remount takes the
 * renderer back before anything is released. A real unmount tears it down for
 * good, main loop included.
 */
import { type RefObject } from "react";
import { ViroWebRenderer, type ViroWebRendererOptions } from "@reactvision/viro-web-renderer";
export type ViroWebRendererHostOptions = Omit<ViroWebRendererOptions, "canvas">;
/**
 * Stop a renderer for good. ViroWebRenderer.dispose() releases its JS state but
 * leaves the Emscripten main loop scheduled, so the module would keep drawing
 * into the canvas. pauseMainLoop is what emscripten_cancel_main_loop calls, and
 * every published build exports it on the module.
 */
export declare function teardownViroWebRenderer(renderer: ViroWebRenderer): void;
/** Take a reference on the canvas's renderer, creating it on first use. */
export declare function acquireViroWebRenderer(canvas: HTMLCanvasElement, options?: ViroWebRendererHostOptions): Promise<ViroWebRenderer>;
/** Drop a reference. The renderer is torn down once nobody takes it back. */
export declare function releaseViroWebRenderer(canvas: HTMLCanvasElement): void;
/**
 * The renderer for the canvas in `canvasRef`, or null while it loads. Options
 * are read once, on the first mount, as they were before.
 */
export declare function useViroWebRenderer(canvasRef: RefObject<HTMLCanvasElement | null>, options: ViroWebRendererHostOptions | undefined, onError: (err: unknown) => void): ViroWebRenderer | null;
