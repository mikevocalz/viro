# Accessibility checklist

Produced with `design:accessibility-review` (WCAG 2.1 AA). This is a design-time audit of the specs in `spatial-tokens.md`, `copy.md` and `handoff/`. Nothing has been checked on a device. Every box is unchecked until the WS4 PR attaches evidence; the "Spec status" column says whether the design covers the item.

WCAG was written for screens. Where a criterion maps to a head-worn see-through display only by analogy, the row says so.

## Known limits of this audit

- Contrast ratios are computed against the panel color. On a see-through display the room behind a semi-opaque panel also contributes; real contrast needs an on-device measurement.
- Whether Snap OS offers a screen reader, a system high-contrast setting, or a reduce-motion setting is unverified. The design supports app-level toggles for all three so it does not depend on the answer.
- Minimum interactable angular size and gaze dwell time have no sourced value yet (`research-plan.md`). The rows that depend on them stay open.

## Cross-cutting

| # | Requirement | WCAG | Spec status | Evidence |
| --- | --- | --- | --- | --- |
| [ ] A1 | Every interactable has a `label`; compile fails in `--strict` when one is missing (needs a WS1 diagnostic code) | 4.1.2 Name, Role, Value; 2.5.3 Label in Name | Specced (`copy.md` labels) | |
| [ ] A2 | Visible label text is contained in the accessible label | 2.5.3 | Specced | |
| [ ] A3 | Body and label text at least 4.5:1 on its surface | 1.4.3 | Specced: lowest is `textMuted` 7.41:1 | |
| [ ] A4 | Focus/hover ring, borders and reticle at least 3:1 | 1.4.11 | Specced: `border` 3.61:1, `focus` 8.39:1 | |
| [ ] A5 | Color is never the only cue: selected has a check glyph, error has an error glyph, surface tint has a text label | 1.4.1 Use of Color | Specced | |
| [ ] A6 | Text at least 1.2 deg at the node's real distance | analogous to 1.4.4 Resize Text | Specced; host must clamp | |
| [ ] A7 | High-contrast mode available | 1.4.6 (AAA, adopted) | Specced | |
| [ ] A8 | Reduced-motion mode removes scale, slide and rotation | 2.3.3 Animation from Interactions (AAA, adopted) | Specced | |
| [ ] A9 | No transition over 500 ms; no large-surface motion across the view | 2.3.3 by analogy; pack comfort rule | Specced; needs a lint | |
| [ ] A10 | Hover state visible before a pinch commits | 2.4.7 Focus Visible | Specced | |
| [ ] A11 | Press commits on release inside the target; release outside cancels | 2.5.2 Pointer Cancellation | Specced | |
| [ ] A12 | Every function reachable by gaze alone when hand tracking is unavailable | 2.1.1 Keyboard, by analogy (alternative input path) | Specced; dwell value open | |
| [ ] A13 | Interactable angular size large enough to hit | 2.5.5 Target Size (AAA) by analogy | **Open**: no sourced value | |
| [ ] A14 | No time limit on any task; look-away cancel only cancels placement, never loses work | 2.2.1 Timing Adjustable | Specced | |
| [ ] A15 | Focus order inside a panel: title, message, primary action, secondary action | 2.4.3 Focus Order | Specced in handoffs | |
| [ ] A16 | Gaze-only path confirmed by a real participant with hand tracking off | n/a (usability) | Planned in research plan | |

## Per lifecycle state

### Loading

| # | Check | WCAG | Spec status |
| --- | --- | --- | --- |
| [ ] L1 | Progress ring has a label with the percentage | 4.1.2 | Specced (`loading.a11yLabel`) |
| [ ] L2 | Ring at least 3:1 (`focus` on `surface`) | 1.4.11 | Specced |
| [ ] L3 | Reduced motion: static arc or opacity dots, no rotation | 2.3.3 | Specced |
| [ ] L4 | Interactables are not shown before `ready`, so nothing can be pinched mid-load | 3.2.1 On Focus | Specced (pack: animations start after ready) |
| [ ] L5 | Slow-load copy appears only past the WS3 threshold | 3.3 by analogy | Threshold not yet set |

### Ready

| # | Check | WCAG | Spec status |
| --- | --- | --- | --- |
| [ ] R1 | Every interactable in the scene has a label | 4.1.2 | Specced per handoff |
| [ ] R2 | Hover ring and haptic/audio hook on every interactable; app can disable haptic/audio | 2.4.7 | Specced |
| [ ] R3 | All content between 0.6 and 3.0 m | comfort rule | Specced; host clamps |
| [ ] R4 | Drag keeps the model inside the band | comfort rule | Specced in Interaction handoff |

### Degraded

| # | Check | WCAG | Spec status |
| --- | --- | --- | --- |
| [ ] D1 | One-line reason shown; names what the wearer can still do | 3.3.1 Error Identification by analogy | Specced (`copy.md`) |
| [ ] D2 | UI that needs the missing capability is hidden, not disabled-and-visible (pack) | 3.2.4 Consistent Identification | Specced |
| [ ] D3 | Hand tracking `permission-required` switches to gaze-only without a restart | 2.1.1 by analogy | Specced |
| [ ] D4 | Degraded icon is paired with text | 1.4.1 | Specced |
| [ ] D5 | Notice is dismissible and does not come back for the same capability in the session | 2.2.4 Interruptions (AAA, adopted) | Specced |

### Error

| # | Check | WCAG | Spec status |
| --- | --- | --- | --- |
| [ ] E1 | Error says what happened and what to do | 3.3.1, 3.3.3 Error Suggestion | Specced (`copy.md`) |
| [ ] E2 | Exactly one primary action; panel is reachable by gaze | 2.1.1 by analogy | Specced |
| [ ] E3 | Lens never ends on a blank view; placeholder box marks a missing asset | 1.1.1 Non-text Content (placeholder has a label) | Specced |
| [ ] E4 | Error text on `errorSurface` at least 4.5:1 (`text` 13.33:1, `error` 6.57:1) | 1.4.3 | Specced |
| [ ] E5 | Diagnostic code is shown as text, not only logged | 3.3.1 | Specced |

## Per gallery screen

| Screen | Interactables (all need labels) | Gaze-only path | Notes |
| --- | --- | --- | --- |
| Hello | "Next scene" | Dwell on Next scene | Title pulse animation becomes static in reduced motion |
| Placement | Reticle (state, not a button), "Place model" via pinch, "Reset model" | No pinch: show "Place here" button under the reticle, selectable by dwell | Look-away cancel must not fire while the wearer reads the hint (research question) |
| Interaction | Button row, model (drag), "Reset model" | Drag replaced by "Move left / Move right" buttons (step size set in handoff) | Drag is the one gesture with no direct gaze equivalent |
| Navigation | Cards, setting toggle, "Back" | Dwell on cards, toggle and Back | Scroll needs a gaze equivalent: "Scroll up / down" buttons at list edges |

## Priority fixes before WS4 merges

1. **A13 and dwell time have no value.** Without them the gaze-only path can't be built to a spec. Run the research plan's gaze block or find a sourced value from Snap's Spectacles design guidance.
2. **A1 needs a diagnostic code.** "Label on every interactable" is only enforceable if the compiler emits one when it's missing. Ask the `contract` lane for a `VS` code.
3. **Contrast on device.** Measure A3, A4 and E4 against a bright room and a dark room on SPECS 27.
