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
exports.ViroSpecsScene = ViroSpecsScene;
const React = __importStar(require("react"));
const ViroSpecsCompiler_1 = require("./ViroSpecsCompiler");
const ViroSpecsRuntime_1 = require("./ViroSpecsRuntime");
function emptyCompiled() {
    return {
        scene: { version: 1, nodes: [] },
        polylines: [],
        animations: [],
        callbacks: new Map(),
        diagnostics: [],
    };
}
/**
 * Compiles familiar Viro JSX into the portable scene consumed by the validated
 * SPECS 27 Lens backend. Outside Specs it renders the same children without
 * evaluating Specs-only asset resolution.
 *
 * Use viroTag for stable cross-renderer node IDs.
 */
function ViroSpecsScene({ children, transport, sourceResolver, onDiagnostic, renderNativeFallback = true, }) {
    const specsRuntime = (0, ViroSpecsRuntime_1.isViroSpecsRuntime)();
    const compiled = React.useMemo(() => specsRuntime
        ? (0, ViroSpecsCompiler_1.compileViroSpecsChildren)(children, sourceResolver)
        : emptyCompiled(), [children, sourceResolver, specsRuntime]);
    const callbacksRef = React.useRef(compiled.callbacks);
    callbacksRef.current = compiled.callbacks;
    const revisionRef = React.useRef(0);
    const queueRef = React.useRef(Promise.resolve());
    React.useEffect(() => {
        if (!specsRuntime)
            return;
        const revision = ++revisionRef.current;
        queueRef.current = queueRef.current
            .then(async () => {
            if (revisionRef.current !== revision)
                return;
            for (const diagnostic of compiled.diagnostics) {
                onDiagnostic?.(diagnostic);
            }
            await transport.applyScene(compiled.scene);
            if (revisionRef.current !== revision)
                return;
            await transport.clearPolylines?.();
            if (revisionRef.current !== revision)
                return;
            for (const polyline of compiled.polylines) {
                await transport.presentPolyline?.(polyline);
                if (revisionRef.current !== revision)
                    return;
            }
            for (const animation of compiled.animations) {
                if (revisionRef.current !== revision)
                    return;
                if (animation.action === "stop") {
                    if (!transport.stopAnimation) {
                        onDiagnostic?.("Specs transport cannot stop animation " +
                            animation.name +
                            " on " +
                            animation.nodeId +
                            ".");
                        continue;
                    }
                    await transport.stopAnimation(animation.nodeId, animation.name);
                }
                else {
                    if (!transport.playAnimation) {
                        onDiagnostic?.("Specs transport cannot play animation " +
                            animation.name +
                            " on " +
                            animation.nodeId +
                            ".");
                        continue;
                    }
                    await transport.playAnimation(animation);
                }
            }
        })
            .catch((error) => {
            onDiagnostic?.("Specs scene transport failed: " +
                (error instanceof Error ? error.message : String(error)));
        });
        return () => {
            if (revisionRef.current === revision) {
                revisionRef.current += 1;
            }
        };
    }, [compiled, onDiagnostic, specsRuntime, transport]);
    React.useEffect(() => {
        if (!specsRuntime || !transport.onInteraction)
            return;
        return transport.onInteraction((event) => (0, ViroSpecsCompiler_1.dispatchViroSpecsInteraction)(event, callbacksRef.current));
    }, [specsRuntime, transport]);
    React.useEffect(() => {
        if (!specsRuntime || !transport.onAnimationEvent)
            return;
        return transport.onAnimationEvent((event) => (0, ViroSpecsCompiler_1.dispatchViroSpecsAnimationEvent)(event, callbacksRef.current));
    }, [specsRuntime, transport]);
    if (specsRuntime)
        return null;
    if (!renderNativeFallback)
        return null;
    return React.createElement(React.Fragment, null, children);
}
