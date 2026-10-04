/**
 * Web implementation of ViroMaterialVideo with native-style playback lifecycle.
 */
import * as React from "react";
type Props = {
    material?: string;
    source: unknown;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    onBufferStart?: () => void;
    onBufferEnd?: () => void;
    onFinish?: () => void;
    onUpdateTime?: (currentTime: number, totalTime: number) => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export type ViroWebMaterialVideoHandle = {
    seekToTime(timeInSeconds: number): void;
};
export declare const ViroMaterialVideo: React.ForwardRefExoticComponent<Omit<Props, "ref"> & React.RefAttributes<ViroWebMaterialVideoHandle>>;
export {};
