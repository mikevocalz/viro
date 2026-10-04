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
exports.ViroGpuPanel = void 0;
/**
 * ViroGpuPanel
 *
 * The one panel for WebGPU-backed rendering: three.js (`three/webgpu`),
 * Skia (@next, Graphite backend), TypeGPU, raw WGSL, react-three-fiber —
 * all pick a renderer over the same `GPUCanvasContext`; the panel owns
 * the surface, the material binding, and the frame pump.
 *
 * (Rive in React Native ships native via `rive-react-native` and doesn't
 *  expose a JS `GPUCanvasContext`, so it lives outside this panel.)
 *
 * Pattern matches wcandillon/react-native-webgpu's Canvas but renders into
 * a Viro material instead of a screen view.
 *
 *   import * as ThreeWgpu from 'three/webgpu';
 *
 *   <ViroGpuPanel
 *     width={1.6} height={1.6}
 *     position={[0, 1.45, -2.2]}
 *     init={{
 *       importContext: async (surface) => {
 *         // wire react-native-wgpu / Dawn-imported context here
 *         return { context, present };
 *       },
 *       setup: ({ context, width, height }) => {
 *         // three.js — scene graph + GLTFLoader + post-FX
 *         const renderer = new ThreeWgpu.WebGPURenderer({ context });
 *         const scene = new ThreeWgpu.Scene();
 *         const camera = new ThreeWgpu.PerspectiveCamera(45, width/height, 0.1, 100);
 *         return { render(dt) { renderer.render(scene, camera); } };
 *
 *         // — OR — Skia (Graphite over the same context)
 *         // const sk = await Skia.MakeFromGPUContext(context, width, height);
 *         // return { render(dt) { draw(sk.getCanvas()); sk.flush(); } };
 *
 *         // — OR — TypeGPU / raw WGSL
 *         // const root = await tgpu.init(context.device);
 *         // return { render(dt) { root.execute(...); } };
 *       },
 *     }}
 *   />
 *
 * Pair with `useEnsureWgpuAdapter` in the expo-router root layout so every
 * mount finds an initialized WebGPU runtime.
 */
const React = __importStar(require("react"));
const nitroCanvas_1 = require("./CanvasPanel/nitroCanvas");
const ViroNode_1 = require("./ViroNode");
const ViroQuad_1 = require("./ViroQuad");
const useCanvasPanel_1 = require("./CanvasPanel/useCanvasPanel");
const engineSurfaceAdapter_1 = require("./CanvasPanel/engineSurfaceAdapter");
exports.ViroGpuPanel = React.forwardRef(function ViroGpuPanel(props, ref) {
    const { init, width, height, position = [0, 1.45, -2.0], rotation, resolution = { width: 1024, height: 1024 }, sRGB, androidRoute, lightingModel, fallbackColor, materialName, onReady, onError, autoTick, } = props;
    const state = (0, useCanvasPanel_1.useCanvasPanel)({
        producerFactory: () => new ((0, nitroCanvas_1.requireNitroCanvas)().GLES3Producer)(init),
        resolution,
        sRGB,
        androidRoute,
        lightingModel,
        fallbackColor,
        materialName,
        onReady,
        onError,
        autoTick,
    });
    React.useImperativeHandle(ref, () => ({
        surface: state?.surface ?? null,
        producer: state?.producer ?? null,
        materialName: state?.materialName ?? "",
        engineSurface: (0, engineSurfaceAdapter_1.describeCanvasSurface)(state?.surface, "gpu"),
    }), [state]);
    if (!state)
        return null;
    return (<ViroNode_1.ViroNode position={position} rotation={rotation}>
      <ViroQuad_1.ViroQuad width={width} height={height} materials={[state.materialName]}/>
    </ViroNode_1.ViroNode>);
});
