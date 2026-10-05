import * as React from "react";
export function useEnsureWgpuAdapter(opts = {}) {
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
