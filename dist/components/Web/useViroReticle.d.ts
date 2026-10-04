import type { ViroWebRenderer } from "@reactvision/viro-web-renderer";
export interface ViroReticleProps {
    /** Draw the gaze reticle at screen centre. Web default: false. */
    showReticle?: boolean;
}
/** Returns false when the loaded WASM has no reticle switch. */
export declare function setViroReticleVisible(renderer: ViroWebRenderer, visible: boolean): boolean;
export declare function useViroReticle(renderer: ViroWebRenderer | null, { showReticle }: ViroReticleProps): void;
