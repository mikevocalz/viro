# Specs experience layer (WS4)

What the wearer sees around a scene: comfort limits the compilers enforce,
accessible names, premium components drawn from spatial tokens, and the
Platform Lab gallery. The Lens side (lifecycle visuals, placement reticle,
gaze dwell, high contrast and reduced motion at runtime) lives in
`@viro-external/specs` as `ViroSpecsExperienceController`; see that package's
`doc/Experience.md`.

Design sources: `docs/ux/spatial-tokens.md`, `docs/ux/copy.md`,
`docs/ux/accessibility.md` and `docs/ux/handoff/*.md`.

Evidence: everything on this page is `portable-test-passed` (Jest and the CLI
suite). Nothing here is `preview-validated` or `hardware-validated` yet.

## Comfort rules

The compilers run `checkSpecsExperience` on every manifest they build, and
`viro-specs-compile --manifest` runs it on hand-written JSON. Findings are
warnings: the manifest is faithful, the experience is not comfortable.
`--strict` fails on them.

| Rule | Code | Measured how |
| --- | --- | --- |
| Rendered content 0.6-3.0 m from the wearer | `VS3017` | Composed world position of text, image, model and panel nodes; wearer at the scene origin |
| Text at least 1.2 degrees tall | `VS3018` | Em-square height (`fontSize` / 4388.6 m, times world scale) as an angle at the node's distance |
| Animations at most 500 ms | `VS3019` | `plan.durationSeconds` |
| Animations ease in and out | `VS3020` | `plan.easing` must be `ease-in-out` |
| No large surface moves across the view | `VS3021` | A position track that changes a node carrying a surface 10 degrees or wider |

The host enforces the same limits at runtime, where distances can change
after placement and drag: it raises text to 1.2 degrees (`VS5022`) and stops
placement and drag at the band edges (`VS5023`).

### Text size: the pack and Snap's type scale disagree

The pack's 1.2 degree minimum, measured on the em square, needs a 3.14 cm em
at 1.5 m: a Lens Text size of about 138. The Spectacles UI Kit type scale in
the CLAD `specs-build-ui` skill puts its smallest readable text (Caption, size
38) at 110 cm, which is a 0.87 cm em, about 0.45 degrees. So every Snap UI Kit
text style is smaller than the pack's floor, and PanelText at `type.title`
(2.0 degrees) renders at about 230 at 1.5 m.

This lane follows the pack, because the pack is the requirement. The critique
in `docs/ux/critique.md` already asks whether 1.2 degrees is meant for cap
height or the em box; this finding makes the question more pressing. Settle it
with the pack author and the on-device legibility block in
`docs/ux/research-plan.md` before the tokens ship. If the rule changes, edit
`type.*` in `components/Specs/core/tokens.ts` and the token sheet together;
`VS3018` and PanelText sizing follow automatically.

## Labels

Every node an interaction targets needs an accessible name (`VS3016`). Write
`accessibilityLabel` on Viro elements (React Native's prop, already in
`ViroCommonProps`) and `label` on premium components. Both land in the node's
`label`. Name the action or object, not the control type: "Reset model", not
"Button". The host appends ", selected" and ", unavailable"
(`a11y.selected`, `a11y.unavailable` in `docs/ux/copy.md`); never write state
into the label. A PanelButton's label is also its visible text, which keeps
WCAG 2.5.3 (label in name) true by construction.

## Gaze dwell

**Provisional value: 1000 ms.** The token is `input.gazeDwellMs`.

`docs/ux/research-plan.md` left dwell time open and the accessibility review
listed it as a priority fix. The gaze-only fallback could not ship without a
number, so this lane picked one:

- Majaranta, Ahola and Špakov (CHI 2009, "Fast gaze typing with an
  adjustable dwell time", doi:10.1145/1518701.1518758) started novices at
  1000 ms. In their first session participants chose 876 ms on average, and
  the fixed dwell times in the studies they cite ran from 450 to 1000 ms.
  Our wearers are novices on every first run.
- A VR hands-free text selection study (arXiv 2209.06825) piloted dwell times
  in the 400 ms-1 s range and found 1 s worked best.
- The FocusFlow VR study (arXiv 2401.12872) found a 0.5 s dwell had the
  highest false-trigger rate.
- On Spectacles, gaze here means a head ray, not eye tracking
  (`eye-gaze` is `unverified` in the capability report). Head rays drift more
  than eye gaze, and a false trigger on "Next scene" navigates away, so the
  value sits at the slow end of the range.

What would change it: the gaze block in the research plan (wearers with hand
tracking off) measuring false triggers and time to select at 600, 800 and
1000 ms. Until then the value is a starting point, not a comfort or
accessibility claim. The dwell ring fills over the dwell time; under reduced
motion it shows a filling arc without rotation.

Minimum interactable angular size (accessibility check A13) is still open and
no value is enforced.

## Premium components

Import from `@reactvision/react-viro`. On ViroCore they render with Viro
primitives (ViroFlexView, ViroText, ViroImage, Viro3DObject); inside
`ViroSpecsScene` both compilers read their props by name and emit the node
kinds in `docs/specs-manifest.md#premium-components`. The Lens host draws the
visuals from `theme.tokens`.

| Component | Props | Notes |
| --- | --- | --- |
| `SpatialPanel` | `title?`, `width?`, `height?` (m), children | Default 20 x 12 degrees at the node's distance. `color.surface` at 92%, `border`, `radius.panel`, padding `space.md`. Faces the wearer at placement, no billboarding. |
| `PanelText` | `text`, `role?` (`title`/`body`/`label`), `tone?` (`default`/`muted`), `maxLines?`, `width?`, `height?`, `animation?` | `fontSize` is computed from the role's angle at the node's distance, rounded up to 0.1 pt, so it never triggers `VS3018`. `maxLines` defaults to 4 for body, 2 otherwise. |
| `PanelButton` | `label` (required, `VS3022`), `state?`, `errorMessage?`, `onPress?`, `onHover?`, `width?`, `height?`, children | Seven visual states: the app sets idle, selected, disabled, loading and error; the host adds hover and pressed. Press commits on release inside the target; release outside cancels. Default size fits the label at `type.label` plus `space.sm` and `space.md` padding; the host re-measures. |
| `PanelImage` | `source`, `width?`, `height?`, `label?` | Missing asset: `color.placeholder` box at these extents, `VS5003`, accessible name `{label}, didn't load`. |
| `SpatialScrollView` | `width`, `height`, `itemHeight` (all m, required, `VS3022`), `initialIndex?` | Compiles to a `group` with `scroll`, the path a ViroNode with `specsScroll` takes. Place children around the viewport center at the node origin; the compiler moves them into the scroll content and sizes `contentHeight` to whole rows. The host scrolls with UI Kit ScrollWindow, clips at the viewport edge, settles drags on `itemHeight` rows, starts `initialIndex` rows down and keeps the position for the `viroTag` across updates and, per route, across navigation. On ViroCore it renders children without scrolling. |
| `ModelViewer` | `source`, `type` (`GLB`/`GLTF`/`OBJ`), `autoRotate?`, `resettable?`, `onClick?`, `onHover?`, `onDrag?`, `label?` | Load shows a progress ring at the bounds; error shows the placeholder and `error.asset`; drag is held inside the comfort band; Reset returns the authored transform in `motion.base`. `autoRotate` is off under reduced motion. |

All share `viroTag`, `position`, `rotation`, `scale`, `visible`, `opacity`
and `label`. Invalid values (an unknown `state`, a negative size) are
`VS3022` errors; the element is not compiled when a required prop is missing.

## Copy

`components/Specs/core/copy.ts` (`VIRO_SPECS_COPY`, `formatSpecsCopy`) holds
every key in `docs/ux/copy.md`, and a test checks the two match string for
string. Code references keys. The gallery scenes use
`VIRO_SPECS_COPY["nav.next"]`, which both compilers resolve statically.

## Platform Lab gallery

Four scenes under `examples/specs-platform-lab/`, one per handoff screen:

| Scene | File | Handoff |
| --- | --- | --- |
| Hello | `SpecsPlatformLab.tsx` | `docs/ux/handoff/hello.md` |
| Placement | `PlacementScene.tsx` | `docs/ux/handoff/placement.md` |
| Interaction | `InteractionScene.tsx` | `docs/ux/handoff/interaction.md` |
| Navigation | `NavigationScene.tsx` | `docs/ux/handoff/navigation.md` |

`__test__/ViroSpecsGallery.test.tsx` checks that each compiles with no
diagnostics in both compilers, that the two manifests are byte-identical, that
every interactable has a label, and that the scene documents match
`__test__/fixtures/specs/gallery/*.scene.json`. Those documents are the inputs
the experience-layer tests in `@viro-external/specs` load to exercise loading,
degraded and error for each scene.

The gallery shows initial states. Toggling Option A, opening a card or
retrying goes through the typed actions contract (WS3b), not through new JSX.

## Limitations

| Limitation | Code |
| --- | --- |
| The wearer is assumed at the scene origin; a scene placed elsewhere at runtime is checked again by the host, not the compiler | `VS3017`, `VS5023` |
| Text without `fontSize` is checked at the host default of 48 points | `VS3018` |
| The 10 degree surface threshold for the no-vection rule is a starting value | `VS3021` |
| A missing PanelButton label or SpatialScrollView viewport drops the element | `VS3022` |
| Scene protocol 1 drops `label`, `component` and `theme` | `VS1015` |
| PanelText or PanelImage with only one of `width`/`height` drops the extents | `VS3022` |
| The current Lens host does not draw the ModelViewer Reset button, load ring and `autoRotate`, or PanelImage corner radius | `VS5025` |
| SpatialScrollView content height counts direct children only; a child without extents counts as one row | none |
| The gaze-only Scroll up/down buttons are in the view model and `scrollByRows` exists on the host, but the Lens adapter does not draw the buttons yet | none |

ViroCore rendering (outside Specs, where no Specs diagnostic runs): the premium
components use plain Viro primitives, `SpatialScrollView` does not scroll, and
`ModelViewer` is typed without FBX because `Viro3DObject` has no FBX loader.
None of this affects the Specs manifest, which carries FBX.
