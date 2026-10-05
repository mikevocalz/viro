import * as React from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { AppState } from "react-native";
import { requireNitroCanvas } from "./nitroCanvas";
import { ViroMaterials } from "../Material/ViroMaterials";
/** Allocate after commit, then render the quad only after its material exists. */
export function useCanvasPanel(opts) {
    const store = React.useMemo(() => createStore(() => ({
        resource: null,
    })), []);
    const state = useStore(store, value => value.resource);
    const latest = React.useRef(opts);
    latest.current = opts;
    const updateClock = React.useRef(null);
    const { resolution: { width, height }, sRGB = true, androidRoute = "ahb", materialName: override, lightingModel = "Constant", fallbackColor = "#ffffff" } = opts;
    React.useEffect(() => {
        let alive = true;
        let attached = false;
        let settled = false;
        let surfaceDisposed = false;
        let frame = null;
        let foreground = AppState.currentState !== "background" && AppState.currentState !== "inactive";
        let resource = null;
        const report = (error) => {
            if (alive)
                latest.current.onError?.(error instanceof Error ? error : new Error(String(error)));
        };
        const disposeSurface = () => {
            if (!resource || surfaceDisposed)
                return;
            surfaceDisposed = true;
            resource.surface.dispose();
        };
        let producerDisposed = false;
        const disposeProducer = () => {
            if (!resource || producerDisposed)
                return;
            producerDisposed = true;
            resource.producer.dispose();
        };
        const cancelFrame = () => {
            if (frame !== null)
                cancelAnimationFrame(frame);
            frame = null;
        };
        const tick = () => {
            frame = null;
            if (!alive || !foreground || latest.current.autoTick === false || !resource)
                return;
            try {
                resource.producer.renderFrame();
                frame = requestAnimationFrame(tick);
            }
            catch (error) {
                report(error);
            }
        };
        const syncClock = () => {
            cancelFrame();
            if (!attached || !resource || !alive)
                return;
            const playing = foreground && latest.current.autoTick !== false;
            resource.producer.setActive?.(playing);
            if (playing && !resource.producer.managesOwnFrames)
                frame = requestAnimationFrame(tick);
        };
        updateClock.current = syncClock;
        const subscription = AppState.addEventListener("change", (value) => {
            foreground = value === "active";
            syncClock();
        });
        try {
            const surface = requireNitroCanvas().createCanvasSurface({ width, height, sRGB, androidRoute });
            let producer;
            try {
                producer = latest.current.producerFactory();
            }
            catch (error) {
                surface.dispose();
                throw error;
            }
            const materialName = override ?? `viroCanvasPanel_${surface.id}`;
            resource = { surface, producer, materialName };
            ViroMaterials.createMaterials({ [materialName]: {
                    diffuseTexture: requireNitroCanvas().canvasSource(surface),
                    diffuseColor: fallbackColor, lightingModel,
                } });
            store.setState({ resource });
            void Promise.resolve().then(() => {
                if (alive)
                    return producer.attach(surface);
            }).then(() => {
                if (!alive)
                    return;
                attached = true;
                syncClock();
                try {
                    latest.current.onReady?.(resource);
                }
                catch (error) {
                    report(error);
                }
            }).catch((error) => {
                // Attach failed: the producer owns no valid frame surface, so retire
                // the whole resource rather than render a dead canvasSource. If the
                // component already unmounted, the finally block below owns disposal.
                if (!alive)
                    return;
                report(error);
                attached = false;
                cancelFrame();
                resource?.producer.setActive?.(false);
                store.setState({ resource: null });
                if (resource) {
                    try {
                        disposeProducer();
                    }
                    finally {
                        ViroMaterials.deleteMaterials([resource.materialName]);
                        disposeSurface();
                    }
                }
            }).finally(() => {
                settled = true;
                // A late attach must retire its own resources before its surface is released.
                if (!alive) {
                    try {
                        disposeProducer();
                    }
                    finally {
                        disposeSurface();
                    }
                }
            });
        }
        catch (error) {
            settled = true;
            if (resource) {
                try {
                    disposeProducer();
                }
                finally {
                    disposeSurface();
                }
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
                try {
                    disposeProducer();
                }
                finally {
                    ViroMaterials.deleteMaterials([resource.materialName]);
                    if (settled)
                        disposeSurface();
                }
            }
        };
    }, [width, height, sRGB, androidRoute, override, lightingModel, fallbackColor, opts.resourceKey]);
    React.useEffect(() => { updateClock.current?.(); }, [opts.autoTick]);
    return state;
}
