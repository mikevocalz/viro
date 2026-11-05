# Handoff: Degraded state

Produced with `design:design-handoff`. Applies to all four gallery scenes. Copy keys in `../copy.md#degraded` and `#permission-required`.

## Overview

The scene runs with one capability missing. Pack section 2: placement UI hidden, one-line reason shown. Driven by `ViroXRRuntimeCapabilityState` from `components/Specs/ViroSpecsRuntime.ts`: `unsupported`, `permission-required`, `temporarily-unavailable`, `unverified`.

## Which UI hides for which capability

| Capability | State | Hidden | Replacement |
| --- | --- | --- | --- |
| `world-query` / `surface-placement` | unsupported | Reticle, tint, placement label | Model placed at 1.5 m in front of the wearer |
| same | temporarily-unavailable | Nothing yet; searching state stays | Reason after repeated failed hits; recovers on its own when hits return |
| `hand-tracking` / `pinch` | permission-required | Pinch hints, drag | Gaze-only: dwell to select; step buttons replace drag; scroll buttons |
| same | temporarily-unavailable | Same as above while lost | Returns to hands automatically when tracking returns |
| `drag-manipulation` | unsupported | Drag | Step buttons |
| any | unverified | Nothing | `degraded.unverified` notice for builders only (debug builds) |

Hide, don't disable: a visible control that can never work trains the wearer to distrust the rest (A-check D2).

## Layout

```
   [ (i)  Hand tracking is off. Look at a button      ]   <- notice, top of the scene panel
   [      and hold your gaze to select.     [ Got it ] ]
```

- Notice is a strip inside the scene panel, `color.degradedSurface`, icon `color.degraded`, text `type.body` `color.text`, `depth.overlay`.
- One line of reason, wrapping to 2 at most. "Got it" dismisses it.
- `permission-required` for hand tracking on a scene that can't run gaze-only uses the permission panel instead (`permission.handTracking.*`): full SpatialPanel with "Use gaze instead" or "Close".

## Behavior

- Shown once per capability per session. Dismissed notices don't return for the same capability.
- If the capability recovers, the hidden UI returns with a `motion.base` fade and the notice goes away without a new message.
- If two capabilities degrade, show one notice listing the most limiting one (placement beats hand tracking because it changes the scene layout).

## Motion

Notice in: fade, `motion.base`. Out: fade, `motion.fast`. Reduced motion: same (fades are allowed).

## Edge cases

- **Capability flips repeatedly** (tracking flicker): don't re-show the notice; switch input mode without animation.
- **Degraded during placement countdown**: cancel placement silently; show the world-query notice.
- **Builder mode**: diagnostic line under the notice with capability name and state, e.g. `hand-tracking: permission-required`.

## Accessibility

Checks D1-D5, A12, A16.

## Mobbin references

Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2).

| Flow | Why it's here |
| --- | --- |
| [Apple Store, View augmented reality](https://mobbin.com/flows/d7677bb3-36de-4057-945f-66872bd038e4) | "More light required" pill plus an Object mode that works without AR |
| [Walmart, Trying on virtually](https://mobbin.com/flows/42f8de2a-13f1-4b26-af59-7612c90c9ee1) | Explains why the camera is needed before asking |
| [Opal, Scan QR code](https://mobbin.com/flows/27fee9fe-78b4-490f-ada4-b14ddb94006c) | System camera prompt with a one-line purpose string |
| [Dot, Permissions](https://mobbin.com/flows/061f8e8e-0916-4118-b509-40f46b6fc2a1) | Per-capability status list (Enabled / Enable) |
| [(Not Boring) Camera, Onboarding](https://mobbin.com/flows/1d328006-8692-4556-a642-f60fab639b3d) | Capabilities shown as a checklist before entering |
