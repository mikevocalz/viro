//  Copyright © 2017 Viro Media. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package com.viromedia.bridge.module;

import android.view.View;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.IllegalViewOperationException;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.BoundingBox;
import com.viro.core.Matrix;
import com.viro.core.Object3D;
import com.viro.core.Quaternion;
import com.viro.core.Vector;
import com.viromedia.bridge.component.node.VRTNode;

import com.viro.core.Node;
import com.viromedia.bridge.component.node.control.VRT3DObject;
import java.util.Set;

import static java.lang.Math.toDegrees;

@ReactModule(name = "VRTNodeModule")
public class NodeModule extends ReactContextBaseJavaModule {

    public NodeModule(ReactApplicationContext context) {
        super(context);
    }
    // https://stackoverflow.com/a/44879687
    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }
    @Override
    public String getName() {
        return "VRTNodeModule";
    }

    @ReactMethod
    public void applyImpulse(final int viewTag, final ReadableArray force, final ReadableArray position) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View viroView = viewResolver.resolveView(viewTag);
                if (!(viroView instanceof VRTNode)){
                    throw new IllegalViewOperationException("Invalid view returned when applying force: expected a node-type control!");
                }

                if (force == null || force.size() != 3){
                    throw new IllegalViewOperationException("Invalid impulse force parameters provided!");
                }

                if (position != null && position.size() != 3){
                    throw new IllegalViewOperationException("Invalid impulse force position parameters provided!");
                }

                // If no offset is given, default to a central impulse.
                float[] forcePosition = {0,0,0};
                if (position != null){
                    forcePosition[0] = (float)position.getDouble(0);
                    forcePosition[1] = (float)position.getDouble(1);
                    forcePosition[2] = (float)position.getDouble(2);
                }
                float[] forceArray = { (float)force.getDouble(0), (float)force.getDouble(1), (float)force.getDouble(2)};

                VRTNode nodeControl = (VRTNode) viroView;
                nodeControl.applyImpulse(forceArray, forcePosition);
            }
        });
    }

    @ReactMethod
    public void applyTorqueImpulse(final int viewTag, final ReadableArray torque) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View viroView = viewResolver.resolveView(viewTag);
                if (!(viroView instanceof VRTNode)){
                    throw new IllegalViewOperationException("Invalid view returned when applying force: expected a node-type control!");
                }

                if (torque == null || torque.size() != 3){
                    throw new IllegalViewOperationException("Invalid impulse torque params provided!");
                }

                float[] torqueArray = { (float)torque.getDouble(0), (float)torque.getDouble(1), (float)torque.getDouble(2)};
                VRTNode nodeControl = (VRTNode) viroView;
                nodeControl.applyTorqueImpulse(torqueArray);
            }
        });
    }

    @ReactMethod
    public void setVelocity(final int viewTag, final ReadableArray velocity) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View viroView = viewResolver.resolveView(viewTag);
                if (!(viroView instanceof VRTNode)){
                    throw new IllegalViewOperationException("Invalid view returned when applying velocity: expected a node-type control!");
                }

                if (velocity == null || velocity.size() != 3){
                    throw new IllegalViewOperationException("Invalid velocity params provided!");
                }

                float[] velocityArray = { (float)velocity.getDouble(0), (float)velocity.getDouble(1), (float)velocity.getDouble(2)};
                VRTNode nodeControl = (VRTNode) viroView;
                nodeControl.setVelocity(velocityArray, false);
            }
        });
    }

    @ReactMethod
    public void getNodeTransform(final int viewTag, final Promise promise)
     {
         UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
         if (uiManager == null) {
             promise.reject("ERROR", "UIManager not available");
             return;
         }
         ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
             @Override
             public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                 View viroView = viewResolver.resolveView(viewTag);
                 if (!(viroView instanceof VRTNode)) {
                     // Transient view-lifecycle race: reject so the JS await settles (throwing in
                     // the UIBlock leaked the promise; casting first risked ClassCastException).
                     promise.reject("view_not_ready", "Node view not registered yet");
                     return;
                 }
                 VRTNode nodeView = (VRTNode) viroView;

                 Node nodeJNI = nodeView.getNodeJni();
                 if (nodeJNI == null) {
                     // Torn down but still registered: forceCascadeTearDown() nulls every
                     // node in the tree when the scene navigator is destroyed, while the
                     // views stay resolvable until React drops them.
                     promise.reject("view_not_ready", "Node has been torn down");
                     return;
                 }
                 Matrix matrix = nodeJNI.getWorldTransformRealTime();
                 Vector scale = matrix.extractScale();
                 Vector position = matrix.extractTranslation();
                 Vector rotation = matrix.extractRotation(scale).toEuler();

                 WritableMap returnMap = Arguments.createMap();
                 WritableArray writablePosArray = Arguments.createArray();
                 writablePosArray.pushDouble(position.x);
                 writablePosArray.pushDouble(position.y);
                 writablePosArray.pushDouble(position.z);

                 WritableArray writableRotateArray = Arguments.createArray();
                 writableRotateArray.pushDouble(toDegrees(rotation.x));
                 writableRotateArray.pushDouble(toDegrees(rotation.y));
                 writableRotateArray.pushDouble(toDegrees(rotation.z));

                 WritableArray writeableScaleArray = Arguments.createArray();
                 writeableScaleArray.pushDouble(scale.x);
                 writeableScaleArray.pushDouble(scale.y);
                 writeableScaleArray.pushDouble(scale.z);

                 returnMap.putArray("position", writablePosArray);
                 returnMap.putArray("rotation", writableRotateArray);
                 returnMap.putArray("scale", writeableScaleArray);
                 promise.resolve(returnMap);
            }
         });
    }

    @ReactMethod
    public void getBoundingBox(final int viewTag, final Promise promise)
    {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View viroView = viewResolver.resolveView(viewTag);
                if (!(viroView instanceof VRTNode)) {
                    // Transient view-lifecycle race: reject so the JS await settles (throwing in
                    // the UIBlock leaked the promise; casting first risked ClassCastException).
                    promise.reject("view_not_ready", "Node view not registered yet");
                    return;
                }
                VRTNode nodeView = (VRTNode) viroView;

                Node nodeJNI = nodeView.getNodeJni();
                if (nodeJNI == null) {
                    // Torn down but still registered (see getNodeTransform).
                    promise.reject("view_not_ready", "Node has been torn down");
                    return;
                }
                BoundingBox box = nodeJNI.getBoundingBox();

                WritableMap returnMap = Arguments.createMap();
                WritableMap boundingBoxMap = Arguments.createMap();
                boundingBoxMap.putDouble("minX", box.minX);
                boundingBoxMap.putDouble("maxX", box.maxX);
                boundingBoxMap.putDouble("minY", box.minY);
                boundingBoxMap.putDouble("maxY", box.maxY);
                boundingBoxMap.putDouble("minZ", box.minZ);
                boundingBoxMap.putDouble("maxZ", box.maxZ);
                returnMap.putMap("boundingBox", boundingBoxMap);
                promise.resolve(returnMap);
            }
        });
    }

    /**
     * Resolves the Object3D behind a VRT3DObject view tag inside a UI block, or null —
     * the transient view-lifecycle races are the same ones getNodeTransform documents,
     * and every avatar-pose method below needs the identical walk.
     */
    private interface Object3DBlock {
        void execute(Object3D node);
    }

    private void withObject3D(final int viewTag, final Promise promiseOrNull, final Object3DBlock block) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            if (promiseOrNull != null) {
                promiseOrNull.reject("ERROR", "UIManager not available");
            }
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View viroView = viewResolver.resolveView(viewTag);
                if (!(viroView instanceof VRT3DObject)) {
                    if (promiseOrNull != null) {
                        promiseOrNull.reject("view_not_ready", "Node view not registered yet");
                    }
                    return;
                }
                Object3D node = (Object3D) ((VRT3DObject) viroView).getNodeJni();
                if (node == null) {
                    if (promiseOrNull != null) {
                        promiseOrNull.reject("view_not_ready", "Node has been torn down");
                    }
                    return;
                }
                block.execute(node);
            }
        });
    }

    /**
     * The whole face in one bridge call — names and weights, positionally paired.
     * Fire-and-forget on purpose: this runs at frame rate and a Promise per frame
     * is a leak of exactly the thing the batching saves.
     */
    @ReactMethod
    public void setMorphTargetWeights(final int viewTag, final ReadableArray names,
                                      final ReadableArray weights) {
        if (names == null || weights == null || names.size() != weights.size()) {
            return;
        }
        final int count = names.size();
        final String[] nameArray = new String[count];
        final float[] weightArray = new float[count];
        for (int i = 0; i < count; i++) {
            nameArray[i] = names.getString(i);
            weightArray[i] = (float) weights.getDouble(i);
        }
        withObject3D(viewTag, null, new Object3DBlock() {
            @Override
            public void execute(Object3D node) {
                node.setMorphTargetWeights(nameArray, weightArray);
            }
        });
    }

    /** The skeleton's bone names, in skeleton order. Empty for an unskinned model. */
    @ReactMethod
    public void getSkeletonBoneKeys(final int viewTag, final Promise promise) {
        withObject3D(viewTag, promise, new Object3DBlock() {
            @Override
            public void execute(Object3D node) {
                String[] keys = node.getSkeletonBoneKeys();
                WritableArray bones = Arguments.createArray();
                for (String key : keys) {
                    bones.pushString(key);
                }
                WritableMap returnMap = Arguments.createMap();
                returnMap.putArray("bones", bones);
                promise.resolve(returnMap);
            }
        });
    }

    /**
     * The named bones' current world transforms — 16 column-major floats each,
     * concatenated in request order. Read once at load: these are the rest poses a
     * procedural driver composes its deltas against. An unknown bone contributes
     * sixteen zeros rather than shifting everything after it.
     */
    @ReactMethod
    public void getSkeletonBoneTransforms(final int viewTag, final ReadableArray names,
                                          final Promise promise) {
        if (names == null) {
            promise.reject("ERROR", "No bone names given");
            return;
        }
        final int count = names.size();
        final String[] nameArray = new String[count];
        for (int i = 0; i < count; i++) {
            nameArray[i] = names.getString(i);
        }
        withObject3D(viewTag, promise, new Object3DBlock() {
            @Override
            public void execute(Object3D node) {
                WritableArray matrices = Arguments.createArray();
                for (String name : nameArray) {
                    float[] transform = node.getSkeletonBoneWorldTransform(name);
                    for (int i = 0; i < 16; i++) {
                        matrices.pushDouble(i < transform.length ? transform[i] : 0);
                    }
                }
                WritableMap returnMap = Arguments.createMap();
                returnMap.putArray("matrices", matrices);
                promise.resolve(returnMap);
            }
        });
    }

    /**
     * One pose, one crossing: bone names plus 16 column-major floats per bone.
     * Fire-and-forget for the same reason setMorphTargetWeights is.
     */
    @ReactMethod
    public void setSkeletonBoneTransforms(final int viewTag, final ReadableArray names,
                                          final ReadableArray matrices, final boolean recurse) {
        if (names == null || matrices == null || matrices.size() != names.size() * 16) {
            return;
        }
        final int count = names.size();
        final String[] nameArray = new String[count];
        for (int i = 0; i < count; i++) {
            nameArray[i] = names.getString(i);
        }
        final float[] matrixArray = new float[count * 16];
        for (int i = 0; i < matrixArray.length; i++) {
            matrixArray[i] = (float) matrices.getDouble(i);
        }
        withObject3D(viewTag, null, new Object3DBlock() {
            @Override
            public void execute(Object3D node) {
                node.setSkeletonBoneWorldTransforms(nameArray, matrixArray, recurse);
            }
        });
    }

    @ReactMethod
    public void getMorphTargets(final int viewTag, final Promise promise) {
        UIManager uiManager = UIManagerHelper.getUIManager(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            promise.reject("ERROR", "UIManager not available");
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View viroView = viewResolver.resolveView(viewTag);
                if (!(viroView instanceof VRT3DObject)) {
                    // Transient view-lifecycle race: reject instead of throwing (see getNodeTransform).
                    promise.reject("view_not_ready", "Node view not registered yet");
                    return;
                }
                VRT3DObject nodeView = (VRT3DObject) viroView;
                Object3D node = (Object3D)nodeView.getNodeJni();
                if (node == null) {
                    // Torn down but still registered (see getNodeTransform).
                    promise.reject("view_not_ready", "Node has been torn down");
                    return;
                }
                Set<String> keys = node.getMorphTargetKeys();
                WritableMap returnMap = Arguments.createMap();
                WritableArray targets = Arguments.createArray();
                for (String key : keys) {
                    targets.pushString(key);
                }
                returnMap.putArray("targets", targets);
                promise.resolve(returnMap);
            }
        });
    }
}
