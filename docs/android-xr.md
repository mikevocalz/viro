# Android XR integration

Status: **experimental; awaiting Android XR device validation**.

`ANDROID_XR` connects the Expo build, Android activity, and React scene routing
to ViroCore's existing C++/OpenXR renderer. It is intended for Android XR devices
that expose the OpenXR runtime. Eskiu integration is outside this change.

## Configure an app

```js
plugins: [
  [
    "@reactvision/react-viro",
    {
      provider: "none",
      android: { xRMode: ["ANDROID_XR"] },
    },
  ],
];
```

Run a clean Expo prebuild after changing platform modes. Android XR uses its
own `androidxr` dependency flavor. It must be the only mode in its Viro
configuration, because this integration targets a dedicated Android XR APK.
Existing mobile, Quest, and PICO build modes remain
available independently.

Use the existing `ViroXRSceneNavigator` with a `ViroScene` for the first test.
Device detection comes from the Android PackageManager feature exposed by the
native bridge, rather than a model-name match. `isAndroidXR` is available from
the package root for diagnostics and platform-specific app shells.

## What this integration changes

- The Expo mode type and parser accept `ANDROID_XR`.
- `MainApplication` initializes `ViroPlatform.ANDROID_XR`; AAR wrapper modules
  resolve the `androidxr` flavor and the app builds for arm64.
- The generated immersive `VRActivity` declares unmanaged Full Space and the
  OpenXR immersive category. The ordinary `MainActivity` owns the single
  launcher tile. The start-mode property is scoped to the immersive activity.
- The manifest declares `libopenxr.google.so` and requires the Android XR
  OpenXR feature. Android XR does not inherit Quest's SDK caps or automatic
  Meta permissions.
- `ViroXRSceneNavigator` sends the scene and navigator operations to the shared
  OpenXR activity instead of falling through to phone AR. Existing public
  names such as `renderQuestPanel` and the registered `VRQuestScene` root are
  retained for compatibility.
- Android XR exit finishes the immersive activity without the Oculus Home
  pending-intent handoff. The updated Java bridge is shipped in the rebuilt
  `react_viro-release.aar`.
- A pending permission request cannot launch the immersive activity after its
  React navigator unmounts.

The renderer AAR stays unchanged. This change does not establish support for
every optional Android XR extension.

## Validation without a headset

The automated boundaries are the ones exercised by a consumer: generated Expo
project files, public scene routing, native bridge compilation, and package
installation/build. Mocked native tests establish how the React code responds;
they do not certify the Android XR runtime or compositor.

```bash
npm ci
npm test -- --runInBand
npm run build
npm run test:plugin-load
npm run android-xr:prepare
```

The [diagnostic sample](../examples/android-xr/README.md) documents the optional
APK build and a hardware test sequence. The Android XR build workflow produces
the APK and a validation report. Its hardware result stays `not-run` until an
actual tester supplies evidence; CI never marks it passed.

## Required device evidence

A tester with a compatible Android XR device must verify visible stereo
content, head tracking, basic hand selection and drag release, exit/reentry,
background/resume, and passthrough before the target is advertised as verified.
Record device/runtime versions, the exact APK and source commit, logs, video,
and observed results. Evaluate sustained frame timing separately after the
minimal scene works.

The diagnostic APK is a bundled, development-signed release build with
minification disabled. A minified build currently fails R8 on missing private
telemetry/protobuf types referenced by the inherited GVR 1.180 library. This
sample-specific setting preserves a usable test APK; it does not resolve that
production dependency issue or change other apps' shrinking settings.

Google's emulator explicitly does not support OpenXR apps. A successful
Android/Jetpack XR emulator test therefore cannot validate this rendering path.
Hardware can belong to a collaborator; owning a headset is not required to
implement or build the integration.

## Native features still awaiting integration or verification

| Feature | Current limit |
| --- | --- |
| Passthrough capability report | The renderer's legacy flag follows `XR_FB_passthrough`; Android XR's alpha-blend route needs a separate runtime correction and device evidence. |
| Basic hand actions | Bindings exist in the renderer; actual Android XR input is unverified. |
| Raw hand joints, eye and scene data | Require feature-specific permissions and native lifecycle validation. They are not prerequisites for the basic probe. |
| Room geometry and anchors | Existing EXT/FB backends do not establish Android XR spatial-entity/trackables support. |
| System Spatial Containers | Separate optional extension work. |
| Studio room placement and co-location | Quest-specific paths need their own platform review. |
| Rive, whiteboard, and video surfaces | Bring across after the minimal scene passes device tests. |

## Official references

- [OpenXR getting started and manifest requirements](https://developer.android.com/develop/xr/openxr/get-started)
- [Activity/application XR manifest properties](https://developer.android.com/reference/androidx/xr/runtime/manifest/ManifestProperty)
- [Supported OpenXR extensions](https://developer.android.com/develop/xr/openxr/extensions)
- [XR permissions](https://developer.android.com/develop/xr/permissions)
- [Android XR emulator limitations](https://developer.android.com/develop/xr/jetpack-xr-sdk/run/create-avds/xr-headsets-glasses)
- [Device installation, logs, and screen capture](https://developer.android.com/develop/xr/engine-hub/manage-devices)
