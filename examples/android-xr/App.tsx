import React, { useCallback, useEffect, useRef } from "react";
import {
  exitVRScene,
  getOpenXRRuntimeCapabilities,
  isAndroidXR,
  useVRViewTag,
  ViroAmbientLight,
  ViroBox,
  ViroMaterials,
  ViroScene,
  ViroText,
  ViroXRSceneNavigator,
} from "@reactvision/react-viro";
import { useProbeStore } from "./probeStore";
import { DiagnosticPanel } from "./ui/DiagnosticPanel";

ViroMaterials.createMaterials({
  androidXrProbe: { lightingModel: "Lambert", diffuseColor: "#60A5FA" },
});

const labelStyle = {
  fontFamily: "sans-serif",
  fontSize: 24,
  color: "#FFFFFF",
  textAlign: "center" as const,
};

function ProbeScene() {
  const clicks = useProbeStore((state) => state.clicks);
  const position = useProbeStore((state) => state.cubePosition);
  const viewTag = useVRViewTag();
  const lastPoseLog = useRef(0);

  const reportRuntime = useCallback(async () => {
    const report = useProbeStore.getState().report;
    if (viewTag === null) {
      report("runtime_not_ready");
      return;
    }
    try {
      const capabilities = await getOpenXRRuntimeCapabilities(viewTag);
      // These are the renderer's current reported flags. In particular, the
      // legacy passthrough flag is not a test of Android XR alpha blending.
      report(capabilities ? "runtime_report" : "runtime_not_ready", capabilities);
    } catch (error) {
      report("runtime_report_failed", String(error));
    }
  }, [viewTag]);

  useEffect(() => {
    if (viewTag !== null) void reportRuntime();
  }, [viewTag, reportRuntime]);

  return (
    <ViroScene
      onPlatformUpdate={(platform) => useProbeStore.getState().report("platform", platform)}
      onCameraTransformUpdate={(pose) => {
        // A bounded diagnostic sample, not a per-frame JS rendering loop.
        const now = Date.now();
        if (now - lastPoseLog.current >= 2000) {
          lastPoseLog.current = now;
          useProbeStore.getState().report("head_pose", {
            position: pose.position,
            forward: pose.forward,
          });
        }
      }}
      onError={(event) => useProbeStore.getState().report("scene_error", event.nativeEvent)}
    >
      <ViroAmbientLight color="#FFFFFF" intensity={600} />
      <ViroText
        text={`Android XR probe\nSelections: ${clicks}`}
        position={[0, 0.65, -2]}
        width={2.4}
        height={0.5}
        style={labelStyle}
      />
      <ViroBox
        position={position}
        width={0.3}
        height={0.3}
        length={0.3}
        materials={["androidXrProbe"]}
        dragType="FixedDistance"
        onClick={(point, source) => {
          useProbeStore.getState().select();
          useProbeStore.getState().report("select", { point, source });
        }}
        onClickState={(state, point, source) =>
          useProbeStore.getState().report("select_state", { state, point, source })
        }
        onDrag={(point) => useProbeStore.getState().drag(point)}
      />
      <ViroText
        text="Report runtime"
        position={[-0.6, -0.6, -2]}
        width={1.1}
        height={0.3}
        style={labelStyle}
        onClick={() => void reportRuntime()}
      />
      <ViroText
        text="Exit scene"
        position={[0.6, -0.6, -2]}
        width={1.1}
        height={0.3}
        style={labelStyle}
        onClick={() => {
          useProbeStore.getState().report("exit_requested");
          exitVRScene();
        }}
      />
    </ViroScene>
  );
}

export default function App() {
  if (!isAndroidXR) return <DiagnosticPanel />;

  return (
    <ViroXRSceneNavigator
      initialScene={{ scene: ProbeScene }}
      trackingOrigin="eye"
      passthroughEnabled={false}
      questPermissions={[]}
      onExitViro={() => useProbeStore.getState().report("system_back")}
      renderQuestPanel={(enter) => <DiagnosticPanel onEnter={enter} />}
      style={{ flex: 1 }}
    />
  );
}
