# Handoff: Ready state

Produced with `design:design-handoff`. Applies to all four gallery scenes.

## Overview

All assets resolved, interaction attached, animations started. This is the normal state; per-screen layouts are in `hello.md`, `placement.md`, `interaction.md` and `navigation.md`. This file lists what every scene must satisfy once ready.

## Rules every ready scene meets

| Rule | Source |
| --- | --- |
| All content between 0.6 and 3.0 m from the wearer; host clamps on placement and drag | Pack section 2 |
| Text at least 1.2 deg at its actual distance | Pack section 2 |
| Every transition at most 500 ms, EaseInEaseOut; continuous indicators (ring, countdown) are the only exceptions and are listed in `spatial-tokens.md` | Pack section 2 |
| No large surface moves across the view | Pack section 2 |
| Every interactable has a `label` and a hover state; haptic/audio hooks on by default, app can disable | Pack sections 2 and 3 (WS3) |
| Diagnostic panel hidden from the wearer | `spatial-tokens.md` |
| Scene animations start only now, never during loading | Pack section 2 (WS3 asset lifecycle) |

## Transition into ready

Crossfade from loading, `motion.base` 240 ms. Scene panel scales 0.96 to 1.0 in place. Reduced motion: fade only.

## State changes inside ready

A React state change applies as one node update (WS3 incremental diff). The visual rule: the changed node crossfades in `motion.fast`; nothing else in the scene re-animates. If a whole-scene rebuild is visible to the wearer (everything flickers), that's a WS3 bug, not a design choice.

## Moving to another state

| To | When |
| --- | --- |
| degraded | A capability changes state at runtime (hand tracking lost, world-query unavailable) |
| error | An update fails validation or a late asset fails; previous content stays |
| loading | A navigation to a scene with unresolved assets |

## Accessibility

Checks R1-R4, A1-A15.

## Mobbin references

Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2).

| Flow | Why it's here |
| --- | --- |
| [Google Arts & Culture, View artifact in AR](https://mobbin.com/flows/846fa571-490e-43f8-977f-a686ab246149) | Placed content with quiet chrome: label under the object, controls at the edge |
| [Best Buy, Adding an item](https://mobbin.com/flows/78314d65-b432-45df-a988-a3eeb0f39236) | Selection affordance on one object while the rest stays still |
| [Superlist, List detail](https://mobbin.com/flows/258439a8-40a5-4574-b6f1-4bfd0327b57d) | A single item updating in place after a change |
