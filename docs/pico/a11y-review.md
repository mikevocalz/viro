# Headset accessibility review — WCAG 2.1 AA

**Verdict: accessibility risks to fix.**

Scope is the five surfaces a wearer meets between the app icon and standing in a
Studio scene. WCAG was written for screens, so each criterion below is applied in
the units a headset actually has: degrees of visual angle rather than pixels, and
effective contrast against a live camera feed rather than a known background.

Read from source at the cited `file:line`. Nothing here was measured on hardware;
the section at the end lists what still has to be.

## Surfaces

| Id | Surface | File |
| --- | --- | --- |
| S1 | Pre-launch permission request | `components/ViroXRSceneNavigator.tsx` |
| S2 | In-scene alert | `components/Studio/StudioQuestAlertOverlay.tsx` |
| S3 | Scene / exit HUD | `components/Studio/StudioQuestSceneHudOverlay.tsx` |
| S4 | Missing-plane fallback | `components/Studio/StudioARScene.tsx`, `components/Utilities/useOpenXRCapabilities.ts` |
| S5 | 2D launch panel | `components/Studio/StudioSceneNavigator.tsx` |

## How the numbers were derived

`ViroText` renders at `fontSize x 0.01` metres — `kTextPointToWorldScale` in
virocore `ViroRenderer/VROText.h:44`, applied at `VROText.cpp:140`. Angular size
is `2·atan((h/2)/d)`.

Head-locked panels sit 1.2 m out, yaw only
(`components/Studio/domain/questHeadLockedTransform.ts:30-45`). The HUD adds
`verticalOffsetM: -0.4` (`StudioQuestSceneHudOverlay.tsx:54`), so its true
eye-to-panel distance is `sqrt(1.2^2 + 0.4^2) = 1.265` m and its centre sits 18.4
degrees below the gaze axis.

Both scrims are black at partial alpha over passthrough, so effective background
is `passthrough x (1 - alpha)`. Ratios below composite each text colour against
that, at three room luminances.

## Likely WCAG issues

**1. HUD text drops below 4.5:1 over bright passthrough — 1.4.3 Contrast (Minimum), AA.**

The HUD scrim is `rgba(0,0,0,0.6)` (`StudioQuestSceneHudOverlay.tsx:63`). Against a
white wall or a window, effective background is rgb(102,102,102):

| Text | Colour | Dark room (32) | Lit room (180) | Bright (255) |
| --- | --- | --- | --- | --- |
| Scene name | `#FFFFFF` `:77` | 19.46:1 | 9.15:1 | 5.74:1 |
| Status | `#CCCCCC` `:88` | 12.12:1 | 5.70:1 | **3.58:1** |
| Exit | `#7FCBFF` `:101` | 11.02:1 | 5.18:1 | **3.25:1** |

Status and Exit fall under 4.5:1 somewhere between a lit room and a bright one.
Both clear the 3:1 large-text threshold, and at 4.98 and 5.88 degrees they are
unambiguously large — WCAG's 18pt threshold is about 0.9 degrees on a phone at
0.4 m, so these are five to six times that. So this **passes at AA on the
large-text allowance**, with no margin, on the two rows that carry the actual
information. The alert's `0.85` scrim (`StudioQuestAlertOverlay.tsx:44`) stays
above 15:1 everywhere and is not at risk.

Fix: raise the HUD scrim to `0.75`, or lift status from `#CCCCCC` to `#E6E6E6`.
Either restores margin without touching layout.

**2. Exit is distinguished from static rows by colour and bracket glyphs alone — 1.4.1 Use of Colour, A.**

`[ Exit ]` at `#7FCBFF` (`:94`, `:101`) sits under two non-interactive rows in the
same typeface and alignment. Nothing else marks it as actionable: no plate, no
border, no focus ring, no hover, pressed or disabled state anywhere in the file.
The brackets are doing the work a control affordance should. For a wearer with
reduced blue-yellow discrimination, the brackets are the only remaining cue.

Fix: give it a drawn backplate with a non-colour boundary, and a focus state that
responds to controller ray.

**3. A destructive action has a 61-degree invisible hit region and no confirmation — 3.3.4 Error Prevention, AA, and 2.5.5 Target Size.**

The Exit target is the `ViroText` geometry, 1.5 x 0.15 m (`:95-96`) — **61.3 x 6.8
degrees** at 1.265 m — while the visible `[ Exit ]` glyphs occupy a small
fraction of it. A ray anywhere along that invisible full-width strip exits the
scene. `handleExitClick` (`:26-29`) runs `onExitViro` and `exitVRScene()`
immediately, with no confirmation step.

2.5.5 is about targets being large enough; this is the opposite failure and WCAG
has no criterion for it, which is why it is filed under 3.3.4: a destructive
action that is trivially easy to trigger by accident and cannot be undone. The
same applies to S2, where the entire 2 x 1 m alert plate is the dismiss target
(`StudioQuestAlertOverlay.tsx:42`) with nothing drawn to say so.

Fix: bound the hit region to the drawn control, and either confirm the exit or
make it recoverable.

**4. S1 has no denied state at all — 3.3.1 Error Identification, A.**

`PermissionsAndroid.requestMultiple` is awaited and its result discarded
(`ViroXRSceneNavigator.tsx:269-270`); the `.catch(() => undefined)` also swallows
a genuine request failure. Nothing reads `RESULTS.GRANTED`, so there is no denied
UI to review. A wearer who declines surface access gets a scene that silently
never anchors, with no statement of what was refused or how to restore it.

This is a functional defect, not only a missing screen: upstream's platform
matrix records Quest plane detection as requiring Space Setup **and**
`horizonos.permission.USE_ANCHOR_API`, so the discarded grant decides whether S4
can ever report a surface.

Fix: keep the grant map, and surface a denied state naming the permission, the
consequence, and the Settings path. Copy is drafted in `ux-copy.md`.

**5. The plane-detection fallback never says what happened — 3.3.3 Error Suggestion, AA.**

`planeDetectionAvailable` collapses `null` and `false` into one branch
(`StudioARScene.tsx:1239-1240`), and the only signal is one HUD line. A wearer
cannot tell "still initialising" from "this headset has no surface detection",
and the poll runs 20 attempts at 250 ms before settling
(`useOpenXRCapabilities.ts:26-27`), so the indeterminate state can persist ~5
seconds while the HUD claims scanning is underway.

Fix: distinguish the pending string from the unavailable one.

**6. Head-locked panels step at 6.7 Hz and cannot be dismissed or moved — 2.2.2 Pause, Stop, Hide, A.**

Repositioning is throttled to 150 ms (`StudioARScene.tsx:94`, applied `:862-872`),
so panels jump to a new yaw rather than following. There is no entering or exiting
transition anywhere in either overlay, and no motion tokens exist. The HUD is
persistent for the scene's lifetime with no way to hide or reposition it, and it
occupies 64.6 x 22.4 degrees centred 18.4 degrees below gaze.

For a wearer prone to discomfort, content that snaps in the lower field with every
head turn and cannot be dismissed is the case 2.2.2 exists for.

Fix: allow the HUD to be hidden; interpolate between positions, or raise the
cadence enough that stepping is not perceptible.

**7. Type is two to three times oversized for its role, which is also a legibility failure.**

| Element | fontSize | World size | Distance | Angular |
| --- | --- | --- | --- | --- |
| Alert title | 22 | 0.22 m | 1.2 m | 10.47 deg |
| Alert message | 16 | 0.16 m | 1.2 m | 7.63 deg |
| HUD scene name | 14 | 0.14 m | 1.265 m | 6.33 deg |
| HUD status | 11 | 0.11 m | 1.265 m | 4.98 deg |
| HUD Exit | 13 | 0.13 m | 1.265 m | 5.88 deg |
| Placement prompt | 14 | 0.14 m | 2.01 m | 3.99 deg |
| Empty-scene text | 16 | 0.16 m | 2.0 m | 4.58 deg |
| Crash fallback | 20 | 0.20 m | 2.0 m | 5.72 deg |

Oversized type is not a WCAG failure, and it is why issue 1 passes on the
large-text allowance. It is still a usability problem: at 7.63 degrees per line
inside a 79.6-degree plate, reading the alert message requires moving the head
across it rather than reading it in one fixation.

**8. Seated reach is not assumed anywhere — no finding.**

Every surface is head-locked or placed at a fixed z, nothing requires reaching,
walking or turning past the comfortable seated cone, and the only interactions are
ray-based. Recorded because it was checked, not because it failed.

## Design fixes, in priority order

1. Keep the permission grant map and build the denied state (issue 4). It is the only item here that changes what the app can do, not only how it reads.
2. Bound the Exit hit region to the drawn control and confirm or make recoverable (issue 3).
3. Give Exit a non-colour affordance and a focus state (issue 2).
4. Raise the HUD scrim to 0.75 or status to `#E6E6E6` (issue 1).
5. Separate the pending and unavailable plane strings (issue 5).
6. Let the HUD be hidden; smooth or speed up repositioning (issue 6).

## Needs implementation verification

A source read cannot settle these. They are stated as observations to make on
device, not as findings.

- **Does any accessibility service exist on this path at all?** Nothing in these files sets an accessible name, role or state, and it is unclear whether Horizon OS or PICO OS expose a screen reader to an OpenXR immersive activity. If none exists, criteria 1.1.1, 1.3.1 and 4.1.2 are unmeetable here and that should be recorded as a platform limit rather than a defect.
- **Real contrast in a real room.** The table above composites a scrim over a flat background. Passthrough is a live camera with its own exposure and tone curve, so measure the HUD against a window at midday rather than trusting the arithmetic.
- **Whether 150 ms stepping reads as jitter** to someone prone to discomfort, and whether the 18.4-degree downward offset is comfortable seated over a full session.
- **Whether the Exit strip is hit accidentally** in ordinary use, which is the practical form of issue 3.
- **Whether oversized type actually forces head movement** to read one line, or whether the lens and eye relief make it acceptable.
