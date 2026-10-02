package com.viromedia.bridge.module;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.viro.core.Renderer;

import java.lang.reflect.Method;

/**
 * React Native edge adapter for ViroCore's language-neutral engine ABI.
 *
 * Renderer.queryEngineAbi() is invoked reflectively so this JS package remains
 * binary-compatible with an older renderer AAR. Once the newer AAR is present,
 * the exact same module begins returning the ABI snapshot without an app API change.
 */
@ReactModule(name = "ViroEngineContract")
public class ViroEngineContractModule extends ReactContextBaseJavaModule {

    public ViroEngineContractModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "ViroEngineContract";
    }

    @ReactMethod
    public void setBackendPreference(int domain, int preference, Promise promise) {
        try {
            Method set = Renderer.class.getMethod(
                    "setEngineBackendPreference", int.class, int.class);
            Object raw = set.invoke(null, domain, preference);
            if (!(raw instanceof Integer)) {
                promise.reject("E_ENGINE_BACKEND_SELECTOR_INVALID",
                        "Renderer.setEngineBackendPreference() returned no status");
                return;
            }
            promise.resolve((Integer) raw);
        } catch (NoSuchMethodException e) {
            promise.reject("E_ENGINE_BACKEND_SELECTOR_UNAVAILABLE",
                    "Bundled ViroCore does not expose backend selection yet", e);
        } catch (Throwable t) {
            promise.reject("E_ENGINE_BACKEND_SELECTOR_SET",
                    "Unable to set ViroCore backend preference", t);
        }
    }

    @ReactMethod
    public void getBackendPreference(int domain, Promise promise) {
        try {
            Method get = Renderer.class.getMethod(
                    "getEngineBackendPreference", int.class);
            Object raw = get.invoke(null, domain);
            if (!(raw instanceof Integer)) {
                promise.reject("E_ENGINE_BACKEND_SELECTOR_INVALID",
                        "Renderer.getEngineBackendPreference() returned no preference");
                return;
            }
            promise.resolve((Integer) raw);
        } catch (NoSuchMethodException e) {
            promise.reject("E_ENGINE_BACKEND_SELECTOR_UNAVAILABLE",
                    "Bundled ViroCore does not expose backend selection yet", e);
        } catch (Throwable t) {
            promise.reject("E_ENGINE_BACKEND_SELECTOR_GET",
                    "Unable to query ViroCore backend preference", t);
        }
    }

    @ReactMethod
    public void queryAbi(Promise promise) {
        try {
            Method query = Renderer.class.getMethod("queryEngineAbi");
            Object raw = query.invoke(null);
            if (!(raw instanceof int[])) {
                promise.reject("E_ENGINE_CONTRACT_UNAVAILABLE",
                        "Renderer.queryEngineAbi() returned no ABI snapshot");
                return;
            }

            int[] values = (int[]) raw;
            if (values.length < 6) {
                promise.reject("E_ENGINE_CONTRACT_INVALID",
                        "Renderer.queryEngineAbi() returned an invalid ABI snapshot");
                return;
            }

            WritableMap map = Arguments.createMap();
            map.putInt("structSize", values[0]);
            map.putInt("abiMajor", values[1]);
            map.putInt("abiMinor", values[2]);
            map.putInt("backendKind", values[3]);
            map.putInt("capabilitiesLow", values[4]);
            map.putInt("capabilitiesHigh", values[5]);
            promise.resolve(map);
        } catch (NoSuchMethodException e) {
            promise.reject("E_ENGINE_CONTRACT_UNAVAILABLE",
                    "Bundled ViroCore does not expose the engine contract yet", e);
        } catch (Throwable t) {
            promise.reject("E_ENGINE_CONTRACT_QUERY",
                    "Unable to query ViroCore engine contract", t);
        }
    }
}
