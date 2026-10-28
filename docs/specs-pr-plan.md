# Specs production pass: PR plan

Two pull requests carry the release, in this order:

1. **viro-external `feat/specs-release` → `main`.** Ships
   `@viro-external/xr-contract` 0.3.0 and `@viro-external/specs` 0.3.0.
   Merge it first: viro's `consumer` job packs `@viro-external/specs` from
   viro-external `main` (a public repo, so no token), and viro's `^0.3.0`
   peer needs the 0.3.0 this PR ships.
2. **viro `feat/specs-release` → `main`.** The Specs surface of
   `@reactvision/react-viro`, the web preview, the reference apps and the
   Platform Lab Lens Studio project.

Nothing is opened yet. viro-external has no `develop`; viro does, and CI
runs on both.

The Lens lab branch, viro `feat/specs-lens-experience`, holds the Platform
Lab Lens Studio project and the Preview evidence. It is already merged
into viro `feat/specs-release` (`a0733ff6`), with every viro gate at exit
0 afterwards, so it needs no PR of its own. Two conflicts, both resolved
to the release side: the lab branch forked from `main` and fixed the
generated host's teardown in the old single-file compiler, and the release
line already carries the same fix in `src/specs-cli/lensTs.ts`. After the
merge the root `tsconfig.json` excludes `docs/evidence` and
`scripts/specs-lens` (Lens-runtime TypeScript), and `package.json` keeps
the lab out of the npm tarball.

Each PR description follows the pack's template: problem, changed
behavior, API compatibility, ADRs, skills used, validation with evidence
labels, limits, migration notes, reviewer sign-off. Evidence labels:
`implemented`, `portable-test-passed`, `lens-compiled`,
`preview-validated`. Lens Studio Preview is the top tier for this
release; SPECS hardware is not released, so there is no hardware tier to
reach.

## Review map

The workstream branches were merged into one another as they landed
(`feat/specs-integration-3` in viro, `feat/specs-integration` in
viro-external, and `feat/specs-release` on top of both), so the eight
pack PRs are not opened separately. The table maps each one to the
branches whose commits it covers, for reviewers reading the two release
PRs by workstream.

| # | Pack PR | viro branch (commits ahead of main) | viro-external branch | Depends on |
| --- | --- | --- | --- | --- |
| 1 | Compiler diagnostics + schemas (WS1) | `feat/specs-production` (5): manifest v2 schema, validator, migration, catalog, coded diagnostics in both compilers | none | none |
| 2 | Replacement/patch semantics + lifetimes (WS2 + WS3) | `feat/specs-compiler` (14), `feat/specs-host` (6): shared core, static CLI in TypeScript, protocol 2 to the Lens host | `feat/specs-host` (13): `ViroSpecsSceneController`, staging/commit/retire, patch ops, ownership, host diagnostics, 100-cycle suite | 1 |
| 3 | Distribution compatibility + clean fixtures (WS6 packaging) | `feat/specs-release`: `98976ec7`, `a2c28da8`, `12acd024` (ViroSpecsScene export, react peer-only, peer ranges, clean-app check) | `feat/specs-preview` (22, sync/doctor ownership ledger and real version checks) and `feat/specs-release`: `6146d98`, `a06127a`, `33af31f` (tarball contents, publish the tarball, 0.3.0) | 2 |
| 4 | Starter + Lens setup | `feat/specs-lens-experience`, merged at `a0733ff6`: `scripts/specs-lens-setup.mjs` drives Lens Studio through MCP for the Platform Lab. No starter generator for a new app; the documented path is `viro-specs sync` + `doctor` + wiring two components ([specs-quickstart.md](specs-quickstart.md)) | `bootstrap-platform-lab.mjs`, `go-clad.mjs` exist for the Platform Lab only | 3 |
| 5 | Typed actions + state (WS3b) | `feat/specs-actions` (10) | `feat/specs-actions` (21) | 2 |
| 6 | Premium component/style contract (WS4) | `feat/specs-experience` (22), `feat/specs-ux` (1) | `feat/specs-experience` (17) | 5 |
| 7 | Watch mode, assets, upgrades (WS5) | `feat/specs-preview` (20), merged into `feat/specs-release` at `70da0c87`: three.js preview, `viro-specs watch`, ledger-owned atomic writes. On the release line the preview vendors the release Lens core and draws scroll groups, the experience layer and the reference apps | sync ledger already in PR 3 | 2 |
| 8 | Reference apps, release gates, docs | `feat/specs-release`: API snapshot, lens-ts snapshot, generated error reference, CI jobs, docs, reference apps | `feat/specs-release`: API snapshots, consumer check, release workflow, CHANGELOG, Release.md, reference-app scene documents and LEAF scenarios | 3, 6 |

## Gates and evidence

Each release PR runs its repo's CI: viro `Specs public API` (`validate`
and `consumer` jobs), viro-external `SPECS release gates` (`gates` and
`consumer`). A change to a `.d.ts` in either API snapshot carries the
regenerated snapshot and a CHANGELOG line. The local gate run, with exit
codes, is in [specs-release-report.md](specs-release-report.md).

| # | Evidence for this workstream, attached to the release PR |
| --- | --- |
| 1 | `test:specs` and `test:specs-compiler` output; schema validates every fixture |
| 2 | mock-host round trip and 100-cycle suite (`specs:test-host`); Lens Studio compile of the synced runtime (lens-compiled); placeholder for a missing GLB in Preview |
| 3 | `npm run test:specs-consumer` 12/12 with the specs tarballs; `pnpm specs:test-consumer` 9/9 |
| 4 | a fresh Lens project reaching Preview with only the documented commands, no Inspector repair |
| 5 | reference flow in Preview: select card, details, change setting, back to list with scroll kept |
| 6 | LEAF gallery scenarios for loading, ready, degraded and error; accessibility and design critique outputs |
| 7 | preview screenshots per primitive and per release scene (`docs/evidence/specs/web-preview/`); preview parity and experience tests (`npm test` in `web-harness/specs-preview`); watch mode keeps the last valid output on a broken edit (`__test__/ViroSpecsWatch.test.ts`) |
| 8 | LEAF reference-app run ([specs-examples.md](specs-examples.md)), with the expected-failure scenario failing |

## Before opening

1. Re-run `git merge-base --is-ancestor origin/main HEAD` (viro-external)
   and `git merge-base --is-ancestor fork/main HEAD` (viro). Both held on
   2026-10-28; if `main` moved, merge it in and re-run the gates.
2. Open the viro-external PR first and merge it. Then open the viro PR;
   its `consumer` job needs viro-external `main` at 0.3.0.
3. Run the ten reference-app and 29 lab LEAF scenarios in Preview again.
   The last run (`docs/evidence/specs/lens/ws4-08-polish2/leaf-suite/`)
   predates the dashboard panel move to y -0.22 and the high-contrast
   surface change to `#42525f`; see
   [specs-release-report.md](specs-release-report.md).
