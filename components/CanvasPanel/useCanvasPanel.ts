import * as React from "react";
import type { CanvasProducer, CanvasSurface } from "nitro-canvas-in-Vision";
import { requireNitroCanvas } from "./nitroCanvas";
import { ViroMaterials } from "../Material/ViroMaterials";

/**
 * Common lifecycle for every Viro "canvas panel" (ViroThreeJSPanel,
 * ViroWgpuPanel, ViroSkiaPanel, ViroRivePanel, ...): allocate a
 * CanvasSurface, register a Viro material that samples it, attach the
 * producer, drive a microtask render loop while mounted, and dispose
 * idempotently on unmount.
 *
 * The only thing each panel kind has to provide is a producer factory
 * — everything else is shared here.
 */

export type CanvasPanelOpts<P extends CanvasProducer> = {
  /** Allocates the producer. Called once per surface identity. */
  producerFactory: () => P;

  /** Pixel resolution of the underlying CanvasSurface. */
  resolution: { width: number; height: number };
  /** sRGB output. */
  sRGB?: boolean;
  /** Android-side import route. */
  androidRoute?: "ahb" | "surface-texture";

  /** Material lighting model. */
  lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
  /** Optional fallback color shown until the first frame lands. */
  fallbackColor?: string;
  /** Material name override; auto-derived from surface id otherwise. */
  materialName?: string;

  /** Fired after the producer attaches and the first frame is queued. */
  onReady?: () => void;
  /** Fired if `producer.attach()` throws. The panel does not retry. */
  onError?: (error: Error) => void;

  /**
   * If true (default), the panel pumps the producer on every microtask.
   * Set false if your scene drives a shared clock and you'll call
   * `producer.renderFrame()` yourself.
   */
  autoTick?: boolean;
};

export type CanvasPanelState<P extends CanvasProducer> = {
  surface: CanvasSurface;
  producer: P;
  materialName: string;
};

export function useCanvasPanel<P extends CanvasProducer>(
  opts: CanvasPanelOpts<P>
): CanvasPanelState<P> {
  const {
    producerFactory,
    resolution,
    sRGB = true,
    androidRoute = "ahb",
    lightingModel = "Constant",
    fallbackColor = "#02070d",
    materialName: materialNameOverride,
    onReady,
    onError,
    autoTick = true,
  } = opts;

  const surface = React.useMemo(
    () =>
      requireNitroCanvas().createCanvasSurface({
        width: resolution.width,
        height: resolution.height,
        sRGB,
        androidRoute,
      }),
    // Resolution / colorspace / route changes require a full reattach;
    // remount the component to swap.
    [resolution.width, resolution.height, sRGB, androidRoute]
  );

  const materialName = materialNameOverride ?? `viroCanvasPanel_${surface.id}`;

  const producer = React.useMemo(
    () => producerFactory(),
    // The factory closure captures consumer init; treat as immutable
    // for the surface's lifetime. To swap, remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surface]
  );

  // ponytail: register the material SYNCHRONOUSLY at render time, not in
  // useEffect. Effects run after React commit, but child ViroQuad's `materials`
  // prop is processed by the native bridge DURING commit. If we register in an
  // effect, MaterialManager.getMaterial() returns null → NPE in
  // safelyApplyProp → swallowed → Quad keeps a default Material with no
  // canvasSource binding (panel renders blank). Registering during render
  // makes the material exist by the time the Quad's prop is applied.
  const _matRegistered = React.useRef(false);
  if (!_matRegistered.current) {
    ViroMaterials.createMaterials({
      [materialName]: {
        diffuseTexture: requireNitroCanvas().canvasSource(surface),
        diffuseColor: fallbackColor,
        lightingModel,
      },
    });
    _matRegistered.current = true;
  }

  React.useEffect(() => {
    surface.markDirty();
  }, [surface, materialName, lightingModel, fallbackColor]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await producer.attach(surface);
        if (!alive) return;
        onReady?.();
        if (!autoTick) return;
        while (alive) {
          producer.renderFrame();
          await Promise.resolve();
        }
      } catch (err) {
        if (alive) onError?.(err as Error);
      }
    })();

    return () => {
      alive = false;
      // surface is a Nitro HybridObject — a double dispose throws
      // "Cannot call hybrid function HybridObject.dispose(...)". React
      // StrictMode and HMR can re-fire this cleanup, so swallow that
      // specific failure path on both calls.
      try {
        producer.dispose?.();
      } catch {}
      try {
        surface.dispose();
      } catch {}
    };
  }, [producer, surface, autoTick, onReady, onError]);

  return { surface, producer, materialName };
}
