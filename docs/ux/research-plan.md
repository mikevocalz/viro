# SPECS experience layer: research plan

Produced with the `design:user-research` skill (knowledge-work-plugins design 1.2.0) for WS4 of the Viro SPECS production pack. Scope: the Platform Lab gallery (Hello, Placement, Interaction, Navigation) and the four scene lifecycle states (loading, ready, degraded, error).

No sessions have run. Every finding slot below is empty on purpose. Participants are recruited, not invented.

## Who wears SPECS for this work

Two groups, recruited separately because they judge different things.

| Group | Who | What they judge | Target n |
| --- | --- | --- | --- |
| Wearers | People who have used Spectacles or another see-through headset for at least one session | Comfort, legibility, whether placement and selection make sense without instructions | 5-8 |
| Builders | React Native or Viro developers who would ship a lens built from Viro JSX | Whether the lifecycle states and diagnostics tell them what broke and where | 5 |

Screener questions for wearers: headset used in the last 6 months (which one), hand dominance, corrective lenses worn under the headset (yes/no), any motion sickness in VR or AR (never / sometimes / often). Recruit at least one participant who answers "often" and one who wears corrective lenses.

Screener for builders: shipped a React Native app (yes/no), used Lens Studio (never / tried / shipped a lens), used Viro before (yes/no).

## The three tasks

Each wearer session runs the same three tasks on device, one gallery scene per task, in a counterbalanced order.

1. **Place.** Open the Placement scene, put the model on a table, then cancel a second placement by looking away.
   - Success: model rests on the table surface the participant chose; the cancel happens without the participant asking how.
   - Measures: time from reticle shown to confirm, number of mis-placements, whether the participant noticed the surface tint, whether look-away cancel happened on purpose or by accident.
2. **Select.** In the Interaction scene, select the third button in a row, then drag the model 30 cm to the right.
   - Success: correct button selected on first pinch; model ends within the content band.
   - Measures: wrong-target selections, hover-to-select time, whether the hover state was visible before the pinch.
3. **Navigate.** In the Navigation scene, open the second card, change one setting, go back to the list.
   - Success: participant returns to the list and finds the card they opened without re-scrolling.
   - Measures: whether scroll position was noticed as preserved, back-target misses.

Gaze-only variant: one session block per participant repeats Select and Navigate with hand tracking disabled, so the gaze-only fallback gets real use rather than a desk review.

Lifecycle states are triggered by the moderator through the mock capability map and a missing-asset build: a slow asset (loading), a denied hand-tracking permission (degraded), and a missing GLB (error). Ask after each: "What do you think happened? What would you do next?"

## Interview guide (wearers, 50 min)

1. **Warm-up, 5 min.** Explain the session. Confirm comfort: they can take the headset off at any point and we stop.
2. **Context, 10 min.**
   - "Tell me about the last time you used a headset. Where were you, what did you do?"
   - "When something in a headset app stopped working, what did you do?"
3. **Tasks, 20 min.** The three tasks above, think-aloud. Do not explain the reticle, tint, or look-away cancel before the task.
4. **Reaction, 10 min.** Show the four lifecycle states in turn.
   - "Read me the message you see." (legibility check, note distance)
   - "What does this mean? What would you do?"
   - "Was anything uncomfortable to look at or follow?"
5. **Wrap-up, 5 min.** "Anything we didn't ask about?" Record the comfort self-report (none / mild / moderate / stop).

## Interview guide (builders, 40 min)

1. Context: how they debug a React Native app today.
2. Show a lens in the error state with a `VS` diagnostic code. "What broke? Where would you look?"
3. Show a degraded state (world-query unavailable). "Is this your bug or the device's?"
4. Ask them to change the copy of the loading state using only the docs. Record where they looked.

## Open parameters this study must settle

The pack fixes these comfort values (section 2): 0.6-3.0 m content band, text at least 1.2 degrees angular height, motion at most 500 ms ease-in-out, look-away cancel after 1.5 s. Tokens and handoff docs use them as given.

The pack does not give values for the following. This study measures them; no default is adopted until it does.

- Gaze dwell time for gaze-only selection.
- Minimum angular size of an interactable hit area. WCAG 2.5.5 (44 CSS px) does not translate to a head-worn display without a viewing-angle model.
- Whether 1.2 degrees applies to cap height or the full em box (see `critique.md`).
- Whether 1.5 s look-away cancel triggers by accident during normal head movement.

## Analysis

- Affinity map of observations per task and per state.
- Impact/effort matrix on the resulting issues.
- Each finding lands as a row in `accessibility.md` or `critique.md` with participant count, never as a general claim.

## Timeline

| Week | Work |
| --- | --- |
| 1 | Recruit, build the mock capability map and missing-asset build |
| 2 | Wearer sessions (on device), builder sessions (remote) |
| 3 | Synthesis, update tokens and handoff docs with measured values |

## Evidence labels

Results from these sessions carry the pack's labels: desk review of this plan is `implemented` at most. Wearer sessions on a SPECS 27 unit are `hardware-validated` only when device, Snap OS, Lens Studio and package versions are recorded.
