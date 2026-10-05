import { forwardRef, useEffect, useImperativeHandle, useRef, } from "react";
import { ViroTextureChannel } from "@reactvision/viro-web-renderer";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import { getSharedMaterialHandle } from "./Web/viroMaterialRegistry";
import { attachWebVideoLifecycle, seekHtmlVideo, startWebVideoTexturePump, } from "./Web/viroWebVideo";
export const ViroMaterialVideo = forwardRef(function ViroMaterialVideo(props, ref) {
    const scene = useViroScene();
    const url = resolveImageSource(props.source);
    const materialName = props.material;
    const videoRef = useRef(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    useImperativeHandle(ref, () => ({
        seekToTime(timeInSeconds) {
            seekHtmlVideo(videoRef.current, timeInSeconds);
        },
    }), []);
    useEffect(() => {
        if (!url || !materialName)
            return;
        const material = getSharedMaterialHandle(scene, materialName);
        if (!material)
            return;
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.playsInline = true;
        video.preload = "auto";
        videoRef.current = video;
        const detachLifecycle = attachWebVideoLifecycle(video, () => propsRef.current);
        const stopPump = startWebVideoTexturePump(scene, video, (texture) => {
            scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, texture);
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
    }, [scene, url, materialName]);
    useEffect(() => {
        const video = videoRef.current;
        if (!video)
            return;
        video.loop = props.loop ?? false;
        video.muted = props.muted ?? false;
        if (props.volume != null)
            video.volume = props.volume;
        if (props.paused ?? false)
            video.pause();
        else
            video.play().catch((error) => propsRef.current.onError?.(error));
    }, [props.paused, props.loop, props.muted, props.volume, scene, url, materialName]);
    return null;
});
