/**
 * Copyright © 2026 ReactVision. All rights reserved.
 */
/**
 * Native producer class that feeds a `ViroExternalVideo`.
 *
 * - A string is a fully-qualified Java class, used on Android only. This is the original form and
 *   keeps working unchanged; on iOS and visionOS the Apple default is used instead.
 * - The object form names a class per platform. `android` is a Java class with static
 *   `provideSurface`/`revokeSurface` methods; `apple` is an Objective-C class with the class
 *   methods `provideVideoFramesForSourceKey:consumer:width:height:` and
 *   `revokeVideoFramesForSourceKey:consumer:`. `apple` covers iOS and visionOS.
 *
 * An omitted entry falls back to the react-native-webrtc producer for that platform.
 *
 * Consumed by `ViroExternalVideoProps.sourceClass`.
 */
export type ViroExternalVideoSourceClass = string | {
    /** Fully-qualified Java class of the Android producer. */
    android?: string;
    /** Objective-C class name of the iOS/visionOS producer. */
    apple?: string;
};
