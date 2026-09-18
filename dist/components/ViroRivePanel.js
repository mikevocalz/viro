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
exports.ViroRivePanel = void 0;
/**
 * ViroRivePanel
 *
 * The native Rive bridge. Sister panel to ViroGpuPanel — different runtime
 * (no GPUCanvasContext), same lifecycle. Consumers supply a Rive runtime
 * adapter that knows how to draw into the CanvasSurface's backing buffer
 * (AHardwareBuffer on Android, IOSurface on Apple).
 *
 *   <ViroRivePanel
 *     width={1.2} height={0.8}
 *     position={[0, 1.45, -2.0]}
 *     init={{
 *       createRuntime: async (surface) => {
 *         // attach a Rive runtime to the surface's backing buffer here
 *         return {
 *           advance(dt) { stateMachine.advance(dt) },
 *           draw()      { riveRenderer.draw(skSurface.getCanvas()) },
 *           release()   { riveRenderer.release() },
 *         };
 *       },
 *     }}
 *   />
 *
 * Note: the native shim that bridges @rive-app/react-native's runtime to a
 * Viro material is the missing piece — `@rive-app/react-native` ships a
 * `<RiveView>` for screen rendering but does not expose its renderer for
 * off-screen targeting today. Until that native bridge lands the producer
 * is dormant; the JS surface is here so plug-in is one render-runtime
 * change once it does.
 */
const React = __importStar(require("react"));
const nitro_canvas_in_Vision_1 = require("nitro-canvas-in-Vision");
const ViroCanvasPanel_1 = require("./CanvasPanel/ViroCanvasPanel");
exports.ViroRivePanel = React.forwardRef(function ViroRivePanel({ init, ...surface }, ref) {
    return (<ViroCanvasPanel_1.ViroCanvasPanel ref={ref} producerFactory={() => new nitro_canvas_in_Vision_1.RiveProducer(init)} {...surface}/>);
});
