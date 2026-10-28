# Specs production pass: PR plan

The eight pull requests from the engineering pack (§9), in merge order,
mapped to the branches that hold the work. Nothing here is opened yet.
Base branches: viro `mikevocalz/viro` `main`, viro-external
`mikevocalz/viro-external` `main` (viro-external has no `develop`; viro
does, and CI runs on both).

Each PR description follows the pack's template: problem, changed
behavior, API compatibility, ADRs, skills used, validation with evidence
labels, limits, migration notes, reviewer sign-off. Evidence labels:
`implemented`, `portable-test-passed`, `lens-compiled`,
`preview-validated`. Lens Studio Preview is the final tier for this
release.

The workstream branches were merged into one another as they landed
(`feat/specs-integration-3` in viro, `feat/specs-integration` in
viro-external, and `feat/specs-release` on top of both). Opening the
eight PRs therefore means stacking: each PR's base is the previous PR's
branch until that one merges, and its diff is computed against it.

| # | PR | viro branch (commits ahead of main) | viro-external branch | Depends on |
| --- | --- | --- | --- | --- |
| 1 | Compiler diagnostics + schemas (WS1) | `feat/specs-production` (5): manifest v2 schema, validator, migration, catalog, coded diagnostics in both compilers | none | none |
| 2 | Replacement/patch semantics + lifetimes (WS2 + WS3) | `feat/specs-compiler` (14), `feat/specs-host` (6): shared core, static CLI in TypeScript, protocol 2 to the Lens host | `feat/specs-host` (13): `ViroSpecsSceneController`, staging/commit/retire, patch ops, ownership, host diagnostics, 100-cycle suite | 1 |
| 3 | Distribution compatibility + clean fixtures (WS6 packaging) | `feat/specs-release`: `98976ec7`, `a2c28da8`, `12acd024` (ViroSpecsScene export, react peer-only, peer ranges, clean-app check) | `feat/specs-preview` (22, sync/doctor ownership ledger and real version checks) and `feat/specs-release`: `6146d98`, `a06127a`, `33af31f` (tarball contents, publish the tarball, 0.3.0) | 2 |
| 4 | Starter + Lens setup | not started: no starter generator exists. Today's path is `viro-specs sync` + `doctor` + hand wiring of two components ([specs-quickstart.md](specs-quickstart.md)) | `bootstrap-platform-lab.mjs`, `go-clad.mjs` exist for the Platform Lab only | 3 |
| 5 | Typed actions + state (WS3b) | `feat/specs-actions` (10) | `feat/specs-actions` (21) | 2 |
| 6 | Premium component/style contract (WS4) | `feat/specs-experience` (22), `feat/specs-ux` (1) | `feat/specs-experience` (17) | 5 |
| 7 | Watch mode, assets, upgrades (WS5) | `feat/specs-preview` (20), merged into `feat/specs-release` at `70da0c87`: three.js preview, `viro-specs watch`, ledger-owned atomic writes. On the release line the preview vendors the release Lens core and draws scroll groups, the experience layer and the reference apps | sync ledger already in PR 3 | 2 |
| 8 | Reference apps, release gates, docs | `feat/specs-release`: API snapshot, lens-ts snapshot, generated error reference, CI jobs, docs, reference apps | `feat/specs-release`: API snapshots, consumer check, release workflow, CHANGELOG, Release.md, reference-app scene documents and LEAF scenarios | 3, 6 |

## Per-PR gates

Every PR runs the same CI as its branch: viro `Specs public API`
(`validate` and `consumer` jobs), viro-external `SPECS release gates`
(`gates` and `consumer`). A PR that changes a `.d.ts` in either API
snapshot carries the regenerated snapshot and a CHANGELOG line.

| # | Extra evidence the PR must attach |
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

1. Merge `feat/specs-integration-3` (viro) and `feat/specs-integration`
   (viro-external) into `feat/specs-release` again, so PR 8 carries the
   latest host fixes.
2. PR 7 lands before PR 8. `feat/specs-release` already contains it, and
   the compatibility matrix, quickstart and CHANGELOG describe the web
   preview and `viro-specs watch`. The preview's tier is
   `portable-test-passed`; its screenshots are browser captures, not
   Preview evidence.
3. Merge the viro-external release PR first. The viro `consumer` job packs
   `@viro-external/specs` from viro-external `main` (a public repo, so no
   token), and viro's `^0.3.0` peer needs the 0.3.0 that PR ships.
