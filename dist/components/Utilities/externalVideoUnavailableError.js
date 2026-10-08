/**
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * Platform-neutral so the package barrel resolves it on every platform, including web, where
 * ViroExternalVideo.web.tsx replaces the native component file.
 */
/**
 * The error ViroExternalVideo reports through `onError` when the native build has no
 * `VRTExternalVideo` view.
 */
export const VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR = "VRTExternalVideo is not registered with React Native. The native build predates the " +
    "iOS/visionOS external-video backend; update @reactvision/react-viro, run pod install and " +
    "rebuild the app.";
