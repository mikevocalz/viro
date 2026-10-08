/**
 * Copyright (c) 2016-present, Viro Media, Inc.
 * All rights reserved.
 *
 */
import { ViroAnimations } from "./components/Animation/ViroAnimations";
import { StudioSceneNavigator, StudioARScene, StudioRecordingIndicator, StudioPlacementIndicator, useStudioRecording, useStudioPlacement, } from "./components/Studio";
import { ViroVisionOSModule, isVisionOS, enterImmersiveSpace, exitImmersiveSpace, setInputTuning, subscribeSpatialStylus, sharedSpaceState, sharedSpaceNextOutgoing, sharedSpacePushIncoming, } from "./components/VisionOS/ViroVisionOSModule";
import { Viro3DObject } from "./components/Viro3DObject";
import { Viro360Image } from "./components/Viro360Image";
import { Viro360Video } from "./components/Viro360Video";
import { ViroAnimatedImage } from "./components/ViroAnimatedImage";
import { ViroAmbientLight } from "./components/ViroAmbientLight";
import { ViroAnimatedComponent } from "./components/ViroAnimatedComponent";
import { ViroARCloudAnchor } from "./components/AR/ViroARCloudAnchor";
import { ViroSharedFrame } from "./components/AR/ViroSharedFrame";
import { isColocationAvailable, joinColocation, leaveColocation, setColocationLocalPose, getColocationState, getColocationPeers, VIRO_POSE_INTERVAL_MS, } from "./components/AR/ViroColocation";
import { useViroColocation } from "./components/hooks/useViroColocation";
import { useViroColocationRoom } from "./components/hooks/useViroColocationRoom";
import { createColocationRoom, formatJoinCode, lookupColocationRoom, normaliseJoinCode, } from "./components/AR/ViroColocationRooms";
import { ViroReplicationClient } from "./components/AR/ViroReplication";
import { useViroReplicatedState } from "./components/hooks/useViroReplicatedState";
import { useViroSmoothedEntities, useViroSmoothedPeers, } from "./components/hooks/useViroSmoothing";
import { approachFactor, approachQuat, approachVec3, } from "./components/AR/ViroSmoothing";
import { useViroThrottledWrite, viroVec3Settled, VIRO_REPLICATION_WRITE_INTERVAL_MS, } from "./components/hooks/useViroThrottledWrite";
import { cloudAnchorFrameSource, metaSpatialAnchorFrameSource, visionOSSharedSpaceFrameSource, } from "./components/AR/ViroFrameSource";
import { parseLocationTransform, locationToWorld, worldToLocation, invertTransform, transformDirection, poseCsv, } from "./components/AR/ViroLocationFrame";
import { ViroARImageMarker } from "./components/AR/ViroARImageMarker";
import { ViroARObjectMarker } from "./components/AR/ViroARObjectMarker";
import { ViroARTrackingTargets } from "./components/AR/ViroARTrackingTargets";
import { ViroARPlane } from "./components/AR/ViroARPlane";
import { ViroARPlaneSelector } from "./components/AR/ViroARPlaneSelector";
import { ViroARScene } from "./components/AR/ViroARScene";
import { ViroARSceneNavigator } from "./components/AR/ViroARSceneNavigator";
import { ViroBox } from "./components/ViroBox";
import { ViroButton } from "./components/ViroButton";
import { ViroCamera } from "./components/ViroCamera";
import { ViroARTrackingReasonConstants, ViroRecordingErrorConstants, ViroTrackingStateConstants, } from "./components/ViroConstants";
import { ViroController } from "./components/ViroController";
import { ViroVirtualJoystick } from "./components/ViroVirtualJoystick";
import { ViroVirtualButton } from "./components/ViroVirtualButton";
import { ViroGameLoop } from "./components/ViroGameLoop";
import { ViroGameLoopUtils } from "./components/ViroGameLoopUtils";
import { useViroMapCamera, viroMapCameraTransform, } from "./components/useViroMapCamera";
import { useGameLoop, useLateUpdate, useFixedUpdate, } from "./components/hooks/useGameLoop";
import { ViroDirectionalLight } from "./components/ViroDirectionalLight";
import { ViroFlexView } from "./components/ViroFlexView";
import { ViroGeometry } from "./components/ViroGeometry";
import { ViroLightingEnvironment } from "./components/ViroLightingEnvironment";
import { ViroImage } from "./components/ViroImage";
import { ViroMaterials, } from "./components/Material/ViroMaterials";
import { ViroMaterialVideo } from "./components/ViroMaterialVideo";
import { ViroCameraTexture } from "./components/ViroCameraTexture";
import { ViroExternalVideo } from "./components/ViroExternalVideo";
export { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR } from "./components/Utilities/externalVideoUnavailableError";
import { ViroObjectDetector } from "./components/ViroObjectDetector";
export { VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR } from "./components/ViroObjectDetector";
import { ViroNode } from "./components/ViroNode";
import { ViroOmniLight } from "./components/ViroOmniLight";
import { ViroOrbitCamera } from "./components/ViroOrbitCamera";
import { ViroParticleEmitter } from "./components/ViroParticleEmitter";
import { ViroPolygon } from "./components/ViroPolygon";
import { ViroPolyline } from "./components/ViroPolyline";
import { ViroPortal } from "./components/ViroPortal";
import { ViroPortalScene } from "./components/ViroPortalScene";
import { ViroQuad } from "./components/ViroQuad";
import { ViroGpuPanel, } from "./components/ViroGpuPanel";
import { ViroThreeJSPanel, } from "./components/ViroThreeJSPanel";
import { ViroRivePanel, } from "./components/ViroRivePanel";
import { useEnsureWgpuAdapter, } from "./components/CanvasPanel/useEnsureWgpuAdapter";
import { ViroScene } from "./components/ViroScene";
import { ViroSkyBox } from "./components/ViroSkyBox";
import { ViroSound } from "./components/ViroSound";
import { ViroSoundField } from "./components/ViroSoundField";
import { ViroSpatialSound } from "./components/ViroSpatialSound";
import { ViroSphere } from "./components/ViroSphere";
import { ViroSpinner } from "./components/ViroSpinner";
import { ViroSpotLight } from "./components/ViroSpotLight";
import { ViroText } from "./components/ViroText";
import { ViroVideo } from "./components/ViroVideo";
import { ViroVRSceneNavigator } from "./components/ViroVRSceneNavigator";
import { ViroXRSceneNavigator } from "./components/ViroXRSceneNavigator";
import { Viro3DSceneNavigator } from "./components/Viro3DSceneNavigator";
import { hasOpenXRSupport, isQuest, isKnownQuest, isMetaHorizonXR, metaHorizonFormFactor, isPico, isWeb, isXRHeadset, } from "./components/Utilities/ViroPlatform";
import { ViroSpatialSceneProvider, ViroSpatialWindow, getViroSpatialLayoutSupport, } from "./components/Spatial/ViroSpatialLayout";
import { useAnySourceHover } from "./components/Utilities/useAnySourceHover";
import { useAnySourcePressed } from "./components/Utilities/useAnySourcePressed";
import { polarToCartesian, polarToCartesianActual, isARSupportedOnDevice, requestRequiredPermissions, checkPermissions, latLngToMercator, gpsToArWorld, } from "./components/Utilities/ViroUtils";
import { ViroARCamera } from "./components/AR/ViroARCamera";
import { ViroPinchStateTypes, ViroClickStateTypes, ViroRotateStateTypes, } from "./components/Types/ViroEvents";
import { ViroSurface } from "./components/ViroSurface";
import { ViroSceneNavigator } from "./components/ViroSceneNavigator";
import { VIRO_VERSION } from "./components/Utilities/ViroVersion";
import { ViroQuestEntryPoint } from "./components/ViroQuestEntryPoint";
import { VRQuestNavigatorBridge } from "./components/Utilities/VRQuestNavigatorBridge";
import { VRModuleOpenXR, useVRViewTag, exitVRScene, setPassthroughStyle, triggerHaptic, getOpenXRRuntimeCapabilities, } from "./components/Utilities/VRModuleOpenXR";
import { StreamingAudioManager } from "./components/Utilities/StreamingAudioManager";
import { hasViroEngineCapability, } from "./components/Engine/ViroEngineContract";
import { getViroEngineContractInfo, setViroEngineBackendPreference, getViroEngineBackendPreference, } from "./components/Engine/ViroEngineContractNative";
import { getViroXRRuntime, hasViroXRRuntimeCapability, isViroSpecsRuntime, } from "./components/Specs/ViroSpecsRuntime";
import { AppRegistry } from "react-native";
// Auto-register the Quest VR entry point. VRActivity launches this component
// as 'VRQuestScene'. Registering here means apps need no manual setup.
// Apps that need a custom VR root can re-register after importing this package.
AppRegistry.registerComponent("VRQuestScene", () => ViroQuestEntryPoint);
export { ViroSpatialSceneProvider, ViroSpatialWindow, getViroSpatialLayoutSupport, ViroARCloudAnchor, ViroSharedFrame, cloudAnchorFrameSource, metaSpatialAnchorFrameSource, visionOSSharedSpaceFrameSource, isColocationAvailable, joinColocation, leaveColocation, setColocationLocalPose, getColocationState, getColocationPeers, VIRO_POSE_INTERVAL_MS, useViroColocation, useViroColocationRoom, createColocationRoom, lookupColocationRoom, normaliseJoinCode, formatJoinCode, ViroReplicationClient, useViroReplicatedState, useViroSmoothedPeers, useViroSmoothedEntities, approachFactor, approachVec3, approachQuat, useViroThrottledWrite, viroVec3Settled, VIRO_REPLICATION_WRITE_INTERVAL_MS, ViroARImageMarker, ViroARObjectMarker, ViroARTrackingTargets, ViroARPlane, ViroARPlaneSelector, ViroARScene, ViroARSceneNavigator, ViroBox, ViroButton, ViroCamera, ViroController, ViroVirtualJoystick, ViroVirtualButton, ViroGameLoop, ViroGameLoopUtils, parseLocationTransform, locationToWorld, worldToLocation, invertTransform, transformDirection, poseCsv, useViroMapCamera, viroMapCameraTransform, useGameLoop, useLateUpdate, useFixedUpdate, ViroDirectionalLight, ViroFlexView, ViroGeometry, ViroLightingEnvironment, ViroImage, ViroMaterials, ViroARCamera, ViroMaterialVideo, ViroCameraTexture, ViroExternalVideo, ViroObjectDetector, ViroNode, ViroOmniLight, ViroOrbitCamera, ViroParticleEmitter, ViroPolygon, ViroPolyline, ViroPortal, ViroPortalScene, ViroQuad, ViroGpuPanel, ViroThreeJSPanel, ViroRivePanel, useEnsureWgpuAdapter, ViroScene, ViroSurface, ViroSceneNavigator, ViroSkyBox, ViroAnimations, Viro3DObject, Viro360Image, Viro360Video, ViroAnimatedImage, ViroAmbientLight, ViroAnimatedComponent, ViroSound, ViroSoundField, ViroSpatialSound, ViroSphere, ViroSpinner, ViroSpotLight, ViroText, ViroVideo, ViroVRSceneNavigator, ViroXRSceneNavigator, ViroQuestEntryPoint, 
// Quest bridge — for custom VR roots and VRModuleOpenXR viewTag access
VRQuestNavigatorBridge, VRModuleOpenXR, useVRViewTag, exitVRScene, setPassthroughStyle, triggerHaptic, getOpenXRRuntimeCapabilities, Viro3DSceneNavigator, 
// Streaming audio
StreamingAudioManager, 
// Engine contract
getViroEngineContractInfo, hasViroEngineCapability, setViroEngineBackendPreference, getViroEngineBackendPreference, 
// Specs / universal XR runtime
getViroXRRuntime, hasViroXRRuntimeCapability, isViroSpecsRuntime, 
// Utilities
hasOpenXRSupport, isQuest, isKnownQuest, isMetaHorizonXR, metaHorizonFormFactor, isPico, isWeb, isXRHeadset, useAnySourceHover, useAnySourcePressed, ViroARTrackingReasonConstants, ViroRecordingErrorConstants, ViroTrackingStateConstants, polarToCartesian, polarToCartesianActual, isARSupportedOnDevice, requestRequiredPermissions, checkPermissions, latLngToMercator, gpsToArWorld, ViroClickStateTypes, ViroPinchStateTypes, ViroRotateStateTypes, VIRO_VERSION, 
// Studio Integration
StudioSceneNavigator, StudioARScene, StudioRecordingIndicator, StudioPlacementIndicator, useStudioRecording, useStudioPlacement, 
// VisionOS
ViroVisionOSModule, isVisionOS, enterImmersiveSpace, sharedSpaceState, sharedSpaceNextOutgoing, sharedSpacePushIncoming, exitImmersiveSpace, setInputTuning, subscribeSpatialStylus, };
export { isStudioApiError } from "./components/Studio";
