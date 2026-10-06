/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import * as React from "react";
import { UIManager, findNodeHandle, NativeModules, Platform, requireNativeComponent, } from "react-native";
import { isVisionOS } from "./Utilities/ViroPlatform";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
export class ViroMaterialVideo extends React.Component {
    _component = null;
    componentWillUnmount() {
        // Pause the video texture on unmount to prevent memory leaks
        // Both Android and iOS need explicit pause since GC may not release immediately
        const nodeHandle = findNodeHandle(this);
        if (nodeHandle) {
            if (Platform.OS === "android") {
                // Bridgeless-safe: NativeModules.UIManager is null on New Architecture.
                const cmd = UIManager.getViewManagerConfig?.("VRTMaterialVideo")?.Commands?.pause;
                if (cmd !== undefined) {
                    UIManager.dispatchViewManagerCommand(nodeHandle, cmd, [0]);
                }
            }
            else if (Platform.OS === "ios") {
                // Also pause on iOS to ensure video resources are released
                NativeModules.VRTMaterialVideoManager?.pause?.(nodeHandle);
            }
        }
    }
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
        // ViroMaterialVideo's view manager is excluded from the visionOS renderer, so React has no view
        // config for it and mounting fails with "View config not found".
        if (isVisionOS) {
            warnUnsupported("ViroMaterialVideo", "Apple Vision Pro", "Video textures are not part of the visionOS renderer.");
            return null;
        }
        // Since materials and transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        //let materials = typeof this.props.materials === 'string' ? new Array(this.props.materials) : this.props.materials;
        let nativeProps = Object.assign({}, this.props);
        //nativeProps.materials = materials;
        nativeProps.onBufferStartViro = this._onBufferStart;
        nativeProps.onBufferEndViro = this._onBufferEnd;
        nativeProps.onFinishViro = this._onFinish;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onUpdateTimeViro = this._onUpdateTime;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTMaterialVideo {...nativeProps}/>;
    }
    seekToTime = (timeInSeconds) => {
        switch (Platform.OS) {
            case "ios":
                NativeModules.VRTMaterialVideoManager.seekToTime(findNodeHandle(this), timeInSeconds);
                break;
            case "android": {
                const cmd = UIManager.getViewManagerConfig?.("VRTMaterialVideo")?.Commands?.seekToTime;
                if (cmd !== undefined) {
                    UIManager.dispatchViewManagerCommand(findNodeHandle(this), cmd, [timeInSeconds]);
                }
                break;
            }
        }
    };
}
var VRTMaterialVideo = requireNativeComponent("VRTMaterialVideo", 
// @ts-ignore
ViroMaterialVideo, {
    nativeOnly: {
        onBufferStartViro: true,
        onBufferEndViro: true,
        onUpdateTimeViro: true,
        onFinishViro: true,
        onErrorViro: true,
    },
});
