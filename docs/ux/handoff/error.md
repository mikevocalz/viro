# Handoff: Error state

Produced with `design:design-handoff`. Applies to all four gallery scenes. Copy keys in `../copy.md#error`.

## Overview

Something failed and the wearer needs to know. Pack section 2: a readable panel, never a dead lens. WS3 routes failures through `ViroSpecsHostDiagnostics` instead of `throw`; each diagnostic carries `{ code, severity, nodeId, ... }` (WS1), and this state renders it.

## Two kinds of error

| Kind | Example | What the wearer sees |
| --- | --- | --- |
| Node error | One GLB missing (WS3 acceptance case) | Placeholder box at the node's declared bounds + compact error panel; rest of the scene runs |
| Scene error | Update fails validation | Previous scene stays (transactional replacement); error panel over it. No previous scene: `error.sceneNoFallback` |

## Layout

```
   [ (!) Model didn't load                       ]
   [     The rest of the scene works. Retry to   ]
   [     load it again.                          ]
   [     VS1023 (platform-lab-model)   [ Retry ] ]
```

- SpatialPanel, `color.errorSurface`, border `color.error`, `depth.overlay`, placed at 1.2 m in front of the failed node or, for scene errors, at 1.5 m on the gaze ray at the moment of failure.
- Title `type.body` weight 600 in `color.error` with the error glyph. Message `type.body` `color.text`. Diagnostic line `type.label` `color.textMuted`.
- Exactly one action. Retry for node errors, Close for scene errors.

Placeholder box: `color.placeholder` at 40%, `border` outline, same bounds the node declared (pack: "bounded tinted box"). Label "{node label}, didn't load".

## Behavior

| Trigger | Result |
| --- | --- |
| Retry | Button goes to loading; host re-resolves the asset. Success: placeholder crossfades to model, panel closes. Failure: panel stays, button returns to error state |
| Close (scene error with fallback) | Panel closes, previous scene keeps running |
| Close (no fallback) | Lens stays on the error panel; the wearer exits with the system gesture. Never a blank view |
| Several node errors | One panel: "{n} models didn't load", list of codes, one Retry that retries all |

## Motion

Panel in: fade + scale 0.96 to 1.0, `motion.base`. Placeholder to model: crossfade, `motion.base`. Reduced motion: fades only.

## Edge cases

- **Error during loading**: wait until ready to show the panel, so it doesn't appear and get covered by the scene coming in.
- **Error on a node off screen**: panel goes to the gaze ray, not the node, and the message names the node's label.
- **Repeated identical errors** (render loop): de-duplicate by code + nodeId.
- **Diagnostic has no nodeId**: diagnostic line shows the code only.
- **Transport lost** (`error.transport`): scene keeps the last applied state; panel dismisses with "Got it".

## Accessibility

Checks E1-E5, A3, A5. Error is never only red: glyph + title text.

## Mobbin references

Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2).

| Flow | Why it's here |
| --- | --- |
| [Netflix, Download information](https://mobbin.com/flows/667d1a9c-91a3-4696-8241-1d5e63fac79a) | Inline failure on the item with a code (10023-1200), Retry and Cancel: the closest match to our node error + diagnostic code |
| [DAZN, Error information](https://mobbin.com/flows/6e1d2018-4095-496a-b239-aa81699087f6) | Error panel over playback with concrete steps |
| [Julienne, Trying again](https://mobbin.com/flows/219a58aa-7a86-4d60-b8d9-6c72aae4d305) | Retry turning into loading in place |
| [Plenty of Fish, Meet me](https://mobbin.com/flows/a3fc8aff-56b4-450c-af68-dd15114eafa4) | Counter-example: "An Error occured, please try again" says nothing about what failed |
