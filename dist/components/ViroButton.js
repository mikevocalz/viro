/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroButton
 */
"user strict";
import * as React from "react";
import { ViroAnimations } from "./Animation/ViroAnimations";
import { checkMisnamedProps } from "./Utilities/ViroProps";
import { ViroImage } from "./ViroImage";
import { ViroNode } from "./ViroNode";
export var ViroButtonStateTypes;
(function (ViroButtonStateTypes) {
    ViroButtonStateTypes["BTN_TYPE_HOVER"] = "hovering";
    ViroButtonStateTypes["BTN_TYPE_NORMAL"] = "normal";
    ViroButtonStateTypes["BTN_TYPE_CLICKED"] = "clicked";
})(ViroButtonStateTypes || (ViroButtonStateTypes = {}));
/**
 * Composite controle for 2D button
 */
export class ViroButton extends React.Component {
    _component = null;
    state = {
        buttonType: ViroButtonStateTypes.BTN_TYPE_NORMAL,
    };
    applyImpulse = (force, atPosition) => {
        this._component?.applyImpulse(force, atPosition);
    };
    applyTorqueImpulse = (torque) => {
        this._component?.applyTorqueImpulse(torque);
    };
    setVelocity = (velocity) => {
        this._component?.setVelocity(velocity);
    };
    _onAnimationStart = () => {
        this.props.animation &&
            this.props.animation.onStart &&
            this.props.animation.onStart();
    };
    _onAnimationFinish = () => {
        this.props.animation &&
            this.props.animation.onFinish &&
            this.props.animation.onFinish();
    };
    getTransformAsync = async () => {
        return await this._component?.getTransformAsync();
    };
    getBoundingBoxAsync = async () => {
        return await this._component?.getBoundingBoxAsync();
    };
    render() {
        checkMisnamedProps("ViroButton", this.props);
        // We default to showing the button if it's undefined
        const { visible = true } = this.props;
        var normalSrcVisible;
        var hoverSrcVisible;
        var clickSrcVisible;
        var hoverSource = this.props.hoverSource || this.props.gazeSource;
        var clickSource = this.props.clickSource || this.props.tapSource;
        let buttonScale = this.props.scale || [1, 1, 1];
        switch (this.state.buttonType) {
            case ViroButtonStateTypes.BTN_TYPE_HOVER:
                hoverSrcVisible = visible && true;
                clickSrcVisible = false;
                normalSrcVisible = false;
                break;
            case ViroButtonStateTypes.BTN_TYPE_CLICKED:
                // start scale for button animation
                buttonScale = [
                    0.9 * buttonScale[0],
                    0.9 * buttonScale[1],
                    0.9 * buttonScale[2],
                ];
                hoverSrcVisible = false;
                clickSrcVisible = visible && true;
                normalSrcVisible = false;
                break;
            default:
                normalSrcVisible = visible && true;
                hoverSrcVisible = false;
                clickSrcVisible = false;
        }
        // TODO: rather than manually expanding/setting props, we should do
        // {...this.props} which will save us time when adding new properties
        return (<ViroNode ref={(component) => {
                this._component = component;
            }} visible={visible} physicsBody={this.props.physicsBody} position={this.props.position} onTransformUpdate={this.props.onTransformUpdate} onClickState={this.props.onClickState} onTouch={this.props.onTouch} onScroll={this.props.onScroll} onSwipe={this.props.onSwipe} onHover={this._onButtonHover} onClick={this._onButtonClicked} onDrag={this.props.onDrag} onPinch={this.props.onPinch} onRotate={this.props.onRotate} onCollision={this.props.onCollision} viroTag={this.props.viroTag} onFuse={this.props.onFuse} animation={this.props.animation} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish} ignoreEventHandling={this.props.ignoreEventHandling} dragType={this.props.dragType}>
        <ViroImage source={this.props.source} rotation={this.props.rotation} rotationPivot={this.props.rotationPivot} scale={buttonScale} scalePivot={this.props.scalePivot} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={normalSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials}/>

        <ViroImage source={hoverSource ? hoverSource : this.props.source} rotation={this.props.rotation} rotationPivot={this.props.rotationPivot} scale={buttonScale} scalePivot={this.props.scalePivot} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={hoverSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials}/>

        <ViroImage source={clickSource
                ? clickSource
                : hoverSource
                    ? hoverSource
                    : this.props.source} rotation={this.props.rotation} scale={buttonScale} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={clickSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials} animation={{
                name: "clickAnimation",
                run: clickSrcVisible,
                onFinish: this._onAnimationFinished,
            }}/>
      </ViroNode>);
    }
    _onButtonHover = (isHovering, position, source) => {
        if (isHovering) {
            this.setState({
                buttonType: ViroButtonStateTypes.BTN_TYPE_HOVER,
            });
            if (this.props.onHover) {
                // TODO: This was different than the other onHover callbacks
                this.props.onHover(isHovering, position, source);
            }
        }
        else {
            this.setState({
                buttonType: ViroButtonStateTypes.BTN_TYPE_NORMAL,
            });
        }
    };
    _onButtonClicked = (position, source) => {
        this.setState({
            buttonType: ViroButtonStateTypes.BTN_TYPE_CLICKED,
        });
        if (this.props.onClick) {
            this.props.onClick(position, source);
        }
    };
    _onAnimationFinished = () => {
        this.setState({
            buttonType: ViroButtonStateTypes.BTN_TYPE_HOVER,
        });
    };
}
ViroAnimations.registerAnimations({
    clickAnimation: {
        properties: {
            scaleX: "/=0.9",
            scaleY: "/=0.9",
            scaleZ: "/=0.9",
        },
        easing: "Bounce",
        duration: 500,
    },
});
