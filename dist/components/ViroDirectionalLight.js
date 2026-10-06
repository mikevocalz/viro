/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroDirectionalLight
 * @flow
 */
"use strict";
import * as React from "react";
import { requireNativeComponent } from "react-native";
/**
 * Used to render a ViroDirectionalLight
 */
export class ViroDirectionalLight extends React.Component {
    _component = null;
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroDirectionalLight", this.props);
        let nativeProps = Object.assign({}, this.props);
        nativeProps.style = [this.props.style];
        nativeProps.color = this.props.color;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTDirectionalLight {...nativeProps}/>;
    }
}
var VRTDirectionalLight = requireNativeComponent("VRTDirectionalLight", 
// @ts-ignore
ViroDirectionalLight);
