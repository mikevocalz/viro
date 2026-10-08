/**
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * Picks the native producer class for ViroExternalVideo on the current platform.
 */
import type { ViroExternalVideoSourceClass } from "../Types/ViroExternalVideoSourceClass";
/** Java class used on Android when the caller names none: the patched react-native-webrtc bridge. */
export declare const DEFAULT_ANDROID_EXTERNAL_VIDEO_SOURCE_CLASS = "com.oney.WebRTCModule.ExternalVideoSurfaces";
/** Objective-C class used on iOS and visionOS when the caller names none. */
export declare const DEFAULT_APPLE_EXTERNAL_VIDEO_SOURCE_CLASS = "ViroExternalWebRTCFrames";
/**
 * Resolves `sourceClass` for one platform.
 *
 * A plain string is a Java class name, as it was before the Apple backend existed, so on iOS and
 * visionOS it falls back to the Apple default instead of asking the Objective-C runtime for a
 * Java class. Every other platform takes the `apple` entry: visionOS reports
 * `Platform.OS === "ios"`, and web never reaches here because it has its own component file.
 */
export declare function resolveExternalVideoSourceClass(sourceClass: ViroExternalVideoSourceClass | undefined, platformOS: string): string;
