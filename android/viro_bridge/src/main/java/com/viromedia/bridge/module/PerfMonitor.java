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

import android.app.Application;
import android.app.Activity;
import android.util.Log;

import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.devsupport.interfaces.DevOptionHandler;
import com.facebook.react.devsupport.interfaces.DevSupportManager;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.ViroView;

import java.lang.ref.WeakReference;

@ReactModule(name = "VRTPerfMonitor")
public class PerfMonitor extends ReactContextBaseJavaModule {
    private static final String TAG = "VRTPerfMonitor";
    // https://stackoverflow.com/a/44879687
    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }
    private static class PerfOptionHandler implements DevOptionHandler {

        private WeakReference<PerfMonitor> mPerfMonitor;

        public PerfOptionHandler(PerfMonitor perfMonitor) {
            mPerfMonitor = new WeakReference<PerfMonitor>(perfMonitor);
        }

        @Override
        public void onOptionSelected() {
            PerfMonitor perfMonitor = mPerfMonitor.get();
            if (perfMonitor != null) {
                perfMonitor.onOptionSelected();
            }
        }
    }

    private boolean mIsShowing = false;

    private boolean mIsInitialized = false;

    private WeakReference<ViroView> mView;

    public PerfMonitor(ReactApplicationContext context) {
        super(context);
    }

    public void onOptionSelected() {
        ViroView view = mView.get();
        if (view != null) {
            view.setDebugHUDEnabled(!mIsShowing);
        }
        mIsShowing = !mIsShowing;
    }

    public void setView(ViroView view) {
        if (!mIsInitialized) {
            Activity activity = getCurrentActivity();
            Application application = activity == null ? null : activity.getApplication();
            if (application instanceof ReactApplication) {
                ReactApplication reactApplication = (ReactApplication) application;
                DevSupportManager devSupport = reactApplication.getReactHost().getDevSupportManager();
                devSupport.addCustomDevOption("[Viro] Toggle FPS Display", new PerfOptionHandler(this));

                mIsInitialized = true;
            } else {
                Log.w(TAG, "setView: current Activity unavailable; FPS dev option deferred");
            }
        }

        mView = new WeakReference<ViroView>(view);
        view.setDebugHUDEnabled(mIsShowing);
        Log.i(TAG, "setView: " + view.getClass().getSimpleName());
    }

    /**
     * The most recently constructed {@link ViroView}, or null if none is
     * alive. Every VRT scene navigator registers its ViroView here in its
     * constructor (see VRT3DSceneNavigator), which makes this the canonical
     * "current ViroView" lookup for headless modules (e.g. the external GPU
     * texture bridge in react-native-viro-mux) that need a ViroContext but
     * have no view tag.
     */
    public ViroView getView() {
        WeakReference<ViroView> ref = mView;
        return ref == null ? null : ref.get();
    }

    @Override
    public String getName() {
        return "VRTPerfMonitor";
    }

}
