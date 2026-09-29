# Design-system audit — in-scene HUD and alert

An inventory, not a change. Every hardcoded colour, size, spacing value and
duration in the XR HUD and alert components, measured against the tokens in
`viroreact-spatial-layout-system`. Nothing here has been applied to the code.

Scope is the four components that render in-scene on a headset:

- `components/Studio/StudioQuestAlertOverlay.tsx` (78 lines)
- `components/Studio/StudioQuestSceneHudOverlay.tsx` (108 lines)
- `components/Studio/domain/questHeadLockedTransform.ts` (45 lines)
- the two in-scene `ViroText` blocks in `components/Studio/StudioARScene.tsx`
  (`:1411-1424`, `:1438-1447`)

## There is no token module

`components/Styles/ViroStyle.ts` is 23 lines, of which the operative two are an
import from `react-native` (`:18`) and a type alias
(`:23`). It re-exports `ViewStyle & ShadowStyleIOS` and defines nothing. There
is no spacing scale, no type scale, no colour set, no distance constants, and no
duration constants anywhere under `components/`.

Every value below is therefore a literal at its use site. The counts that follow
are not a style complaint; they are the reason two components that render six
feet apart in the same scene disagree about what white is.

## Measurement basis

`ViroText` maps `fontSize` to world size with a fixed factor —
`kTextPointToWorldScale = 0.01` in the coordinated virocore repo,
`ViroRenderer/VROText.h:44`. `fontSize: 16` is a 0.16 m em box. Nothing scales
this by distance, so the same `fontSize` is a different angular size on every
surface depending on where that surface sits.

Angular sizes use the true viewing distance from
`computeHeadLockedTransform` (`components/Studio/domain/questHeadLockedTransform.ts:30-45`):
1.200 m for the alert (`distanceM` default, no vertical offset) and 1.265 m for
the HUD, whose `verticalOffsetM: -0.4` is applied along the up vector rather than
subtracted from the forward distance
(`StudioQuestSceneHudOverlay.tsx:52-55`). The two `StudioARScene` texts are
world-placed at z = −2.

## Colour

Six distinct literals across four files. No named colour exists anywhere.

| Value | Sites | Role as used |
|---|---|---|
| `#FFFFFF` | `StudioQuestAlertOverlay.tsx:59`, `:71`; `StudioQuestSceneHudOverlay.tsx:76`; `StudioARScene.tsx:1421` | primary text |
| `#CCCCCC` | `StudioQuestSceneHudOverlay.tsx:88`; `StudioARScene.tsx:1444` | secondary text |
| `#7FCBFF` | `StudioQuestSceneHudOverlay.tsx:101` | the only interactive affordance in either component |
| `rgba(0,0,0,0.85)` | `StudioQuestAlertOverlay.tsx:44` | alert scrim |
| `rgba(0,0,0,0.6)` | `StudioQuestSceneHudOverlay.tsx:63` | HUD scrim |
| `"Arial"` | five sites across three files | every `fontFamily` in the set |

Observations:

- **Two scrim opacities for one visual language.** 0.85 and 0.6 with no stated
  reason for the difference. The alert is modal-ish and the HUD is persistent, so
  a difference is defensible — it is just undocumented and unnamed, so the next
  surface has to guess which one it belongs to.
- **`#7FCBFF` marks the only clickable thing in the HUD and appears once.** There
  is no hover, pressed, focused or disabled variant of it anywhere. The layout
  system requires all four states on every interactive component.
- **`#CCCCCC` does two unrelated jobs.** On the HUD it is the plane-status line;
  on `StudioARScene.tsx:1444` it is the empty-state message. Those are a status
  and a placeholder, and they are the same grey by coincidence rather than by
  decision.
- **Scrims are `ViroFlexView` `style.backgroundColor`, not materials.** Neither
  component touches `ViroMaterials`, so none of the `materialToken` set —
  `solidPanel`, `glassPanel`, `dangerSurface` — is reachable from here. An alert
  carrying a failure and an alert carrying a confirmation render identically.

## Type

`typeScale` is in metres of rendered glyph height:
`caption` 0.025–0.035, `body` 0.04–0.055, `title` 0.07–0.11, `hero` 0.14–0.28.

| Site | `fontSize` | Em box | Angular | Role | Token for that role | Over |
|---|---|---|---|---|---|---|
| Alert title, `StudioQuestAlertOverlay.tsx:57` | 22 | 0.22 m | 10.5° | panel title | `title` ≤ 0.11 | **2.0×** |
| Alert message, `:70` | 16 | 0.16 m | 7.6° | reading content | `body` ≤ 0.055 | **2.9×** |
| Scene name, `StudioQuestSceneHudOverlay.tsx:75` | 14 | 0.14 m | 6.3° | panel title | `title` ≤ 0.11 | **1.3×** |
| Plane status, `:87` | 11 | 0.11 m | 5.0° | metadata | `caption` ≤ 0.035 | **3.1×** |
| Exit label, `:100` | 13 | 0.13 m | 5.9° | button label | `body` ≤ 0.055 | **2.4×** |
| Placement prompt, `StudioARScene.tsx:1420` | 14 | 0.14 m | 4.0° at 2 m | transient instruction | `body` ≤ 0.055 | **2.5×** |
| Empty state, `:1443` | 16 | 0.16 m | 4.6° at 2 m | reading content | `body` ≤ 0.055 | **2.9×** |

Every one of the seven is oversized against the token for its own role, by 1.3×
to 3.1×. The alert title at 0.22 m lands inside `hero` (0.14–0.28), the band
reserved for a scene title.

The internal ordering is the part that survives: 22 > 16 and 14 > 13 > 11 are
sensible relative weights. What is missing is a scale that anchors them, so the
hierarchy is right and the absolute sizes are two to three times what the system
calls for.

`fontWeight: "bold"` appears once, on the alert title
(`StudioQuestAlertOverlay.tsx:58`). Nothing else in the set has a weight.

## Panels, spacing and distance

`panelSize` offers `compactCard` 0.45 × 0.28, `standardCard` 0.7 × 0.42,
`widePanel` 1.2 × 0.72, `theaterPanel` 2.4 × 1.35.
`spatialSpacing` is xs 0.025, sm 0.05, md 0.1, lg 0.2, xl 0.35.
`distance.comfortableUI` is 1.25–2.0 m.

| Value | Site | Token |
|---|---|---|
| Panel 2.00 × 1.00 | `StudioQuestAlertOverlay.tsx:40-41` | none. Between `widePanel` and `theaterPanel`; 2:1 aspect matches neither 1.66:1 nor 16:9 |
| Panel 1.60 × 0.50 | `StudioQuestSceneHudOverlay.tsx:60-61` | none. 3.2:1 |
| Padding 0.06 | `StudioQuestAlertOverlay.tsx:47` | none. Between `sm` 0.05 and `md` 0.1 |
| Padding 0.04 | `StudioQuestSceneHudOverlay.tsx:66` | none. Between `xs` 0.025 and `sm` 0.05 |
| Child width 1.80 | `StudioQuestAlertOverlay.tsx:53`, `:66` | derived from panel by hand |
| Child width 1.50 | `StudioQuestSceneHudOverlay.tsx:71`, `:83`, `:95` | derived from panel by hand |
| Text box 3.00 × 1.00 | `StudioARScene.tsx:1416-1417` | none |
| Distance 1.200 m | `questHeadLockedTransform.ts:34` | **below** `comfortableUI.min` 1.25 |
| Distance 1.265 m | computed, `StudioQuestSceneHudOverlay.tsx:52-55` | inside `comfortableUI` |
| Vertical offset −0.40 | `:54` | none |
| World z = −2 | `StudioARScene.tsx:1415`, `:1440` | inside `comfortableUI`, but world-locked while everything else on the surface is head-locked |

Two things stand out.

**The HUD content box is an exact fit with zero slack.** Panel height 0.50 minus
2 × 0.04 padding leaves 0.42 m. The three children are 0.15 + 0.12 + 0.15 = 0.42 m
(`:72`, `:84`, `:96`). There is no room for a gap between rows, no room for a
descender to overflow, and no room to add a fourth row without changing the panel
height. Across the width the total margin is 0.02 m (1.52 content, 1.50 children)
— 0.01 m per side.

It also means the spacing between rows is zero, which is why the layout reads as
a block rather than as three fields. `spatialSpacing.xs` is 0.025; three rows
separated by `xs` would need 0.05 m the panel does not have.

Hiding the plane-status row when `planeDetectionMode === "NONE"` (`:80`) leaves
0.12 m of slack, which `justifyContent: "center"` (`:64`) distributes as leading.
The two remaining rows therefore sit further apart in `NONE` mode than in any
other mode, with no code expressing that intent.

**Panel sizes are large in angular terms.** The alert covers 79.6° × 45.2° at
1.200 m and the HUD 64.6° × 22.3° at 1.265 m. Both were written as metres without
the distance in the same expression, which is the mechanism by which an
in-spec-looking number becomes an out-of-spec panel.

## Durations

There are none. No `animation`, no `ViroAnimations`, no `setTimeout`, no fade in
either component. Both appear and disappear on the frame their condition flips:
the alert on `questAlertStore.isActive()`
(`StudioQuestAlertOverlay.tsx:31`), the HUD on `cameraPose`
(`StudioQuestSceneHudOverlay.tsx:50`), and exit fires synchronously on click
(`:26-29`).

The coordinated `docs/pico/handoff.md` specifies a ≤200 ms fade for the toast
surface and for recenter, and forbids animated translation. The in-scene
surfaces that exist today implement neither the fade nor a violation of it — they
have no timing behaviour at all, so there is nothing to tune and nothing to
name.

## Naming inconsistencies

**Two words for one thing.** The HUD's unavailable line says "Surface tracking
unavailable" and the line one row up in the same state machine says "Scanning for
planes…" / "Plane found" (`StudioQuestSceneHudOverlay.tsx:82`). The prop is
`planeDetectionAvailable`, the native field is `_planeDetectionStatus`, the JS
capability is `planeDetection`. Users see two nouns for one concept, in adjacent
strings, from one ternary. Pick "surface" for user-facing copy and keep "plane"
for the API surface.

**`cameraPose` versus `questHeadLockedPose`.** The prop is `cameraPose` on both
components (`StudioQuestAlertOverlay.tsx:15`,
`StudioQuestSceneHudOverlay.tsx:15`); the variable passed to both is
`questHeadLockedPose` (`StudioARScene.tsx:1426`, `:1429`). The value is a camera
pose, and head-locking is what the transform does to it — the call site name
describes the consumer rather than the value.

**`Quest` in names for components gated on `isXRHeadset`.** `StudioQuestAlertOverlay`,
`StudioQuestSceneHudOverlay`, `questAlertStore`, `questHeadLockedTransform`,
`VRQuestNavigatorBridge`, and the `VRQuestScene` registration key all carry
Quest, while the mount conditions are `isXRHeadset`
(`StudioARScene.tsx:1426`, `:1427`) and the navigator branches are
`isQuest || isPico` (`components/ViroXRSceneNavigator.tsx:198`, `:253`, `:323`).
Only two things in this set are genuinely Quest-specific: the permission request
(`:268`) and `hdrEnabled={!isQuest}`
(`components/Studio/StudioSceneNavigator.tsx:580`). The registration key
`VRQuestScene` is a wire contract and cannot move; the component names can.

**`[ Exit ]` is a text-mode convention.** The brackets stand in for a button that
was never drawn (`StudioQuestSceneHudOverlay.tsx:94`). They neither bound the hit
area — which is the full 1.5 m text width, 61.3° of arc — nor signal
interactivity as reliably as the colour beside them.

**`padding` is one number in a system that separates axes.** Both components pass
a scalar (`StudioQuestAlertOverlay.tsx:47`,
`StudioQuestSceneHudOverlay.tsx:66`), so horizontal and vertical breathing room
cannot differ. The HUD is 3.2:1 and needs them to.

## Proposed tokens

One module, `components/Styles/spatialTokens.ts`, next to the existing
`ViroStyle.ts`. Values below are the token set the current code should map onto,
with the current literal noted where it differs. Adopting them changes rendered
output; that is a separate change with K08 and K09 behind it.

```ts
// Distance, metres. distance.comfortableUI is 1.25–2.0.
export const xrDistance = {
  alert: 1.35,   // was 1.2 — below the comfortableUI floor
  hud:   1.35,   // forward component; true distance rises with hudVerticalOffset
} as const;

export const xrOffset = {
  hudVerticalOffset: -0.35,  // was -0.4; ~14.5° below gaze at 1.35 m
} as const;

// Rendered glyph height, metres. Maps onto typeScale.
export const xrType = {
  caption: 0.03,   // plane status        — was 0.11 (fontSize 11)
  body:    0.05,   // alert message,
                   // empty state         — was 0.16 (fontSize 16)
  label:   0.05,   // exit, prompts       — was 0.13 (fontSize 13)
  title:   0.09,   // scene name          — was 0.14 (fontSize 14)
  hero:    0.16,   // alert title         — was 0.22 (fontSize 22)
} as const;

// fontSize = metres / kTextPointToWorldScale (0.01), so multiply by 100.
export const xrFontSize = {
  caption: 3, body: 5, label: 5, title: 9, hero: 16,
} as const;

// Maps onto spatialSpacing.
export const xrSpacing = {
  xs: 0.025,  // row gap inside a panel — currently 0
  sm: 0.05,   // panel padding          — was 0.04 (HUD) / 0.06 (alert)
  md: 0.1,
} as const;

export const xrPanel = {
  alert: { width: 1.2, height: 0.72 },   // widePanel; was 2.0 × 1.0
  hud:   { width: 1.2, height: 0.30 },   // widePanel width, strip height
} as const;

export const xrColor = {
  textPrimary:     '#FFFFFF',
  textSecondary:   '#CCCCCC',
  textPlaceholder: '#9A9A9A',  // splits the second job off #CCCCCC
  action:          '#7FCBFF',
  actionHover:     '#A6DBFF',  // new — no hover state exists
  actionPressed:   '#5AB4EE',  // new
  actionDisabled:  '#5A6B78',  // new
  scrimHeavy:      'rgba(0,0,0,0.85)',  // alert
  scrimLight:      'rgba(0,0,0,0.60)',  // HUD
  danger:          '#FF8A80',  // new — no error colour exists
} as const;

export const xrDuration = {
  fade: 180,  // ms, under the ≤200 ms ceiling in handoff.md §(b)
} as const;

export const xrFont = { family: 'Arial' } as const;
```

Three notes on adoption.

**The HUD panel must grow or the rows must shrink before spacing exists.** At the
proposed `xrType` heights the three rows total 0.03 + 0.05 + 0.09 = 0.17 m, which
with two `xs` gaps and `sm` padding on both sides needs 0.32 m of height. The
proposed 0.30 m strip is 0.02 m short; either take the row gap down to 0.015 m or
take the strip to 0.32 m. Left as a decision rather than silently rounded.

**`xrFontSize` exists because `fontSize` is the prop.** Keeping both the metre
value and its `fontSize` in one module is what stops the next surface
rediscovering the 0.01 factor at a use site.

**The exit hit area is not a token problem.** Shrinking the label does not shrink
the target: the `onClick` sits on the `ViroText` and the target is the geometry's
`width` (`StudioQuestSceneHudOverlay.tsx:95-97`), which is set independently of
`fontSize`. That needs a bounded, rendered control, which is a component change.
See `docs/pico/g5-runbook.md` K09 and S3 in the coordinated
`docs/pico/ux-copy.md`.
