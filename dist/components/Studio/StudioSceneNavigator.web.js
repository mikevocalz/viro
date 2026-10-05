/**
 * Web host/navigator for Studio scenes. Web counterpart of StudioSceneNavigator
 * (native): instead of pushing StudioARScene onto ViroXRSceneNavigator via the
 * native VRTStudioModule, it holds the scene data in state and renders
 * StudioARScene.web inside a web navigator — ViroARSceneNavigator (AR via slam)
 * or Viro3DSceneNavigator (non-AR 3D), chosen from the scene's plane detection.
 *
 * Data source is injected (out of the renderer's scope): pass `sceneData`
 * directly, or a `loadScene(id)` fetcher (also used for NAVIGATION between
 * scenes via the runtime's injectable `navigate` seam). `apiRequestExecutor`
 * (for API_REQUEST functions) is likewise injected.
 */
import * as React from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, } from "react";
import { Viro3DSceneNavigator } from "../Viro3DSceneNavigator.web";
import { ViroARSceneNavigator } from "../AR/ViroARSceneNavigator.web";
import { StudioARScene } from "./StudioARScene.web";
import { StudioPlacementStore, isTapToPlaceAsset } from "./domain/placementStore";
import { studioPlacementBannerStore } from "./domain/placementBannerStore";
import { STUDIO_RENDERER_EFFECTS } from "./domain/studioRendererEffects";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioPlacementIndicator } from "./StudioPlacementIndicator.web";
import { StudioRecordingIndicator } from "./StudioRecordingIndicator.web";
import { StudioColocationIndicator } from "./StudioColocationIndicator.web";
import { studioColocationStore } from "./domain/colocationStore";
/**
 * What the navigators mount as the scene. At module scope on purpose: it used to
 * be a closure built in the render body, so every navigator render handed React
 * a new component type, which unmounts and remounts the whole scene subtree and
 * rebuilds every node in the renderer. A three-image scene rendered three times
 * on first load, and a 29 MB model was fetched twice, doubling peak heap. The
 * props now travel through `viroAppProps`, which both navigators spread onto it.
 */
function StudioSceneRoot({ sceneNavigator: _sceneNavigator, ...props }) {
    return <StudioARScene key={props.sceneData?.scene.id} {...props}/>;
}
const STUDIO_SCENE = { scene: StudioSceneRoot };
function isARScene(sceneData) {
    const mode = (sceneData?.scene?.plane_detection ?? "NONE").toUpperCase();
    return mode === "AUTOMATIC" || mode === "MANUAL";
}
/**
 * The tap surface for guided placement, and the only writer of the prompt state.
 *
 * Mounted only while the queue is waiting on an asset, so it never swallows a
 * tap meant for the scene's own click handlers. The visible pill is a separate
 * indicator the host positions in its own chrome; this publishes what it shows.
 *
 * Screen point to canvas pixels: the hit test works in the renderer's drawing
 * buffer, which is not the element's CSS size on a scaled display or under a
 * `devicePixelRatio` other than 1.
 */
const StudioPlacementOverlay = ({ store, apiRef, getName }) => {
    const [activeId, setActiveId] = useState(() => store.activeAssetId());
    const missTimerRef = useRef(null);
    useEffect(() => {
        setActiveId(store.activeAssetId());
        return store.subscribeActive(() => setActiveId(store.activeAssetId()));
    }, [store]);
    useEffect(() => {
        studioPlacementBannerStore.set(!!activeId, activeId ? getName(activeId) : null);
    }, [activeId, getName]);
    useEffect(() => () => {
        if (missTimerRef.current)
            clearTimeout(missTimerRef.current);
        studioPlacementBannerStore.reset();
    }, []);
    const handlePointerUp = useCallback((evt) => {
        const api = apiRef.current;
        if (!api)
            return;
        const target = evt.currentTarget;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0)
            return;
        const canvas = target.parentElement?.querySelector("canvas");
        const bufferW = canvas?.width ?? rect.width;
        const bufferH = canvas?.height ?? rect.height;
        const x = ((evt.clientX - rect.left) / rect.width) * bufferW;
        const y = ((evt.clientY - rect.top) / rect.height) * bufferH;
        void api.placeAtScreenPoint(x, y).then((result) => {
            if (result !== "miss") {
                studioPlacementBannerStore.setShowMiss(false);
                return;
            }
            studioPlacementBannerStore.setShowMiss(true);
            if (missTimerRef.current)
                clearTimeout(missTimerRef.current);
            missTimerRef.current = setTimeout(() => studioPlacementBannerStore.setShowMiss(false), 2500);
        });
    }, [apiRef]);
    if (!activeId)
        return null;
    return (<div onPointerUp={handlePointerUp} style={{
            position: "absolute",
            inset: 0,
            // Above the canvas and below the pills, which set pointerEvents none.
            zIndex: 1,
            touchAction: "none",
        }}/>);
};
export const StudioSceneNavigator = forwardRef((props, ref) => {
    const { recordingIndicator = true, placementIndicator = true, colocation, colocationIndicator = true, onColocationStateChange, arOptions, onSessionReady, onMotionUnavailable, sceneData: injectedSceneData, loadScene, sceneId, apiRequestExecutor, mode, webRendererOptions, slamScriptUrl, onSceneReady, onError, onAssetError, onRendererAbort, onSceneChange, onSceneLoaded, onPlaneDetected, onUnsupported, noAssetsMessage, loadingView, renderError, } = props;
    const containerRef = useRef(null);
    // Session-scoped variable store (survives NAVIGATION between scenes).
    const variableStoreRef = useRef(null);
    if (variableStoreRef.current === null)
        variableStoreRef.current = new StudioVariableStore();
    // The guided placement queue, and the scene's imperative handle onto it.
    const placementStoreRef = useRef(null);
    const placementApiRef = useRef(null);
    const [sceneData, setSceneData] = useState(injectedSceneData);
    const [error, setError] = useState(null);
    const onSceneLoadedRef = useRef(onSceneLoaded);
    onSceneLoadedRef.current = onSceneLoaded;
    const onColocationStateChangeRef = useRef(onColocationStateChange);
    onColocationStateChangeRef.current = onColocationStateChange;
    const colocationRequested = colocation !== undefined;
    // Idle is only news after a failure was reported, as on native.
    const colocationReportedRef = useRef(false);
    const [colocationStoreOwner] = useState(() => ({}));
    useEffect(() => {
        if (!colocationRequested && !colocationReportedRef.current)
            return;
        colocationReportedRef.current = colocationRequested;
        const state = colocationRequested
            ? {
                status: "failed",
                code: "FRAME_KIND_UNSUPPORTED",
                message: "Co-location rooms need a phone or headset: a browser cannot align with a device's scan.",
            }
            : { status: "idle" };
        studioColocationStore.set(state, colocationStoreOwner);
        onColocationStateChangeRef.current?.(state);
    }, [colocationRequested, colocationStoreOwner]);
    useEffect(() => () => studioColocationStore.reset(colocationStoreOwner), [colocationStoreOwner]);
    // The navigators read their renderer options once, when they create it.
    const onRendererAbortRef = useRef(onRendererAbort);
    onRendererAbortRef.current = onRendererAbort;
    const rendererOptions = useMemo(() => ({
        ...webRendererOptions,
        onAbort: (err) => {
            webRendererOptions?.onAbort?.(err);
            onRendererAbortRef.current?.(err);
            setError(err);
        },
    }), [webRendererOptions]);
    const applyScene = useCallback((next) => {
        setSceneData(next);
        onSceneLoadedRef.current?.(next);
    }, []);
    // Initial load: prefer injected data, else fetch by id.
    useEffect(() => {
        if (injectedSceneData) {
            applyScene(injectedSceneData);
            return;
        }
        if (!sceneId || !loadScene)
            return;
        let cancelled = false;
        loadScene(sceneId)
            .then((data) => !cancelled && applyScene(data))
            .catch((err) => {
            if (cancelled)
                return;
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            onError?.(e);
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sceneId, injectedSceneData]);
    // NAVIGATION seam: fetch the target scene and re-render.
    const navigate = useCallback((targetSceneId) => {
        if (!loadScene) {
            console.warn("[Studio web] navigate ignored: no loadScene provided");
            return;
        }
        loadScene(targetSceneId)
            .then((data) => applyScene(data))
            .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))));
    }, [loadScene, applyScene, onError]);
    useImperativeHandle(ref, () => ({
        takeScreenshot: async (fileName) => {
            const canvas = containerRef.current?.querySelector("canvas");
            if (!canvas)
                return { success: false };
            try {
                return { success: true, url: canvas.toDataURL("image/png") };
            }
            catch {
                return { success: false };
            }
        },
        leaveColocation: () => { },
        retryColocation: () => false,
        getColocationRoom: () => null,
        finishColocationScan: () => false,
    }), []);
    // Owned here rather than in the scene so the prompt can read the same queue
    // the tap surface drives, and so neither survives a scene change.
    const placementStore = (placementStoreRef.current ??= new StudioPlacementStore());
    const placementNames = new Map((sceneData?.assets ?? [])
        .filter(isTapToPlaceAsset)
        .map((a) => [a.id, a.name ?? ""]));
    const getPlacementName = (assetId) => placementNames.get(assetId) ?? null;
    if (error && renderError)
        return <>{renderError(error)}</>;
    if (!sceneData)
        return <>{loadingView ?? null}</>;
    const resolvedMode = mode ?? (isARScene(sceneData) ? "ar" : "3d");
    const sceneProps = {
        placementApiRef,
        placementStore,
        sceneData,
        mode: resolvedMode,
        apiRequestExecutor,
        navigate,
        onReady: onSceneReady,
        onSceneChange,
        onPlaneDetected,
        onUnsupported,
        onAssetError,
        noAssetsMessage,
        variableStore: variableStoreRef.current ?? undefined,
    };
    // The two HUD pills sit over the canvas rather than in it: they are DOM
    // siblings, so neither the WebGL capture nor a canvas recorder sees them,
    // which is the same guarantee the native ones give. Offsets mirror the
    // native constants (iOS branch — there is no status bar to measure on web).
    const overlay = {
        position: "absolute",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
    };
    return (<div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {resolvedMode === "ar" ? (<ViroARSceneNavigator initialScene={STUDIO_SCENE} viroAppProps={sceneProps} webRendererOptions={rendererOptions} slamScriptUrl={slamScriptUrl} arOptions={{ detectPlanes: true, ...arOptions }} onSessionReady={onSessionReady} onMotionUnavailable={onMotionUnavailable} {...STUDIO_RENDERER_EFFECTS}/>) : (<Viro3DSceneNavigator initialScene={STUDIO_SCENE} viroAppProps={sceneProps} webRendererOptions={rendererOptions} {...STUDIO_RENDERER_EFFECTS}/>)}
      {recordingIndicator && (<div style={{ ...overlay, top: 52 }}>
          <StudioRecordingIndicator />
        </div>)}
      {resolvedMode === "ar" && (<StudioPlacementOverlay store={placementStore} apiRef={placementApiRef} getName={getPlacementName}/>)}
      {placementIndicator && (<div style={{ ...overlay, top: 64, padding: "0 24px", zIndex: 2 }}>
          <StudioPlacementIndicator />
        </div>)}
      {colocationIndicator && (<div style={{ ...overlay, bottom: 40, padding: "0 24px", zIndex: 2 }}>
          <StudioColocationIndicator />
        </div>)}
    </div>);
});
StudioSceneNavigator.displayName = "StudioSceneNavigator";
