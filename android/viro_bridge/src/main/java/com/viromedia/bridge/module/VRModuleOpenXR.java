// Copyright © 2026 ReactVision. All rights reserved.
// MIT License — see LICENSE file.

package com.viromedia.bridge.module;

import android.view.View;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.viro.core.ViroViewOpenXR;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.UIManagerHelper;
import com.viromedia.bridge.component.VRT3DSceneNavigator;
import com.viromedia.bridge.component.VRTVRSceneNavigator;

/**
 * React Native native module for Meta Quest / OpenXR-specific operations.
 * Registered automatically when {@link com.viromedia.bridge.ReactViroPackage} is
 * initialised with {@code ViroPlatform.QUEST}.
 *
 * JS usage (via NativeModules.VRModuleOpenXR):
 *   recenterTracking(viewTag)
 *   setPassthroughEnabled(viewTag, enabled)  // Week 4
 */
@ReactModule(name = "VRModuleOpenXR")
public class VRModuleOpenXR extends ReactContextBaseJavaModule {

    public VRModuleOpenXR(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }

    @Override
    public String getName() {
        return "VRModuleOpenXR";
    }

    /** Capability facts after native initialization, including permission failure. */
    @ReactMethod
    public void getCapabilities(final int sceneNavTag, final Promise promise) {
        UIManager manager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), sceneNavTag);
        if (!(manager instanceof FabricUIManager)) {
            promise.reject("E_XR_VIEW_UNAVAILABLE", "OpenXR view manager is unavailable");
            return;
        }
        ((FabricUIManager) manager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver resolver) {
                try {
                    View view = resolver.resolveView(sceneNavTag);
                    if (!(view instanceof VRT3DSceneNavigator) ||
                        !(((VRT3DSceneNavigator) view).getViroView() instanceof ViroViewOpenXR)) {
                        promise.reject("E_XR_VIEW_UNAVAILABLE", "OpenXR view is not mounted");
                        return;
                    }
                    ViroViewOpenXR xrView = (ViroViewOpenXR) ((VRT3DSceneNavigator) view).getViroView();
                    int status = xrView.getPlaneDetectionStatus();
                    WritableMap result = Arguments.createMap();
                    if (status < 0) result.putNull("planeDetection");
                    else result.putBoolean("planeDetection", status == 1);
                    promise.resolve(result);
                } catch (Exception error) {
                    promise.reject("E_XR_CAPABILITIES", error);
                } catch (LinkageError error) {
                    promise.reject("E_XR_REBUILD_REQUIRED", "Rebuild both ViroCore and the Viro bridge", error);
                }
            }
        });
    }

    /**
     * Recenters the VR tracking origin to the current head pose.
     * Equivalent to pressing the Meta button to re-orient the view.
     *
     * @param sceneNavTag React tag of the ViroVRSceneNavigator view.
     */
    @ReactMethod
    public void recenterTracking(final int sceneNavTag) {
        UIManager uiManager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRT3DSceneNavigator) {
                    ((VRT3DSceneNavigator) view).recenterTracking();
                }
            }
        });
    }

    /**
     * Toggle mixed-reality passthrough mode (Quest 3 / Quest Pro only).
     * On Quest 3 the camera feed is shown in full colour behind virtual content.
     * No-op on devices that do not support XR_FB_passthrough.
     *
     * @param sceneNavTag React tag of the ViroVRSceneNavigator view.
     * @param enabled     {@code true} to show passthrough; {@code false} for fully virtual.
     */
    @ReactMethod
    public void setPassthroughEnabled(final int sceneNavTag, final boolean enabled) {
        UIManager uiManager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTVRSceneNavigator) {
                    ((VRTVRSceneNavigator) view).setPassthroughEnabled(enabled);
                }
            }
        });
    }

    /**
     * Select the vertical tracking origin at runtime: "eye" (head-height,
     * default) or "floor" (origin on the physical floor). The renderer rebuilds
     * its reference space; content placed relative to y=0 moves accordingly.
     *
     * @param sceneNavTag React tag of the ViroVRSceneNavigator view.
     * @param origin      "eye" or "floor".
     */
    @ReactMethod
    public void setTrackingOrigin(final int sceneNavTag, final String origin) {
        UIManager uiManager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTVRSceneNavigator) {
                    ((VRTVRSceneNavigator) view).setTrackingOrigin(origin);
                }
            }
        });
    }

    /**
     * Style the passthrough layer. opacity ∈ [0,1]; edge[RGBA] is the edge
     * highlight colour (alpha 0 disables the edge effect).
     */
    @ReactMethod
    public void setPassthroughStyle(final int sceneNavTag, final float opacity,
                                    final float edgeR, final float edgeG,
                                    final float edgeB, final float edgeA) {
        UIManager uiManager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTVRSceneNavigator) {
                    ((VRTVRSceneNavigator) view).setPassthroughStyle(opacity, edgeR, edgeG, edgeB, edgeA);
                }
            }
        });
    }

    /**
     * Fire a controller haptic pulse. hand: 0 = left, 1 = right, 2 = both,
     * -1 = whichever controller last pressed its trigger. amplitude ∈ [0,1],
     * durationSec is the pulse length in seconds (e.g. 0.02–0.06 for a UI tick).
     */
    @ReactMethod
    public void triggerHaptic(final int sceneNavTag, final int hand,
                              final float amplitude, final float durationSec) {
        UIManager uiManager = UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), sceneNavTag);
        if (uiManager == null) {
            return;
        }
        ((FabricUIManager) uiManager).addUIBlock(new com.facebook.react.fabric.interop.UIBlock() {
            @Override
            public void execute(com.facebook.react.fabric.interop.UIBlockViewResolver viewResolver) {
                View view = viewResolver.resolveView(sceneNavTag);
                if (view instanceof VRTVRSceneNavigator) {
                    ((VRTVRSceneNavigator) view).triggerHaptic(hand, amplitude, durationSec);
                }
            }
        });
    }
}
