# G5 — first device results

PICO 4 Ultra (model A9210), Android 14, SDK 34. Paired fork build: renderer AAR
`dc9a68a0…4219d4`, bridge AAR `6907dc2e…d81f8`, `libviro_renderer.so`
`2a5c0221…a997` verified identical inside the APK.

Entering XR required a controller press. Injected taps reach the panel's virtual
display — a tap on another button navigated — but did not fire this control, so
the operator pressed it. Everything below is from that session.

## What passed

**Interaction profile — K01, PASS.** The runtime bound the profile matching the
hardware, not the fall-through:

```
[XR-DIAG] active profile /user/hand/left:  /interaction_profiles/bytedance/pico4s_controller
[XR-DIAG] active profile /user/hand/right: /interaction_profiles/bytedance/pico4s_controller
```

`pico4s_controller` is the PICO 4 Ultra path. `khr/simple_controller` would have
meant the suggestion list never matched; it did not appear. Both hands bound.
The first read is `none bound yet`, which is the pre-`FOCUSED` state, and the
bound value follows about 100 ms later.

**The scene root registration — PASS.** `ReactNativeJS: Running "VRQuestScene"`
and `com.example.expopico/.VRActivity` both appear, so VRActivity mounted Viro's
own entry point rather than an override. This is the PRE-1 fix working on
hardware: the example no longer calls `registerImmersiveScene`, the panel mounts
`ViroXRSceneNavigator`, and the intent it sets is what VRActivity reads.

## Plane detection is absent, as predicted

```
[XR-DIAG] caps: localFloor=yes handTracking=yes handAim=no passthrough=yes
          planeDetection=no fbScene=no eyeGaze=yes foveation=yes displayRefreshRate=yes
```

`planeDetection=no` and `fbScene=no`. Neither `XR_EXT_plane_detection` nor the
`XR_FB_scene` trio is available, so `_arSession` is never built and the
capability settles to `false` rather than `true`.

This is what `device-profiles.md:17-25` predicted from source and why the runbook
marked K10 — the `null -> true` transition — unreachable on PICO and moved the
real case to Quest as Q06. The device agrees. K11, `null -> false`, is the PICO
path, and Studio's manual-placement fallback is the behaviour that matters here.

Available and worth knowing: hand tracking, passthrough, eye gaze, foveation and
display refresh rate all report yes. Hand aim reports no.

## One thing to look at

```
Reference space: LOCAL offset 0.889 m (STAGE-emulated floor)
Floor origin applied on frame retry (offset 0.889 m)
[XR-DIAG] eye Y above appSpace(type=2) = 1.169 m;
          STAGE floor offset = 0.889 m (true floor origin expects eye Y ~1.3-1.8)
```

The renderer emulates a STAGE floor with a 0.889 m offset and then reports the
resulting eye height as 1.169 m, below the 1.3–1.8 m its own check expects. The
diagnostic exists precisely to catch this, and on this device it fires. Either
the emulated offset is too small for a seated or standing adult, or the app
space is not the one the offset assumes. Worth a seated-vs-standing comparison
before trusting any content placed relative to the floor.

## Not yet run

Everything else in the runbook: trigger and joystick, scene push and pop,
`onExitViro`, suspend and resume, recentre, passthrough toggle, permission
denied, empty-room scan, and the Quest regression. The logcat buffer rotated
during the session, so those need a fresh capture.

Note for the next session: injected taps are unreliable against this panel's
controls. Drive with the controller and use adb for capture rather than input.
