# Accessibility audit: WS4 implementation

Produced with `design:accessibility-review`. Standard: WCAG 2.1 AA, with the
AAA criteria `accessibility.md` adopted. Date: 2026-10-28. Scope: the code on
`feat/specs-experience` in viro (compile-time rules, premium components,
gallery) and viro-external (experience controller, Lens adapter).

Evidence is `portable-test-passed` unless a row says otherwise. Nothing was
checked with a person, in Preview, or on a SPECS 27 unit. Contrast ratios use
the panel color as background; real see-through contrast needs the on-device
measurement `accessibility.md` already calls for.

## Summary

Issues found: 6. Critical: 1 (open). Major: 3 (2 fixed, 1 open). Minor: 2 (open).

## Status of the design-time checklist

| # | Check | Status | Evidence |
| --- | --- | --- | --- |
| A1 | Every interactable has a label; `--strict` fails without one | Met | `VS3016`; `ViroSpecsExperience.test.tsx` "fails viro-specs-compile --strict on a missing label" |
| A2 | Visible label inside the accessible name | Met for PanelButton | The label is the visible text by construction |
| A3 | Text at least 4.5:1 | Met on panel color | Contrast table below |
| A4 | Rings, borders, reticle at least 3:1 | Met on panel color | Contrast table below |
| A5 | Color never the only cue | Met | Check glyph on selected, error glyph on error, surface name in the reticle label |
| A6 | Text at least 1.2 degrees at its real distance | Met in code | `VS3018` at compile time, `VS5022` clamp at runtime from the compiled size |
| A7 | High-contrast mode | Met in code | `resolveViroSpecsTokens`; runtime `setPreferences`; untested on an additive display |
| A8 | Reduced motion removes scale, slide, rotation | Met in code | Hover and appear scale forced to 1, static loading arc, "Cancelling" text |
| A9 | No transition over 500 ms, no large-surface motion | Met | `VS3019`, `VS3020`, `VS3021`; token durations tested under the cap |
| A10 | Hover visible before a pinch commits | Met in code | PanelButton hover state; gaze dwell disc (fixed in 0672ba8) |
| A11 | Commit on release inside, cancel outside | Met | `ViroSpecsButtonTracker` tests |
| A12 | Every function reachable by gaze | **Not met for Navigation** | Scroll buttons are in the view model, but SpatialScrollView does not scroll in the Lens host yet (`VS5025`) |
| A13 | Interactable angular size large enough | Open | No sourced value; buttons are at least 3.2 degrees tall at 1.5 m today |
| A14 | No time limit; look-away only cancels placement | Met | Placement tests |
| A15 | Focus order title, message, actions | Met in layout | Gallery layouts follow handoff order; no screen reader exists to confirm |
| A16 | Gaze path tried by a participant | Open | Research plan not run |
| L1-L5 | Loading label, ring contrast, reduced motion, nothing pinchable mid-load, slow copy | Met in code | Experience tests per gallery scene |
| D1-D5 | One-line reason, hide not disable, switch without restart, icon plus text, no repeat | Met in code | Degraded tests |
| E1-E5 | What happened and what to do, one action, never blank, contrast, code as text | Met in code | Error tests |

## Findings

### Perceivable

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | "{n} models didn't load" names images as models | 1.1.1, 3.3.1 | Minor | Image-specific error copy (see `critique-ws4.md`) |
| 2 | Pure black high-contrast surface may render transparent on an additive display | 1.4.6 (adopted) | Minor | Verify on device; the doubled white border is the fallback |

### Operable

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 3 | Navigation's list does not scroll in the current Lens host; cards 5-8 unreachable by hand or gaze | 2.1.1 by analogy | Critical | Implement scroll-view panels (ScrollWindow), then wire the gaze Scroll buttons to `stepViroSpecsScroll` |
| 4 | Gaze-only selection showed no progress | 2.4.7, 3.2.1 | Major | Fixed: dwell disc grows over the 1000 ms dwell |
| 5 | Panel actions had no hover state or surface | 2.4.7 | Major | Fixed: drawn as PanelButtons |

### Understandable

No new findings. All error copy says what happened and what to do; the
banned phrases test keeps "Something went wrong" and its relatives out.

### Robust

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 6 | Accessible names are computed (`accessibleName`, `a11yLabel` keys) but Snap OS exposes no screen reader API this host can call (unverified) | 4.1.2 | Major | Keep computing them so LEAF can assert them; wire them when a platform API exists |

## Color contrast check

Pairs the code renders, WCAG relative-luminance formula, panel color as
background.

| Element | Foreground | Background | Ratio | Required | Pass |
| --- | --- | --- | --- | --- | --- |
| Button idle label | #eef2f0 | #26343f | 11.30:1 | 4.5:1 | yes |
| Button pressed label | #eef2f0 | #33444f | 8.94:1 | 4.5:1 | yes |
| Button selected label | #eef2f0 | #3b3320 | 11.07:1 | 4.5:1 | yes |
| Button disabled label | #808d96 | #1b2630 | 4.51:1 | exempt (inactive) | yes |
| Button border vs panel | #6b7d8c | #1b2630 | 3.61:1 | 3:1 | yes |
| Button border vs its own fill | #6b7d8c | #26343f | 3.00:1 | 3:1 | yes, at the limit |
| Hover ring | #c4d0d8 | #1b2630 | 9.78:1 | 3:1 | yes |
| Selected border | #f2b544 | #3b3320 | 6.83:1 | 3:1 | yes |
| Error border | #ff8a7a | #26343f | 5.57:1 | 3:1 | yes |
| Error title | #ff8a7a | #3a1f1e | 6.57:1 | 4.5:1 | yes |
| Error body | #eef2f0 | #3a1f1e | 13.33:1 | 4.5:1 | yes |
| Error code line | #a9b6bf | #3a1f1e | 7.26:1 | 4.5:1 | yes |
| Notice body | #eef2f0 | #1e2c3d | 12.54:1 | 4.5:1 | yes |
| Notice builder line | #a9b6bf | #1e2c3d | 6.83:1 | 4.5:1 | yes |
| Loading title (accent) | #f2b544 | #1b2630 | 8.39:1 | 4.5:1 | yes |
| Disabled border at 50% | #43525e | #1b2630 | 1.91:1 | exempt (inactive) | yes |
| High-contrast focus | #ffd25e | #000000 | 14.63:1 | 3:1 | yes |

The idle border against the raised fill sits exactly at 3.00:1. It passes,
but any darkening of `color.border` fails it; the token sheet should say so.

## Input paths (the headset's "keyboard navigation")

| Element | Hands | Gaze only | Cancel |
| --- | --- | --- | --- |
| PanelButton | Hover, pinch, release inside | Dwell 1000 ms | Release outside, look away before the dwell fills |
| Panel action (Retry, Close, Got it) | Same | Same | Same |
| Model drag | Drag, clamped to 0.6-3.0 m | Move left/right/closer/away, 10 cm steps, clamped | Release |
| Placement | Pinch on a valid surface | "Place here" by dwell | Look away 1.5 s |
| List scroll | Not available in the Lens host yet | Scroll up/down buttons in the view model, not wired yet | n/a |

## Announced names

| Element | Name | Issue |
| --- | --- | --- |
| Option B (selected) | "Option B, selected" | none |
| Option C (disabled) | "Option C, unavailable" | none |
| Reticle | "Placement reticle on Table" | none |
| Loading | "Loading scene, 40 percent" | none |
| Missing thumbnail | "{label}, didn't load" | needs a label on PanelImage; gallery thumbnails have none, which is allowed because they are not interactive |

## Priority fixes

1. **SpatialScrollView scrolling in the Lens host.** Blocks hand and gaze
   wearers from half of Navigation.
2. **On-device contrast and legibility**, bright and dark room, including the
   high-contrast black surface on the additive display.
3. **Image-specific error copy.**
