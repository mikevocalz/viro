/**
 * ViroGameLoop.tsx — headless component that fires per-frame JS callbacks.
 *
 * Mount anywhere inside a ViroARScene or ViroScene to start the loop.
 * The loop automatically stops when the component unmounts.
 *
 * Usage:
 *   <ViroGameLoop onUpdate={(dt, elapsed) => { ... }} />
 *   <ViroGameLoop fixedHz={30} onFixedUpdate={(dt) => { ... }} />
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import React from "react";
import { requireNativeComponent } from "react-native";
const VRTGameLoopView = requireNativeComponent("VRTGameLoopView");
// ── Component ─────────────────────────────────────────────────────────────────
export function ViroGameLoop({ onUpdate, onLateUpdate, onFixedUpdate, fixedHz, }) {
    // Native sends dt/elapsed as strings to avoid Fabric conversions.h type-check spam.
    const parse = (e) => ({
        dt: parseFloat(e.nativeEvent.dt),
        elapsed: parseFloat(e.nativeEvent.elapsed ?? "0"),
    });
    const parseFixed = (e) => ({ dt: parseFloat(e.nativeEvent.dt) });
    return (<VRTGameLoopView onUpdate={onUpdate ? (e) => onUpdate(parse(e)) : undefined} onLateUpdate={onLateUpdate ? (e) => onLateUpdate(parse(e)) : undefined} onFixedUpdate={onFixedUpdate ? (e) => onFixedUpdate(parseFixed(e)) : undefined} fixedHz={fixedHz}/>);
}
