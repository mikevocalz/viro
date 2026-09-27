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
exports.ViroThreeJSPanel = void 0;
/**
 * ViroThreeJSPanel
 *
 * three.js (regular `three`, WebGL2) panel — sibling of ViroGpuPanel.
 * Owns an expo-gl headless context, instantiates a `THREE.WebGLRenderer`
 * against it, hands it to the consumer's `setup` callback, and pumps the
 * frame loop. Pixels readback into the CanvasSurface (CPU path).
 *
 *   import * as THREE from 'three';
 *
 *   <ViroThreeJSPanel
 *     three={THREE}
 *     width={1.6}
 *     height={1.6}
 *     position={[0, 1.45, -2.2]}
 *     resolution={{ width: 1024, height: 1024 }}
 *     setup={({ renderer, width, height }) => {
 *       const scene = new THREE.Scene();
 *       const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 100);
 *       return { render(dt) { renderer.render(scene, camera); } };
 *     }}
 *   />
 *
 * ponytail: CPU readback ceiling lives in GLES3Producer. When perf bites,
 * the upgrade is native EGL/IOSurface binding — same JS API, faster path.
 */
const React = __importStar(require("react"));
const nitroCanvas_1 = require("./CanvasPanel/nitroCanvas");
const ViroNode_1 = require("./ViroNode");
const ViroQuad_1 = require("./ViroQuad");
const useCanvasPanel_1 = require("./CanvasPanel/useCanvasPanel");
exports.ViroThreeJSPanel = React.forwardRef(function ViroThreeJSPanel(props, ref) {
    const { three, setup, width, height, position = [0, 1.45, -2.0], rotation, resolution = { width: 1024, height: 1024 }, sRGB, androidRoute, lightingModel, fallbackColor, materialName, onReady, onError, autoTick, } = props;
    // ponytail: init is captured on first mount; changing `three` or `setup`
    // mid-life requires remount. Standard for renderer-owning components.
    const initRef = React.useRef({ three, setup });
    const state = (0, useCanvasPanel_1.useCanvasPanel)({
        producerFactory: () => new ((0, nitroCanvas_1.requireNitroCanvas)().GLES3Producer)(initRef.current),
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
    }), [state]);
    if (!state)
        return null;
    return (<ViroNode_1.ViroNode position={position} rotation={rotation}>
      <ViroQuad_1.ViroQuad width={width} height={height} materials={[state.materialName]}/>
    </ViroNode_1.ViroNode>);
});
