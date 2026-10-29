# Specs production pass: PR plan

The release went out as two pull requests, viro-external first because
viro's `consumer` job packs `@viro-external/specs` from viro-external
`main`, and viro's `^0.3.0` peer needs the 0.3.0 that PR ships. Both are
merged, with two follow-ups and the upstream sync after them:

| Order | Repo | PR | Branch | Merge commit | Merged (UTC) |
| --- | --- | --- | --- | --- | --- |
| 1 | viro-external | [#74](https://github.com/mikevocalz/viro-external/pull/74) SPECS release: typed actions, experience layer, packaging (0.3.0) | `feat/specs-release` | `3c3de8a` | 2026-10-28 21:19 |
| 2 | viro | [#72](https://github.com/mikevocalz/viro/pull/72) SPECS release: compiler, experience layer, web preview, packaging | `feat/specs-release` | `f93d67e5` | 2026-10-28 21:31 |
| 3 | viro | [#73](https://github.com/mikevocalz/viro/pull/73) Expect the Hello root at y -0.22 in the lab LEAF scenarios | `feat/specs-release` | `26d7a1a2` | 2026-10-28 23:41 |
| 4 | viro | [#74](https://github.com/mikevocalz/viro/pull/74) Run the reference-app LEAF scenarios from the Lens setup script | `feat/specs-lens-experience` | `6ec9873d` | 2026-10-28 23:50 |
| 5 | viro | [#75](https://github.com/mikevocalz/viro/pull/75) Sync ReactVision 3.1.0 and Advanced VPS into the fork | `sync/upstream-3.1.0-v2` | `017d5f83` | 2026-10-29 00:36 |
| 6 | viro | starter generator, quickstart run, error reference fix, Storybook (this pass) | `feat/specs-starter` | see [specs-release-report.md](specs-release-report.md) §11 | |

CI on the merge commits: viro `017d5f83` passed `Specs public API`,
`Engine contract facade` and `Viro convergence`; `f93d67e5` and `26d7a1a2`
passed `Specs public API`. viro-external `3c3de8a` passed
`SPECS release gates`; its `Viro 3 / Expo 58 validation` and
`Premium spatial stack` runs failed and passed on the next `main` commit,
`963244f` ([#75](https://github.com/mikevocalz/viro-external/pull/75),
which does not touch `packages/specs` or `packages/xr-platform-contract`).

Each PR description followed the pack's template: problem, changed
behavior, API compatibility, ADRs, skills used, validation with evidence
labels, limits, migration notes. Evidence labels: `implemented`,
`portable-test-passed`, `lens-compiled`, `preview-validated`. Lens Studio
Preview is the top tier for this release. SPECS hardware is not released,
so there is no hardware tier to reach and none is listed as a gap.

## Review map

The workstream branches were merged into one another as they landed
(`feat/specs-integration-3` in viro, `feat/specs-integration` in
viro-external, and `feat/specs-release` on top of both), so the pack's
eight PRs were not opened separately. The table maps each one to the
branches whose commits it covers.

| # | Pack PR | viro | viro-external | Depends on |
| --- | --- | --- | --- | --- |
| 1 | Compiler diagnostics + schemas (WS1) | `feat/specs-production` (5): manifest v2 schema, validator, migration, catalog, coded diagnostics in both compilers | none | none |
| 2 | Replacement/patch semantics + lifetimes (WS2 + WS3) | `feat/specs-compiler` (14), `feat/specs-host` (6): shared core, static CLI in TypeScript, protocol 2 to the Lens host | `feat/specs-host` (13): `ViroSpecsSceneController`, staging/commit/retire, patch ops, ownership, host diagnostics, 100-cycle suite | 1 |
| 3 | Distribution compatibility + clean fixtures (WS6 packaging) | `feat/specs-release`: `98976ec7`, `a2c28da8`, `12acd024` (ViroSpecsScene export, react peer-only, peer ranges, clean-app check) | `feat/specs-preview` (22, sync/doctor ownership ledger and real version checks) and `feat/specs-release`: `6146d98`, `a06127a`, `33af31f` (tarball contents, publish the tarball, 0.3.0) | 2 |
| 4 | Starter + Lens setup | `feat/specs-lens-experience` (#74): `scripts/specs-lens-setup.mjs` drives Lens Studio through MCP for the Platform Lab. `feat/specs-starter`: `viro-specs init <dir>` writes an app whose scene compiles with `--strict`, syncs the Lens runtime and writes the generated host; the consumer check runs it from the packed tarball | `bootstrap-platform-lab.mjs` (also `viro-specs lab`) and `go-clad.mjs` for the Platform Lab; `init` calls the installed `sync-lens-runtime.mjs` | 3 |
| 5 | Typed actions + state (WS3b) | `feat/specs-actions` (10) | `feat/specs-actions` (21) | 2 |
| 6 | Premium component/style contract (WS4) | `feat/specs-experience` (22), `feat/specs-ux` (1) | `feat/specs-experience` (17) | 5 |
| 7 | Watch mode, assets, upgrades (WS5) | `feat/specs-preview` (20): three.js preview, `viro-specs watch`, ledger-owned atomic writes. `feat/specs-starter`: Storybook with a story per primitive on the same preview | sync ledger already in PR 3 | 2 |
| 8 | Reference apps, release gates, docs | `feat/specs-release`: API snapshot, lens-ts snapshot, generated error reference, CI jobs, docs, reference apps | `feat/specs-release`: API snapshots, consumer check, release workflow, CHANGELOG, Release.md, reference-app scene documents and LEAF scenarios | 3, 6 |

## Gates and evidence

Each PR runs its repo's CI: viro `Specs public API` (`validate`,
`consumer` and `preview` jobs), viro-external `SPECS release gates`
(`gates` and `consumer`). A change to a `.d.ts` in either API snapshot
carries the regenerated snapshot and a CHANGELOG line. The local gate run,
with exit codes, is in [specs-release-report.md](specs-release-report.md).

| # | Evidence |
| --- | --- |
| 1 | `test:specs` and `test:specs-compiler`; the schema validates every fixture |
| 2 | mock-host round trip and 100-cycle suite (`specs:test-host`); Lens Studio compile of the synced runtime (`lens-compiled`, `ws4-09-release/leaf-suite/recompile.json`); placeholder for a missing GLB in Preview (`viro_lab_missing_asset`) |
| 3 | `npm run test:specs-consumer` 13/13 with the specs tarballs; `check-packed-consumer.mjs` 9/9 |
| 4 | `viro-specs init` from the packed tarball in the consumer check; the quickstart followed literally in a clean folder with packed tarballs, every command exit 0 up to the Lens Studio step ([specs-release-report.md](specs-release-report.md) §8). The fresh-project Preview run is the one open step |
| 5 | reference flow in Preview: `viro_lab_actions_reference_flow` in `ws4-09-release/leaf-suite` |
| 6 | LEAF gallery scenarios for loading, ready, degraded and error; accessibility and design critique outputs |
| 7 | Storybook build (`npm run build-storybook` in `web-harness/specs-preview`, CI `preview` job); preview parity and experience tests; watch keeps the last valid output on a broken edit (`__test__/ViroSpecsWatch.test.ts`) |
| 8 | LEAF reference-app run in `ws4-09-release/leaf-suite-ref`, with the expected-failure scenario failing |
