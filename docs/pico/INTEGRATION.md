# PICO integration across the three forks

Viro provides the React scene API and shared Quest/PICO immersive activity.
[ViroCore](https://github.com/mikevocalz/virocore/tree/pico-support) provides the
native OpenXR renderer. [Expo-PICO](https://github.com/mikevocalz/expo-pico) supplies
the PICO product flavor and platform launcher contract, as Expo-Horizon supplies
the Quest flavor. visionOS keeps its existing native immersive-space path.

The coordinated build instructions, pinned PICO CLI commands, flavor configuration
and device checks are in Expo-PICO's
[VIRO-PICO-INTEGRATION.md](https://github.com/mikevocalz/expo-pico/blob/codex/pico-cli-bridge/docs/VIRO-PICO-INTEGRATION.md).

This integration incorporates source changes from ReactVision/viro PRs
[#526](https://github.com/ReactVision/viro/pull/526),
[#527](https://github.com/ReactVision/viro/pull/527) and
[#528](https://github.com/ReactVision/viro/pull/528), adapted to this fork's
Quest, PICO, visionOS and Moyo changes. It does not replace custom native binaries
with upstream prebuilt archives.

Build ViroCore first, then rebuild Viro's Android bridge against that renderer.
`VRModuleOpenXR.getCapabilities` requires the corresponding Java/JNI API. Studio
falls back to manual placement if the native capability API is missing or has no
initialized plane source. No model-name heuristic enables plane detection.

Web parity additionally needs the matching `viro-web-renderer` API/WASM changes.
iOS needs a custom ViroKit/CCA/ViroReact rebuild and verification of deployment
minimums. The imported 15.1 declaration alone does not establish that an existing
binary built for a higher target will load on 15.1. Keep these changes in draft
until native builds and headset regressions are validated.

## Design and QA documents

In this repo, because they describe surfaces and components that live here:

- [`g5-runbook.md`](./g5-runbook.md) — the on-device gate. Cases K01–K12, the two
  preconditions that block a G5 pass, and the header every result is recorded
  against. `components/Studio/StudioSceneNavigator.tsx:577` defers to case K07.
- [`design-system-audit.md`](./design-system-audit.md) — every hardcoded colour,
  size and spacing value in the in-scene HUD and alert, measured against the
  spatial layout tokens. Inventory only; no code change.

In [virocore's `docs/pico/`](https://github.com/mikevocalz/virocore/tree/codex/pico-cli-bridge/docs/pico),
because they cover the renderer and the coordinated change as a whole:

- `research-plan.md` — first-run script, and the G5 moderated usability pass with
  tasks T1–T8 and the SEV bands.
- `handoff.md` — as-built spec for surfaces S1–S5, with metre and angular sizes.
- `ux-copy.md` — final strings S1–S6.
- `code-review.md` — blockers and majors across all three repositories.
- `device-profiles.md`, `adr-0001-reference-space.md`, `mobbin-refs.md`.
