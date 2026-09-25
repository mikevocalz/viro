"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCanvasPanel = useCanvasPanel;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const nitroCanvas_1 = require("./nitroCanvas");
const ViroMaterials_1 = require("../Material/ViroMaterials");
/** Allocate after commit, then render the quad only after its material exists. */
function useCanvasPanel(opts) {
    const [state, setState] = React.useState(null);
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
        let foreground = react_native_1.AppState.currentState !== "background" && react_native_1.AppState.currentState !== "inactive";
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
        const subscription = react_native_1.AppState.addEventListener("change", (value) => {
            foreground = value === "active";
            syncClock();
        });
        try {
            const surface = (0, nitroCanvas_1.requireNitroCanvas)().createCanvasSurface({ width, height, sRGB, androidRoute });
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
            ViroMaterials_1.ViroMaterials.createMaterials({ [materialName]: {
                    diffuseTexture: (0, nitroCanvas_1.requireNitroCanvas)().canvasSource(surface),
                    diffuseColor: fallbackColor, lightingModel,
                } });
            setState(resource);
            void Promise.resolve().then(() => {
                if (alive)
                    return producer.attach(surface);
            }).then(() => {
                if (!alive)
                    return;
                attached = true;
                syncClock();
                latest.current.onReady?.(resource);
            }).catch(report).finally(() => {
                settled = true;
                // A late attach must retire its own resources before its surface is released.
                if (!alive) {
                    try {
                        producer.dispose();
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
                    resource.producer.dispose();
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
            setState(null);
            if (resource) {
                resource.producer.setActive?.(false);
                try {
                    resource.producer.dispose();
                }
                finally {
                    ViroMaterials_1.ViroMaterials.deleteMaterials([resource.materialName]);
                    if (settled)
                        disposeSurface();
                }
            }
        };
    }, [width, height, sRGB, androidRoute, override, lightingModel, fallbackColor, opts.resourceKey]);
    React.useEffect(() => { updateClock.current?.(); }, [opts.autoTick]);
    return state;
}
