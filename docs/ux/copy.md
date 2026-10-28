# Copy

Produced with `design:ux-copy`, edited against `no-ai-slop`. Covers loading, degraded, error, placement confirm/cancel and permission-required for the SPECS gallery.

## Voice

The wearer is standing in a room with a headset on, often mid-gesture. Copy has to be read in one glance at 1.5 m, so:

- Sentence case. No exclamation marks. No apologies.
- Lead with what happened, then what to do. Skip the why unless it changes what the wearer does.
- Name actions with the gesture the wearer makes: "Pinch to place", not "Tap" or "Click".
- One term per thing: **place** (never drop, put, anchor), **surface** (never plane), **hand tracking** (never hands mode).
- Label limit: 2 lines at `type.label`. Message limit: 4 lines at `type.body`. Character counts below are budgets for English; plan for 30-40% expansion in translation, which is why the budgets are under the line limits.

Copy keys are the contract. WS4 code references keys, never inline strings.

## Loading

| Key | Copy | Budget |
| --- | --- | --- |
| `loading.title` | Loading scene | 20 |
| `loading.progress` | Loading {done} of {total} | 28 |
| `loading.slow` | Still loading. Large models can take a moment. | 60 |
| `loading.a11yLabel` | Loading scene, {percent} percent | n/a |

`loading.slow` appears after the host has been in loading for longer than a threshold WS3 sets from measured first-frame time (pack target: first frame under 2 s). Do not show it on every load.

Rejected alternatives: "Hang tight" (idiom, translates badly), "Preparing your experience" (says nothing).

## Degraded

Degraded means the scene runs, with one capability missing. The pack requires a one-line reason and hiding the UI that depends on the missing capability.

| Key | Trigger (capability → state) | Copy | Budget |
| --- | --- | --- | --- |
| `degraded.worldQuery.unsupported` | world-query → unsupported | Placement isn't available on this device. Content stays in front of you. | 80 |
| `degraded.worldQuery.unavailable` | world-query → temporarily-unavailable | Can't find surfaces right now. Try a brighter spot or look at a table or floor. | 85 |
| `degraded.handTracking.permission` | hand-tracking → permission-required | Hand tracking is off. Look at a button and hold your gaze to select. | 75 |
| `degraded.handTracking.unavailable` | hand-tracking → temporarily-unavailable | Can't see your hands. Hold them in view, or select with your gaze. | 75 |
| `degraded.unverified` | any → unverified | Some features haven't been checked on this device. | 55 |
| `degraded.dismiss` | button | Got it | 10 |

"Hold your gaze" depends on the gaze-only dwell being implemented. If it isn't in the build, the copy becomes the permission-required row below.

## Error

Structure: what happened, then what to do. Every error panel has exactly one primary action.

| Key | When | Title | Message | Action |
| --- | --- | --- | --- | --- |
| `error.asset` | A model or image failed to load; placeholder shown | Model didn't load | The rest of the scene works. Retry to load it again. | Retry |
| `error.scene` | Scene failed validation or apply | Scene couldn't open | The last working scene is still here. | Close |
| `error.sceneNoFallback` | No previous scene to keep | Scene couldn't open | Close this lens and open it again. If it keeps happening, the code below helps the developer. | Close |
| `error.transport` | Connection to the app dropped mid-session | Lost connection to the app | What's here stays. Changes will show when it reconnects. | Got it |

Diagnostic line under every error message: `{code} ({nodeId})`, for example `VS1023 (platform-lab-model)`. Never translate the code.

Banned in errors: "Oops", "Something went wrong", "An error occurred", "Please try again" without saying what to try. These were in the reference flows (see Mobbin collection); they are the pattern to avoid.

## Placement

| Key | Copy | Budget |
| --- | --- | --- |
| `placement.searching` | Look at a table or the floor | 32 |
| `placement.surface` | {surface}. Pinch to place. | 30 |
| `placement.surfaceUnknown` | Look for a flat surface | 26 |
| `placement.confirmed` | Placed | 10 |
| `placement.cancelHint` | Look away to cancel | 22 |
| `placement.cancelled` | Placement cancelled | 22 |
| `placement.a11yLabel` | Placement reticle on {surface} | n/a |

`{surface}` renders as Floor, Table, Wall, Seat or Ceiling. Unknown surfaces use `placement.surfaceUnknown` and placement is disabled.

`placement.cancelHint` shows once per session, the first time the reticle appears. After the wearer has cancelled once, it doesn't come back.

## Permission required

Shown when a capability the scene needs reports `permission-required`.

| Key | Copy |
| --- | --- |
| `permission.handTracking.title` | Hand tracking is off |
| `permission.handTracking.body` | Turn it on in Spectacles settings to pinch and drag. You can still select with your gaze. |
| `permission.handTracking.body.noGaze` | Turn it on in Spectacles settings to use this scene. |
| `permission.action.continue` | Use gaze instead |
| `permission.action.close` | Close |

Unverified: the exact name of the settings location on Snap OS. "Spectacles settings" is a placeholder until checked against current Snap OS. Do not ship with a guessed menu path.

## Gallery scene titles and labels

| Key | Copy |
| --- | --- |
| `gallery.hello.title` | Hello |
| `gallery.placement.title` | Placement |
| `gallery.interaction.title` | Interaction |
| `gallery.navigation.title` | Navigation |
| `nav.back` | Back |
| `nav.next` | Next scene |
| `modelViewer.reset` | Reset model |

## Accessibility labels

Every interactable carries a `label` (pack section 2). Labels name the action or object, not the control type: "Reset model", not "Button". Selected and disabled states are announced by the host appending ", selected" or ", unavailable"; authors do not write them into the label.
