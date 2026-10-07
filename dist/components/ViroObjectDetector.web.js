// The root barrel re-exports this from "./ViroObjectDetector", which resolves to this file on web.
// It is the value the native component's `onError` reports when its view is not in the build;
// kept in step with ViroObjectDetector.tsx by hand, since importing it from there would pull in
// the top-level requireNativeComponent() this stub exists to avoid.
export const VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR = "VRTObjectDetectorView is not registered with React Native. @reactvision/react-viro up to " +
    "3.0.2 shipped iOS builds without it; update the package, run pod install and rebuild the app.";
export const ViroObjectDetector = () => {
    if (__DEV__) {
        console.warn("[Viro web] ViroObjectDetector is not supported on web; rendering nothing.");
    }
    return null;
};
