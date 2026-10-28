/**
 * Copyright (c) 2016-present, Viro Media, Inc.
 * All rights reserved.
 *
 */
import { ViroAnimations } from "./components/Animation/ViroAnimations";
import {
  StudioSceneNavigator,
  StudioARScene,
  StudioRecordingIndicator,
  StudioPlacementIndicator,
  StudioColocationIndicator,
  useStudioRecording,
  useStudioPlacement,
  useStudioColocation,
} from "./components/Studio";
import {
  ViroVisionOSModule,
  isVisionOS,
  enterImmersiveSpace,
  exitImmersiveSpace,
  setInputTuning,
  subscribeSpatialStylus,
  sharedSpaceState,
  sharedSpaceNextOutgoing,
  sharedSpacePushIncoming,
} from "./components/VisionOS/ViroVisionOSModule";
import { Viro3DObject } from "./components/Viro3DObject";
import { Viro360Image } from "./components/Viro360Image";
import { Viro360Video } from "./components/Viro360Video";
import { ViroAnimatedImage } from "./components/ViroAnimatedImage";
import { ViroAmbientLight } from "./components/ViroAmbientLight";
import { ViroAnimatedComponent } from "./components/ViroAnimatedComponent";
import { ViroARCloudAnchor } from "./components/AR/ViroARCloudAnchor";
import { ViroSharedFrame } from "./components/AR/ViroSharedFrame";
import {
  isColocationAvailable,
  joinColocation,
  leaveColocation,
  setColocationLocalPose,
  getColocationState,
  getColocationPeers,
  VIRO_POSE_INTERVAL_MS,
} from "./components/AR/ViroColocation";
import { useViroColocation } from "./components/hooks/useViroColocation";
import { useViroColocationRoom } from "./components/hooks/useViroColocationRoom";
import {
  createColocationRoom,
  formatJoinCode,
  lookupColocationRoom,
  normaliseJoinCode,
} from "./components/AR/ViroColocationRooms";
import { ViroReplicationClient } from "./components/AR/ViroReplication";
import { useViroReplicatedState } from "./components/hooks/useViroReplicatedState";
import {
  useViroSmoothedEntities,
  useViroSmoothedPeers,
} from "./components/hooks/useViroSmoothing";
import {
  approachFactor,
  approachQuat,
  approachVec3,
} from "./components/AR/ViroSmoothing";
import {
  useViroThrottledWrite,
  viroVec3Settled,
  VIRO_REPLICATION_WRITE_INTERVAL_MS,
} from "./components/hooks/useViroThrottledWrite";
import {
  cloudAnchorFrameSource,
  metaSpatialAnchorFrameSource,
  visionOSSharedSpaceFrameSource,
} from "./components/AR/ViroFrameSource";
import {
  parseLocationTransform,
  locationToWorld,
  worldToLocation,
  invertTransform,
  transformDirection,
  poseCsv,
} from "./components/AR/ViroLocationFrame";
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
import {
  ViroARTrackingReasonConstants,
  ViroRecordingErrorConstants,
  ViroTrackingStateConstants,
} from "./components/ViroConstants";
import { ViroController } from "./components/ViroController";
import { ViroVirtualJoystick } from "./components/ViroVirtualJoystick";
import { ViroVirtualButton } from "./components/ViroVirtualButton";
import { ViroGameLoop } from "./components/ViroGameLoop";
import { ViroGameLoopUtils } from "./components/ViroGameLoopUtils";
import {
  useViroMapCamera,
  viroMapCameraTransform,
} from "./components/useViroMapCamera";
import {
  useGameLoop,
  useLateUpdate,
  useFixedUpdate,
} from "./components/hooks/useGameLoop";
import { ViroDirectionalLight } from "./components/ViroDirectionalLight";
import { ViroFlexView } from "./components/ViroFlexView";
import { ViroGeometry } from "./components/ViroGeometry";
import { ViroLightingEnvironment } from "./components/ViroLightingEnvironment";
import { ViroImage } from "./components/ViroImage";
import {
  ViroMaterials,
  ViroMaterial,
  ViroShaderModifiers,
  ViroShaderUniform,
  ViroShaderModifier,
} from "./components/Material/ViroMaterials";
import { ViroMaterialVideo } from "./components/ViroMaterialVideo";
import { ViroCameraTexture } from "./components/ViroCameraTexture";
import { ViroExternalVideo } from "./components/ViroExternalVideo";
export type { ViroExternalVideoProps } from "./components/ViroExternalVideo";
export { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR } from "./components/Utilities/externalVideoUnavailableError";
export type { ViroExternalVideoSourceClass } from "./components/Types/ViroExternalVideoSourceClass";
export type {
  ViroCameraPosition,
  ViroCameraReadyEvent,
} from "./components/ViroCameraTexture";
export type {
  ViroMapCameraState,
  ViroMapCameraOptions,
} from "./components/useViroMapCamera";
export type { ViroARCloudAnchorProps } from "./components/AR/ViroARCloudAnchor";
export type { ViroSharedFrameProps } from "./components/AR/ViroSharedFrame";
export type {
  ViroColocationState,
  ViroColocationPeer,
  ViroColocationConfig,
  ViroColocationJoinResult,
} from "./components/AR/ViroColocation";
export type {
  UseViroColocationResult,
  UseViroColocationOptions,
} from "./components/hooks/useViroColocation";
export type {
  UseViroColocationRoomResult,
  UseViroColocationRoomOptions,
} from "./components/hooks/useViroColocationRoom";
export type {
  ViroColocationRoom,
  ViroColocationRoomsConfig,
  ViroColocationRoomResult,
  ViroFrameKind,
  ViroRoomFrame,
} from "./components/AR/ViroColocationRooms";
export type {
  ViroReplicatedEntity,
  ViroReplicationState,
  ViroReplicationConfig,
  ViroReplicationRejection,
  ViroReplicationRejectReason,
  ViroWriteOptions,
} from "./components/AR/ViroReplication";
export type {
  UseViroReplicatedStateResult,
  UseViroReplicatedStateOptions,
} from "./components/hooks/useViroReplicatedState";
export type {
  ViroFrameSource,
  ViroFrameSupport,
  ViroFrameOutcome,
  ViroFrameSourceContext,
  ViroSharedFrameValue,
} from "./components/AR/ViroFrameSource";
export type { ViroLocationTransform } from "./components/AR/ViroLocationFrame";
export type {
  ViroSmoothingOptions,
  ViroEntitySmoothingOptions,
  ViroSmoothedFields,
} from "./components/hooks/useViroSmoothing";
export type { ViroVec3, ViroQuat } from "./components/AR/ViroSmoothing";
export type {
  ViroThrottledWrite,
  ViroThrottledWriteOptions,
} from "./components/hooks/useViroThrottledWrite";
import { ViroObjectDetector } from "./components/ViroObjectDetector";
export type {
  ViroDetectorMode,
  ViroDetectedObject,
  ViroDetectionBoundingBox,
  ViroDetectionEvent,
  ViroDetectorReadyEvent,
  ViroDetectorErrorEvent,
} from "./components/ViroObjectDetector";
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
import {
  ViroGpuPanel,
  ViroGpuPanelHandle,
  ViroGpuPanelProps,
} from "./components/ViroGpuPanel";
import {
  ViroThreeJSPanel,
  ViroThreeJSPanelHandle,
  ViroThreeJSPanelProps,
} from "./components/ViroThreeJSPanel";
import {
  ViroRivePanel,
  ViroRivePanelHandle,
  ViroRivePanelProps,
} from "./components/ViroRivePanel";
import {
  useEnsureWgpuAdapter,
  UseEnsureWgpuAdapterOptions,
} from "./components/CanvasPanel/useEnsureWgpuAdapter";
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
import {
  hasOpenXRSupport,
  isQuest,
  isKnownQuest,
  isMetaHorizonXR,
  metaHorizonFormFactor,
  isPico,
  isWeb,
  isXRHeadset,
} from "./components/Utilities/ViroPlatform";
import {
  ViroSpatialSceneProvider,
  ViroSpatialWindow,
  getViroSpatialLayoutSupport,
} from "./components/Spatial/ViroSpatialLayout";
export type {
  ViroSpatialFallback,
  ViroSpatialSceneProviderProps,
  ViroSpatialWindowProps,
  ViroSpatialLayoutSupport,
} from "./components/Spatial/ViroSpatialLayout";
import { useAnySourceHover } from "./components/Utilities/useAnySourceHover";
import { useAnySourcePressed } from "./components/Utilities/useAnySourcePressed";
import { ViroTextStyle } from "./components/Styles/ViroTextStyle";
import { ViroStyle } from "./components/Styles/ViroStyle";
import {
  polarToCartesian,
  polarToCartesianActual,
  isARSupportedOnDevice,
  requestRequiredPermissions,
  checkPermissions,
  ViroARSupportResponse,
  ViroPermissionsResult,
  ViroPermission,
  latLngToMercator,
  gpsToArWorld,
} from "./components/Utilities/ViroUtils";
import { ViroARCamera } from "./components/AR/ViroARCamera";
import {
  ViroHoverEvent,
  ViroClickEvent,
  ViroClickStateEvent,
  ViroTouchEvent,
  ViroScrollEvent,
  ViroSwipeEvent,
  ViroFuseEvent,
  ViroPinchEvent,
  ViroRotateEvent,
  ViroDragEvent,
  ViroPlatformEvent,
  ViroCollisionEvent,
  ViroPlatformInfo,
  ViroCameraTransformEvent,
  ViroPlatformUpdateEvent,
  ViroCameraTransform,
  ViroExitViroEvent,
  ViroErrorEvent,
  ViroAnimationStartEvent,
  ViroAnimationFinishEvent,
  ViroLoadStartEvent,
  ViroLoadEndEvent,
  ViroLoadErrorEvent,
  ViroVideoBufferStartEvent,
  ViroVideoBufferEndEvent,
  ViroVideoUpdateTimeEvent,
  ViroVideoErrorEvent,
  ViroVideoFinishEvent,
  ViroAnimatedComponentStartEvent,
  ViroAnimatedComponentFinishEvent,
  ViroARAnchorRemovedEvent,
  ViroARAnchorUpdatedEvent,
  ViroARAnchorFoundEvent,
  ViroAnchor,
  ViroAnchorFoundMap,
  ViroAnchorUpdatedMap,
  ViroPlaneUpdatedMap,
  ViroPlaneUpdatedEvent,
  ViroARPlaneSizes,
  ViroCameraARHitTestEvent,
  ViroCameraARHitTest,
  ViroARHitTestResult,
  ViroARPointCloudUpdateEvent,
  ViroARPointCloud,
  ViroTrackingUpdatedEvent,
  ViroTrackingState,
  ViroTrackingReason,
  ViroAmbientLightUpdateEvent,
  ViroAmbientLightInfo,
  ViroWorldOrigin,
  ViroNativeTransformUpdateEvent,
  ViroControllerStatusEvent,
  ViroControllerStatus,
  ViroPortalEnterEvent,
  ViroPortalExitEvent,
  ViroSoundFinishEvent,
  ViroPinchStateTypes,
  ViroClickStateTypes,
  ViroRotateStateTypes,
  // Provider Types
  ViroProvider,
  // Cloud Anchor Types
  ViroCloudAnchorState,
  ViroCloudAnchorProvider,
  ViroCloudAnchor,
  ViroHostCloudAnchorResult,
  ViroResolveCloudAnchorResult,
  ViroCloudAnchorStateChangeEvent,
  // Geospatial Types
  ViroGeospatialAnchorProvider,
  ViroEarthTrackingState,
  ViroRecordingStatus,
  ViroVPSAvailability,
  ViroGeospatialAnchorType,
  ViroQuaternion,
  ViroGeospatialPose,
  ViroGeospatialAnchor,
  ViroGeospatialSupportResult,
  ViroEarthTrackingStateResult,
  ViroGeospatialPoseResult,
  ViroVPSAvailabilityResult,
  ViroCreateGeospatialAnchorResult,
  // Monocular Depth Estimation Types
  ViroMonocularDepthSupportResult,
  ViroMonocularDepthModelAvailableResult,
  ViroMonocularDepthPreferenceResult,
  // Quest / OpenXR Hand Tracking Types
  ViroJoint,
  ViroHandJoints,
  ViroHandPinchEvent,
  ViroHandUpdateEvent,
  // VPS-Lite scan observability
  ViroScanStatus,
  ViroScanDiagnostics,
} from "./components/Types/ViroEvents";
import { ViroSurface } from "./components/ViroSurface";
import { ViroSceneNavigator } from "./components/ViroSceneNavigator";
import { VIRO_VERSION } from "./components/Utilities/ViroVersion";
import { ViroQuestEntryPoint } from "./components/ViroQuestEntryPoint";
import { VRQuestNavigatorBridge } from "./components/Utilities/VRQuestNavigatorBridge";
import {
  VRModuleOpenXR,
  useVRViewTag,
  exitVRScene,
  setPassthroughStyle,
  triggerHaptic,
  getOpenXRRuntimeCapabilities,
} from "./components/Utilities/VRModuleOpenXR";
import type {
  VRModuleOpenXRType,
  ViroCaptureResult,
  ViroPassthroughStyle,
  ViroHapticHand,
  ViroTrackingOrigin,
  ViroOpenXRRuntimeCapabilities,
} from "./components/Utilities/VRModuleOpenXR";
import { StreamingAudioManager } from "./components/Utilities/StreamingAudioManager";
import {
  hasViroEngineCapability,
} from "./components/Engine/ViroEngineContract";
import type {
  ViroEngineBackend,
  ViroEngineCapability,
  ViroEngineContractInfo,
  ViroEngineDomain,
  ViroEngineBackendPreference,
} from "./components/Engine/ViroEngineContract";
import {
  getViroEngineContractInfo,
  setViroEngineBackendPreference,
  getViroEngineBackendPreference,
} from "./components/Engine/ViroEngineContractNative";
import {
  getViroXRRuntime,
  hasViroXRRuntimeCapability,
  isViroSpecsRuntime,
} from "./components/Specs/ViroSpecsRuntime";
import { ViroSpecsScene } from "./components/Specs/ViroSpecsScene";
import { createViroSpecsARRuntime } from "./components/Specs/ViroSpecsAR";
import { AppRegistry } from "react-native";

// Auto-register the Quest VR entry point. VRActivity launches this component
// as 'VRQuestScene'. Registering here means apps need no manual setup.
// Apps that need a custom VR root can re-register after importing this package.
AppRegistry.registerComponent("VRQuestScene", () => ViroQuestEntryPoint);

export {
  ViroSpecsScene,
  ViroSpatialSceneProvider,
  ViroSpatialWindow,
  getViroSpatialLayoutSupport,
  ViroARCloudAnchor,
  ViroSharedFrame,
  cloudAnchorFrameSource,
  metaSpatialAnchorFrameSource,
  visionOSSharedSpaceFrameSource,
  isColocationAvailable,
  joinColocation,
  leaveColocation,
  setColocationLocalPose,
  getColocationState,
  getColocationPeers,
  VIRO_POSE_INTERVAL_MS,
  useViroColocation,
  useViroColocationRoom,
  createColocationRoom,
  lookupColocationRoom,
  normaliseJoinCode,
  formatJoinCode,
  ViroReplicationClient,
  useViroReplicatedState,
  useViroSmoothedPeers,
  useViroSmoothedEntities,
  approachFactor,
  approachVec3,
  approachQuat,
  useViroThrottledWrite,
  viroVec3Settled,
  VIRO_REPLICATION_WRITE_INTERVAL_MS,
  ViroARImageMarker,
  ViroARObjectMarker,
  ViroARTrackingTargets,
  ViroARPlane,
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroBox,
  ViroButton,
  ViroCamera,
  ViroController,
  ViroVirtualJoystick,
  ViroVirtualButton,
  ViroGameLoop,
  ViroGameLoopUtils,
  parseLocationTransform,
  locationToWorld,
  worldToLocation,
  invertTransform,
  transformDirection,
  poseCsv,
  useViroMapCamera,
  viroMapCameraTransform,
  useGameLoop,
  useLateUpdate,
  useFixedUpdate,
  ViroDirectionalLight,
  ViroFlexView,
  ViroGeometry,
  ViroLightingEnvironment,
  ViroImage,
  ViroMaterials,
  ViroARCamera,
  ViroMaterialVideo,
  ViroCameraTexture,
  ViroExternalVideo,
  ViroObjectDetector,
  ViroNode,
  ViroOmniLight,
  ViroOrbitCamera,
  ViroParticleEmitter,
  ViroPolygon,
  ViroPolyline,
  ViroPortal,
  ViroPortalScene,
  ViroQuad,
  ViroGpuPanel,
  ViroGpuPanelHandle,
  ViroGpuPanelProps,
  ViroThreeJSPanel,
  ViroThreeJSPanelHandle,
  ViroThreeJSPanelProps,
  ViroRivePanel,
  ViroRivePanelHandle,
  ViroRivePanelProps,
  useEnsureWgpuAdapter,
  UseEnsureWgpuAdapterOptions,
  ViroScene,
  ViroSurface,
  ViroSceneNavigator,
  ViroSkyBox,
  ViroAnimations,
  Viro3DObject,
  Viro360Image,
  Viro360Video,
  ViroAnimatedImage,
  ViroAmbientLight,
  ViroAnimatedComponent,
  ViroSound,
  ViroSoundField,
  ViroSpatialSound,
  ViroSphere,
  ViroSpinner,
  ViroSpotLight,
  ViroText,
  ViroVideo,
  ViroVRSceneNavigator,
  ViroXRSceneNavigator,
  ViroQuestEntryPoint,
  // Quest bridge — for custom VR roots and VRModuleOpenXR viewTag access
  VRQuestNavigatorBridge,
  VRModuleOpenXR,
  useVRViewTag,
  exitVRScene,
  setPassthroughStyle,
  triggerHaptic,
  getOpenXRRuntimeCapabilities,
  Viro3DSceneNavigator,
  // Streaming audio
  StreamingAudioManager,
  // Engine contract
  getViroEngineContractInfo,
  hasViroEngineCapability,
  setViroEngineBackendPreference,
  getViroEngineBackendPreference,
  // Specs / universal XR runtime
  getViroXRRuntime,
  hasViroXRRuntimeCapability,
  isViroSpecsRuntime,
  // Utilities
  hasOpenXRSupport,
  isQuest,
  isKnownQuest,
  isMetaHorizonXR,
  metaHorizonFormFactor,
  isPico,
  isWeb,
  isXRHeadset,
  useAnySourceHover,
  useAnySourcePressed,
  ViroARTrackingReasonConstants,
  ViroRecordingErrorConstants,
  ViroTrackingStateConstants,
  polarToCartesian,
  polarToCartesianActual,
  isARSupportedOnDevice,
  requestRequiredPermissions,
  checkPermissions,
  latLngToMercator,
  gpsToArWorld,
  // Types
  ViroARSupportResponse,
  ViroPermissionsResult,
  ViroPermission,
  ViroHoverEvent,
  ViroClickEvent,
  ViroClickStateEvent,
  ViroClickStateTypes,
  ViroTouchEvent,
  ViroScrollEvent,
  ViroSwipeEvent,
  ViroFuseEvent,
  ViroPinchEvent,
  ViroPinchStateTypes,
  ViroRotateEvent,
  ViroRotateStateTypes,
  ViroDragEvent,
  ViroPlatformEvent,
  ViroCollisionEvent,
  ViroPlatformInfo,
  ViroCameraTransformEvent,
  ViroPlatformUpdateEvent,
  ViroCameraTransform,
  ViroExitViroEvent,
  ViroErrorEvent,
  ViroAnimationStartEvent,
  ViroAnimationFinishEvent,
  ViroLoadStartEvent,
  ViroLoadEndEvent,
  ViroLoadErrorEvent,
  ViroVideoBufferStartEvent,
  ViroVideoBufferEndEvent,
  ViroVideoUpdateTimeEvent,
  ViroVideoErrorEvent,
  ViroVideoFinishEvent,
  ViroAnimatedComponentStartEvent,
  ViroAnimatedComponentFinishEvent,
  ViroARAnchorRemovedEvent,
  ViroARAnchorUpdatedEvent,
  ViroARAnchorFoundEvent,
  ViroAnchor,
  ViroAnchorFoundMap,
  ViroAnchorUpdatedMap,
  ViroPlaneUpdatedMap,
  ViroPlaneUpdatedEvent,
  ViroARPlaneSizes,
  ViroCameraARHitTestEvent,
  ViroCameraARHitTest,
  ViroARHitTestResult,
  ViroARPointCloudUpdateEvent,
  ViroARPointCloud,
  ViroTrackingUpdatedEvent,
  ViroTrackingState,
  ViroTrackingReason,
  ViroAmbientLightUpdateEvent,
  ViroAmbientLightInfo,
  ViroWorldOrigin,
  ViroNativeTransformUpdateEvent,
  ViroControllerStatusEvent,
  ViroControllerStatus,
  ViroPortalEnterEvent,
  ViroPortalExitEvent,
  ViroSoundFinishEvent,
  ViroTextStyle,
  ViroStyle,
  ViroMaterial,
  ViroShaderModifiers,
  ViroShaderUniform,
  ViroShaderModifier,
  VIRO_VERSION,
  // Provider Types
  ViroProvider,
  // Cloud Anchor Types
  ViroCloudAnchorState,
  ViroCloudAnchorProvider,
  ViroCloudAnchor,
  ViroHostCloudAnchorResult,
  ViroResolveCloudAnchorResult,
  ViroCloudAnchorStateChangeEvent,
  // Geospatial Types
  ViroGeospatialAnchorProvider,
  ViroEarthTrackingState,
  ViroRecordingStatus,
  ViroVPSAvailability,
  ViroGeospatialAnchorType,
  ViroQuaternion,
  ViroGeospatialPose,
  ViroGeospatialAnchor,
  ViroGeospatialSupportResult,
  ViroEarthTrackingStateResult,
  ViroGeospatialPoseResult,
  ViroVPSAvailabilityResult,
  ViroCreateGeospatialAnchorResult,
  // Monocular Depth Estimation Types
  ViroMonocularDepthSupportResult,
  ViroMonocularDepthModelAvailableResult,
  ViroMonocularDepthPreferenceResult,
  // Quest / OpenXR Hand Tracking Types
  ViroJoint,
  ViroHandJoints,
  ViroHandPinchEvent,
  ViroHandUpdateEvent,
  // VPS-Lite scan observability
  ViroScanStatus,
  ViroScanDiagnostics,
  // Studio Integration
  StudioSceneNavigator,
  StudioARScene,
  StudioRecordingIndicator,
  StudioPlacementIndicator,
  StudioColocationIndicator,
  useStudioRecording,
  useStudioPlacement,
  useStudioColocation,
  // VisionOS
  ViroVisionOSModule,
  isVisionOS,
  enterImmersiveSpace,
  sharedSpaceState,
  sharedSpaceNextOutgoing,
  sharedSpacePushIncoming,
  exitImmersiveSpace,
  setInputTuning,
  subscribeSpatialStylus,
};

export type {
  VRModuleOpenXRType,
  ViroCaptureResult,
  ViroPassthroughStyle,
  ViroHapticHand,
  ViroTrackingOrigin,
  ViroOpenXRRuntimeCapabilities,
};
export type {
  ImmersiveSpaceStyle,
  ViroInputTuning,
  ViroSharedSpaceState,
  ViroSpatialStylusSample,
} from "./components/VisionOS/ViroVisionOSModule";

export type {
  StudioSceneResponse,
  StudioAsset,
  StudioAnimation,
  StudioCollisionBinding,
  StudioSceneFunction,
  StudioSceneMeta,
  StudioProjectMeta,
  StudioSceneNavigatorHandle,
  StudioSceneNavigatorProps,
  StudioApiError,
  StudioApiErrorFields,
  StudioColocationErrorCode,
  StudioColocationOptions,
  StudioColocationRoom,
  StudioColocationState,
  StudioQuestMenuItem,
} from "./components/Studio";

export { isStudioApiError } from "./components/Studio";



export type {
  ViroXRRuntimeKind,
  ViroXRRuntimeCapability,
  ViroXRRuntimeCapabilityState,
  ViroXRRuntimeInfo,
} from "./components/Specs/ViroSpecsRuntime";


export type {
  ViroSpecsSceneProps,
  ViroSpecsSceneTransport,
} from "./components/Specs/ViroSpecsScene";
export type {
  ViroSpecsCompiledScene,
  ViroSpecsInteractionEvent,
  ViroSpecsPortableNode,
  ViroSpecsPortablePolyline,
  ViroSpecsSceneSnapshot,
  ViroSpecsSourceResolver,
} from "./components/Specs/ViroSpecsCompiler";


export type {
  ViroSpecsARRuntime,
  ViroSpecsHitTestRequest,
  ViroSpecsHitTestResult,
  ViroSpecsPlacementMode,
  ViroSpecsPlacementPose,
} from "./components/Specs/ViroSpecsAR";
export type { ViroSpecsAnimationPlan } from "./components/Specs/ViroSpecsCompiler";

// Specs typed actions and state
export {
  VIRO_SPECS_ACTION_ID_PATTERN,
  checkSpecsActionPayload,
  defineSpecsActions,
  specsTrigger,
} from "./components/Specs/core/actions";
export type {
  ViroSpecsActionDeclaration,
  ViroSpecsActionField,
  ViroSpecsActionFieldType,
  ViroSpecsActionPayload,
  ViroSpecsActionPayloads,
  ViroSpecsActionSet,
  ViroSpecsActionSpec,
  ViroSpecsActionTrigger,
  ViroSpecsActionTriggerEvent,
  ViroSpecsActionValue,
} from "./components/Specs/core/actions";
export {
  bindSpecsActionsToStore,
  createSpecsActionDispatcher,
  resolveSpecsTriggers,
} from "./components/Specs/ViroSpecsActions";
export type {
  ViroSpecsActionDispatcher,
  ViroSpecsActionDispatcherOptions,
  ViroSpecsActionEvent,
  ViroSpecsActionHandlers,
  ViroSpecsActionReducers,
  ViroSpecsStateStore,
} from "./components/Specs/ViroSpecsActions";
export type { ViroSpecsCompileOptions } from "./components/Specs/ViroSpecsCompiler";
export type { ViroSpecsScroll } from "./components/Specs/core/manifest";

// Specs manifest v2 and diagnostics
export {
  VIRO_SPECS_DIAGNOSTICS,
} from "./components/Specs/core/diagnosticCodes";
export type {
  ViroSpecsDiagnosticCode,
  ViroSpecsDiagnosticDefinition,
  ViroSpecsDiagnosticSeverity,
} from "./components/Specs/core/diagnosticCodes";
export {
  createViroSpecsDiagnostic,
  formatViroSpecsDiagnostic,
  hasViroSpecsErrors,
} from "./components/Specs/core/diagnostic";
export type {
  ViroSpecsDiagnostic,
  ViroSpecsDiagnosticDetails,
} from "./components/Specs/core/diagnostic";
export {
  VIRO_SPECS_MANIFEST_SCHEMA_ID,
  VIRO_SPECS_MANIFEST_VERSION,
  VIRO_SPECS_SCENE_PROTOCOL_VERSION,
  VIRO_SPECS_SCENE_DOCUMENT_PROTOCOL_VERSION,
} from "./components/Specs/core/manifest";
export type {
  ViroSpecsSceneDocument,
  ViroSpecsSceneDocumentNode,
  ViroSpecsAmbientLight,
  ViroSpecsAnimationTarget,
  ViroSpecsAnimationTrack,
  ViroSpecsButtonAuthoredState,
  ViroSpecsButtonVisualState,
  ViroSpecsComponentSpec,
  ViroSpecsComponentType,
  ViroSpecsDirectionalLight,
  ViroSpecsEasing,
  ViroSpecsExtents,
  ViroSpecsGroupNode,
  ViroSpecsImageNode,
  ViroSpecsLight,
  ViroSpecsManifestAnimation,
  ViroSpecsManifestGenerator,
  ViroSpecsManifestInteraction,
  ViroSpecsManifestNode,
  ViroSpecsManifestPolyline,
  ViroSpecsManifestV1,
  ViroSpecsManifestV2,
  ViroSpecsMaterial,
  ViroSpecsModelFormat,
  ViroSpecsModelViewerSpec,
  ViroSpecsPanelButtonSpec,
  ViroSpecsPanelImageSpec,
  ViroSpecsPanelTextSpec,
  ViroSpecsScrollViewSpec,
  ViroSpecsSpatialPanelSpec,
  ViroSpecsTextRole,
  ViroSpecsModelNode,
  ViroSpecsNodeKind,
  ViroSpecsOmniLight,
  ViroSpecsPanelNode,
  ViroSpecsQuat,
  ViroSpecsSoundNode,
  ViroSpecsSpotLight,
  ViroSpecsTextNode,
  ViroSpecsTextStyle,
  ViroSpecsVec3,
  ViroSpecsVideoNode,
  ViroSpecsWireNode,
  ViroSpecsWireNodeKind,
  ViroSpecsWireSceneSnapshot,
} from "./components/Specs/core/manifest";
export { migrateSpecsManifest } from "./components/Specs/core/migrate";
export {
  parseSpecsManifest,
  parseSpecsManifestJson,
} from "./components/Specs/core/parse";
export {
  validateSpecsManifestV2,
  validateSpecsSceneSnapshot,
} from "./components/Specs/core/validate";
export type {
  ViroSpecsValidationContext,
  ViroSpecsValidationResult,
} from "./components/Specs/core/validate";
export { toSpecsSceneDocument, toSpecsSceneSnapshot } from "./components/Specs/core/lower";
export {
  checkSpecsExperience,
  VIRO_SPECS_EXPERIENCE_CODES,
  VIRO_SPECS_TEXT_EM_METERS_PER_POINT,
} from "./components/Specs/core/experience";
export {
  resolveSpecsTokens,
  specsAngleToMeters,
  specsMetersToAngle,
  VIRO_SPECS_DEFAULT_THEME,
  VIRO_SPECS_HIGH_CONTRAST_TOKENS,
  VIRO_SPECS_SPATIAL_TOKENS,
} from "./components/Specs/core/tokens";
export type {
  ViroSpecsExperiencePreferences,
  ViroSpecsHighContrastTokens,
  ViroSpecsSpatialTokens,
  ViroSpecsTheme,
} from "./components/Specs/core/tokens";
export {
  ModelViewer,
  PanelButton,
  PanelImage,
  PanelText,
  SpatialPanel,
  SpatialScrollView,
} from "./components/Specs/premium";
export type {
  ModelViewerProps,
  PanelButtonProps,
  PanelImageProps,
  PanelTextProps,
  PremiumBaseProps,
  SpatialPanelProps,
  SpatialScrollViewProps,
} from "./components/Specs/premium";
export type { ViroSpecsLoweredScene } from "./components/Specs/core/lower";
export {
  VIRO_SPECS_UNSUPPORTED_FEATURE_STATUS,
} from "./components/Specs/core/capabilities";
export type {
  ViroSpecsCapabilityStatus,
  ViroSpecsEvidenceLabel,
  ViroSpecsUnsupportedFeature,
} from "./components/Specs/core/capabilities";
export { applySpecsManifest } from "./components/Specs/applySpecsManifest";
export type { ViroSpecsApplyResult } from "./components/Specs/applySpecsManifest";
