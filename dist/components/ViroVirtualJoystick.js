/**
 * ViroVirtualJoystick.tsx
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 */
import * as React from "react";
import { Platform, processColor, requireNativeComponent, } from "react-native";
const NativeVirtualJoystick = requireNativeComponent("VRTVirtualJoystickView");
export const ViroVirtualJoystick = (props) => {
    const { tintColor, onStickChange, ...rest } = props;
    const processedTint = tintColor != null ? processColor(tintColor) : undefined;
    // Native sends x/y as strings to avoid Fabric conversions.h type-check spam.
    const handleStickChange = onStickChange
        ? (e) => onStickChange({
            nativeEvent: { x: parseFloat(e.nativeEvent.x), y: parseFloat(e.nativeEvent.y) }
        })
        : undefined;
    return (<NativeVirtualJoystick {...rest} tintColor={processedTint} onStickChange={handleStickChange}/>);
};
if (Platform.OS === "web") {
    // No-op on web; the joystick is a native-only view today.
    // Tracked as a follow-up: HTML/Canvas equivalent for the wasm path.
}
export default ViroVirtualJoystick;
