# Handoff: Hello

Produced with `design:design-handoff`. Tokens from `../spatial-tokens.md`, copy keys from `../copy.md`, checks from `../accessibility.md`.

## Overview

First scene of the Platform Lab gallery. It proves the pipeline end to end: one panel, one model, one polyline, one action. It replaces today's `SpecsPlatformLab` content (title text, shiba GLB, three-point polyline) and keeps the existing `viroTag`s so callbacks stay bound.

The wearer's job on this screen is to see that the lens works and move to the next scene.

## Layout

Root node at `distance.default` (1.5 m), centered on the wearer's gaze at launch, placed once, not head-locked.

```
          [ Hello                     ]   <- SpatialPanel, title type.title
          [ This scene runs the same  ]   <- PanelText type.body, max 2 lines
          [ Viro JSX as the phone.    ]
          [                           ]
          [    (shiba model)  ~~~~~   ]   <- Model viewer + polyline
          [                           ]
          [            [ Next scene ] ]   <- PanelButton, right aligned
```

- Panel width 20 deg (52.9 cm at 1.5 m, from `2 · d · tan(10°)`). The host lays out in angles. Height follows content. Whether 20 deg fits comfortably inside the SPECS 27 field of view is unverified; check on device.
- Model sits inside the panel bounds, `depth.raised` in front of the surface.
- Polyline stays where the lab authors it today, in front of the model by 0.12 m.

## Tokens

| Element | Tokens |
| --- | --- |
| Panel | `color.surface`, `color.border`, `radius.panel`, padding `space.md`, `depth.base` |
| Title | `type.title`, `color.text` |
| Body | `type.body`, `color.textMuted` |
| Next scene | PanelButton, all states from tokens |
| Polyline | `color.focus` at 100%, thickness as authored (0.008 m) |

## Components and labels

| Component | viroTag | label |
| --- | --- | --- |
| SpatialPanel | `platform-lab-root` | none (container) |
| PanelText (title) | `platform-lab-title` | n/a, read as text |
| Model viewer | `platform-lab-model` | "Shiba model" |
| Polyline | `platform-lab-route` | none, decorative |
| PanelButton | `hello-next` (new) | "Next scene" |

## States

| State | What shows |
| --- | --- |
| loading | Panel with title only and a progress ring where the model will be. Next scene hidden |
| ready | Full layout. Title pulse runs (existing `platformLabPulse`, 500 ms EaseInEaseOut, within cap) |
| degraded | Not expected here: Hello needs no world-query. If hand tracking is `permission-required`, show `degraded.handTracking.permission` under the body and switch Next scene to gaze dwell |
| error | Model failed: placeholder box at the model's bounds, `error.asset` panel at `depth.overlay`. Next scene stays available |

## Interactions

| Element | Trigger | Result |
| --- | --- | --- |
| Next scene | Hover | Hover state, haptic/audio hook once |
| Next scene | Pinch release on target | Navigate to Placement |
| Model | Select | Fires `onSelect` (existing callback) |
| Model | Drag | Existing `onDrag`; clamped to the content band |

## Motion

| Element | Trigger | Animation | Duration | Easing |
| --- | --- | --- | --- | --- |
| Panel | ready | Fade + scale 0.96 to 1.0 | `motion.base` 240 ms | EaseInEaseOut |
| Title | ready, loop | `platformLabPulse` scale 1.15, opacity 0.8 | 500 ms | EaseInEaseOut |
| Scene exit | Next scene | Crossfade to next scene | `motion.slow` 400 ms | EaseInEaseOut |

Reduced motion: title pulse off; panel fade only; scene swap instant.

Critique note: the existing pulse scales the title to 1.15 in a loop. It is within the 500 ms cap, but a looping scale on the only text in view draws the eye forever. See `../critique.md`.

## Edge cases

- **Launched facing a wall closer than 0.6 m**: root moves back to 0.6 m along the gaze ray; content never renders nearer than `distance.min`.
- **Long body text in translation**: cap at 2 lines; if longer, the copy is fixed, not truncated.
- **GLB slow**: model area shows the ring; title and Next scene are already usable once the panel is ready. (Open question for WS3: is "ready" per scene or per node?)

## Accessibility

Focus order: title, body, Next scene. Gaze-only: dwell on Next scene. Checks R1-R4, A6.

## Mobbin references

Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2) (private to Mike's Mobbin team).

| Flow | Why it's here |
| --- | --- |
| [(Not Boring) Camera, Onboarding](https://mobbin.com/flows/1d328006-8692-4556-a642-f60fab639b3d) | One object, one line of text, one action per step: the density Hello should hold |
| [Replika, View Replika with AR](https://mobbin.com/flows/a4b3f453-f419-4d90-b586-62b7e7bbe02c) | Entry into a 3D scene from a picker, single primary action |
| [Sunlitt, Switching to AR view](https://mobbin.com/flows/224683b4-e339-418f-aaca-3ac64a8ae2b2) | Same object carried from a 2D view into AR without a reload |
| [Best Buy, View in 3D mode](https://mobbin.com/flows/94882fec-67d7-4a18-b1a5-ce56ce664978) | A model shown alone with one gesture hint |
