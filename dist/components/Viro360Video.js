/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Viro360Video
 * @flow
 */
"use strict";
import * as React from "react";
import { findNodeHandle, Platform, requireNativeComponent, } from "react-native";
// @ts-ignore
// The visionOS-safe resolver. Image.resolveAssetSource returns an empty uri there;
// see ViroAssetSource.ts for why, and what it falls back to.
import { resolveViroAssetSource as resolveAssetSource } from "./Utilities/ViroAssetSource";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
var NativeModules = require("react-native").NativeModules;
/**
 * Used to render a 360 video on the background sphere.
 */
export class Viro360Video extends React.Component {
    _component = null;
    _onBufferStart = (event) => {
        this.props.onBufferStart && this.props.onBufferStart(event);
    };
    _onBufferEnd = (event) => {
        this.props.onBufferEnd && this.props.onBufferEnd(event);
    };
    _onFinish = () => {
        this.props.onFinish && this.props.onFinish();
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    _onUpdateTime = (event) => {
        this.props.onUpdateTime &&
            this.props.onUpdateTime(event.nativeEvent.currentTime, event.nativeEvent.totalTime);
    };
    setNativeProps = (nativeProps) => {
        this._component?.setNativeProps(nativeProps);
    };
    render() {
        // Viro360Video's view manager is excluded from the visionOS renderer, so React has no view
        // config for it and mounting fails with "View config not found".
        if (isVisionOS) {
            warnUnsupported("Viro360Video", "Apple Vision Pro", "Video textures are not part of the visionOS renderer.");
            return null;
        }
        checkMisnamedProps("Viro360Video", this.props);
        var vidsrc = resolveAssetSource(this.props.source);
        let nativeProps = Object.assign({}, this.props);
        nativeProps.source = vidsrc;
        nativeProps.onBufferStartViro = this._onBufferStart;
        nativeProps.onBufferEndViro = this._onBufferEnd;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.onUpdateTimeViro = this._onUpdateTime;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRO360Video {...nativeProps}/>;
    }
    seekToTime = (timeInSeconds) => {
        switch (Platform.OS) {
            case "ios":
                NativeModules.VRT360VideoManager.seekToTime(findNodeHandle(this), timeInSeconds);
                break;
            case "android":
                NativeModules.UIManager.dispatchViewManagerCommand(findNodeHandle(this), NativeModules.UIManager.VRT360Video.Commands.seekToTime, [timeInSeconds]);
                break;
        }
    };
}
var VRO360Video = requireNativeComponent("VRT360Video", 
// @ts-ignore
Viro360Video, {
    nativeOnly: {
        onBufferStartViro: true,
        onBufferEndViro: true,
        onUpdateTimeViro: true,
        onErrorViro: true,
        onFinishViro: true,
    },
});
