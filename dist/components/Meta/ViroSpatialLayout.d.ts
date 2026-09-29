import * as React from "react";
export type ViroSpatialWindowFallback = "inline" | "drop";
export type ViroSpatialSceneProviderProps = { children?: React.ReactNode; [key: string]: unknown; };
export type ViroSpatialWindowProps = { label: string; windowWidth?: number; windowHeight?: number; fallback?: ViroSpatialWindowFallback; children?: React.ReactNode; [key: string]: unknown; };
export declare function isMetaSpatialLayoutAvailable(): boolean;
export declare function ViroSpatialSceneProvider({ children, ...props }: ViroSpatialSceneProviderProps): React.ReactElement;
export declare function ViroSpatialWindow({ children, fallback, ...props }: ViroSpatialWindowProps): React.ReactElement | null;
