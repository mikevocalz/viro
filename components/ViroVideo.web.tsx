/**
 * Web implementation of ViroVideo.
 *
 * Uses a reusable GPU source texture when the active WASM renderer supports it,
 * falling back to RGBA uploads for older binaries. Playback lifecycle mirrors
 * the native surface: buffering, time/duration updates, finish, error and seek.
 */
import * as React from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ViroLightingModel,
  ViroTextureChannel,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import {
  attachWebVideoLifecycle,
  seekHtmlVideo,
  startWebVideoTexturePump,
} from "./Web/viroWebVideo";

type Props = ViroWebNodeProps & {
  source: unknown;
  width?: number;
  height?: number;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  onBufferStart?: () => void;
  onBufferEnd?: () => void;
  onFinish?: () => void;
  onUpdateTime?: (currentTime: number, totalTime: number) => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export type ViroWebVideoHandle = {
  seekToTime(timeInSeconds: number): void;
};

export const ViroVideo = forwardRef<ViroWebVideoHandle, Props>(
  function ViroVideo(props, ref) {
    const scene = useViroScene();
    const url = resolveImageSource(props.source);
    const [aspect, setAspect] = useState(1);
    const slot = useViroFlexSlot();
    const sizePropSet = slot != null || props.width != null || props.height != null;
    const width = slot?.width ?? props.width ?? 1;
    const height = slot?.height ?? props.height ?? (sizePropSet ? 1 : width / aspect);

    const geometryRef = useRef<ViroHandle>(0);
    useViroNode(
      props,
      (s) => {
        const geo = s.createSurface(width, height);
        geometryRef.current = geo;
        return geo;
      },
      true,
      sizePropSet ? undefined : aspect,
    );

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

      const material = scene.createMaterial();
      scene.setMaterialLightingModel(material, ViroLightingModel.Constant);

      const detachLifecycle = attachWebVideoLifecycle(video, () => propsRef.current);
      const stopPump = startWebVideoTexturePump(scene, video, (texture) => {
        const geo = geometryRef.current;
        if (!geo) return;
        scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, texture);
        scene.setGeometryMaterial(geo, material);
      });

      const onMetadata = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setAspect(video.videoWidth / video.videoHeight);
        }
      };
      video.addEventListener("loadedmetadata", onMetadata);
      video.src = url;
      video.load();

      return () => {
        stopPump();
        detachLifecycle();
        video.removeEventListener("loadedmetadata", onMetadata);
        video.pause();
        video.removeAttribute("src");
        video.load();
        videoRef.current = null;
        scene.destroyMaterial(material);
      };
    }, [scene, url]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.loop = props.loop ?? false;
      video.muted = props.muted ?? false;
      if (props.volume != null) video.volume = props.volume;
      if (props.paused ?? false) {
        video.pause();
      } else {
        video.play().catch((error) => propsRef.current.onError?.(error));
      }
    }, [props.paused, props.loop, props.muted, props.volume, url]);

    return null;
  },
);
