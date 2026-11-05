# Handoff: Placement

Produced with `design:design-handoff`. Tokens from `../spatial-tokens.md`, copy from `../copy.md`.

## Overview

The wearer puts the model on a real surface. Built on `ViroSpecsARRuntime.startPlacement` and `hitTest` (WorldQuery on SPECS). Pack section 2 fixes the behavior: reticle on a WorldQuery hit, surface tint by classification, confirm by pinch, cancel by looking away for 1.5 s.

Requires capabilities `world-query` and `surface-placement`. If either is not `supported`, this screen renders its degraded variant.

## Layout

```
   (room)
                 Table. Pinch to place.        <- label, type.label, 1 space.sm above reticle
                     ( reticle )                <- ring on the surface, tint below it
                 ~~~~~ tint on table ~~~~~

   [ Placement ]                 [ Next scene ]  <- small panel, lower third of view, 1.0 m
```

- Reticle: a ring lying flat on the hit surface, aligned to the hit `normal`. Diameter 2.0 deg at the hit distance. Ring stroke `border.widthFocus`, `color.focus`.
- Tint: disc under the reticle, 35% opacity, color from `tint.{surface}`. Unknown surface: no tint, reticle in `color.textMuted`, placement disabled.
- Label floats above the reticle, faces the wearer, never below `text.minAngle` at the hit distance.
- Control panel at 1.0 m, below eye line, holds title, "Reset model" (after first placement) and "Next scene".

Hits outside 0.6-3.0 m: reticle shows in `textMuted`, label `placement.surfaceUnknown`, pinch does nothing. The model can't be placed outside the content band.

## States and timings

| Phase | Visual | Copy key | Exit |
| --- | --- | --- | --- |
| searching | No reticle; label at 1.5 m on the gaze ray | `placement.searching` | First valid hit |
| aiming | Reticle + tint + label | `placement.surface` | Pinch, or look away 1.5 s |
| look-away countdown | Reticle ring drains clockwise over 1.5 s | `placement.cancelHint` (first time only) | Gaze returns to a valid surface (countdown resets) or 1.5 s elapses |
| confirmed | Model fades in at pose; `color.success` tick on the reticle | `placement.confirmed` | After `motion.base`, reticle hides |
| cancelled | Reticle fades out | `placement.cancelled` | Back to idle; "Place again" button on the panel |

"Look away" means the gaze ray has no valid hit (no surface, unknown surface, or outside the band) for 1.5 s without a break. Any valid hit resets the timer. This definition is a design decision; whether it fires by accident during normal head movement is a research question.

## Tokens

| Element | Tokens |
| --- | --- |
| Reticle | `color.focus`, `border.widthFocus` |
| Tint | `tint.floor/table/wall/seat/ceiling` at 35% |
| Label | `type.label`, `color.text` on a `surface` pill with padding `space.xs` |
| Confirm tick | `color.success` |
| Control panel | SpatialPanel + PanelButton tokens |

## Interactions

| Trigger | Result |
| --- | --- |
| Pinch while aiming at a valid surface | Place at pose (position + rotation from the hit normal). Haptic/audio hook "confirm" |
| Pinch while aiming at an invalid surface | Nothing placed; label dims to `color.textMuted` and back to `color.text`, `motion.fast` each way (reduced motion: no change, label text stays) |
| Look away 1.5 s | Cancel |
| "Reset model" | Model returns to placement idle; reticle reappears |
| Gaze-only (hand tracking off) | A "Place here" PanelButton appears 1 `space.sm` under the reticle label; dwell selects it |

## Motion

| Element | Trigger | Animation | Duration | Easing |
| --- | --- | --- | --- | --- |
| Reticle | Moves to new hit | Follows hit position every frame, no tween (a tween lags the gaze) | n/a | n/a |
| Tint | Surface class changes | Color crossfade | `motion.fast` 120 ms | EaseInEaseOut |
| Countdown ring | Look-away | Arc drains | 1500 ms | Linear (a timer, not a transition; tied to the pack's 1.5 s, exempt from the 500 ms cap because it is a countdown indicator) |
| Model | Confirm | Fade + scale 0.96 to 1.0 in place | `motion.base` 240 ms | EaseInEaseOut |

Reduced motion: countdown shown as text "Cancelling" instead of a draining ring; model appears with fade only.

## Lifecycle variants

| State | Behavior |
| --- | --- |
| loading | Model loading: placement can start; on confirm, the progress ring shows at the pose until the model is ready |
| degraded, world-query unsupported | Reticle never shows. Model appears at 1.5 m in front of the wearer. One line: `degraded.worldQuery.unsupported` |
| degraded, world-query temporarily unavailable | Searching state with `degraded.worldQuery.unavailable` after the hit test fails repeatedly (count set by WS3) |
| degraded, hand tracking permission-required | Gaze-only "Place here" button |
| error | Model failed: placement still works and places a placeholder box with `error.asset` |

## Edge cases

- **Wearer pinches during the countdown**: if the hit became valid again, place; otherwise ignore.
- **Surface classification flips between table and floor at an edge**: tint crossfades; the label updates no faster than every `motion.base` to avoid flicker. (Starting value.)
- **Wall placement**: model orients to the wall normal; model's authored up axis may be wrong for walls. Placement mode `vertical` is opt-in per scene.
- **Second placement**: the first model stays until the second is confirmed. Cancel leaves the first one where it is.

## Accessibility

Labels: reticle `placement.a11yLabel` (state, not interactable); "Place here" (gaze-only); "Reset model"; "Next scene". Surface type is written in the label, not only shown by tint (A5). Checks D2, D3, A11, A14.

## Mobbin references

Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2).

| Flow | Why it's here |
| --- | --- |
| [Apple Store, Placing an object](https://mobbin.com/flows/31620620-6440-4eec-9e3f-bef7655257c3) | Ghosted model + reticle while searching; environment warning ("More light required") as a one-line pill |
| [Sunlitt, Placing an object](https://mobbin.com/flows/d70cc8c4-31de-4608-a7c4-82a4ad5b4077) | Separate object picker, then a disabled Place button until a surface is found |
| [Google Arts & Culture, View artifact in AR](https://mobbin.com/flows/846fa571-490e-43f8-977f-a686ab246149) | Surface-search illustration, then a ring on the floor anchoring the placed object |
| [Apple Store, View augmented reality](https://mobbin.com/flows/d7677bb3-36de-4057-945f-66872bd038e4) | AR / Object toggle: a fallback view when placement can't run (our degraded variant) |
| [Best Buy, Adding an item](https://mobbin.com/flows/78314d65-b432-45df-a988-a3eeb0f39236) | Bounding box with actions around the placed model |
| [Target, Enabling manual controls](https://mobbin.com/flows/996412bf-5f37-4e7b-9130-e0d103584c02) | "Start over" plus explicit rotate/move buttons: precedent for the gaze-only placement controls |
