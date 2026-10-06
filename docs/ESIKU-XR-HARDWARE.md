# Esiku XR hardware support

Viro's public API exposes one capability model over the native Esiku bridge.

## Hardware lanes

| Target | Public lane | Native path |
| --- | --- | --- |
| Android XR | XR / capability-first | ViroCore OpenXR |
| XREAL AURA | XR / capability-first | ViroCore OpenXR |
| RayNeo | XR / capability-first | OpenXR, then RayNeo extension adapter |
| VITURE | XR / capability-first | VITURE native adapter |
| HTC VIVE Eagle | wearable | wearable SDK adapter |
| Valve Steam Frame | XR / capability-first | ViroCore OpenXR |
| Quest | existing XR | existing ViroCore OpenXR |
| Vision Pro | existing visionOS | existing ViroCore visionOS |

The API intentionally does not add device-specific scene components.

## Component behavior

Existing components consume capabilities:

- ViroCamera -> camera capability
- ViroARPlane -> planes capability
- ViroController -> controller capability
- hand/pinch events -> hand-tracking / gesture capabilities
- ViroHeadTransform -> head-pose capability
- passthrough -> passthrough capability
- spatial audio -> spatial-audio capability

When a capability is unavailable, the component reports the same explicit
unsupported/permission-required state used by the existing provider model.

## Required implementation skills

- React Native + Expo native module/config-plugin work.
- Viro component/provider API compatibility.
- OpenXR capability negotiation and interaction profiles.
- Android XR permission/runtime discovery.
- VITURE and RayNeo native adapter lifecycle.
- Wearable camera/microphone/audio/device-control APIs for VIVE Eagle.
- Steam Frame OpenXR/controller validation.
- Native-device integration tests; no JS frame stepping.

## Compatibility

This PR does not replace the existing Quest or visionOS APIs. It adds the
common Esiku vocabulary so the native bridge can expose capabilities without
creating a product-specific Viro API surface.
