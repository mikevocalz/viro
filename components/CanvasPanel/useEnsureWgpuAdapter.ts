import * as React from "react";

/**
 * Mount-once hook that probes `navigator.gpu.requestAdapter()` and runs an
 * optional adapter check (typically `warnIfNotHardwareAccelerated` from
 * `react-native-webgpu`). Call this from your expo-router root layout —
 * pairing it with `<Stack>` is the canonical place — so every screen that
 * mounts a `ViroWgpuPanel` / `ViroThreeJSWgpuPanel` finds an initialized
 * WebGPU runtime.
 *
 *   // app/_layout.tsx
 *   import { warnIfNotHardwareAccelerated } from "react-native-webgpu";
 *   import { useEnsureWgpuAdapter } from "@reactvision/react-viro";
 *
 *   export default function RootLayout() {
 *     useEnsureWgpuAdapter({ check: warnIfNotHardwareAccelerated });
 *     return <Stack>...</Stack>;
 *   }
 *
 * Safe on non-WebGPU runtimes — when `navigator.gpu` is undefined the hook
 * resolves to a no-op, so the same layout works on devices without WGPU
 * (older Android, simulators without Metal/Dawn).
 *
 * Mirrors the wcandillon/react-native-webgpu example's root effect.
 */
export type UseEnsureWgpuAdapterOptions = {
  /**
   * Optional hardware-acceleration check. The hook awaits
   * `requestAdapter()` and then invokes `check(adapter)` if the adapter
   * resolves. Pass `warnIfNotHardwareAccelerated` from `react-native-webgpu`,
   * or your own diagnostic.
   */
  check?: (adapter: unknown) => void | Promise<void>;

  /**
   * Optional adapter request options forwarded to `requestAdapter`.
   * Defaults to `{ powerPreference: 'high-performance' }` because XR panels
   * benefit from the discrete GPU when present.
   */
  options?: { powerPreference?: "low-power" | "high-performance" };

  /**
   * Fired with the resolved adapter (or null if WebGPU is unavailable).
   * Useful when a downstream effect needs the adapter to construct a device.
   */
  onAdapter?: (adapter: unknown | null) => void;
};

export function useEnsureWgpuAdapter(opts: UseEnsureWgpuAdapterOptions = {}): void {
  const { check, options, onAdapter } = opts;
  React.useEffect(() => {
    let cancelled = false;
    const gpu = (globalThis as any).navigator?.gpu;
    if (!gpu || typeof gpu.requestAdapter !== "function") {
      onAdapter?.(null);
      return;
    }
    void gpu
      .requestAdapter(options ?? { powerPreference: "high-performance" })
      .then(async (adapter: unknown) => {
        if (cancelled) return;
        onAdapter?.(adapter ?? null);
        if (adapter && check) {
          try {
            await check(adapter);
          } catch {
            // Diagnostic helper threw — non-fatal; consumer can log via
            // their own check callback if they care.
          }
        }
      })
      .catch(() => {
        if (!cancelled) onAdapter?.(null);
      });
    return () => {
      cancelled = true;
    };
    // Adapter probe is one-shot per mount; intentionally ignore option churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
