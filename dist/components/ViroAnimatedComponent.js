/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroAnimatedComponent
 * @flow
 */
"use strict";
import * as React from "react";
import { requireNativeComponent, } from "react-native";
/**
 * Used to render a ViroAnimatedComponent
 */
export class ViroAnimatedComponent extends React.Component {
    _component = null;
    _onStart(_event) {
        this.props.onStart && this.props.onStart();
    }
    _onFinish(_event) {
        this.props.onFinish && this.props.onFinish();
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        console.warn("<ViroAnimatedComponent> is deprecated, please use each component's 'animation' property");
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroAnimatedComponent", this.props);
        let nativeProps = Object.assign({}, this.props);
        nativeProps.onAnimationFinishViro = this._onFinish;
        nativeProps.onAnimationStartViro = this._onStart;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRTAnimatedComponent {...nativeProps}/>;
    }
}
var VRTAnimatedComponent = requireNativeComponent("VRTAnimatedComponent", 
// @ts-ignore
ViroAnimatedComponent, {
    nativeOnly: { onAnimationStartViro: true, onAnimationFinishViro: true },
});
