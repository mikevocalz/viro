import { forwardRef, useEffect, useImperativeHandle, useRef, } from "react";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import { attachWebVideoLifecycle, seekHtmlVideo, startWebVideoTexturePump, } from "./Web/viroWebVideo";
export const Viro360Video = forwardRef(function Viro360Video(props, ref) {
    const scene = useViroScene();
    const url = resolveImageSource(props.source);
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
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
    }, [props.paused, props.loop, props.muted, props.volume, scene, url]);
    useEffect(() => {
        scene.setBackgroundRotation((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
    }, [scene, rx, ry, rz]);
    return null;
});
