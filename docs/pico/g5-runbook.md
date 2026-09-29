# G5 on-device runbook

The gate between "it compiles" and "it has been observed on hardware". Every case
below is something this branch reasons about but has not seen run. Several were
decided by reading extension tables and upstream documentation; this is where
those readings get checked.

`components/Studio/StudioSceneNavigator.tsx:577` defers to case K07 by name.

Cases are referenced from the research plan in the coordinated virocore repo —
[`docs/pico/research-plan.md`](https://github.com/mikevocalz/virocore/blob/codex/pico-cli-bridge/docs/pico/research-plan.md),
G5 section. Tasks T1–T8 there name the cases they depend on. Run the case first;
a task run against a failed case produces a finding about the build, not about
the design.

## Rules

**Record the build, every time.** Two builds can render identically and behave
differently — see K05. A result without a SHA is not a result.

**Never cold-start `.VRActivity`.** It is declared `android:exported="false"`
(`plugins/withViroAndroid.ts:774`) and launching it directly bypasses intent
setup, so the activity mounts with no scene registered and sits on a blank
screen. Launch the package and let the panel set the intent. expo-pico
`docs/VIRO-PICO-INTEGRATION.md:35` says the same.

**Uninstall before install.** Do not read a screen against a binary you cannot
name. The capability API lives in native code, and an APK that kept an older
renderer produces `E_XR_REBUILD_REQUIRED` — which the JS layer renders as an
ordinary "unavailable" (K04).

**This file is public.** Record device tiers and OS versions, not serials. No
raw logcat, no screenshots, no host paths, no signing material. The
`scripts/pico-cli.mjs capture` output in the coordinated expo-pico repo writes
device info, package logcat and a screenshot to a directory — keep that
directory out of the repo.

## Header

Fill once per pass. Copy onto every observer sheet.

```
Viro SHA            ____________  (git rev-parse --short HEAD)
ViroCore SHA        ____________
expo-pico SHA       ____________
react-viro resolved ____________  (fork build, or public release — see P2)
Device tier         Neo3 / PICO 4 / PICO 4 Ultra / Quest 3 / Quest 3S
OS version          ____________
Scene root          ViroScene / ViroARScene
Space Setup run     Y / N        (Quest only)
Date                ____________
```

## Preconditions

Both block the whole pass. Neither is a finding; they are harness faults, and
running G5 through them produces results about the harness.

### P1 — the example app removes Viro's VR entry point

expo-pico `example/index.js:20` calls `registerImmersiveScene(VrSceneRoot)` at
module scope. React Native's last registration wins, so this replaces Viro's
`VRQuestScene` root and `ViroQuestEntryPoint` never mounts. That entry point is
what wires the hardware back/B button to `exitVRScene()` and what subscribes to
`VRQuestNavigatorBridge`, so a scene entered this way has no back button and does
not receive push/pop from the panel.

expo-pico `docs/VIRO-PICO-INTEGRATION.md:35` forbids it in as many words: "Do not
replace its registration with `registerImmersiveScene` when using this
navigator."

**Clear by:** removing the `registerImmersiveScene` call and mounting
`ViroXRSceneNavigator` from the panel, or keeping the custom root and subscribing
it to `VRQuestNavigatorBridge` as the upstream Quest guide §8 describes.
**Verify:** K10 passes with the hardware button, not only with the HUD strip.

### P2 — the example pins the public react-viro release

expo-pico `example/package.json:38` pins `@reactvision/react-viro` to `2.58.1`,
the public npm release. `getCapabilities` does not exist in that native build, so
the call raises a `LinkageError`, the bridge rejects with
`E_XR_REBUILD_REQUIRED`
(`android/viro_bridge/src/main/java/com/viromedia/bridge/module/VRModuleOpenXR.java:75`),
and `useOpenXRCapabilities` swallows it into `{ planeDetection: null }`
(`components/Utilities/useOpenXRCapabilities.ts:29-33`).

The observable result is a HUD that says "Surface tracking unavailable" on every
device, for every reason, forever. Every plane-related case would pass its
negative branch for the wrong cause.

**Clear by:** installing the fork build per expo-pico
`docs/VIRO-PICO-INTEGRATION.md`, "Build and verify the native pair".
**Verify:** K04 distinguishes `null` from `false`.

## Cases

Each case records a fact. Where a case has a predicted outcome, the prediction is
stated with its basis — a case that confirms a prediction is as useful as one
that breaks it, and only one of those is worth writing down if the prediction is
left implicit.

### K01 — Panel to immersive handoff

**Establishes:** the two-activity launch path works on this device.

1. Cold-start the app by package name. Do not name an activity.
2. Navigate to the scene screen.
3. Observe the panel, then the headset display.

**Record:** time from panel mount to first rendered XR frame; whether the panel
showed anything during that window; whether MainActivity stayed a 2D panel.

**Pass:** the immersive scene appears and the panel does not bleed RN UI into it.

**Expect a blank panel.** `ViroXRSceneNavigator` returns `null` on both headsets
(`components/ViroXRSceneNavigator.tsx:323`) and `StudioSceneNavigator`'s
remaining children are all conditional
(`components/Studio/StudioSceneNavigator.tsx:587-614`). Blank is the current
design, not a failure of this case. Copy for it is proposed as S5 in the
coordinated `docs/pico/ux-copy.md`.

### K02 — Permission grant, Quest

**Establishes:** what the three-permission request does when accepted.

1. Uninstall, install, launch. The permissions must be in their unasked state.
2. Accept all three at the system dialog.
3. Enter the scene and read the HUD plane status line.

**Record:** which of the three dialogs appeared and in what order; whether
VRActivity launch waited for them; the HUD status line after five seconds.

The three are `horizonos.permission.USE_ANCHOR_API`,
`com.oculus.permission.USE_SCENE`, `horizonos.permission.HEADSET_CAMERA`
(`components/ViroXRSceneNavigator.tsx:36-40`). The call is awaited at `:269`, so
launch is blocked while the dialog is up.

**Pass:** all three prompt, launch proceeds after, and the plane status resolves
to something other than the unavailable string (given Space Setup has been run).

### K03 — Permission denial, Quest

**Establishes:** that the denial is currently invisible, and what it costs.

1. Uninstall, install, launch.
2. **Deny** `USE_ANCHOR_API` at the dialog. Accept the others.
3. Enter the scene. Read the HUD. Attempt a plane-anchored placement.

**Record:** everything the app said about the denial (expected: nothing); the
HUD status line; whether any placement anchored.

**Expect no acknowledgement.** The grant map from `requestMultiple` is discarded
at `components/ViroXRSceneNavigator.tsx:269-270` — `.catch(() => undefined)` with
the resolved value unread — and `launch()` proceeds identically either way.

**This is a functional defect, not only a missing screen.** The upstream platform
matrix gives both Quest plane-detection rows as "Quest 3/3S via XR_FB_scene room
model (Space Setup + `horizonos.permission.USE_ANCHOR_API`)", and the Quest setup
guide §7b states the permission is runtime-granted and must be requested in-app.
Denying it removes plane detection, and the only downstream signal is the same
`planeDetection: false` a PICO device produces for an unrelated reason.

**Pass:** the case passes when it has been observed and recorded. The expected
observation is a failure of the product, and it is the highest-value result in
this runbook — SEV2 base, +1 for silent, per the research plan's bands.

### K04 — Capability report

**Establishes:** which of `null`, `false`, `true` this build and device produce,
and whether `null` is transient or terminal.

1. Enter the scene with the HUD visible.
2. Watch the plane status line from mount through ten seconds.
3. With `debug` enabled, record the resolved value of `getCapabilities` and any
   rejection code.

**Record:** the value at t=0, t=1 s, t=5 s, t=10 s; any rejection code; whether
the line ever changed.

`useOpenXRCapabilities` polls every 250 ms for at most 20 attempts
(`components/Utilities/useOpenXRCapabilities.ts:26-27`), so `null` is terminal
after five seconds. The bridge rejects with three distinct codes —
`E_XR_VIEW_UNAVAILABLE`, `E_XR_CAPABILITIES`, `E_XR_REBUILD_REQUIRED`
(`android/viro_bridge/src/main/java/com/viromedia/bridge/module/VRModuleOpenXR.java:63, 73, 75`)
— and the hook collapses all three into `{ planeDetection: null }` (`:29-33`).

**Pass:** the recorded value is attributable to one cause. If it is `null` and
the rejection code is unavailable, the case fails and P2 is the first thing to
re-check.

Note the five-second window separately: `planeDetectionAvailable` is false while
the capability is `null` (`components/Studio/StudioARScene.tsx:1239-1240`), so
the HUD asserts a definite failure during a period when nothing has failed yet.

### K05 — Capability versus anchor delivery

**Establishes:** whether a reported capability actually produces anchors. Run
this on Quest; it is the case that separates two builds that look identical.

1. Quest 3 or 3S, Space Setup completed, `USE_ANCHOR_API` granted.
2. Enter a Studio scene. Record the HUD status line.
3. Independently record whether any `onAnchorFound` fired and whether any content
   anchored to a real surface.

**Record both, separately:**

```
Capability (getCapabilities.planeDetection):  null / false / true
HUD status line:                              ________________________
Anchors delivered to the scene:               Y / N
Scene root actually mounted:                  ViroScene / ViroARScene
```

`_planeDetectionStatus` is stored at session creation regardless of scene root
(virocore `android/sharedCode/src/main/cpp/VROSceneRendererOpenXR.cpp:619`).
Anchors take a different path: `attachARSceneIfNeeded` does a
`dynamic_pointer_cast<VROARScene>` and returns early for a plain `VROScene`
(`:1236-1241`). Upstream viro#526's merge
[`5bddce6`](https://github.com/mikevocalz/viro/commit/5bddce6) kept the Quest
root at `ViroScene` and says so: "with this root a Studio scene on Quest gets no
detected surfaces."

So `capability: true, anchors: N` is a real and expected combination, and it
renders as "Scanning for planes…" indefinitely.

**Pass:** both values recorded. A case that records only the HUD line cannot tell
a root-unified build from this one, which is the entire reason the case exists.

### K06 — Missing-plane fallback

**Establishes:** the scene stays usable when surfaces are unavailable.

1. Any PICO tier, or Quest with `USE_ANCHOR_API` denied.
2. Enter a scene with plane-placed assets. Read the HUD.
3. Place an object with the controller.

**Record:** whether assets rendered at all; whether controller placement worked;
whether the HUD named manual placement.

`anchorDetectionTypes` returns `[]` (`components/Studio/StudioARScene.tsx:1253`)
and `renderAssets` returns the assets unwrapped rather than inside a
`ViroARPlane` (`:1345-1347`), so content should render unanchored rather than
disappear.

**Pass:** assets visible, controller placement works, HUD says "Surface tracking
unavailable — use manual placement" (`components/Studio/StudioQuestSceneHudOverlay.tsx:82`).

### K07 — HDR against passthrough on PICO

**Establishes:** whether PICO's compositor behaves like Quest's. This is the case
`components/Studio/StudioSceneNavigator.tsx:577` defers to.

1. PICO, `passthroughEnabled` true, an MR scene.
2. Run with `hdrEnabled` at its current value — true on PICO, since the flag is
   `!isQuest` (`:580`).
3. Observe whether the room is visible behind virtual content.
4. Force `hdrEnabled={false}` and repeat.

**Record:** passthrough visible with HDR on — Y/N. Passthrough visible with HDR
off — Y/N. Whether PBR materials changed appearance between the two.

Quest is settled: the HDR composite renders to an intermediate target and forces
an opaque final composite, which hides passthrough. The upstream Quest setup
guide §7b says to set `hdrEnabled={false}` for MR scenes and the platform
matrix's mixed-reality row repeats it, which is why
[`f0a51bd`](https://github.com/mikevocalz/viro/commit/f0a51bd) made the flag
`!isQuest`.

PICO is not covered by that guidance and was deliberately left on, because
turning HDR off costs PBR outright: `VROChoreographer::isPBREnabled` is
`_hdrEnabled && _pbrEnabled`, so roughness, metalness and the AO map stop being
read and materials fall back to Blinn.

**Outcomes:**
- Passthrough visible with HDR on → leave `!isQuest` as it stands, record the
  observation against the flag.
- Passthrough hidden with HDR on and visible with it off → widen the condition to
  `!isXRHeadset` and accept the PBR loss on PICO, or gate HDR on whether the
  scene is MR rather than on the device.

Either way this case replaces a guess with an observation. Do not widen the flag
without it.

### K08 — In-scene alert

**Establishes:** the alert is readable and dismissible.

1. Trigger an alert through the store
   (`components/Studio/domain/questAlertStore.ts:31`).
2. Read it without moving your head. Dismiss it.
3. Trigger one without a title, then one with a long title.

**Record:** whether the whole panel fit in view; where the first click landed;
whether the message shifted vertically between the titled and untitled cases;
what a long title did.

The panel is 2 × 1 m at 1.2 m — 79.6° × 45.2° of arc — with a 0.22 m title em box
(10.5°) and a 0.16 m message em box (7.6°). See the coordinated
`docs/pico/handoff.md`, S2. Dismissal is a click anywhere on the panel
(`components/Studio/StudioQuestAlertOverlay.tsx:42`) with no rendered boundary
and no hover state.

**Pass:** read and dismissed without head movement and without moderator help.

### K09 — HUD legibility and exit target

**Establishes:** the HUD is readable, and how wide the exit really is.

1. Enter a scene. Read the scene name and the status line.
2. Sweep the controller ray slowly across the HUD from left to right **without
   pressing anything**. Note where a hover or highlight appears (expected:
   nowhere).
3. Press once on the exit row.
4. Separately: sweep across the HUD while pressing, deliberately away from the
   visible `[ Exit ]` text but within its row.

**Record:** whether the name and status were readable at a glance; where the exit
target appeared to start and end; whether step 4 exited the scene.

The exit hit area is the `ViroText` geometry's full 1.5 m width, 61.3° of arc,
invisible (`components/Studio/StudioQuestSceneHudOverlay.tsx:93-97`).
`handleExitClick` (`:26-29`) calls `onExitViro` and `exitVRScene()` immediately,
with no confirmation.

**Pass:** step 4 is the result that matters. If pressing away from the visible
text exits the scene, record it as SEV1 — destructive, unrecoverable within the
session, and silent about what is about to happen.

### K10 — Exit and return

**Establishes:** both exit paths, and what the panel does afterwards.

1. Exit via the HUD strip. Observe the panel.
2. Re-enter. Exit via the hardware back/B button. Observe the panel.
3. Re-enter. Press the Meta/system button and close from the universal menu.

**Record:** whether `onExitViro` fired on each path; what the panel showed after
each; whether re-entry worked.

Path 2 depends on P1 being cleared — the back button is wired by
`ViroQuestEntryPoint`, which `registerImmersiveScene` removes. Path 3 is not
expected to fire `onExitViro` at all; the system can finish VRActivity without
going through `exitVRScene()`.

**Pass:** paths 1 and 2 both exit and both fire `onExitViro`. Record path 3's
behaviour without treating it as a failure.

### K11 — Recenter

**Establishes:** both recenter paths, and whether the in-app one is discoverable.

1. Turn until the content is behind you.
2. Try to fix it without being told how.
3. Use `VRModuleOpenXR.recenterTracking(viewTag)`.
4. Use the system recenter (long-press Home).

**Record:** what was attempted first; whether content moved as a cut or as an
animation; whether the floor offset survived in Floor mode.

The coordinated `docs/pico/handoff.md` §(c) requires recenter to read as a cut,
with at most a ≤200 ms fade and no animated translation.

**Pass:** both paths reorient the content and neither animates its translation.

### K12 — CLI and prebuild failure text

**Establishes:** a developer can act on the error without reading source. Run on
the laptop, not in the headset.

1. `node scripts/pico-cli.mjs` with no arguments, then with an unknown command.
2. `install` with a path that is not an APK, then with an APK that does not exist.
3. `launch` with a malformed package id.
4. `capture` against a disconnected device.
5. Run prebuild twice against a clean project and diff the two outputs.

**Record:** for each, whether the message named what happened, why, and the next
action; and for step 5, whether the second prebuild changed anything.

Step 5 has a known result: the generated `android/app/build.gradle` is not a
fixpoint until the third run. See `code-review.md` in the coordinated virocore
repo.

**Pass:** every message in steps 1–4 carries all three parts. Step 5 records the
diff rather than passing or failing.

## Reporting

One row per case per pass. Keep it next to the observer sheets, not inside them.

```
Case  Result (pass / fail / void)  Predicted?  Note
K01   ______                       n/a         ______________________
K02   ______                       n/a         ______________________
K03   ______                       yes/no      ______________________
K04   ______                       n/a         ______________________
K05   ______                       yes/no      cap=____ anchors=____
K06   ______                       n/a         ______________________
K07   ______                       open        hdr on=____ off=____
K08   ______                       n/a         ______________________
K09   ______                       yes/no      step 4 exited: Y / N
K10   ______                       n/a         ______________________
K11   ______                       n/a         ______________________
K12   ______                       n/a         prebuild diff: ______
```

The "Predicted?" column records whether the outcome matched what this branch
reasoned its way to. A pass that breaks a prediction is worth more than a pass
that confirms one, and the column is the only place that distinction survives.
