import { type MetaHorizonFormFactor } from "./ViroXRRuntime";
/** True when running through react-native-web. */
export declare const isWeb: boolean;
/** True for Android XR devices in the Meta Horizon OS / OpenXR family. */
export declare const isMetaHorizonXR: boolean;
/**
 * Best-effort *reported* Meta form factor. Horizon compatibility mode can make
 * newer hardware report an older Quest identity, so never use this value as a
 * physical-device or feature-capability guarantee.
 */
export declare const metaHorizonFormFactor: MetaHorizonFormFactor | null;
/**
 * True when Android reports a Quest-compatible identity. Meta VR Glasses may
 * also report a Quest model while Horizon compatibility mode is active.
 * Do not use this flag for feature gating; query the needed capability instead.
 */
export declare const isKnownQuest: boolean;
/**
 * @deprecated Use isMetaHorizonXR for immersive routing. `isKnownQuest` and
 * model strings are diagnostic only because Horizon compatibility mode can
 * report a Quest identity on newer devices. Kept broad for backwards compatibility.
 */
export declare const isQuest: boolean;
/** True for PICO standalone OpenXR hardware. */
export declare const isPico: boolean;
/** True when Viro should use its Android OpenXR immersive path. */
export declare const isXRHeadset: boolean;
/** Build capability, not device identity. */
export declare const hasOpenXRSupport: boolean;
export declare const isVisionOS: boolean;
