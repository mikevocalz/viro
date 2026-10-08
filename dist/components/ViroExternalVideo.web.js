/**
 * ViroExternalVideo.web.tsx
 *
 * Not implemented on web — the external-Surface producer path (Android
 * ExternalSurfaceTexture fed by e.g. a WebRTC EglRenderer) has no counterpart
 * in the WASM/WebGL2 renderer yet; a web equivalent would bind an
 * HTMLVideoElement srcObject to the material instead. This file exists purely
 * so the platform-extension resolver picks THIS instead of
 * ViroExternalVideo.tsx on web: the native file calls
 * requireNativeComponent() at module scope with no web guard, which crashes
 * the entire @reactvision/react-viro barrel import on web the moment anything
 * requires it — not just when this component is actually used.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as React from "react";
import { warnUnsupported } from "./Utilities/ViroUnsupported";
// Same export surface as the native file, so nothing that imports it breaks on web.
export { VIRO_EXTERNAL_VIDEO_UNAVAILABLE_ERROR } from "./Utilities/externalVideoUnavailableError";
export function resetExternalVideoNativeViewCheck() { }
export class ViroExternalVideo extends React.Component {
    componentDidMount() {
        if (__DEV__) {
            warnUnsupported("ViroExternalVideo", "web", "It renders nothing.");
        }
    }
    render() {
        return null;
    }
}
