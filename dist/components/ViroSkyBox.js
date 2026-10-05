/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSkyBox
 * @flow
 */
"use strict";
import * as React from "react";
import { requireNativeComponent, } from "react-native";
// @ts-ignore
// The visionOS-safe resolver. Image.resolveAssetSource returns an empty uri there;
// see ViroAssetSource.ts for why, and what it falls back to.
import { resolveViroAssetSource as resolveAssetSource } from "./Utilities/ViroAssetSource";
import { checkMisnamedProps } from "./Utilities/ViroProps";
/**
 * Used to render a skybox as a scene background.
 */
export class ViroSkyBox extends React.Component {
    _component = null;
    _onLoadStart = (event) => {
        this.props.onLoadStart && this.props.onLoadStart(event);
    };
    _onLoadEnd = (event) => {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    };
    setNativeProps = (nativeProps) => {
        this._component?.setNativeProps(nativeProps);
    };
    render() {
        checkMisnamedProps("ViroSkyBox", this.props);
        // Create and set the native props.
        var skyboxDict = {};
        let nativeProps = Object.assign({}, this.props);
        if (this.props.source !== undefined) {
            for (var key in this.props.source) {
                var s = resolveAssetSource(this.props.source[key]);
                skyboxDict[key] = s;
            }
            nativeProps.source = skyboxDict;
        }
        nativeProps.onViroSkyBoxLoadStart = this._onLoadStart;
        nativeProps.onViroSkyBoxLoadEnd = this._onLoadEnd;
        nativeProps.color = this.props.color;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTSkyBox {...nativeProps}/>;
    }
}
var VRTSkyBox = requireNativeComponent("VRTSkybox", 
// @ts-ignore
ViroSkyBox, {
    nativeOnly: { onViroSkyBoxLoadStart: true, onViroSkyBoxLoadEnd: true },
});
