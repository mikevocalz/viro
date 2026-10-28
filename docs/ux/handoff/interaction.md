# Handoff: Interaction

Produced with `design:design-handoff`. Tokens from `../spatial-tokens.md`, copy from `../copy.md`.

## Overview

Shows every PanelButton state and the model's manipulate/reset behavior. It is the screen that exercises the seven interaction phases WS3 forwards (hover, hover-move, select-start, select, drag, cancel, plus the `source` kinds hand-left, hand-right, gaze, synthetic). The wearer's job: select one button, drag the model.

## Layout

Panel at `distance.default` (1.5 m), 20 deg wide.

```
[ Interaction                                   ]
[ Pinch a button. Drag the model.               ]
[                                               ]
[ [ Idle ] [ Selected ✓ ] [ Disabled ] [ Retry ! ] ]   <- PanelButton row, gap space.sm
[                                               ]
[        (model)                [ Reset model ] ]
[                                  [ Next scene ] ]
```

The button row is a live demo: one button per state that can sit still (idle, selected, disabled, error). Hover and pressed show on whichever the wearer targets. Loading shows on the Retry button after it is pressed.

## Components and labels

| Component | viroTag | label | Behavior |
| --- | --- | --- | --- |
| PanelButton | `ix-btn-a` | "Option A" | Toggles selected |
| PanelButton | `ix-btn-b` | "Option B" | Starts selected; toggles |
| PanelButton | `ix-btn-disabled` | "Option C" (announced ", unavailable") | Disabled |
| PanelButton | `ix-btn-retry` | "Retry" | Press: loading state for the duration of a mock async call, then idle (success) or error (mock failure) |
| Model viewer | `ix-model` | "Shiba model" | Drag, select |
| PanelButton | `ix-reset` | "Reset model" | Returns model to authored transform |
| PanelButton | `ix-next` | "Next scene" | Navigate |

Option A/B are placeholder labels for the demo; product screens use real verbs.

## States

PanelButton state table lives in `../spatial-tokens.md#panelbutton`. This screen must show each one on device for the WS4 capture.

| Phase from host | Visual |
| --- | --- |
| hover (enter) | Hover state, haptic/audio hook once |
| hover-move | No visual change; host updates the hover target |
| select-start | Pressed |
| select (release inside) | Action fires; state per button |
| cancel (release outside, or tracking lost) | Back to idle, no action |
| drag | Model follows; hover ring stays on the model bounds |

`source` changes nothing visually. It is logged for diagnostics and used to pick dwell (gaze) vs pinch (hands).

## Drag rules

- Model follows the hand ray, constrained to 0.6-3.0 m from the wearer. At a limit it stops; it does not bounce.
- Drag is one-to-one with the hand. No smoothing tween (a tween adds lag).
- Released model stays where it is. Reset returns it in `motion.base`.

## Motion

| Element | Trigger | Animation | Duration | Easing |
| --- | --- | --- | --- | --- |
| Button | hover | Ring in, scale 1.04, offset to `depth.hover` | `motion.fast` 120 ms | EaseInEaseOut |
| Button | press | Fill to `surfacePressed`, offset back to `depth.raised` | `motion.fast` | EaseInEaseOut |
| Retry | loading | 3-dot indicator, opacity cycle | until resolved | Linear |
| Model | reset | Translate + rotate back to authored transform | `motion.base` 240 ms | EaseInEaseOut |

Reset moves a small object a short distance; it is not a large-surface motion. Reduced motion: reset is instant; no hover scale.

## Gaze-only variant

When hand tracking is `permission-required` or `temporarily-unavailable`:

- Buttons select by dwell (duration open, see research plan).
- Drag is replaced by four buttons under the model: "Move left", "Move right", "Move closer", "Move away". Step 10 cm (starting value), clamped to the content band.
- `degraded.handTracking.*` notice at the top of the panel.

## Lifecycle variants

| State | Behavior |
| --- | --- |
| loading | Panel and buttons show; model area has the progress ring; drag disabled until the model is ready |
| degraded | Gaze-only variant above |
| error | Model failed: placeholder box (drag still works on the box, so the interaction demo survives); `error.asset` |

## Edge cases

- **Two hands on two targets**: last select-start wins; the other cancels.
- **Hover target changes during a press**: press stays on the original target until release (A11).
- **Retry pressed repeatedly**: ignored while loading.
- **Model dragged behind the panel**: allowed inside the band; hover ring stays visible because it renders at `depth.hover` relative to the model, not the panel.

## Accessibility

Focus order: title, body, buttons left to right, model, Reset, Next. Checks A10, A11, A12, R2, R4.

## Mobbin references

Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2).

| Flow | Why it's here |
| --- | --- |
| [Best Buy, Adding an item](https://mobbin.com/flows/78314d65-b432-45df-a988-a3eeb0f39236) | Selected-object bounding box with info, swap, remove actions attached |
| [Target, Enabling manual controls](https://mobbin.com/flows/996412bf-5f37-4e7b-9130-e0d103584c02) | Direction pad and rotate buttons as an alternative to direct manipulation (gaze-only drag) |
| [Amazon Shopping, Viewing a product in 3D](https://mobbin.com/flows/cd536b10-54cc-4a5e-80e0-883b5e1a7ce5) | Step buttons (arrows, zoom, close) for a 3D model |
| [Best Buy, View in 3D mode](https://mobbin.com/flows/94882fec-67d7-4a18-b1a5-ce56ce664978) | Gesture hint drawn on the model itself |
| [Julienne, Trying again](https://mobbin.com/flows/219a58aa-7a86-4d60-b8d9-6c72aae4d305) | Retry button that turns into an inline loading indicator |
