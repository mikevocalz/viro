/**
 * Web implementation of ViroVideo.
 *
 * Uses a reusable GPU source texture when the active WASM renderer supports it,
 * falling back to RGBA uploads for older binaries. Playback lifecycle mirrors
 * the native surface: buffering, time/duration updates, finish, error and seek.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    source: unknown;
    width?: number;
    height?: number;
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
export type ViroWebVideoHandle = {
    seekToTime(timeInSeconds: number): void;
};
export declare const ViroVideo: React.ForwardRefExoticComponent<Omit<Props, "ref"> & React.RefAttributes<ViroWebVideoHandle>>;
export {};
