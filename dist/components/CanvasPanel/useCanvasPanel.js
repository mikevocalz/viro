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
const nitro_canvas_in_Vision_1 = require("nitro-canvas-in-Vision");
const ViroMaterials_1 = require("../Material/ViroMaterials");
function useCanvasPanel(opts) {
    const { producerFactory, resolution, sRGB = true, androidRoute = "ahb", lightingModel = "Constant", fallbackColor = "#02070d", materialName: materialNameOverride, onReady, onError, autoTick = true, } = opts;
    const surface = React.useMemo(() => (0, nitro_canvas_in_Vision_1.createCanvasSurface)({
        width: resolution.width,
        height: resolution.height,
        sRGB,
        androidRoute,
    }), 
    // Resolution / colorspace / route changes require a full reattach;
    // remount the component to swap.
    [resolution.width, resolution.height, sRGB, androidRoute]);
    const materialName = materialNameOverride ?? `viroCanvasPanel_${surface.id}`;
    const producer = React.useMemo(() => producerFactory(), 
    // The factory closure captures consumer init; treat as immutable
    // for the surface's lifetime. To swap, remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surface]);
    // ponytail: register the material SYNCHRONOUSLY at render time, not in
    // useEffect. Effects run after React commit, but child ViroQuad's `materials`
    // prop is processed by the native bridge DURING commit. If we register in an
    // effect, MaterialManager.getMaterial() returns null → NPE in
    // safelyApplyProp → swallowed → Quad keeps a default Material with no
    // canvasSource binding (panel renders blank). Registering during render
    // makes the material exist by the time the Quad's prop is applied.
    const _matRegistered = React.useRef(false);
    if (!_matRegistered.current) {
        ViroMaterials_1.ViroMaterials.createMaterials({
            [materialName]: {
                diffuseTexture: (0, nitro_canvas_in_Vision_1.canvasSource)(surface),
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
                if (!alive)
                    return;
                onReady?.();
                if (!autoTick)
                    return;
                while (alive) {
                    producer.renderFrame();
                    await Promise.resolve();
                }
            }
            catch (err) {
                if (alive)
                    onError?.(err);
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
            }
            catch { }
            try {
                surface.dispose();
            }
            catch { }
        };
    }, [producer, surface, autoTick, onReady, onError]);
    return { surface, producer, materialName };
}
