//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Licensed under the same MIT license as the rest of @reactvision/react-viro.

package com.viromedia.bridge.utility;

import android.util.Log;

import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;

/**
 * Event-emission helper for viro_bridge components.
 *
 * Replaces the legacy {@code reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(...)}
 * path which on RN bridgeless arch (>= 0.83) throws
 * {@code IllegalArgumentException: getJSModule(RCTEventEmitter) is not recommended in
 * the new architecture and will stop working with interop disabled}.
 * The interop layer still delivers the call but only when the captured
 * ReactContext is bound to the live EventEmitter — when a stale (zombie)
 * ReactContext from a previously destroyed VRActivity surface emits, the event
 * is silently dropped. That manifested as onClick taking dozens of presses to
 * register on the second VR entry on Quest.
 *
 * The modern path resolves the EventDispatcher via UIManagerHelper using the
 * view tag, which short-circuits when the view is not in the live UIManager
 * registry — so stale-surface emits become silent no-ops without log spam.
 */
public final class ViroEventEmitter {

    private ViroEventEmitter() {}

    /**
     * Dispatch a generic event for the given view to the React event system.
     * Safe no-op when the view is not registered in the UIManager (e.g. a
     * stale surface that was never properly torn down).
     *
     * @param reactContext  the React context owning the view
     * @param viewId        the React view tag of the source component
     * @param eventName     one of {@link ViroEvents}
     * @param payload       event data (may be null)
     */
    private static int sDetDiag = 0;

    public static void emit(ReactContext reactContext,
                            int viewId,
                            String eventName,
                            WritableMap payload) {
        if (reactContext == null) {
            return;
        }
        EventDispatcher dispatcher =
                UIManagerHelper.getEventDispatcherForReactTag(reactContext, viewId);
        // Fabric routes events by surfaceId; the legacy Event(viewId) constructor
        // leaves it UNSET (-1) and the C++ event pipe then drops the event. Resolve
        // the real surfaceId so an event from ANY surface reaches JS — including a
        // backgrounded panel surface (e.g. the ObjectDetector view while an immersive
        // VRActivity is foreground), whose dispatcher is still live even though it is
        // not the visible surface.
        final int surfaceId = UIManagerHelper.getSurfaceId(reactContext);
        // One-shot diagnostic: the detector's onDetection was silently not reaching
        // JS on New Arch; log the first few emits with the routing facts.
        if ("onDetectionViro".equals(eventName) && sDetDiag < 5) {
            sDetDiag++;
            Log.i("ViroEventEmitter", "onDetectionViro emit #" + sDetDiag
                + " dispatcher=" + (dispatcher != null) + " surfaceId=" + surfaceId
                + " viewId=" + viewId);
        }
        if (dispatcher == null) {
            // View not in the active UIManager — happens for components mounted
            // in a surface that is no longer attached. Drop silently; the live
            // surface (if any) will receive its own dispatch.
            return;
        }
        dispatcher.dispatchEvent(new ViroBridgeEvent(surfaceId, viewId, eventName, payload));
    }

    /**
     * Generic Event<T> implementation that carries a raw event name + WritableMap
     * payload. New-arch event registration in ViewManagers continues to use the
     * existing {@code ViroEvents.ON_*} string constants, so consumers in JS keep
     * receiving the same shape they already expected.
     */
    private static final class ViroBridgeEvent extends Event<ViroBridgeEvent> {
        private final String mEventName;
        private final WritableMap mPayload;

        ViroBridgeEvent(int surfaceId, int viewId, String eventName, WritableMap payload) {
            super(surfaceId, viewId);
            mEventName = eventName;
            mPayload = payload;
        }

        @Override
        public String getEventName() {
            return mEventName;
        }

        // ClickUp and Clicked are dispatched consecutively. Coalescing them
        // drops ClickUp, leaving pointer capture and consumer drag state held.
        // Hover is also source-specific: merging both controllers can discard
        // an enter/exit edge from one hand.
        @Override
        public boolean canCoalesce() {
            return !ViroEvents.ON_CLICK.equals(mEventName)
                    && !ViroEvents.ON_HOVER.equals(mEventName);
        }

        @Override
        protected WritableMap getEventData() {
            return mPayload;
        }
    }
}
