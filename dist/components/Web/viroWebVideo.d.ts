import type { ViroHandle, ViroSceneApi } from "@reactvision/viro-web-renderer";
export type WebVideoLifecycleCallbacks = {
    onBufferStart?: () => void;
    onBufferEnd?: () => void;
    onFinish?: () => void;
    onError?: (error: unknown) => void;
    onUpdateTime?: (currentTime: number, totalTime: number) => void;
};
export declare function attachWebVideoLifecycle(video: HTMLVideoElement, getCallbacks: () => WebVideoLifecycleCallbacks): () => void;
/**
 * Pump video frames into one reusable Viro texture when the current WASM
 * renderer supports source textures. Older binaries fall back to RGBA upload.
 */
export declare function startWebVideoTexturePump(scene: ViroSceneApi, video: HTMLVideoElement, applyTexture: (texture: ViroHandle) => void): () => void;
export declare function seekHtmlVideo(video: HTMLVideoElement | null, seconds: number): void;
