"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro360Video = void 0;
const react_1 = require("react");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
const viroWebVideo_1 = require("./Web/viroWebVideo");
exports.Viro360Video = (0, react_1.forwardRef)(function Viro360Video(props, ref) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
    const videoRef = (0, react_1.useRef)(null);
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    (0, react_1.useImperativeHandle)(ref, () => ({
        seekToTime(timeInSeconds) {
            (0, viroWebVideo_1.seekHtmlVideo)(videoRef.current, timeInSeconds);
        },
    }), []);
    (0, react_1.useEffect)(() => {
        if (!url)
            return;
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.playsInline = true;
        video.preload = "auto";
        videoRef.current = video;
        const detachLifecycle = (0, viroWebVideo_1.attachWebVideoLifecycle)(video, () => propsRef.current);
        const stopPump = (0, viroWebVideo_1.startWebVideoTexturePump)(scene, video, (texture) => {
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
    (0, react_1.useEffect)(() => {
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
    (0, react_1.useEffect)(() => {
        scene.setBackgroundRotation((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
    }, [scene, rx, ry, rz]);
    return null;
});
