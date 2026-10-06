/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Viro360Image
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
export class Viro360Image extends React.Component {
    _component = null;
    _onLoadStart = (event) => {
        this.props.onLoadStart && this.props.onLoadStart(event);
    };
    _onLoadEnd = (event) => {
        this.props.onLoadEnd && this.props.onLoadEnd(event);
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    render() {
        checkMisnamedProps("Viro360Image", this.props);
        var imgsrc = resolveAssetSource(this.props.source);
        // Create native props object.
        let nativeProps = Object.assign({}, this.props);
        nativeProps.source = imgsrc;
        nativeProps.onErrorViro = this._onError;
        nativeProps.onLoadStartViro = this._onLoadStart;
        nativeProps.onLoadEndViro = this._onLoadEnd;
        nativeProps.ref = (component) => {
            this._component = component;
        };
        return <VRT360Image {...nativeProps}/>;
    }
}
var VRT360Image = requireNativeComponent("VRT360Image", 
// @ts-ignore
Viro360Image, {
    nativeOnly: {
        onLoadStartViro: true,
        onErrorViro: true,
        onLoadEndViro: true,
    },
});
