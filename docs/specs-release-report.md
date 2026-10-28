# Specs production pass: final report

The release state of the SPECS 27 path as of 2026-10-28, in the shape the
engineering pack's §6 asks for. Two branches carry it: viro-external
`feat/specs-release` and viro `feat/specs-release`. The merge order and the
mapping to the pack's eight workstream PRs are in
[specs-pr-plan.md](specs-pr-plan.md).

Evidence tiers, lowest to highest: `implemented`, `portable-test-passed`,
`lens-compiled`, `preview-validated`. Lens Studio Preview is the top tier
for this release. SPECS hardware is not released, so nothing here is
`hardware-validated` and nothing is missing for lack of it.

## 1. Implemented

No PR is open yet. Branch heads are in §11.

| Repo | Branch | Commits ahead of `main` | Diff against `main` |
| --- | --- | --- | --- |
| viro-external | `feat/specs-release` | 67 | 105 files, +23682 / -469 |
| viro | `feat/specs-release` | 124 | 1099 files, +108995 / -2285 (includes the Platform Lab Lens Studio project and the Preview evidence) |

`main` is an ancestor of both heads (`git merge-base --is-ancestor`, exit 0
in both repos, 2026-10-28): viro-external `main` at `c819554`, viro `main`
at `e4e9808d`.

Commits in the final release pass, oldest first:

viro-external

| Commit | Change |
| --- | --- |
| `e6cac8d` | Merge `feat/specs-integration` (694f212): experience overlay layout, gaze scroll, drag clamp, portable ModelViewer, rounded images, ray blocking behind open panels, narrowed `VS5025`, per-frame text measure budget. No conflicts |
| `29df0c3` | Lens-core API snapshot: 18 new exports, none removed (see §3) |
| `9a934c3` | Reference-app LEAF fixes: Retry found under the error panel's `action` child; PlacementCancel waits on the placement session's label and a hidden reticle; `startRefApp` waits for the GeneratedHost scene first. README: `VS5025`, the cancel row, the Preview run |
| `4157934` | Dashboard scene document from viro (panel at y -0.22); `ViroRefAppScenes.ts` regenerated |
| `e1cece1` | High-contrast surface `#42525f` (see §3), with a test that fails on a black or near-black surface |
| `bc030ae` | `spatial-validation.yml`: SC2129 fixed, so `actionlint` exits 0 (the finding is also on `main`) |
| `b98375b` | Reference-app README names the two changes made after the Preview run |

viro

| Commit | Change |
| --- | --- |
| `5d754f71` | Merge `feat/specs-integration-3` (7d690e90): narrowed `VS5025`, gallery scenes refit to the Preview frame. No conflicts |
| `dbd01931` | Web preview re-vendors the Lens core from viro-external `e6cac8d`; three stale assertions updated (Navigation panel 0.53 x 0.60 m, list anchor 13 cm, no `VS5025` from the model viewer) |
| `ec427507` | API snapshot and error reference for the `VS5025` hint |
| `79d85935` | Platform Lab lens-ts goldens regenerated; they were stale after the integration-3 merge and `test:specs` failed on all four |
| `b15eb6e2` | Reference dashboard panel from y 0 to y -0.22; frame check added to the reference-app layout test |
| `aabd1b5c` | High-contrast surface `#42525f`, its test, goldens, docs, preview re-vendor |
| `a0733ff6` | Merge `feat/specs-lens-experience` (36e74226): Platform Lab Lens Studio project, LEAF suites, MCP setup scripts, Preview evidence. Two conflicts, resolved to the release side (see [specs-pr-plan.md](specs-pr-plan.md)) |
| `2243fe9e` | Lab synced to the release line: runtime token file, ledgers, generated host, gallery and reference-app scene modules |
| `e9a03671`, `e09230f3` | `viro_ws4_preferences` expects `#42525f` |
| `3eab4c15` | Root `tsconfig.json` excludes `docs/evidence` and `scripts/specs-lens`; `package.json` keeps the lab out of the tarball (2218 to 1994 files) |
| `49f332de` | Docs record the reference-app Preview run |

## 2. Baseline findings (pack §9)

Re-checked against viro `e4e9808d` and viro-external `c819554` in
[ADR 0001](adr/0001-specs-manifest-v2.md#baseline-re-verification). That
ADR left the viro-external rows as "not yet verified"; this table closes
them.

| # | Finding | Status | Evidence |
| --- | --- | --- | --- |
| 1 | viro `main` at `e4e9808d`, viro-external `main` at `c819554` | confirmed; neither moved | `git rev-parse fork/main`, `origin/main` |
| 1b | CI runs 40397372164, 40397389449, 40397389313 | confirmed | `gh run view`: Specs public API on `e4e9808d` success; XR platform adapters on `c819554` success; Premium spatial stack on `c819554` failure |
| 2 | specs peer `@viro-external/xr-contract ^0.2.0` while the workspace shipped 0.3.0 | fixed | `^0.2.0` at `c819554`; `^0.3.0` since `c8a6bfb` |
| 3a-d | Unsupported JSX, props and spreads vanish; duplicate IDs unchecked | fixed | `VS3001`, `VS3002`, `VS4002`, `VS2013`, `VS1007` (`dedb69a1`, `b66e2842`, `0b042d7f`) |
| 4 | Replacement cleared the scene before building the next | fixed | no scene controller at `c819554`; `ViroSpecsSceneController` with staged present, commit, retire and patch ops since `51d59d2`; 100-cycle suite in `specs:test-host` |
| 5a | Raw entry points unvalidated (viro) | fixed | `validateSpecsSceneSnapshot`, `parseSpecsManifest`, `applySpecsManifest` (`0b042d7f`, `dedb69a1`, `b66e2842`) |
| 5b | Same, Lens side | fixed | `ViroSpecsSceneDocument.ts` (added in `51d59d2`) checks fields per node kind and protocol |
| 6 | Setup copied dev modules; doctor passed with packages missing | fixed | at `c819554` the doctor only warned on a missing required package and read no versions; production and validation sync split with an ownership ledger (`0672abd`); doctor fails on missing or older packages by version (`d03f256`) |
| 7a | Registry publication | still not done, by plan | `npm view @viro-external/specs` and `@viro-external/xr-contract` return 404; publication follows the merge (`packages/specs/doc/Release.md`) |
| 7b | Physical-device validation | out of scope | SPECS hardware is not released |

## 3. API and migration changes

viro `api/specs.api.d.ts`, against the snapshot before this pass:

- `VIRO_SPECS_HIGH_CONTRAST_TOKENS.color.surface` is `"#42525f"` (was
  `"#000000"`), with a doc comment saying why.
- The `VS5025` hint and the ModelViewer doc comment (load ring at the
  model's origin, not its bounds). Code, severity and title unchanged.

viro-external `api/specs-lens-core.api.d.ts`:

- Added: `layoutViroSpecsStatePanel`, `layoutViroSpecsButtonError`,
  `layoutViroSpecsScrollButtons`, `layoutViroSpecsModelReset`,
  `viroSpecsActionButtonSize`, `estimateViroSpecsLines`,
  `VIRO_SPECS_EM_PER_CHARACTER`, `ViroSpecsLineMeasure`,
  `ViroSpecsTextBlock`, `ViroSpecsStatePanelLayout`,
  `ViroSpecsStatePanelContent`, `viroSpecsAutoRotateDegrees`,
  `VIRO_SPECS_AUTO_ROTATE_DEG_PER_SECOND`, `viroSpecsResetProgress`,
  `viroSpecsLoadingRing`, `ViroSpecsFlatGeometry`,
  `viroSpecsDiscGeometry`, `viroSpecsRoundedRectGeometry`. Nothing removed.
- The same `VS5025` hint; a doc comment on `VIRO_SPECS_LENS_HIGH_CONTRAST`.
- `api/specs.api.d.ts` and `xr-contract.api.d.ts`: unchanged.

Both versions are still unreleased (`@viro-external/specs` 0.3.0, viro
"Unreleased"), so these land in the existing CHANGELOG entries without a
new bump.

Migration for this pass: recompile scenes. A scene compiled by an earlier
viro carries `#000000` in `theme.highContrast` and keeps it until
recompiled. Everything else is in [specs-migration.md](specs-migration.md)
and viro-external `packages/specs/CHANGELOG.md` ("Migration from 0.2.0").

High-contrast decision: SPECS adds each pixel's light to the room, and
black adds none, so the old black surface showed as no surface and high
contrast relied on its white border. `#42525f` has relative luminance
0.080, about four times the default panel's 0.018. White text on it is
8.07:1, above the 7:1 of WCAG 1.4.6 that A7 adopts; focus `#ffd25e` is
5.62:1 and the error border 3.52:1. The other surface tokens keep their
defaults, so a button's raised fill is darker than the high-contrast panel
and its doubled white border marks the edge. Reasoning:
[ux/spatial-tokens.md](ux/spatial-tokens.md#high-contrast-variant).

## 4. Consumer artifacts

Packed 2026-10-28 from the heads in §11:

| Tarball | SHA-256 |
| --- | --- |
| `viro-external-xr-contract-0.3.0.tgz` | `ed18283a2019bda2698d4db5b5b9f7ba9b4609fe3ea68def340730d12f39c892` |
| `viro-external-specs-0.3.0.tgz` | `221b2b6a886804ba074604315a6e8db45c4b806d8ee432d2bb5f0641dcf6d741` |
| `reactvision-react-viro-3.0.3-moyo.1.tgz` | `cd7a9027a44678317b1f59caa6c4a91f7f4690cb725061afc0172c4cdef605ef` |

Build them:

```bash
# viro-external checkout
npx -y pnpm@12.8.1 --filter @viro-external/xr-contract pack --pack-destination <dir>/specs
npx -y pnpm@12.8.1 --filter @viro-external/specs pack --pack-destination <dir>/specs
node packages/specs/scripts/check-packed-consumer.mjs --tarballs <dir>/specs

# viro checkout
npm pack --pack-destination <dir>/viro
node scripts/check-specs-consumer.cjs --viro-tarball <dir>/viro/reactvision-react-viro-3.0.3-moyo.1.tgz --specs-tarballs <dir>/specs
```

Install into an app the way the consumer checks do:

```bash
npm install --strict-peer-deps \
  <dir>/viro/reactvision-react-viro-3.0.3-moyo.1.tgz \
  <dir>/specs/viro-external-specs-0.3.0.tgz \
  <dir>/specs/viro-external-xr-contract-0.3.0.tgz \
  react@19.3.1 react-native@~0.88.0 @types/react@~19.3.0
```

The viro check resolved `react-native` to 0.88.1.

Results: viro-external packed consumer check 9/9, viro consumer check
12/12 (both exit 0). The viro tarball carries none of the Lens lab files.

## 5. Gates, environment, results

Run on 2026-10-28 on macOS (Darwin 27), Node 26.12.0, from clean commits at the
heads in §11. Each line is its own command and exit code.

viro

| Gate | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | |
| `npx tsc --noEmit --strict` | 0 | |
| `npm run build:specs-cli` | 0 | |
| `npm run test:specs` | 0 | 345 passed, 6 skipped |
| `npm run test:specs-compiler` | 0 | 36 check groups |
| `npm run typecheck:specs-examples` | 0 | |
| `npm run test:specs-api` | 0 | snapshot matches |
| `node scripts/specs-error-reference.cjs --check` | 0 | 94 codes |
| web preview `npm run typecheck` | 0 | |
| web preview `npm test` | 0 | 30 passed |
| web preview vendor check `--from ../ve-release` | 0 | matches viro-external `e1cece1` |
| `actionlint` | 0 | |
| VS5xxx catalog, both repos, field by field | 0 | 25 codes, 0 differences in severity, title or hint |

viro-external (pnpm 12.8.1)

| Gate | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | |
| typecheck, `@viro-external/xr-contract` and `@viro-external/specs` | 0, 0 | |
| build, both packages | 0, 0 | |
| `specs:validate-lens` | 0 | |
| `specs:test-lens`, `specs:test-runner`, `specs:test-presentation` | 0, 0, 0 | |
| `specs:test-host` | 0 | 104 passed |
| `specs:test-reference-apps` | 0 | 16 passed; scene module current |
| `node --test scripts/viro-bundle.test.mjs` | 0 | |
| `node --test scripts/*.test.mjs` (packages/specs) | 0 | |
| `node --test test/ci-boundary.test.mjs` | 0 | 14 passed |
| `node scripts/ci/api-snapshot.mjs` | 0 | three snapshots match |
| `node scripts/ci/check-manifests.mjs` | 0 | |
| `node scripts/check-docs.mjs` | 0 | |
| `actionlint` | 0 | |

Scene documents are byte-identical across the repos (`cmp`): the three
reference apps and the four gallery scenes.

## 6. Preview evidence

`preview-validated`, Lens Studio 5.24 SPECS 27 Interactive Preview, Sunlit
Room, default camera pose:

- `docs/evidence/specs/lens/ws4-08-polish2/leaf-suite/`: 39 LEAF
  scenarios, all as expected. 37 passed; `viro_lab_deliberate_failure`
  and `viro_ref_expected_failure` failed as required. All ten reference-app
  scenarios are in this run.
- `docs/evidence/specs/lens/ws4-08-polish2/*.png` and `captures.json`:
  each gallery scene and lifecycle state, Preview and front captures, read
  by eye (titles in frame, rounded card images, the model load ring, the
  error panel over the content).
- Earlier runs (`run-09-leaf`, `ws3-*`, `ws3b-*`, `ws4-01` to `ws4-07`)
  trace the host, actions and experience work.

The browser screenshots in `docs/evidence/specs/web-preview/` are
`portable-test-passed`, not Preview evidence.

## 7. Device evidence

None. SPECS hardware is not released.

## 8. Not yet verified, and the steps that close it

| Item | Tier now | Steps |
| --- | --- | --- |
| The dashboard at y -0.22 and the `#42525f` high-contrast surface in Preview | `portable-test-passed` | Open `examples/specs-platform-lab/lens` in Lens Studio 5.24, then `node scripts/specs-lens-setup.mjs --steps recompile,device,preview,leaf`. Expect 37 passed and the two deliberate failures; capture `viro_ws4_preferences` and `viro_ref_dashboard_ready` |
| Interaction Kit 4.0.0 line | `portable-test-passed` | Install `InteractionKit.lspkg` 4.0.0 in a copy of the lab, `specs:sync --interaction-kit 4`, run the LEAF suite |
| A fresh Lens project reaching Preview with only the documented commands (pack PR 4) | not run | Create an empty SPECS project, follow [specs-quickstart.md](specs-quickstart.md) exactly, record each manual step that was needed |
| CI on the two release PRs | not run | Open the PRs in the order in [specs-pr-plan.md](specs-pr-plan.md) |
| Outside-developer beta (WS7) | not run | Three developers following the docs; no participants yet |

## 9. Known limitations

- `VS5025` stays in the catalog with an empty feature list on the current
  host; it is append-only, so it cannot be removed.
- In high contrast, `surfaceRaised`, `surfacePressed` and the state
  surfaces keep their default values, darker than the `#42525f` panel.
- `viro-specs-compile` has no starter generator; a new app wires two
  components by hand ([specs-quickstart.md](specs-quickstart.md)).
- `scripts/specs-lens-setup.mjs` targets the Platform Lab and needs a
  running Lens Studio with MCP enabled.
- The reference-app scenario `ViroRefPlacementCancelScenario`'s doc comment
  still says the reticle reads "Placement cancelled"; the check itself
  reads the placement session. It is left as is so the file stays
  byte-identical to the lab copy.
- `specs-error-reference.cjs --check` reads `bin/specs-build`, so it
  passes against a stale build. Run `build:specs-cli` first, as CI does.
- The lab's committed tree has no `Packages/`; `specs:doctor` on a fresh
  checkout reports the Lens packages missing until the setup script's
  `packages` step installs them.

## 10. Skills and subagents used in this pass

Skills loaded and applied: `api-design` (snapshot review, the classification
of each API change), `no-ai-slop` (commits, docs, this report),
`verification-before-completion` (every gate run fresh with its own exit
code), `systematic-debugging` (the three preview test failures, the
`tsc` failure after the lab merge), `threejs-fundamentals` (before
touching the three.js preview), `ls-clad:specs-build-ui` (additive display
rule: black renders as transparent; the high-contrast decision),
`ls-clad:specs-leaf-write-scenarios` and `ls-clad:lens-api` (the
reference-app scenario fixes).

No subagents ran in this pass. Lens Studio was not opened; nothing here
was run in Preview.

## 11. Branch heads

Both branches are pushed. The viro head is the commit that last edits
this file; the gates in §5 ran on its parent tree plus this document and
the PR plan, which no gate reads except the docs test.

- viro-external `feat/specs-release` at `b98375b`
- viro `feat/specs-release`: `git log -1 fork/feat/specs-release`

## 12. Next milestone

Close the first row of §8 (re-run the 39 scenarios after the dashboard and
token changes), open and merge the viro-external PR, then the viro PR,
publish `@viro-external/xr-contract` and `@viro-external/specs` 0.3.0 per
`packages/specs/doc/Release.md`, and start the outside-developer beta.
