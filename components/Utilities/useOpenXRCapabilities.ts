import { useEffect, useState } from "react";
import { VRModuleOpenXR, useVRViewTag } from "./VRModuleOpenXR";

export type ViroOpenXRCapabilities = {
  /** null until native session initialization finishes. Reports native source initialization, not guaranteed plane results. */
  planeDetection: boolean | null;
};

/** Read initialized native capabilities; a model name never promises a feature. */
export function useOpenXRCapabilities(): ViroOpenXRCapabilities | null {
  const tag = useVRViewTag();
  const [snapshot, setSnapshot] = useState<{
    tag: number;
    value: ViroOpenXRCapabilities;
  } | null>(null);
  useEffect(() => {
    if (tag == null || !VRModuleOpenXR?.getCapabilities) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const read = async () => {
      try {
        const value = await VRModuleOpenXR!.getCapabilities!(tag);
        if (cancelled) return;
        setSnapshot({ tag, value });
        if (value.planeDetection == null && ++attempts < 20) {
          timer = setTimeout(read, 250);
        }
      } catch {
        // Older AARs and removed views cannot provide this contract. Studio
        // renders unanchored content rather than promising surface detection.
        if (!cancelled) setSnapshot({ tag, value: { planeDetection: null } });
      }
    };
    void read();
    return () => {
      cancelled = true;
      if (timer != null) clearTimeout(timer);
    };
  }, [tag]);
  return snapshot?.tag === tag ? snapshot.value : null;
}
