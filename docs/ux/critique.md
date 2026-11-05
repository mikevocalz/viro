# Design critique

Produced with `design:design-critique`. Stage: specification. No screen captures exist yet, so this critiques the specs in `docs/ux/` and the current Platform Lab code (`examples/specs-platform-lab/SpecsPlatformLab.tsx`). The pack requires a second critique of on-device captures before WS4 merges; that pass has not happened.

## Overall impression

The specs cover the four states and four screens with sourced comfort numbers and computed contrast. The biggest gap is input: the gaze-only path, which the pack makes mandatory, depends on two values nobody has measured (dwell time, minimum target size). Until those exist, the gaze path is a layout, not a working spec.

## Usability

| Finding | Severity | Recommendation |
| --- | --- | --- |
| Gaze dwell duration and target angular size are unset, so gaze-only selection can't be built to spec | Critical | Run the research plan's gaze block, or source values from Snap's Spectacles design guidance, before WS4 code merges |
| Look-away cancel (1.5 s) can fire while the wearer reads the placement label or glances at the control panel | Moderate | Spec defines "away" as no valid hit, which excludes glances at a nearby surface; test it on device and log accidental cancels |
| The current Platform Lab title pulses forever (scale 1.15, 500 ms loop). It's within the motion cap but keeps pulling the eye to the one piece of text | Moderate | Run the pulse once on ready, or stop after 3 cycles; off in reduced motion (already specced) |
| Drag has no gaze-only equivalent, so step buttons were added (10 cm, a starting value) | Minor | Validate step size with participants |
| Loading panel is world-placed; if the wearer turns away during a slow load they see nothing | Minor | Out of scope for v1; consider an edge indicator later |
| The 1.2 deg rule doesn't say whether it measures cap height or the em box. The tokens apply it to font size (em), which is the looser reading | Moderate | Pick one with the pack author; if cap height, every `type.*` token grows by roughly the em/cap ratio of the chosen face |

## Visual hierarchy

- **First thing seen**: the scene panel title, then the model. Correct for Hello and Interaction.
- **Placement**: the reticle and its label should win; the control panel is deliberately below eye line at 1.0 m so it doesn't compete.
- **Error**: amber is reserved for focus and selection, and the error panel uses its own red-orange. If amber also marked errors, the wearer couldn't tell "you're pointing here" from "this broke".

## Consistency

| Element | Issue | Recommendation |
| --- | --- | --- |
| Units | Type and spacing are angular; depth offsets are centimeters | Intentional: depth reads as distance. Keep, and say so in the WS4 component docs |
| Copy | "place" used throughout; no "drop" or "anchor" | Keep the glossary in `copy.md` as the reference for PR review |
| Diagnostic format | `VS1023 (node)` in copy and tokens | WS1 owns the code list; confirm the example code exists before shipping copy that shows it |

## Accessibility

- Contrast: all text tokens pass 4.5:1 on their surface (lowest `textMuted` 7.41:1); borders and focus pass 3:1 (`border` 3.61:1). Computed against the panel color only.
- On a see-through display, panel opacity and the room behind it change real contrast. Measure on device in a bright and a dark room.
- Color is paired with a glyph or text in every state.

## What works

- Every state keeps the scene alive: placeholder boxes for missing assets, previous scene kept on failed updates, one action on every error panel.
- Navigation swaps content inside a fixed panel instead of sliding panels, which satisfies the no-vection rule without a special case.
- Copy keys are the contract, so WS4 code never inlines strings.

## Mobbin reference gap

All 25 saved flows are iPhone apps. Mobbin has no headset or glasses UI, so the references show patterns (reticle search, inline download error with a code, per-capability permission list) and not spatial layout. Spatial layout decisions here come from the pack's comfort rules, not from these references. Collection: [Viro SPECS production](https://mobbin.com/collections/becab9ef-05c1-4e3d-a0a6-716b1c9844e2).

## Priority recommendations

1. **Set dwell time and target size from evidence** before the gaze-only path is coded.
2. **Get a `VS` diagnostic code for a missing `label`** from the `contract` lane so the label rule is enforced at compile time.
3. **Capture every screen in every state on SPECS 27** and run this critique again against the captures, as WS4's done-when requires.

## Provenance

| File | Skill that produced it |
| --- | --- |
| `research-plan.md` | `design:user-research` |
| `spatial-tokens.md` | `design:design-system`, visual direction from `frontend-design:frontend-design` |
| `copy.md` | `design:ux-copy` |
| `accessibility.md` | `design:accessibility-review` |
| `handoff/*.md` | `design:design-handoff` |
| `critique.md` | `design:design-critique` |
| All prose | edited against `no-ai-slop` |

Viro facts (easing names) came from the Viro MCP `reactviro_list_animation_easings`. No `viroreact-*` skill was loaded. `engineering:code-review` from the pack's sequence does not apply: this lane wrote no code.
