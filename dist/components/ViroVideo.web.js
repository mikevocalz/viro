import { forwardRef, useEffect, useImperativeHandle, useRef, useState, } from "react";
import { ViroLightingModel, ViroTextureChannel, } from "@reactvision/viro-web-renderer";
import { useViroNode } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import { attachWebVideoLifecycle, seekHtmlVideo, startWebVideoTexturePump, } from "./Web/viroWebVideo";
export const ViroVideo = forwardRef(function ViroVideo(props, ref) {
    const scene = useViroScene();
    const url = resolveImageSource(props.source);
    const [aspect, setAspect] = useState(1);
    const slot = useViroFlexSlot();
    const sizePropSet = slot != null || props.width != null || props.height != null;
    const width = slot?.width ?? props.width ?? 1;
    const height = slot?.height ?? props.height ?? (sizePropSet ? 1 : width / aspect);
    const geometryRef = useRef(0);
    useViroNode(props, (s) => {
        const geo = s.createSurface(width, height);
        geometryRef.current = geo;
        return geo;
    }, true, sizePropSet ? undefined : aspect);
    const videoRef = useRef(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    useImperativeHandle(ref, () => ({
        seekToTime(timeInSeconds) {
            seekHtmlVideo(videoRef.current, timeInSeconds);
        },
    }), []);
    useEffect(() => {
        if (!url)
            return;
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
            if (!geo)
                return;
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
        if (!video)
            return;
        video.loop = props.loop ?? false;
        video.muted = props.muted ?? false;
        if (props.volume != null)
            video.volume = props.volume;
        if (props.paused ?? false) {
            video.pause();
        }
        else {
            video.play().catch((error) => propsRef.current.onError?.(error));
        }
    }, [props.paused, props.loop, props.muted, props.volume, scene, url]);
    return null;
});
