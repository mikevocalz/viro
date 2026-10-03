/**
 * Web implementation of Viro360Video with native-style playback lifecycle.
 */
import * as React from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import {
  attachWebVideoLifecycle,
  seekHtmlVideo,
  startWebVideoTexturePump,
} from "./Web/viroWebVideo";

type Props = {
  source: unknown;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  rotation?: [number, number, number];
  onBufferStart?: () => void;
  onBufferEnd?: () => void;
  onFinish?: () => void;
  onUpdateTime?: (currentTime: number, totalTime: number) => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export type ViroWeb360VideoHandle = {
  seekToTime(timeInSeconds: number): void;
};

export const Viro360Video = forwardRef<ViroWeb360VideoHandle, Props>(
  function Viro360Video(props, ref) {
    const scene = useViroScene();
    const url = resolveImageSource(props.source);
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;

    useImperativeHandle(
      ref,
      () => ({
        seekToTime(timeInSeconds: number) {
          seekHtmlVideo(videoRef.current, timeInSeconds);
        },
      }),
      [],
    );

    useEffect(() => {
      if (!url) return;

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.playsInline = true;
      video.preload = "auto";
      videoRef.current = video;

      const detachLifecycle = attachWebVideoLifecycle(video, () => propsRef.current);
      const stopPump = startWebVideoTexturePump(scene, video, (texture) => {
        scene.setBackgroundSphere(texture);
      });

      video.src = url;
      video.load();

      return () => {
        stopPump();
        detachLifecycle();
        video.pause();
        video.removeAttribute("src");
        video.load();
        videoRef.current = null;
      };
    }, [scene, url]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.loop = props.loop ?? false;
      video.muted = props.muted ?? false;
      if (props.volume != null) video.volume = props.volume;
      if (props.paused ?? false) video.pause();
      else video.play().catch((error) => propsRef.current.onError?.(error));
    }, [props.paused, props.loop, props.muted, props.volume, url]);

    useEffect(() => {
      scene.setBackgroundRotation(
        (rx * Math.PI) / 180,
        (ry * Math.PI) / 180,
        (rz * Math.PI) / 180,
      );
    }, [scene, rx, ry, rz]);

    return null;
  },
);
