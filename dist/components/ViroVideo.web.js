"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroVideo = void 0;
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
const ViroFlexSlotContext_1 = require("./Web/ViroFlexSlotContext");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
const viroWebVideo_1 = require("./Web/viroWebVideo");
exports.ViroVideo = (0, react_1.forwardRef)(function ViroVideo(props, ref) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const [aspect, setAspect] = (0, react_1.useState)(1);
    const slot = (0, ViroFlexSlotContext_1.useViroFlexSlot)();
    const sizePropSet = slot != null || props.width != null || props.height != null;
    const width = slot?.width ?? props.width ?? 1;
    const height = slot?.height ?? props.height ?? (sizePropSet ? 1 : width / aspect);
    const geometryRef = (0, react_1.useRef)(0);
    (0, useViroNode_1.useViroNode)(props, (s) => {
        const geo = s.createSurface(width, height);
        geometryRef.current = geo;
        return geo;
    }, true, sizePropSet ? undefined : aspect);
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
        const material = scene.createMaterial();
        scene.setMaterialLightingModel(material, viro_web_renderer_1.ViroLightingModel.Constant);
        const detachLifecycle = (0, viroWebVideo_1.attachWebVideoLifecycle)(video, () => propsRef.current);
        const stopPump = (0, viroWebVideo_1.startWebVideoTexturePump)(scene, video, (texture) => {
            const geo = geometryRef.current;
            if (!geo)
                return;
            scene.setMaterialTexture(material, viro_web_renderer_1.ViroTextureChannel.Diffuse, texture);
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
    (0, react_1.useEffect)(() => {
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
