/**
 * Numeric input-source ids reported in event payloads (event.nativeEvent.source),
 * mirroring the native ViroOculus::InputSource enum. Only the sources JS acts
 * on are listed: eye gaze (to route onHover -> onGaze) and Y (the Studio
 * scene's Quest menu).
 */
export const ViroEventSource = {
    Y_BUTTON: 7, // ViroOculus::YButton (left controller)
    EYE_GAZE: 12, // ViroOculus::EyeGaze (Quest Pro, XR_EXT_eye_gaze_interaction)
};
