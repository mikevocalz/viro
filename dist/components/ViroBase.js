import * as React from "react";
import { NativeModules, findNodeHandle, } from "react-native";
import { ViroClickStateTypes, } from "./Types/ViroEvents";
import { ViroEventSource, } from "./Types/ViroUtils";
export class ViroBase extends React.Component {
    _component = null;
    _onHover = (event) => {
        this.props.onHover &&
            this.props.onHover(event.nativeEvent.isHovering, event.nativeEvent.position, event.nativeEvent.source);
        // Route eye-gaze hovers (Quest Pro) to the dedicated onGaze callback. onHover
        // above still fires for every source; onGaze fires only for the eye-gaze ray.
        if (this.props.onGaze &&
            event.nativeEvent.source ===
                ViroEventSource.EYE_GAZE) {
            this.props.onGaze(event.nativeEvent.isHovering, event.nativeEvent.position, event.nativeEvent.source);
        }
    };
    _onClick = (event) => {
        this.props.onClick &&
            this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
    };
    _onClickState = (event) => {
        this.props.onClickState &&
            this.props.onClickState(event.nativeEvent.clickState, event.nativeEvent.position, event.nativeEvent.source);
        // Value representation of Clicked ClickState within EventDelegateJni.
        if (event.nativeEvent.clickState == ViroClickStateTypes.CLICKED) {
            this._onClick(event);
        }
    };
    _onTouch = (event) => {
        this.props.onTouch &&
            this.props.onTouch(event.nativeEvent.touchState, event.nativeEvent.touchPos, event.nativeEvent.source);
    };
    _onScroll = (event) => {
        this.props.onScroll &&
            this.props.onScroll(event.nativeEvent.scrollPos, event.nativeEvent.source);
    };
    _onSwipe = (event) => {
        this.props.onSwipe &&
            this.props.onSwipe(event.nativeEvent.swipeState, event.nativeEvent.source);
    };
    _onPinch = (event) => {
        this.props.onPinch &&
            this.props.onPinch(event.nativeEvent.pinchState, event.nativeEvent.scaleFactor, event.nativeEvent.source);
    };
    _onRotate = (event) => {
        this.props.onRotate &&
            this.props.onRotate(event.nativeEvent.rotateState, event.nativeEvent.rotationFactor, event.nativeEvent.source);
    };
    _onDrag = (event) => {
        this.props.onDrag &&
            this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
    };
    _onFuse = (event) => {
        if (this.props.onFuse) {
            if (typeof this.props.onFuse === "function") {
                this.props.onFuse(event.nativeEvent.source);
            }
            else if (this.props.onFuse != undefined &&
                this.props.onFuse.callback != undefined) {
                this.props.onFuse.callback(event.nativeEvent.source);
            }
        }
    };
    _onAnimationStart = (_event) => {
        this.props.animation &&
            this.props.animation.onStart &&
            this.props.animation.onStart();
    };
    _onAnimationFinish = (_event) => {
        this.props.animation &&
            this.props.animation.onFinish &&
            this.props.animation.onFinish();
    };
    _onError = (event) => {
        this.props.onError && this.props.onError(event);
    };
    getTransformAsync = async () => {
        return await NativeModules.VRTNodeModule.getNodeTransform(findNodeHandle(this));
    };
    getBoundingBoxAsync = async () => {
        return await NativeModules.VRTNodeModule.getBoundingBox(findNodeHandle(this));
    };
    applyImpulse = (force, position) => {
        NativeModules.VRTNodeModule.applyImpulse(findNodeHandle(this), force, position);
    };
    applyTorqueImpulse = (torque) => {
        NativeModules.VRTNodeModule.applyTorqueImpulse(findNodeHandle(this), torque);
    };
    setVelocity = (velocity) => {
        NativeModules.VRTNodeModule.setVelocity(findNodeHandle(this), velocity);
    };
    _onCollision = (event) => {
        if (this.props.onCollision) {
            this.props.onCollision(event.nativeEvent.viroTag, event.nativeEvent.collidedPoint, event.nativeEvent.collidedNormal);
        }
    };
    // Called from native on the event a positional change has occured
    // for the underlying control within the renderer.
    _onNativeTransformUpdate = (event) => {
        var position = event.nativeEvent.position;
        if (this.props.onTransformUpdate) {
            this.props.onTransformUpdate(position);
        }
    };
    setNativeProps = (nativeProps) => {
        this._component?.setNativeProps(nativeProps);
    };
}
