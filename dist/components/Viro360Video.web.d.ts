/**
 * Web implementation of Viro360Video with native-style playback lifecycle.
 */
import * as React from "react";
type Props = {
    source: unknown;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    rotation?: [number, number, number];
    onBufferStart?: () => void;
    onBufferEnd?: () => void;
    onFinish?: () => void;
    onUpdateTime?: (currentTime: number, totalTime: number) => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export type ViroWeb360VideoHandle = {
    seekToTime(timeInSeconds: number): void;
};
export declare const Viro360Video: React.ForwardRefExoticComponent<Omit<Props, "ref"> & React.RefAttributes<ViroWeb360VideoHandle>>;
export {};
