# Design critique: WS4 implementation

Produced with `design:design-critique` on the implemented gallery and
lifecycle states. Stage: built, not yet seen. No Preview or device captures
exist, so this critique reads the compiled scene documents
(`__test__/fixtures/specs/gallery/*.scene.json`), the experience view the host
computes (`@viro-external/specs` `scripts/experience.test.mjs`), and the Lens
adapter code. The pack's second critique, on captures of each screen in each
state, is still owed.

## Overall impression

The four screens and four states exist as data and logic that tests drive
end to end, and every interactable carries a name. Measuring the compiled
layouts turned up six boxes that overran a panel or each other; those are
fixed and now tested. The largest open question is text size: the pack's
1.2 degree floor makes text about three times larger than Snap's own UI Kit
scale, and nobody has looked at it on a Spectacles display.

## Usability

| Finding | Severity | Recommendation | Status |
| --- | --- | --- | --- |
| Hello's Next scene button ran 4 mm past the panel's right edge; Navigation's Back sat 3 cm outside the left edge | Moderate | Keep controls inside the panel's padding | Fixed (b83e02e0), layout test added |
| Interaction body copy ("Pinch a button. Drag the model.") needed about 63 cm on a one-line, 46 cm box | Moderate | Allow two lines | Fixed |
| Navigation card labels sat on top of the card thumbnails | Moderate | Thumbnail at the card's left edge, label clear of it | Fixed |
| Gaze-only mode had no visible dwell progress in the Lens adapter, so a selection arrived without warning | Critical for the gaze path | Draw a disc that grows on the gazed control | Fixed (0672ba8): `color.focus` disc grows to 2 degrees over the dwell |
| Error, notice and permission actions were bare text with no button surface or hover | Moderate | Draw them as PanelButtons | Fixed: same seven-state visual and press-on-release rule |
| "{n} models didn't load" is the title when the failures are images (Navigation's eight card thumbnails) | Moderate | Add `error.image` and `error.imageMany` keys to `copy.md`, or a neutral "{n} items didn't load" | Open: copy belongs to the UX lane; the code picks the key, so it is a one-line change once the copy exists |
| The Placement scene's control panel is at 1.0 m below eye line while the loading panel opens at 1.5 m on the head ray; the wearer looks in two places on first launch | Minor | Open the loading panel where the scene panel will appear when the scene declares one | Open |
| SpatialScrollView does not scroll in the current Lens host, so Navigation's cards 5-8 are unreachable there | Critical for Navigation | Implement the scroll-view panel with UI Kit ScrollWindow | Fixed for hand input on feat/specs-integration-3: SpatialScrollView compiles to a scroll group and the host scrolls it with ScrollWindow. Gaze Scroll up/down buttons are still not drawn |

## Visual hierarchy

- **First thing seen**: the panel title at `type.title` (2.0 degrees, about
  5.2 cm at 1.5 m). Correct for Hello, Interaction and Navigation.
- **Reading flow**: title, body, controls, top to bottom, left-aligned
  buttons in Interaction's two-by-two grid. The grid reads in the handoff's
  focus order (A, B, C, Retry).
- **Emphasis**: amber appears only on focus, selection and the reticle; the
  error state uses its own red-orange. The implementation keeps that split:
  `resolveViroSpecsButtonVisual` never uses `color.focus` for an error.

## Consistency

| Element | Issue | Recommendation |
| --- | --- | --- |
| Type size | Pack floor 1.2 degrees vs UI Kit Caption at about 0.45 degrees (size 38 at 110 cm) | Decide em vs cap height with the pack author; measure legibility on device (`docs/specs-experience.md#text-size-the-pack-and-snaps-type-scale-disagree`) |
| Units | Angular type and spacing, metric depth, as the token sheet intends | Keep |
| Copy | Every string comes from `copy.ts`, tested against `copy.md` | Keep; the test fails if code and doc drift |
| Button sizing | Compiler and Lens adapter estimate label width at 0.55 em per character | Replace with measured text bounds once the host renders in Preview |

## Accessibility

See `accessibility-ws4.md`. Contrast passes for every pair the code renders;
the gaze path now has visible progress; labels are enforced at compile time.

## What works

- A failure never leaves an empty view: placeholders, one-action panels, and
  the no-fallback panel that stays up.
- Hide-don't-disable is literal in the view model (`hidden.placement`,
  `hidden.drag`), so the Lens adapter cannot show a dead control by accident.
- Surface class is always written in the reticle label, never color alone.

## Priority recommendations

1. **Implement SpatialScrollView scrolling in the Lens host.** Navigation is
   not usable past the first four cards until it lands.
2. **Settle the text-size rule** before the token sheet ships, with captures
   at 0.6, 1.5 and 3.0 m.
3. **Capture every gallery screen in every state in Preview** (the LEAF list
   in the WS4 report) and repeat this critique on the images.
