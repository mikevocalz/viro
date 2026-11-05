# Release Notes

## v3.1.0

**Advanced VPS arrives: scan a place with the phone, then find it again and pin content to it, matched on the device or on the GPU server. The world mesh now fuses depth across frames into a room that persists, and Meta Quest gets a headset-native Studio experience.** Renderer binaries are rebuilt on virocore 3.1.0, with ReactVisionCCA 1.4.0. The web build uses `@reactvision/viro-web-renderer` 1.1.0.

### Advanced VPS

- **`<ViroVPS>` finds a scanned place and keeps tracking it.** `startTracking(id)` takes a known location, `"auto"` searches by GPS and `"visual"` by camera image. Results come through `onLocalized` and `onTrackingState`.
- **Two ways to localise, behind one prop.** `localization="device"` (the default) downloads the place's map and matches on the phone. `localization="server"` sends camera frames to the GPU server instead, which holds up much better across days and lighting, and needs no map download. `StudioSceneNavigator` takes the same choice as `vpsLocalization`.
- **`<ViroVPSAnchor>` and the place's mesh.** Content placed in map coordinates, and the scanned mesh (occlusion and physics), follow the map every frame.
- **Scanning from your app.** `uploadScanRecording(target, outputDir, options?)` zips a recording natively and sends it straight to Storage; on iOS the upload carries on in the background. `getScan(scanId)` follows processing.
- **VPS calls go to Studio** and need no address or credentials beyond the Studio session or the Expo plugin's `rvApiKey` and `rvProjectId`. Requests time out instead of hanging.

### World mesh

- **The mesh fuses depth frames into a room that persists** on the depth-image and monocular paths, instead of rebuilding from the last frame. `worldMeshConfig` takes `accumulate`, `voxelSize` and `maxMemoryMB`, `sceneNavigator.resetWorldMesh()` starts a new room, and `getWorldMeshStats()` reports `source` (`lidar`, `depth`, `monocular`, `plane`) and `accumulated`.
- **Android: the world mesh is in the right place,** read from each depth image's own stride, with confidence weighting samples instead of dropping them.
- **iOS without LiDAR: estimated depth is placed where it was seen,** so fusing it no longer leaves duplicated surfaces.
- The world mesh types are exported from the package root.

### Meta Quest

- **Studio scenes feel native in the headset.** A menu on the left controller's menu button (or a palm pinch), panels styled after Meta Horizon OS at a quarter of the size, the HUD centred where the wearer looks, and placement along the controller's ray.
- **The room stays put.** Content on room surfaces, tap-placed models and the co-location frame keep their place when the wearer recentres; `onRoomMoved(listener)` reports a recentre to your app. Plane scenes use the room's planes and pick the one nearest the wearer.
- **Input behaves like the platform's.** Y goes back as B does, only a trigger or pinch selects, a hand and a controller on one side press once, and a released hand releases its pinch. `ViroController.getControllerRayAsync(source)` says where a ray points.
- **Fewer crashes and leaks:** videos no longer abort the app or leak, a scene's root can change as the headset view starts, and closing a scene logs no OpenXR errors.
- **Expo plugin:** Quest builds declare minSdkVersion 32, the Horizon OS SDK, a network security config and Meta's recommended activity settings, and no longer declare NFC.

### Web

- **Web AR content stays in the room on iPhone,** and hides while tracking is lost (`hideContentWhenLost` turns that off). From viro-web-renderer 1.1.0.

### visionOS

- **Studio scenes render in the ImmersiveSpace.** They rooted in `ViroARScene`, which renders nothing on visionOS, so a Studio scene was blank. They now root in `ViroScene`, as on Meta Quest, in shared sessions too.

### Everywhere

- **Every scene navigator sends one usage ping when it mounts,** replacing the device registration ReactVisionCCA used to do. It carries no API key. Turn it off with `ViroTelemetry.setEnabled(false)` or the Expo plugin's `telemetry: false`. The iOS privacy manifest now ships with the pod.
- **Co-location:** the replication socket sends a per-device id (`getColocationDeviceId()`), and a join refused for the team's compute billing says so.
- **A click goes to what is drawn on top,** not always the nearest object, and a click on nothing reaches `ViroController`'s `onClick` again.
- **Text sits where its vertical alignment puts it,** and no longer disappears after a front-culled material.
- **Video:** a paused iOS video stays paused, and Android play and pause reach the player in the order they were made.
- `ViroKit.framework` targets iOS 15.1, the minimum the podspec already declared.

See `CHANGELOG.md` for every change.

## v3.0.3

**Meta Quest gets an in-headset menu and stops reopening itself, iOS mounts `ViroObjectDetector` again, and the package bundles for the web.** A patch release on top of 3.0.2. Renderer binaries are rebuilt on virocore 3.0.3.

### Meta Quest

- **The headset view no longer reopens by itself** after the wearer goes Home or opens Settings. VR launches once, on mount; the panel offers "Enter immersive view", which `renderQuestPanel(enter)` replaces with your own panel. Leaving VR returns to the panel through Home, where the wearer left it.
- **A menu on the left controller's Y button** in `StudioSceneNavigator`: scene name, shared-session status and join code, your `questMenuItems` and Exit. The scene HUD now stays where it appears instead of following the head, says why a shared session failed, and its text is sharp.
- **Studio scenes with plane detection on no longer crash** outside a shared session, and a plane scene opened after another AR scene now gets the room's planes.
- **The boundary is hidden while passthrough is on.**
- **Expo plugin:** `android.questFeatures` drops the permissions an app does not use (`colocation`, `eyeTracking`, `passthroughCamera`), `android.questHorizonOsSdk` sets the Horizon OS SDK version (69 by default), `horizonos.permission.HAND_TRACKING` replaces the deprecated name, and Quest builds no longer declare location or require a camera.

### iOS

- **`<ViroObjectDetector />` mounts again.** 3.0.2's prebuilt archive left out `VRTObjectDetectorView`, so it failed with "View config not found" and `react-viro-onnx` found nothing to attach to. Run `pod install` and rebuild. If the view is ever missing, the component now renders nothing and calls `onError` instead of taking the screen down.
- **A session-only app no longer asks for location** when it opens an AR scene. The Core Location feed starts only with `RVApiKey` and `RVProjectId`, as before 3.0.2.
- **Camera recordings carry an audio track.**

### Web

- **The package bundles with Vite and webpack.** 3.0.2 shipped raw JSX in `dist/`. The build now uses the automatic JSX runtime, and assets resolve without React Native's `AssetSourceResolver`.

### Everywhere

- **Studio, scene and cloud-anchor requests run in the platform database's region**, falling back to unpinned when that region's edge runtime is down. `rvSetStudioSession` takes an optional `functionRegion`.
- **`getRecordingStatus` returns `"None"`, `"Recording"`, `"IOError"` or `"Unsupported"` on Android too** (typed `ViroRecordingStatus`). Android used to return the Java enum names.
- **`onCollision` fires against the AR world mesh** with its `collisionTag`.
- **On Android, `startRecording` without `RECORD_AUDIO` rejects** instead of hanging.
- **A `ViroCamera` mounted between its siblings becomes the scene's camera.**
- **visionOS:** `ViroSpatialSound`, `ViroSoundField` and `ViroObjectDetector` render nothing instead of crashing.
- **visionOS Expo plugin:** it no longer copies stale patches next to an app's own, which made `patch-package` fail and, through an old `expo-modules-core` patch, broke assets and icon fonts on iOS.

## v3.0.2

**The web player, fixed against real scenes, and co-location in `StudioSceneNavigator`.** Large generated models load instead of killing the renderer, taps land where they are drawn, and web AR holds steady through tracking dropouts. A Studio scene can now be shared between devices in the same room. Web needs `@reactvision/viro-web-renderer` 1.0.1; the peer range asks for it.

### Co-location

- **`colocation={{ mode: "host" }}`** scans the space and creates a room with a six-character join code. **`{ mode: "join", code }`** aligns to it, so every device renders the content where the host placed it. A Quest host shares a Meta spatial anchor instead of scanning.
- **A live room shares the scene.** Variables, visibility and tap-to-place positions are shared (the last write wins), and so are drags (the dragging device holds the asset) and NAVIGATE. Animation triggers and sounds play on every device while the function behind them runs on one. Collision bindings keep running when the host leaves.
- **State and control.** Use `onColocationStateChange`, `onColocationRoom` and `colocationIndicator`, plus `leaveColocation()`, `getColocationRoom()`, `finishColocationScan()` and `retryColocation()` on the handle. `StudioColocationIndicator` and `useStudioColocation()` are there for a custom UI.
- **It doesn't hang.** A joiner connected before the host has placed the scene reports `waiting_for_host`, and `connectTimeoutMs` (60 s by default) fails a room that never comes up with `CONNECT_TIMEOUT` or `HOST_TIMEOUT`. The host's Done waits for 30 keyframes and for the point count native reports. Leaving mid-scan or mid-host cancels the native work.
- **Signed-in users work.** It runs on an API key or the internal Studio session. `rvSetStudioSession` also reaches cloud anchors and the co-location channel.

### Fixed on the web

- **A 30 to 40 MB model no longer blacks out the scene.** The renderer's memory was fixed at 256 MB and could not grow. It now grows to 2 GB, and glTF loads no longer copy the model.
- **Failures reach you.** `StudioSceneNavigator` takes `onAssetError(asset, error)` and `onRendererAbort`, which also shows `renderError` in the canvas's place.
- **The Studio scene mounts once**, so models are no longer fetched and parsed more than once.
- **Taps are no longer mirrored vertically.**
- **Web AR holds its last pose through a dropout** and smooths it. `arOptions` accepts `feedWidth`, `feedHeight` and `poseSmoothing`.
- **A denied motion permission is reported** through `onMotionUnavailable` on `ViroARSceneNavigator` and `StudioSceneNavigator`, with a message on screen.
- **Transparent image borders no longer hide what is behind them.**

### Native

- **Meta Quest gets gaze on every headset, screen capture, AR hit test from JS (`performARHitTestWithRay` / `WithWorldPoints`), click haptics and the left-palm menu pinch.** Capture is `sceneNavigator.takeScreenshot`, `startVideoRecording` and `stopVideoRecording`, as on AR. It records the left eye and not the passthrough room, and reports `RECORD_ERROR_NOT_READY` until the headset is rendering.
- **Quest: hit tests, screenshots and recordings no longer crash or come out black,** the laser follows a dragged object, and a drag whose node leaves the scene ends instead of crashing.
- **Remounting a navigator works on every platform.** With physics it crashed on teardown; on iOS the new scene's text came back garbled; on Android the new renderer crashed on its first frame.
- **iOS on React Native 0.86:** native module calls (`applyImpulse`, `getTransformAsync`, hit tests, `project`, camera capture and others) wait for their view to mount instead of failing with "Invalid view returned", so an active `ViroCamera` takes over its scene and `useViroMapCamera` works. A conditional child unmounted before it mounted no longer crashes.
- **iOS: a gesture during AR teardown no longer crashes.**
- **`cancelCloudAnchorOperations()` cancels** ReactVision hosts, resolves and scans (`ErrorCancelled`). It used to be a no-op.
- **The renderer binaries are rebuilt on virocore 3.0.2 and ReactVisionCCA 1.3.0**, which also raises the scan-host floor to 300 points.
