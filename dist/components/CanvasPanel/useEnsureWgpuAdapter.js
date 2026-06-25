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
exports.useEnsureWgpuAdapter = useEnsureWgpuAdapter;
const React = __importStar(require("react"));
function useEnsureWgpuAdapter(opts = {}) {
    const { check, options, onAdapter } = opts;
    React.useEffect(() => {
        let cancelled = false;
        const gpu = globalThis.navigator?.gpu;
        if (!gpu || typeof gpu.requestAdapter !== "function") {
            onAdapter?.(null);
            return;
        }
        void gpu
            .requestAdapter(options ?? { powerPreference: "high-performance" })
            .then(async (adapter) => {
            if (cancelled)
                return;
            onAdapter?.(adapter ?? null);
            if (adapter && check) {
                try {
                    await check(adapter);
                }
                catch {
                    // Diagnostic helper threw — non-fatal; consumer can log via
                    // their own check callback if they care.
                }
            }
        })
            .catch(() => {
            if (!cancelled)
                onAdapter?.(null);
        });
        return () => {
            cancelled = true;
        };
        // Adapter probe is one-shot per mount; intentionally ignore option churn.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
