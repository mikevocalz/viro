# Spatial tokens

Produced with `design:design-system` (extend mode), with visual direction from `frontend-design`. These tokens feed the WS4 premium components (SpatialPanel, PanelText, PanelButton, PanelImage, SpatialScrollView, Model viewer) and must survive compile → manifest v2 → Lens host. Token names are the contract; WS1 decides the manifest field that carries each one.

## Sources and what is decided here

| Value | Source |
| --- | --- |
| Content band 0.6-3.0 m | Pack section 2 |
| Text at least 1.2 degrees angular height | Pack section 2 |
| Motion at most 500 ms, ease-in-out | Pack section 2 |
| Look-away cancel 1.5 s | Pack section 2 (placement UX) |
| Contrast 4.5:1 text, 3:1 large text and non-text | WCAG 2.1 SC 1.4.3, 1.4.11 |
| Easing names | Viro MCP `reactviro_list_animation_easings`: Linear, EaseIn, EaseOut, EaseInEaseOut, Bounce, PowerDecel, PowerAccel |
| Colors, spacing, radii, durations under the cap, hover scale | Design choices made in this file. Starting values, to be checked on device per `research-plan.md`. They are not comfort claims. |

Not set here, because no source gives them: gaze dwell time, minimum interactable angular size. See `research-plan.md`.

## Visual direction

Spectacles use a see-through display. Content sits over the wearer's real room, so every surface competes with an unknown background. The direction follows from that: a dark, mostly opaque slate panel that gives text its own background, one warm signal color (sodium amber) that marks where attention and selection are, and nothing decorative on top. Amber was picked because it separates from both the slate panel and from typical indoor walls; it is a hypothesis to check on device, not a measured result.

Assumption to verify on hardware: on an additive see-through display, dark panel colors render with reduced opacity against the room. The contrast ratios below are computed against the panel color only. Real-world contrast depends on what is behind the panel and is measured in the on-device pass.

## Distance and size

| Token | Value | Note |
| --- | --- | --- |
| `distance.min` | 0.6 m | Pack band, near limit |
| `distance.default` | 1.5 m | Platform Lab root sits at z = -1.5 m today |
| `distance.max` | 3.0 m | Pack band, far limit |
| `text.minAngle` | 1.2 deg | Pack. Height at distance d is `2 · d · tan(0.6°)` |

Minimum text height derived from `text.minAngle` (geometry, not a new number):

| Distance | Min text height |
| --- | --- |
| 0.6 m | 1.26 cm |
| 1.0 m | 2.09 cm |
| 1.5 m | 3.14 cm |
| 2.0 m | 4.19 cm |
| 3.0 m | 6.28 cm |

The host must compute text size from the node's actual distance at placement time and clamp up to the minimum. A fixed centimeter size breaks the rule as soon as content is placed further away.

## Typography

Sizes are angular so they hold at any distance in the band. The host converts to Lens units.

| Token | Angle | At 1.5 m | Weight | Use |
| --- | --- | --- | --- | --- |
| `type.title` | 2.0 deg | 5.24 cm | 600 | Panel titles, gallery scene names |
| `type.body` | 1.4 deg | 3.67 cm | 400 | Messages, card text |
| `type.label` | 1.2 deg | 3.14 cm | 500 | Button labels, hints. The floor; nothing renders smaller |

Rules:

- Sentence case everywhere. No all-caps labels.
- Max 2 lines on a button label, 4 lines on a panel message. Longer copy is a copy bug, not a wrapping problem (see `copy.md`).
- Line height 1.3 for body text.
- Typeface: the Lens default sans until WS3's material/text registry can load a custom font. Swapping the face later must not change the angular sizes.

## Color

Hex values on the panel surface `color.surface` (#1B2630). Ratios computed with the WCAG 2.1 relative-luminance formula.

| Token | Hex | Ratio on surface | Use |
| --- | --- | --- | --- |
| `color.surface` | #1B2630 | n/a | Panel background, 92% opacity |
| `color.surfaceRaised` | #26343F | text 11.3:1 | Buttons, cards |
| `color.surfacePressed` | #33444F | text 8.94:1 | Pressed button fill |
| `color.text` | #EEF2F0 | 13.61:1 | Primary text |
| `color.textMuted` | #A9B6BF | 7.41:1 | Secondary text |
| `color.textDisabled` | #808D96 | 4.51:1 | Disabled labels (exempt under 1.4.3, kept above 4.5 anyway) |
| `color.border` | #6B7D8C | 3.61:1 | Panel and button outline |
| `color.borderStrong` | #C4D0D8 | 9.78:1 | Hover outline |
| `color.focus` | #F2B544 | 8.39:1 | Hover ring, selection ring, reticle, progress ring |
| `color.onFocus` | #14202A | 9.03:1 on focus | Text on an amber fill |
| `color.selectedFill` | #3B3320 | text 11.07:1, focus 6.83:1 | Selected button fill |
| `color.error` | #FF8A7A | 6.71:1 | Error icon and title |
| `color.errorSurface` | #3A1F1E | text 13.33:1, error 6.57:1 | Error panel background |
| `color.degraded` | #9CC8FF | 8.87:1 | Degraded notice icon |
| `color.degradedSurface` | #1E2C3D | text 12.54:1, degraded 8.17:1 | Degraded notice background |
| `color.success` | #8FD9B6 | 9.34:1 | Placement confirmed tick |
| `color.placeholder` | #6B7D8C at 40% | n/a | Bounded tinted box for missing assets (pack section 2) |

Surface tint by classification (placement reticle, pack section 2). Tints are drawn at 35% opacity over the detected surface. The text label next to the reticle carries the surface name so color is never the only cue (WCAG 1.4.1).

| Surface | Token | Hex |
| --- | --- | --- |
| floor | `tint.floor` | #8FD9B6 |
| table | `tint.table` | #F2B544 |
| wall | `tint.wall` | #9CC8FF |
| seat | `tint.seat` | #D9A6F2 |
| ceiling | `tint.ceiling` | #A9B6BF |
| unknown | `tint.unknown` | none. Reticle only, placement disabled |

### High-contrast variant

Selected by the app or by a system setting when one is exposed (unverified whether Snap OS exposes one).

| Token | Default | High contrast |
| --- | --- | --- |
| `color.surface` | #1B2630 at 92% | #42525F at 100% |
| `color.text` | #EEF2F0 | #FFFFFF (8.07:1) |
| `color.textMuted` | #A9B6BF | #FFFFFF. Muted styling is dropped |
| `color.border` | #6B7D8C | #FFFFFF, width doubled |
| `color.focus` | #F2B544 | #FFD25E (5.62:1), ring width doubled |
| `type.*` | as above | +0.2 deg each |

SPECS is an additive display: each pixel adds light to the room, and black adds none, so a black surface shows as no surface. The high-contrast surface is a mid slate, #42525F (relative luminance 0.080, about four times the light of the default surface), so the panel stays visible and white text on it is still 8.07:1, above the 7:1 that 1.4.6 asks for. The other surface tokens (`surfaceRaised`, `surfacePressed`, `errorSurface`, `degradedSurface`, `selectedFill`) keep their default values in high contrast; a button's raised fill is then darker than the panel, and its doubled white border marks its edge. A test in each repo fails if any surface in the resolved high-contrast set drops below relative luminance 0.015 (dimmer than the default panel), if the high-contrast surface is no brighter than the default one, or if text falls under 7:1 or focus and border under 3:1 against it. The contrast ratios are against the panel color; the room behind adds light on device.

## Spacing

Angular, same reasoning as type. Values at 1.5 m in parentheses.

| Token | Angle | At 1.5 m |
| --- | --- | --- |
| `space.xs` | 0.4 deg | 1.05 cm |
| `space.sm` | 0.8 deg | 2.09 cm |
| `space.md` | 1.2 deg | 3.14 cm |
| `space.lg` | 2.0 deg | 5.24 cm |
| `space.xl` | 3.2 deg | 8.38 cm |

Panel padding `space.md`. Gap between buttons `space.sm`. Gap between cards `space.md`.

## Border and radius

| Token | Value |
| --- | --- |
| `border.width` | 0.15 deg |
| `border.widthFocus` | 0.3 deg |
| `radius.panel` | `space.md` |
| `radius.button` | `space.sm` |
| `radius.card` | `space.sm` |

Radius follows hierarchy: panels round more than the controls inside them.

## Depth

| Token | Offset toward wearer | Use |
| --- | --- | --- |
| `depth.base` | 0 | Panel surface |
| `depth.raised` | 0.5 cm | Buttons, cards |
| `depth.hover` | 1.0 cm | Hovered control |
| `depth.overlay` | 3.0 cm | Error and degraded panels over scene content |

Physical offsets in centimeters because depth reads as distance, not angle. No drop shadows; depth comes from offset and the border.

## Motion

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `motion.instant` | 0 ms | n/a | Reduced-motion replacement for transforms |
| `motion.fast` | 120 ms | EaseInEaseOut | Hover ring, pressed fill |
| `motion.base` | 240 ms | EaseInEaseOut | Panel appear, state change |
| `motion.slow` | 400 ms | EaseInEaseOut | Navigation push/pop |
| `motion.max` | 500 ms | EaseInEaseOut | Hard cap from the pack. Lint fails above it |
| `motion.progressLoop` | 1200 ms per turn | Linear | Loading ring rotation. Continuous indicator, not a transition; exempt from the cap, small (under 4 deg) and stops when ready |

Rules from the pack: no vection-inducing motion of large surfaces. Concretely, a panel never translates across the view during a transition; it fades and scales in place (scale from 0.96 to 1.0). Navigation swaps content inside the panel instead of sliding the panel.

`Bounce` is not used. It overshoots, which reads as surface motion at panel scale.

### Reduced-motion variant

| Default | Reduced motion |
| --- | --- |
| Scale + fade on appear | Fade only, `motion.fast` |
| Hover scale 1.04 | No scale; ring and border only |
| Navigation crossfade `motion.slow` | Instant swap |
| Loading ring rotation | Static ring with a filled arc that grows with progress; if progress is unknown, three dots that change opacity, no movement |
| Model auto-rotate (Model viewer) | Off |

## States

Every interactable has these tokens. PanelButton is the reference.

### PanelButton

| State | Fill | Border | Label | Depth | Motion | Behavior |
| --- | --- | --- | --- | --- | --- | --- |
| idle | `surfaceRaised` | `border` | `text` | `raised` | n/a | Accepts hover |
| hover | `surfaceRaised` | `borderStrong` + `focus` ring | `text` | `hover`, scale 1.04 | `motion.fast` | Gaze or hand ray on target. Haptic/audio hook fires once (host default, app can disable) |
| pressed | `surfacePressed` | `focus` ring | `text` | `raised` | `motion.fast` | Pinch down. Action fires on release inside target |
| selected | `selectedFill` | `focus`, `widthFocus` | `text` + check glyph | `raised` | `motion.fast` | Toggle or current item. Shape cue (check) plus color |
| disabled | `surface` | `border` at 50% | `textDisabled` | `base` | n/a | No hover, no haptic. Label still read by the accessibility label |
| loading | `surfaceRaised` | `border` | label replaced by "Working" + 3-dot indicator | `raised` | dots per reduced-motion rule | Ignores further pinches until it resolves |
| error | `surfaceRaised` | `error`, `widthFocus` | `text`; error glyph left of label | `raised` | n/a | Short reason in `copy.md` appears under the button; button stays pressable for retry |

Release outside the target cancels the press and returns to idle. A gaze-only press is confirmed by dwell (duration not yet set, see research plan).

### Other components

- **SpatialPanel**: `surface`, `border`, `radius.panel`, padding `space.md`, `depth.base`. Title `type.title`. Faces the wearer at placement; does not billboard continuously.
- **PanelText**: `type.body` or `type.label`, `text` / `textMuted`. Never below `text.minAngle` at the panel's distance.
- **PanelImage**: `radius.card`. Missing image shows `color.placeholder` box at the declared extents plus a diagnostic.
- **SpatialScrollView**: scroll position retained across navigation. Scroll indicator uses `textMuted`; content clipped inside the panel, never fades past its edge.
- **Model viewer**: states load (progress ring centered on the model's bounds), error (placeholder box + error copy), manipulate (hover ring around bounds), animate, reset (button, returns model to authored transform in `motion.base`).

## Diagnostic panel

Shown in the error state and, for builders, in the degraded state. Not shown to wearers in the ready state.

- SpatialPanel with `errorSurface` (error) or `degradedSurface` (degraded), `depth.overlay`.
- Line 1: wearer message from `copy.md`, `type.body`.
- Line 2: diagnostic code and node, e.g. `VS1023 (platform-lab-model)`, `type.label`, `textMuted`. Builders need the code; wearers can ignore it.
- One action button (Retry or Close). Never zero actions; never a dead lens.
