export type ViroOpenXRCapabilities = {
    /** null until native session initialization finishes. Reports native source initialization, not guaranteed plane results. */
    planeDetection: boolean | null;
};
/** Read initialized native capabilities; a model name never promises a feature. */
export declare function useOpenXRCapabilities(): ViroOpenXRCapabilities | null;
