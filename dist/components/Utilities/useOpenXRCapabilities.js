"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useOpenXRCapabilities = useOpenXRCapabilities;
const react_1 = require("react");
const VRModuleOpenXR_1 = require("./VRModuleOpenXR");
/** Read initialized native capabilities; a model name never promises a feature. */
function useOpenXRCapabilities() {
    const tag = (0, VRModuleOpenXR_1.useVRViewTag)();
    const [snapshot, setSnapshot] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        if (tag == null || !VRModuleOpenXR_1.VRModuleOpenXR?.getCapabilities)
            return;
        let cancelled = false;
        let timer;
        let attempts = 0;
        const read = async () => {
            try {
                const value = await VRModuleOpenXR_1.VRModuleOpenXR.getCapabilities(tag);
                if (cancelled)
                    return;
                setSnapshot({ tag, value });
                if (value.planeDetection == null && ++attempts < 20) {
                    timer = setTimeout(read, 250);
                }
            }
            catch {
                // Older AARs and removed views cannot provide this contract. Studio
                // renders unanchored content rather than promising surface detection.
                if (!cancelled)
                    setSnapshot({ tag, value: { planeDetection: null } });
            }
        };
        void read();
        return () => {
            cancelled = true;
            if (timer != null)
                clearTimeout(timer);
        };
    }, [tag]);
    return snapshot?.tag === tag ? snapshot.value : null;
}
