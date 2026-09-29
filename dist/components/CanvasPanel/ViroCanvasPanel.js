"use strict";
/**
 * One spatial panel for every canvas backend.
 *
 * ViroGpuPanel, ViroThreeJSPanel and ViroRivePanel were three files that, with
 * the backend name normalised away, differed by fourteen lines — a prop-shape
 * choice and a useRef that two of them had and one did not. Everything that
 * actually does the work already lived in one place: useCanvasPanel is generic
 * over `P extends CanvasProducer` and takes a producerFactory, and the native
 * module already models the backends as concrete producers behind that one
 * interface. This component is the panel those three were each re-deriving.
 *
 * The backend arrives as a factory rather than a discriminator. A union of
 * `{ backend: 'gpu', init: GpuProducerInit } | { backend: 'rive', ... }` would
 * push every backend's init type through this file and make adding a fourth an
 * edit here; a factory keeps each backend's init checked at the call site where
 * it is written, and this component never names a concrete producer at all.
 *
 * `import type` throughout is deliberate: type-only imports erase, so this file
 * contributes no runtime dependency on nitro-canvas-in-Vision. The presets that
 * construct a producer do, and they are where that cost belongs.
 */
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
exports.ViroCanvasPanel = void 0;
const React = __importStar(require("react"));
const ViroNode_1 = require("../ViroNode");
const ViroQuad_1 = require("../ViroQuad");
const useCanvasPanel_1 = require("./useCanvasPanel");
function ViroCanvasPanelInner(props, ref) {
    const { producerFactory, width, height, position = [0, 1.45, -2.0], rotation, resolution = { width: 1024, height: 1024 }, sRGB, androidRoute, lightingModel, fallbackColor, materialName, onReady, onError, autoTick, } = props;
    // The factory is captured on first mount. ViroThreeJSPanel did this and
    // ViroGpuPanel did not, so a parent that rebuilt its init object on every
    // render tore down and rebuilt the renderer each time on one panel and not
    // the other. One behaviour now, and it is the safe one.
    const factoryRef = React.useRef(producerFactory);
    const state = (0, useCanvasPanel_1.useCanvasPanel)({
        producerFactory: () => factoryRef.current(),
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
        surface: state.surface,
        producer: state.producer,
        materialName: state.materialName,
    }), [state.surface, state.producer, state.materialName]);
    return (<ViroNode_1.ViroNode position={position} rotation={rotation}>
      <ViroQuad_1.ViroQuad width={width} height={height} materials={[state.materialName]}/>
    </ViroNode_1.ViroNode>);
}
// forwardRef erases the generic, so it is reapplied here. Without this cast a
// caller's handle comes back as CanvasProducer instead of their own producer.
exports.ViroCanvasPanel = React.forwardRef(ViroCanvasPanelInner);
