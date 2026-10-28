# Handoff: Loading state

Produced with `design:design-handoff`. Applies to all four gallery scenes. Tokens from `../spatial-tokens.md`, copy from `../copy.md`.

## Overview

The host is between `apply` and `ready`: assets are preloading (WS3 `resolveAssets`). Pack section 2: loading shows a progress ring; animations start only after `ready`. Target first frame under 2 s after lens start on SPECS 27 (pack cross-cutting), so on a good path this state is brief.

## Layout

```
        [ Loading scene      ]     <- small SpatialPanel, 1.5 m, centered
        [     ( ring )       ]     <- progress ring, 4 deg diameter
        [ Loading 2 of 5     ]     <- type.label, textMuted
```

- Panel is the only content until the scene's own panel can show. Once the scene panel is ready, per-node rings replace the central panel (each pending model shows its own ring at its bounds).
- Ring: `color.focus` arc on a `color.border` track, stroke `border.widthFocus`.

## Behavior

| Condition | Visual |
| --- | --- |
| Progress known (asset count) | Arc fills by completed/total; `loading.progress` |
| Progress unknown | Arc of fixed length rotating, `motion.progressLoop` |
| Past the slow threshold (WS3 sets it from measured first-frame data) | `loading.slow` replaces `loading.progress` |
| Asset fails during load | That node becomes a placeholder box; loading continues for the rest; error notice appears after ready (see `error.md`) |
| All assets resolved | Fade out the loading panel, fade in the scene, `motion.base` |

Nothing interactable appears before ready (A-check L4). No time-out ends the lens.

## Motion

| Element | Animation | Duration | Easing |
| --- | --- | --- | --- |
| Loading panel in | Fade | `motion.fast` 120 ms | EaseInEaseOut |
| Ring (indeterminate) | Rotation | 1200 ms per turn, loop | Linear |
| Loading → ready | Crossfade | `motion.base` 240 ms | EaseInEaseOut |

Reduced motion: no rotation; determinate arc grows without rotating; indeterminate becomes three dots changing opacity.

## Edge cases

- **Everything is cached**: if ready arrives within one `motion.fast`, skip the loading panel entirely so it doesn't flash.
- **Scene update while loading**: new apply replaces the pending one (transactional replacement, WS3); counts reset; ring does not jump backwards visibly, it restarts from the new total.
- **Wearer turns away**: loading panel is world-placed, not head-locked. If it leaves the view, a small arrow at the edge is out of scope for v1 (noted in critique).

## Accessibility

Label `loading.a11yLabel`. Checks L1-L5.

## Mobbin references

Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2).

| Flow | Why it's here |
| --- | --- |
| [Anything, Project](https://mobbin.com/flows/41a80c1c-2d6c-4d3f-ae0a-6ec75f303a03) | "Downloading 37%" with a bar: percentage + plain label |
| [Glow, Downloading a model](https://mobbin.com/flows/c3a2d61d-564b-4f13-b66b-0ea069763d6e) | Per-item progress inline where the item lives (our per-node rings) |
| [Linktree, Downloading a file](https://mobbin.com/flows/1857d99a-510b-4994-b4cf-47c3292c533a) | Button turns into "Downloading..." then "All files downloaded" |
| [Amazon Shopping, Viewing a product in 3D](https://mobbin.com/flows/cd536b10-54cc-4a5e-80e0-883b5e1a7ce5) | Model view opening with the object loading in place |
| [Julienne, Trying again](https://mobbin.com/flows/219a58aa-7a86-4d60-b8d9-6c72aae4d305) | Small inline spinner where the result will appear |
