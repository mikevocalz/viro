/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
import * as React from "react";
import { findNodeHandle, NativeModules, requireNativeComponent, } from "react-native";
import { ViroBase } from "./ViroBase";
import { ViroSceneContext } from "./ViroSceneContext";
import { ViroActiveCameraTracker } from "./Utilities/ViroActiveCameraTracker";
export class ViroScene extends ViroBase {
    state = { activeCameraTag: null };
    _unmounting = false;
    // One tracker for the component's life, so the context value is stable and the cameras do
    // not re-render on every render of the scene.
    _cameras = new ViroActiveCameraTracker((activeCameraTag) => {
        // A camera unmounting with the whole scene still reports in; the scene is past rendering.
        if (!this._unmounting) {
            this.setState({ activeCameraTag });
        }
    });
    componentWillUnmount() {
        this._unmounting = true;
    }
    _onPlatformUpdate = (event) => {
        /**
         * ##### DEPRECATION WARNING - 'vrPlatform' is deprecated in favor of 'platform'! Support
         * for 'vrPlatform' may be removed in the future.
         */
        event.nativeEvent.platformInfoViro.vrPlatform =
            event.nativeEvent.platformInfoViro.platform;
        this.props.onPlatformUpdate &&
            this.props.onPlatformUpdate(event.nativeEvent.platformInfoViro);
    };
    _onCameraTransformUpdate = (event) => {
        const cameraTransform = {
            // ** DEPRECATION WARNING ** The cameraTransform key will be deprecated in a future release,
            cameraTransform: {
                position: [
                    event.nativeEvent.cameraTransform[0],
                    event.nativeEvent.cameraTransform[1],
                    event.nativeEvent.cameraTransform[2],
                ],
                rotation: [
                    event.nativeEvent.cameraTransform[3],
                    event.nativeEvent.cameraTransform[4],
                    event.nativeEvent.cameraTransform[5],
                ],
                forward: [
                    event.nativeEvent.cameraTransform[6],
                    event.nativeEvent.cameraTransform[7],
                    event.nativeEvent.cameraTransform[8],
                ],
                up: [
                    event.nativeEvent.cameraTransform[9],
                    event.nativeEvent.cameraTransform[10],
                    event.nativeEvent.cameraTransform[11],
                ],
            },
            position: [
                event.nativeEvent.cameraTransform[0],
                event.nativeEvent.cameraTransform[1],
                event.nativeEvent.cameraTransform[2],
            ],
            rotation: [
                event.nativeEvent.cameraTransform[3],
                event.nativeEvent.cameraTransform[4],
                event.nativeEvent.cameraTransform[5],
            ],
            forward: [
                event.nativeEvent.cameraTransform[6],
                event.nativeEvent.cameraTransform[7],
                event.nativeEvent.cameraTransform[8],
            ],
            up: [
                event.nativeEvent.cameraTransform[9],
                event.nativeEvent.cameraTransform[10],
                event.nativeEvent.cameraTransform[11],
            ],
        };
        this.props.onCameraTransformUpdate &&
            this.props.onCameraTransformUpdate(cameraTransform);
    };
    // TODO: types for closest
    findCollisionsWithRayAsync = async (from, to, closest, viroTag) => {
        return await NativeModules.VRTSceneModule.findCollisionsWithRayAsync(findNodeHandle(this), from, to, closest, viroTag);
    };
    findCollisionsWithShapeAsync = async (from, to, shapeString, shapeParam, viroTag) => {
        return await NativeModules.VRTSceneModule.findCollisionsWithShapeAsync(findNodeHandle(this), from, to, shapeString, shapeParam, viroTag);
    };
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * @deprecated
     */
    async getCameraPositionAsync() {
        console.warn("[Viro] ViroScene.getCameraPositionAsync has been DEPRECATED. Please use getCameraOrientationAsync instead.");
        var orientation = await NativeModules.VRTCameraModule.getCameraOrientation(findNodeHandle(this));
        var position = [orientation[0], orientation[1], orientation[2]];
        return position;
    }
    async getCameraOrientationAsync() {
        var orientation = await NativeModules.VRTCameraModule.getCameraOrientation(findNodeHandle(this));
        return {
            position: [orientation[0], orientation[1], orientation[2]],
            rotation: [orientation[3], orientation[4], orientation[5]],
            forward: [orientation[6], orientation[7], orientation[8]],
            up: [orientation[9], orientation[10], orientation[11]],
        };
    }
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroScene", this.props);
        let timeToFuse = undefined;
        if (this.props.onFuse != undefined &&
            typeof this.props.onFuse === "object") {
            timeToFuse = this.props.onFuse.timeToFuse;
        }
        return (<ViroSceneContext.Provider value={this._cameras}>
        <VRTScene {...this.props} ref={(component) => {
                this._component = component;
            }} activeCameraTag={this.state.activeCameraTag} canHover={(this.props.onHover != undefined || this.props.onGaze != undefined)} canClick={this.props.onClick != undefined ||
                this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canFuse={this.props.onFuse != undefined} canDrag={this.props.onDrag != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} canCameraTransformUpdate={this.props.onCameraTransformUpdate != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onClick={undefined} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onFuseViro={this._onFuse} onDragViro={this._onDrag} onRotateViro={this._onRotate} onPinchViro={this._onPinch} onPlatformUpdateViro={this._onPlatformUpdate} onCameraTransformUpdateViro={this._onCameraTransformUpdate} timeToFuse={timeToFuse}/>
      </ViroSceneContext.Provider>);
    }
}
var VRTScene = requireNativeComponent("VRTScene", 
// @ts-ignore
ViroScene, {
    nativeOnly: {
        canHover: true,
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canPinch: true,
        canRotate: true,
        canFuse: true,
        canCollide: true,
        canCameraTransformUpdate: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onDragViro: true,
        onPinchViro: true,
        onRotateViro: true,
        onPlatformUpdateViro: true,
        onCameraTransformUpdateViro: true,
        onFuseViro: true,
        timeToFuse: true,
        physicsBody: true,
        onCollisionViro: true,
        activeCameraTag: true,
    },
});
