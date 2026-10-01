# Meta VR Glasses

**Status:** build/Store targeting support in progress; device input verification remains a separate gate.

Meta VR Glasses run Meta Horizon OS and use the same SDK family as Quest. Viro therefore reuses the existing Android OpenXR renderer rather than introducing a second renderer.

## Expo configuration

Use the existing `QUEST` XR mode to select Viro's Meta Horizon/OpenXR build path, then opt into forward-compatible Store targeting:

```ts
export default {
  expo: {
    plugins: [
      [
        "@reactvision/react-viro",
        {
          android: {
            xRMode: ["QUEST"],
            questAppId: process.env.META_APP_ID,
            metaVrGlassesCompatible: true,
          },
        },
      ],
    ],
  },
};
```

`metaVrGlassesCompatible: true` adds:

```xml
<meta-data
  android:name="com.meta.store.defaultDeviceTargets"
  android:value="quest3+" />
```

Meta currently documents `quest3+` as covering the Quest 3 family, Meta VR Glasses and future Meta VR devices.

Viro continues to emit the current Quest compatibility list:

```xml
<meta-data
  android:name="com.oculus.supportedDevices"
  android:value="quest2|questpro|quest3|quest3s" />
```

Do **not** add a guessed Meta VR Glasses identifier there. Meta does not currently expose one.

To override the Store default deliberately:

```ts
android: {
  xRMode: ["QUEST"],
  metaVrGlassesCompatible: true,
  metaDefaultDeviceTargets: "quest3+",
}
```

## Compatibility mode

Meta VR Glasses can run an immersive third-party app in Horizon compatibility mode. In that mode selected Android device-identification APIs may report an older Quest model.

Therefore:

- use `isMetaHorizonXR` to choose Viro's Meta OpenXR family;
- treat `isKnownQuest` / reported model strings as diagnostics only;
- probe OpenXR/runtime capabilities for hands, eye gaze, passthrough, anchors, planes, controllers and other features;
- never enable or disable a feature solely from `Build.MODEL`.

## Input

Meta VR Glasses ship controllerless by default. Eyes + hands are the primary interaction model, although separately purchased controllers can be paired.

ViroCore's current Android OpenXR path already contains:

- `XR_EXT_hand_tracking` hand joints;
- Meta hand-aim support when the runtime exposes it;
- pinch detection and hand/controller handoff;
- `XR_EXT_eye_gaze_interaction` gaze pose support;
- controller action bindings as a fallback when controllers are present.

The companion ViroCore PR makes those negotiated capabilities observable to JavaScript through a new non-breaking probe. Once the matching renderer AAR is staged, app code can query the active immersive view instead of inferring features from hardware names:

```tsx
import {
  getOpenXRRuntimeCapabilities,
  useVRViewTag,
} from "@reactvision/react-viro";

function CapabilityAwareScene() {
  const viewTag = useVRViewTag();

  async function inspectRuntime() {
    if (viewTag == null) return;
    const caps = await getOpenXRRuntimeCapabilities(viewTag);

    if (caps?.eyeGazeSupported && caps.handTrackingAvailable) {
      // Prefer gaze targeting + hand/pinch commit.
    }

    if (!caps?.passthroughAvailable) {
      // Keep the experience fully virtual.
    }
  }

  return <ViroScene>{/* content */}</ViroScene>;
}
```

The old expo-pico `getRuntimeInfo()` String[10] contract is unchanged; the new capability probe is separate.

## Standard Android panels vs immersive Viro

These are two different input paths:

```text
Standard Android / React Native panel
  -> Horizon OS Look and Pinch
  -> Android view hierarchy / accessibility
  -> standard touch semantics

Immersive Viro scene
  -> OpenXR gaze + hand tracking
  -> Viro hit testing
  -> normalized hover/select events
```

Do not require Meta's unstable React Native Gaze SDK for ordinary 2D Look and Pinch. Meta says most Android apps do not need it, and the current unstable SDK is not Store-submittable. It may be evaluated later for explicit gaze overrides/tooltips on Standard Android panels.

## Architecture and ABI

Meta VR Glasses require a 64-bit binary. Viro's Meta/Quest build defaults to `arm64-v8a` only through `questArm64Only: true`; keep that default for this target.

## Testing

Minimum pre-hardware test lane:

1. Build the arm64 Meta/OpenXR APK.
2. Run it against Meta XR Simulator v207 or newer.
3. Select the Meta VR Glasses device profile.
4. Enable Look and Pinch.
5. Verify gaze hover, pinch select, drag/manipulation fallbacks and controllerless navigation.
6. Verify the scene does not depend on Quest-specific model strings.
7. Verify Standard Android panels remain usable through system Look and Pinch.

Simulator evidence is not final device proof. Physical Meta VR Glasses validation remains required before claiming shipping support.

## Related

- `XR-PLATFORM-EXPANSION.md` — complete platform/PR map.
- `META-SPATIAL-LAYOUT.md` — Meta system-managed spatial windows.
- `ViroXRSceneNavigator` — common Meta Horizon/PICO/visionOS reality router.
