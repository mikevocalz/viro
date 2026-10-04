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
import { useEffect, useState, type RefObject } from "react";
import {
  ViroWebRenderer,
  type ViroWebRendererOptions,
} from "@reactvision/viro-web-renderer";

import { uninstallExtendedWebInput } from "./viroExtendedInput";
import { resetMaterialCache } from "./viroMaterialRegistry";

export type ViroWebRendererHostOptions = Omit<ViroWebRendererOptions, "canvas">;

type Host = {
  promise: Promise<ViroWebRenderer>;
  renderer: ViroWebRenderer | null;
  users: number;
  teardownTimer: ReturnType<typeof setTimeout> | null;
  tornDown: boolean;
};

const hosts = new WeakMap<HTMLCanvasElement, Host>();

/**
 * Stop a renderer for good. ViroWebRenderer.dispose() releases its JS state but
 * leaves the Emscripten main loop scheduled, so the module would keep drawing
 * into the canvas. pauseMainLoop is what emscripten_cancel_main_loop calls, and
 * every published build exports it on the module.
 */
export function teardownViroWebRenderer(renderer: ViroWebRenderer): void {
  uninstallExtendedWebInput(renderer);
  renderer.dispose();
  const module = renderer.wasmModule as unknown as { pauseMainLoop?: () => void };
  module.pauseMainLoop?.();
  resetMaterialCache();
}

/** Take a reference on the canvas's renderer, creating it on first use. */
export function acquireViroWebRenderer(
  canvas: HTMLCanvasElement,
  options?: ViroWebRendererHostOptions,
): Promise<ViroWebRenderer> {
  const existing = hosts.get(canvas);
  if (existing && !existing.tornDown) {
    if (existing.teardownTimer !== null) {
      clearTimeout(existing.teardownTimer);
      existing.teardownTimer = null;
    }
    existing.users += 1;
    return existing.promise;
  }

  const host: Host = {
    promise: undefined as unknown as Promise<ViroWebRenderer>,
    renderer: null,
    users: 1,
    teardownTimer: null,
    tornDown: false,
  };
  host.promise = ViroWebRenderer.create({ canvas, ...options }).then(
    (renderer) => {
      host.renderer = renderer;
      // Every user left while the WASM was still loading.
      if (host.tornDown) teardownViroWebRenderer(renderer);
      return renderer;
    },
    (err) => {
      // Let the next mount try again rather than inherit the failure.
      if (hosts.get(canvas) === host) hosts.delete(canvas);
      throw err;
    },
  );
  hosts.set(canvas, host);
  return host.promise;
}

/** Drop a reference. The renderer is torn down once nobody takes it back. */
export function releaseViroWebRenderer(canvas: HTMLCanvasElement): void {
  const host = hosts.get(canvas);
  if (!host || host.tornDown) return;
  host.users = Math.max(0, host.users - 1);
  if (host.users > 0 || host.teardownTimer !== null) return;
  host.teardownTimer = setTimeout(() => {
    host.teardownTimer = null;
    if (host.users > 0) return;
    host.tornDown = true;
    if (hosts.get(canvas) === host) hosts.delete(canvas);
    if (host.renderer) teardownViroWebRenderer(host.renderer);
  }, 0);
}

/**
 * The renderer for the canvas in `canvasRef`, or null while it loads. Options
 * are read once, on the first mount, as they were before.
 */
export function useViroWebRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: ViroWebRendererHostOptions | undefined,
  onError: (err: unknown) => void,
): ViroWebRenderer | null {
  const [renderer, setRenderer] = useState<ViroWebRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    acquireViroWebRenderer(canvas, options).then(
      (created) => {
        if (active) setRenderer(created);
      },
      (err) => {
        if (active) onError(err);
      },
    );
    return () => {
      active = false;
      releaseViroWebRenderer(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return renderer;
}
