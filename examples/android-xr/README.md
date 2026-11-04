# Android XR diagnostic scene

This is the first-device probe for the experimental `ANDROID_XR` build mode.
It uses Viro's existing C++/OpenXR renderer. Android XR device validation is
pending; a successful build is not proof of stereo rendering or tracking.

## Prepare a standalone app

From the Viro repository root, with Node 24:

```bash
npm ci
npm run build
npm run android-xr:prepare
```

The script creates `build/android-xr-probe`, packs this checkout, installs the
tarball in a clean consumer, type-checks the scene, and runs both a clean and a
repeat Expo prebuild. It checks the generated manifest, native platform
selection, Gradle flavor selection, and single launcher activity. Dependencies
use the versions already installed from the repository's lockfile. The consumer
gets its own lockfile and retains its Viro tarball in `vendor/`.

The output directory must not already exist. Use a fresh directory for another
run:

```bash
npm run android-xr:prepare -- --out ./build/android-xr-second-run
```

To also build a standalone APK, install JDK 17 and the Android SDK, set
`JAVA_HOME` and `ANDROID_HOME`, and add `--build`:

```bash
npm run android-xr:prepare -- --out ./build/android-xr-apk --build
```

Gradle creates an arm64 release APK under
`build/android-xr-apk/android/app/build/outputs/apk/release/`. The Expo template
uses its development signing key for this probe. This is a tester build, not a
store release. Minification is explicitly disabled for this probe because the
inherited GVR 1.180 library references missing telemetry/protobuf types during
R8 shrinking. A minified production build needs that legacy dependency issue
resolved separately; the general Viro plugin does not disable shrinking.
The script reads the final manifest back from the APK with the
SDK's `apkanalyzer` and verifies the launch contract and excluded permissions.
`apk-AndroidManifest.xml` preserves that merged result. `validation.json`
records source provenance, package/APK hashes, and which checks ran. It always
records physical-device validation as `not-run`.

## What to do on the device

1. Install the APK and open **Viro Android XR Probe**. There should be one app
   tile. The panel launches the immersive scene.
2. Confirm that the cube is visible to both eyes and stays at its world
   position as you move your head. Record what you observe; a `head_pose` log
   alone is not proof of correct stereo presentation.
3. Aim at the cube and pinch/select. The selection counter should increase.
   Drag it, release, then repeat with the other hand. Also interrupt a drag by
   moving the hand out of view and check that it releases.
4. Select **Report runtime** after the scene appears. Save the report alongside
   the native OpenXR startup log. The initial report can be `runtime_not_ready`.
5. Select **Exit scene**, then **Enter immersive view** in the panel. Repeat
   five times and also check system Back, background/resume, and device sleep.
6. This scene starts opaque. For a separate passthrough test, change
   `passthroughEnabled` to `true`, rebuild, and record the observed background.

The probe does not request runtime grants for raw hand-joint, eye-tracking,
room-sensing, camera, or microphone access. Its Expo configuration also blocks
camera, microphone, and fine eye-tracking declarations inherited from shared
libraries. Basic hand-action input should be checked first. Add permission-gated
features only when the app actually uses them and their native integration has
been verified.

Use Android XR Engine Hub's Device Manager to install the APK, collect logs,
and capture a recording. Or use ADB, replacing the APK path as appropriate:

```bash
adb install -r ./app-release.apk
adb shell am start -n com.viro.androidxrprobe/.MainActivity
adb logcat -v threadtime > android-xr-device.log
```

Stop log capture after the test. Return the APK hash, device/OS/runtime versions,
logs, recording, and pass/fail notes for each step. Do not include unrelated
personal data from the device in a public issue.

## Current limits

- Google's Android XR emulator does not support OpenXR apps. A phone or ordinary
  emulator can exercise the panel only when installed; it does not run this
  immersive scene. Play targeting requires Android XR.
- The capability query returns the current renderer's reported flags. Its
  `passthroughAvailable` flag is based on the older FB route and does not prove
  whether Android XR alpha-blend passthrough works.
- No room mesh, persistent anchors, raw hand joints, eye tracking, or system
  Spatial Containers are claimed by this sample.
- Studio's Quest-specific room-placement and co-location behavior is outside
  this initial integration.

See [the Android XR integration guide](../../docs/android-xr.md) for scope,
build behavior, and official reference links.
