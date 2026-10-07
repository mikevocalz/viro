import * as React from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { AppState } from "react-native";
import type { CanvasProducer, CanvasSurface } from "./nitroCanvas";
import { requireNitroCanvas } from "./nitroCanvas";
import { ViroMaterials } from "../Material/ViroMaterials";

export type CanvasPanelOpts<P extends CanvasProducer> = {
  resourceKey?: unknown;
  producerFactory: () => P;
  resolution: { width: number; height: number };
  sRGB?: boolean;
  androidRoute?: "ahb" | "surface-texture";
  lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
  fallbackColor?: string;
  materialName?: string;
  /**
   * Material blend mode. Defaults to the bridge's Alpha, which composites
   * the surface's alpha against the scene behind — the see-through panel
   * look on headsets. "None" renders the texture fully opaque.
   */
  blendMode?: "None" | "Alpha" | "Add" | "Subtract" | "Multiply" | "Screen";
  /** Producer initialized; native Surface/frame readiness is exposed by the runtime. */
  onReady?: (state: CanvasPanelState<P>) => void;
  onError?: (error: Error) => void;
  /** JS producers tick at display cadence; native producers own their frame clock. */
  autoTick?: boolean;
};

export type CanvasPanelState<P extends CanvasProducer> = {
  surface: CanvasSurface;
  producer: P;
  materialName: string;
};

/** Allocate after commit, then render the quad only after its material exists. */
export function useCanvasPanel<P extends CanvasProducer>(opts: CanvasPanelOpts<P>): CanvasPanelState<P> | null {
  const store = React.useMemo(() => createStore(() => ({
    resource: null as CanvasPanelState<P> | null,
  })), []);
  const state = useStore(store, value => value.resource);
  const latest = React.useRef(opts);
  latest.current = opts;
  const updateClock = React.useRef<(() => void) | null>(null);
  const { resolution: { width, height }, sRGB = true, androidRoute = "ahb",
    materialName: override, lightingModel = "Constant", fallbackColor = "#ffffff",
    blendMode } = opts;

  React.useEffect(() => {
    let alive = true;
    let attached = false;
    let settled = false;
    let surfaceDisposed = false;
    let frame: number | null = null;
    let foreground = AppState.currentState !== "background" && AppState.currentState !== "inactive";
    let resource: CanvasPanelState<P> | null = null;
    const report = (error: unknown) => {
      if (alive) latest.current.onError?.(error instanceof Error ? error : new Error(String(error)));
    };
    const disposeSurface = () => {
      if (!resource || surfaceDisposed) return;
      surfaceDisposed = true;
      resource.surface.dispose();
    };
    let producerDisposed = false;
    const disposeProducer = () => {
      if (!resource || producerDisposed) return;
      producerDisposed = true;
      resource.producer.dispose();
    };
    const cancelFrame = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const tick = () => {
      frame = null;
      if (!alive || !foreground || latest.current.autoTick === false || !resource) return;
      try {
        resource.producer.renderFrame();
        frame = requestAnimationFrame(tick);
      } catch (error) { report(error); }
    };
    const syncClock = () => {
      cancelFrame();
      if (!attached || !resource || !alive) return;
      const playing = foreground && latest.current.autoTick !== false;
      resource.producer.setActive?.(playing);
      if (playing && !resource.producer.managesOwnFrames) frame = requestAnimationFrame(tick);
    };
    updateClock.current = syncClock;
    const subscription = AppState.addEventListener("change", (value) => {
      foreground = value === "active";
      syncClock();
    });

    try {
      const surface = requireNitroCanvas().createCanvasSurface({ width, height, sRGB, androidRoute });
      let producer: P;
      try { producer = latest.current.producerFactory(); }
      catch (error) { surface.dispose(); throw error; }
      const materialName = override ?? `viroCanvasPanel_${surface.id}`;
      resource = { surface, producer, materialName };
      ViroMaterials.createMaterials({ [materialName]: {
        diffuseTexture: requireNitroCanvas().canvasSource(surface),
        diffuseColor: fallbackColor, lightingModel,
        ...(blendMode ? { blendMode } : null),
      } });
      store.setState({ resource });
      void Promise.resolve().then(() => {
        if (alive) return producer.attach(surface);
      }).then(() => {
        if (!alive) return;
        attached = true;
        syncClock();
        try {
          latest.current.onReady?.(resource!);
        } catch (error) { report(error); }
      }).catch((error) => {
        // Attach failed: the producer owns no valid frame surface, so retire
        // the whole resource rather than render a dead canvasSource. If the
        // component already unmounted, the finally block below owns disposal.
        if (!alive) return;
        report(error);
        attached = false;
        cancelFrame();
        resource?.producer.setActive?.(false);
        store.setState({ resource: null });
        if (resource) {
          try { disposeProducer(); } finally {
            ViroMaterials.deleteMaterials([resource.materialName]);
            disposeSurface();
          }
        }
      }).finally(() => {
        settled = true;
        // A late attach must retire its own resources before its surface is released.
        if (!alive) {
          try { disposeProducer(); } finally { disposeSurface(); }
        }
      });
    } catch (error) {
      settled = true;
      if (resource) {
        try { disposeProducer(); } finally { disposeSurface(); }
      }
      report(error);
    }

    return () => {
      alive = false;
      updateClock.current = null;
      subscription.remove();
      cancelFrame();
      store.setState({ resource: null });
      if (resource) {
        resource.producer.setActive?.(false);
        try { disposeProducer(); } finally {
          ViroMaterials.deleteMaterials([resource.materialName]);
          if (settled) disposeSurface();
        }
      }
    };
  }, [width, height, sRGB, androidRoute, override, lightingModel, fallbackColor, blendMode, opts.resourceKey]);

  React.useEffect(() => { updateClock.current?.(); }, [opts.autoTick]);
  return state;
}
