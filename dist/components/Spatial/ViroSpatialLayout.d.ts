/**
 * Compatibility facade for Meta VR Layout SDK spatial windows.
 *
 * The Meta packages stay optional peers. On Android, when they are installed,
 * this delegates to Meta's compatibility layer, which handles Horizon OS
 * spatial placement and inline/drop fallback on unsupported Android hosts.
 * On iOS, visionOS and web, or if the optional peers are absent, Viro applies
 * the same fallback semantics locally.
 */
import * as React from "react";
export type ViroSpatialFallback = "inline" | "drop";
export interface ViroSpatialSceneProviderProps {
    children?: React.ReactNode;
    [key: string]: unknown;
}
export interface ViroSpatialWindowProps {
    /** Stable identifier used by Meta to preserve placement state. */
    label: string;
    /** Required by Meta's React Native Layout SDK. */
    windowWidth: number;
    /** Required by Meta's React Native Layout SDK. */
    windowHeight: number;
    fallback?: ViroSpatialFallback;
    priority?: number;
    anchor?: unknown;
    children?: React.ReactNode;
    [key: string]: unknown;
}
export interface ViroSpatialLayoutSupport {
    platform: string;
    basePackageAvailable: boolean;
    windowPackageAvailable: boolean;
    nativeSpatialLayoutAvailable: boolean;
}
export declare function getViroSpatialLayoutSupport(): ViroSpatialLayoutSupport;
export declare function ViroSpatialSceneProvider(props: ViroSpatialSceneProviderProps): React.ReactElement;
export declare function ViroSpatialWindow(props: ViroSpatialWindowProps): React.ReactElement | null;
