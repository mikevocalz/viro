/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSoundField
 * @flow
 */
"use strict";
import * as React from "react";
import { findNodeHandle, NativeModules, Platform, requireNativeComponent, } from "react-native";
// @ts-ignore
// The visionOS-safe resolver. Image.resolveAssetSource returns an empty uri there;
// see ViroAssetSource.ts for why, and what it falls back to.
import { resolveViroAssetSource as resolveAssetSource } from "./Utilities/ViroAssetSource";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
export class ViroSoundField extends React.Component {
    _component = null;
    _onFinish = (event) => {
        this.props.onFinish && this.props.onFinish(event);
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    setNativeProps = (nativeProps) => {
        this._component?.setNativeProps(nativeProps);
    };
    render() {
        // ViroSoundField's view manager lives in VRTSound.mm, which the podspec excludes from the
        // visionOS renderer, so React has no view config for it and mounting fails with
        // "View config not found".
        if (isVisionOS) {
            warnUnsupported("ViroSoundField", "Apple Vision Pro", "Ambisonic audio is not part of the visionOS renderer.");
            return null;
        }
        checkMisnamedProps("ViroSoundField", this.props);
        var soundSrc = this.props.source;
        if (typeof soundSrc === "number") {
            soundSrc = resolveAssetSource(soundSrc);
        }
        else if (typeof soundSrc === "string") {
            /**
             * @todo
             *
             * This throws a typescript error:
             * Type '{ name: never; }' is not assignable to type 'ImageSourcePropType'.
             * Object literal may only specify known properties, and 'name' does not
             * exist in type 'ImageURISource | ImageURISource[]'.
             *
             * I assume that this works correctly for Viro, but we would need to standardize
             * this or remove this usage. The usage should be {uri: string} or require format
             * to be consistent with images/video.
             */
            soundSrc = { name: soundSrc };
        }
        let nativeProps = Object.assign({}, this.props);
        nativeProps.source = soundSrc;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTSoundField {...nativeProps}/>;
    }
    seekToTime = (timeInSeconds) => {
        switch (Platform.OS) {
            case "ios":
                NativeModules.VRTSoundFieldManager.seekToTime(findNodeHandle(this), timeInSeconds);
                break;
            case "android":
                NativeModules.UIManager.dispatchViewManagerCommand(findNodeHandle(this), NativeModules.UIManager.VRTSoundField.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    };
}
var VRTSoundField = requireNativeComponent("VRTSoundField", 
// @ts-ignore
ViroSoundField, {
    nativeOnly: {
        onFinishViro: true,
        onErrorViro: true,
    },
});
