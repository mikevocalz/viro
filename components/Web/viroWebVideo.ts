import type {
  ViroHandle,
  ViroSceneApi,
} from "@reactvision/viro-web-renderer";

export type WebVideoLifecycleCallbacks = {
  onBufferStart?: () => void;
  onBufferEnd?: () => void;
  onFinish?: () => void;
  onError?: (error: unknown) => void;
  onUpdateTime?: (currentTime: number, totalTime: number) => void;
};

function finiteDuration(video: HTMLVideoElement): number {
  return Number.isFinite(video.duration) ? video.duration : 0;
}

export function attachWebVideoLifecycle(
  video: HTMLVideoElement,
  getCallbacks: () => WebVideoLifecycleCallbacks,
): () => void {
  let buffering = false;

  const bufferStart = () => {
    if (buffering) return;
    buffering = true;
    getCallbacks().onBufferStart?.();
  };
  const bufferEnd = () => {
    if (!buffering) return;
    buffering = false;
    getCallbacks().onBufferEnd?.();
  };
  const updateTime = () => {
    getCallbacks().onUpdateTime?.(video.currentTime, finiteDuration(video));
  };
  const finish = () => getCallbacks().onFinish?.();
  const error = () =>
    getCallbacks().onError?.(
      new Error(video.error?.message || "video playback failed"),
    );

  video.addEventListener("loadstart", bufferStart);
  video.addEventListener("waiting", bufferStart);
  video.addEventListener("stalled", bufferStart);
  video.addEventListener("canplay", bufferEnd);
  video.addEventListener("playing", bufferEnd);
  video.addEventListener("loadeddata", bufferEnd);
  video.addEventListener("timeupdate", updateTime);
  video.addEventListener("durationchange", updateTime);
  video.addEventListener("ended", finish);
  video.addEventListener("error", error);

  return () => {
    video.removeEventListener("loadstart", bufferStart);
    video.removeEventListener("waiting", bufferStart);
    video.removeEventListener("stalled", bufferStart);
    video.removeEventListener("canplay", bufferEnd);
    video.removeEventListener("playing", bufferEnd);
    video.removeEventListener("loadeddata", bufferEnd);
    video.removeEventListener("timeupdate", updateTime);
    video.removeEventListener("durationchange", updateTime);
    video.removeEventListener("ended", finish);
    video.removeEventListener("error", error);
  };
}

function requestVideoFrame(video: HTMLVideoElement, cb: () => void): number | null {
  const fn = (video as HTMLVideoElement & {
    requestVideoFrameCallback?: (callback: () => void) => number;
  }).requestVideoFrameCallback;
  return typeof fn === "function" ? fn.call(video, cb) : null;
}

function cancelVideoFrame(video: HTMLVideoElement, id: number): void {
  const fn = (video as HTMLVideoElement & {
    cancelVideoFrameCallback?: (callbackId: number) => void;
  }).cancelVideoFrameCallback;
  if (typeof fn === "function") fn.call(video, id);
}

/**
 * Pump video frames into one reusable Viro texture when the current WASM
 * renderer supports source textures. Older binaries fall back to RGBA upload.
 */
export function startWebVideoTexturePump(
  scene: ViroSceneApi,
  video: HTMLVideoElement,
  applyTexture: (texture: ViroHandle) => void,
): () => void {
  let cancelled = false;
  let rafId = 0;
  let vfcId = 0;
  let texture: ViroHandle = scene.createSourceTexture(true);
  const usesSourceTexture = texture !== 0;

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  if (!usesSourceTexture) {
    canvas = document.createElement("canvas");
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }

  const scheduleNext = () => {
    if (cancelled) return;
    const id = requestVideoFrame(video, uploadFrame);
    if (id != null) vfcId = id;
    else rafId = requestAnimationFrame(uploadFrame);
  };

  const uploadFrame = () => {
    if (cancelled) return;

    if (
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      video.readyState >= video.HAVE_CURRENT_DATA
    ) {
      if (usesSourceTexture) {
        if (scene.updateTextureFromSource(texture, video)) {
          applyTexture(texture);
        }
      } else if (canvas && ctx) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const rgba = ctx.getImageData(0, 0, w, h).data;
        const next = scene.createTextureRGBA(new Uint8Array(rgba), w, h, true);
        applyTexture(next);
        if (texture) scene.destroyTexture(texture);
        texture = next;
      }
    }

    scheduleNext();
  };

  scheduleNext();

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (vfcId) cancelVideoFrame(video, vfcId);
    if (texture) scene.destroyTexture(texture);
  };
}

export function seekHtmlVideo(video: HTMLVideoElement | null, seconds: number): void {
  if (!video) return;
  const duration = finiteDuration(video);
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  video.currentTime = duration > 0 ? Math.min(safe, duration) : safe;
}
