/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroAnimations
 * @flow
 */
import { NativeModules, processColor, } from "react-native";
const AnimationManager = NativeModules.VRTAnimationManager;
const registeredAnimations = {};
export class ViroAnimations {
    static registerAnimations(animations) {
        Object.assign(registeredAnimations, animations);
        for (var key in animations) {
            if (!Array.isArray(animations[key])) {
                const animation = animations[key];
                if (animation.properties && animation.properties.color) {
                    var newColor = processColor(animation.properties.color);
                    animation.properties.color = newColor;
                }
            }
        }
        if (AnimationManager) {
            AnimationManager.setJSAnimations(animations);
        }
    }
    static getRegisteredAnimation(name) {
        return registeredAnimations[name];
    }
}
