# Specs production pass: final report

The release state of the SPECS 27 path as of 2026-10-29, in the shape the
engineering pack's §6 asks for. The release PRs are merged into `main` in
both repos; viro `feat/specs-starter` adds the starter generator, the
quickstart run and Storybook on top. The merge order and the mapping to
the pack's eight workstream PRs are in [specs-pr-plan.md](specs-pr-plan.md).

Evidence tiers, lowest to highest: `implemented`, `portable-test-passed`,
`lens-compiled`, `preview-validated`. Lens Studio Preview is the top tier
for this release. SPECS hardware is not released, so nothing here is
`hardware-validated` and nothing is missing for lack of it.

## 1. Implemented

The release is merged. PR links, merge commits and CI are in
[specs-pr-plan.md](specs-pr-plan.md).

| Repo | PR | Merge commit |
| --- | --- | --- |
| viro-external | #74 `feat/specs-release` | `3c3de8a` |
| viro | #72 `feat/specs-release` | `f93d67e5` |
| viro | #73 `feat/specs-release` (lab scenarios expect the Hello root at y -0.22) | `26d7a1a2` |
| viro | #74 `feat/specs-lens-experience` (reference-app LEAF scenarios from the setup script) | `6ec9873d` |
| viro | #75 `sync/upstream-3.1.0-v2` (ReactVision 3.1.0) | `017d5f83` |

This pass, on viro `feat/specs-starter` from `017d5f83`:

| Commit | Change |
| --- | --- |
| `9519f665` | `viro-specs init <dir>`: starter app, Lens runtime sync, generated host; init in the consumer check (13 checks); quickstart starts from init |
| `0dfcde13` | `specs-error-reference.cjs` reads the catalog from source, with a stale-build test |
| `c06e22be` | CHANGELOG |
| `9ffb111f` | Storybook for the web preview: 32 stories rendered through the preview's stage and experience layer, CI build and captures |
| see §11 | This report and the PR plan |

Commits of the earlier release pass are listed in the merged PRs.

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

`feat/specs-starter` changes no exported declaration: `test:specs-api`
matches `api/specs.api.d.ts`. CLI changes: `viro-specs init <dir>` is new;
`viro-specs init --project <path>` still runs the Platform Lab bootstrap
and the same bootstrap is also `viro-specs lab`; `npm run docs:specs-errors`
no longer builds the CLI first. Nothing to migrate.

The release PRs changed viro `api/specs.api.d.ts` as follows:

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

Packed 2026-10-29: the viro tarball from `feat/specs-starter` at
`c06e22be`, the specs tarballs from a fresh worktree of viro-external
`origin/main` at `3c3de8a` (`packages/specs` and `packages/xr-platform-contract`
are unchanged at the current `main`, `963244f`).

| Tarball | SHA-256 |
| --- | --- |
| `viro-external-xr-contract-0.3.0.tgz` | `ed18283a2019bda2698d4db5b5b9f7ba9b4609fe3ea68def340730d12f39c892` |
| `viro-external-specs-0.3.0.tgz` | `c74744a2178864ff7db69c94d16914b50ae7d8f376f792e2d4c71e2f0dce4a5b` |
| `reactvision-react-viro-3.1.0-moyo.0.tgz` | `f889879976a34976737ffb8e30aa86e66c4870fc245df048d609197d1b984c1b` |

Build them:

```bash
# viro-external checkout
npx -y pnpm@12.8.1 install --frozen-lockfile --filter "@viro-external/specs..."
npx -y pnpm@12.8.1 --filter @viro-external/xr-contract pack --pack-destination <dir>/specs
npx -y pnpm@12.8.1 --filter @viro-external/specs pack --pack-destination <dir>/specs
node packages/specs/scripts/check-packed-consumer.mjs --tarballs <dir>/specs

# viro checkout
npm pack --pack-destination <dir>/viro
node scripts/check-specs-consumer.cjs --viro-tarball <dir>/viro/reactvision-react-viro-3.1.0-moyo.0.tgz --specs-tarballs <dir>/specs
```

Start an app from them the way [specs-quickstart.md](specs-quickstart.md)
says:

```bash
npx --package <dir>/viro/reactvision-react-viro-3.1.0-moyo.0.tgz viro-specs init my-specs-app --no-install
cd my-specs-app
npm install <dir>/viro/reactvision-react-viro-3.1.0-moyo.0.tgz \
  <dir>/specs/viro-external-specs-0.3.0.tgz <dir>/specs/viro-external-xr-contract-0.3.0.tgz
```

Results: viro-external packed consumer check 9/9, viro consumer check
13/13 (both exit 0). The 13th check runs the installed `viro-specs init`,
finds the synced runtime next to the generated host with no React import
in either, type-checks the starter scene against the packed declarations,
and compiles it with `--strict` in all three formats to the same host init
wrote.

## 5. Gates, environment, results

Run on 2026-10-29 on macOS (Darwin 27), Node 26.12.0, on
`feat/specs-starter`. Each line is its own command and exit code.

viro

| Gate | Exit | Result |
| --- | --- | --- |
| `npm ci --ignore-scripts --legacy-peer-deps=false` | 0 | |
| `npx tsc --noEmit`, `--strict` | 0, 0 | |
| `tsc --noEmit -p` `tsconfig.plugins.json`, `tsconfig.specs-cli.json`, `tsconfig.specs-examples.json`, each also `--strict` | 0 each | |
| `npm run build:specs-cli` | 0 | |
| `npm test` | 0 | 1160 passed |
| `npm run test:specs` | 0 | 356 passed, 6 skipped (adds `ViroSpecsInit`, 9 tests, and 2 stale-build tests in `ViroSpecsReleaseDocs`) |
| `npm run test:specs-compiler` | 0 | 36 check groups |
| `npm run typecheck:specs-examples` | 0 | |
| `npm run test:specs-api` | 0 | snapshot matches, no change |
| `node scripts/specs-error-reference.cjs --check` | 0 | 94 codes, read from source |
| web preview `npm ci --dry-run --legacy-peer-deps=false` | 0 | |
| web preview `npm run typecheck` | 0 | |
| web preview `npm test` | 0 | 30 passed |
| web preview `npm run vendor:check` | 0 | |
| web preview `npm run build-storybook` (Storybook 10.6.5, html-vite) | 0 | 32 stories |
| web preview `node scripts/storybook-screenshots.mjs` | 0 | 25 captures, each at its expected lifecycle |
| `npm run test:specs-consumer` (packed tarballs) | 0 | 13/13 |
| `actionlint .github/workflows/*.yml` | 0 | |

viro-external, fresh worktree at `3c3de8a` (pnpm 12.8.1)

| Gate | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile --filter "@viro-external/specs..."` | 0 | |
| `pnpm --filter @viro-external/xr-contract pack` | 0 | |
| `pnpm --filter @viro-external/specs pack` (prepack: build, `specs:validate-lens`, `specs:test-lens`, `specs:test-runner`, `specs:test-presentation`, `specs:test-host`, bundle test) | 0 | |
| `check-packed-consumer.mjs` | 0 | 9/9 |

## 6. Preview evidence

`preview-validated`, Lens Studio 5.24 SPECS 27 Interactive Preview, Sunlit
Room, default camera pose, `docs/evidence/specs/lens/ws4-09-release/`:

- `leaf-suite/`: the Platform Lab and WS4 gallery, 29 scenarios after a
  `lens-compiled` recompile (`recompile.json`). 28 passed;
  `viro_lab_deliberate_failure` failed as required.
- `leaf-suite-ref/`: the reference apps, 10 scenarios. 9 passed;
  `viro_ref_expected_failure` failed as required.
- `captures.json` and the PNGs: `viro_ws4_preferences` (loading and ready,
  the `#42525f` high-contrast panel) and `viro_ref_dashboard_ready` (the
  dashboard at y -0.22), Preview and front captures.

This closes the earlier gap: the dashboard move and the high-contrast
surface are now in a Preview run. Earlier runs (`run-09-leaf`, `ws3-*`,
`ws3b-*`, `ws4-01` to `ws4-08-polish2`) trace the host, actions and
experience work.

The browser screenshots in `docs/evidence/specs/web-preview/` and the
Storybook captures are `portable-test-passed`, not Preview evidence.

## 7. Device evidence

None. SPECS hardware is not released, and Preview is the final tier for
this release.

## 8. Fresh-project quickstart run (pack PR 4)

[specs-quickstart.md](specs-quickstart.md) followed literally in an empty
folder with the tarballs in §4, without Lens Studio:

| Step | Command | Exit |
| --- | --- | --- |
| 1 | `npx --package <viro.tgz> viro-specs init my-specs-app --no-install` | 0 |
| 1 | `npm install <viro.tgz> <specs.tgz> <xr-contract.tgz>` | 0 |
| 1 | `npm run lens:sync` | 0 |
| 2 | `npm run specs:check` | 0, no diagnostics |
| 2 | `npm run typecheck` | 0 |
| 2 | `npm run specs:preview` | 0 |
| 3 | `npm run lens:host` | 0 (host unchanged from init) |
| 3 | `npm run lens:doctor` | 1, as documented: `lens/` is not a saved Lens Studio project yet |

Manual repairs found and fixed:

- The old quickstart started from "an existing React Native app". In an
  empty folder that meant writing a package.json with `react` and
  `react-native` and copying the scene out of the doc before step 1. `init`
  now writes both, and the quickstart starts from it.
- `viro-specs doctor` on the `lens/` folder failed with "Expected exactly
  one .esproj file". `npm run lens:doctor` now says the folder is not a
  Lens Studio project yet and what to do.
- The Lens host had to be compiled by hand with a long `--out` path into the
  Lens project. `init` writes it, and `npm run lens:host` / `lens:watch`
  take the path from `package.json`.

Open: the Lens Studio half. Steps for the Preview run, in Lens Studio 5.24:

1. Create a new Spectacles project and save it, for example as
   `my-specs-app/LensProject`.
2. Install from the Asset Library: Spectacles Interaction Kit 2.0.0,
   Spectacles UI Kit 2.0.0, SurfacePlacement 2.0.0, VolumetricLine 2.0.0,
   SpecsNavigationKit 2.0.0.
3. In `my-specs-app/package.json` set `viroSpecs.lensProject` to
   `LensProject`, then run `npm run lens:doctor` (expect exit 0),
   `npm run lens:sync` and `npm run lens:host`.
4. Wire the host as in quickstart step 4: `ViroSpecsAssetRegistry` and
   `ViroSpecsSceneControllerHost` on one SceneObject, the controller's
   `assetRegistryObject` set to the registry; `ViroGeneratedSceneHost` on
   another, `sceneHostObject` set to the first.
5. Press Preview (SPECS 27 Interactive Preview). Expect the "Hello, Specs"
   panel with the body text and a Next button, no `VS5xxx` errors in the
   Lens log, and record any step beyond these that was needed.

Step 4 is Inspector work; `scripts/specs-lens-setup.mjs` does it through
the Lens Studio MCP server for the Platform Lab only.

## 9. Known limitations

- `VS5025` stays in the catalog with an empty feature list on the current
  host; it is append-only, so it cannot be removed.
- In high contrast, `surfaceRaised`, `surfacePressed` and the state
  surfaces keep their default values, darker than the `#42525f` panel.
- The starter's Lens host is wired by hand in the Inspector (§8 step 4).
  `scripts/specs-lens-setup.mjs` automates it for the Platform Lab and is
  not in the npm package.
- `init` does not create a Lens Studio project; `lens/` holds only
  `Assets/ViroSpecs/` until `viroSpecs.lensProject` points at a saved one.
- Installing the react-viro tarball prints npm's `install-scripts` notice
  naming its `prepare` script. The quickstart run in §8 left it unapproved
  and every command after the install exited as listed.
- `specs-error-reference.cjs` needs Node 22.18 or newer (type stripping).
- The web preview draws the loading, error and rejected-scene panel body
  text on one unwrapped line, so a long message runs past the panel
  (visible in the ModelViewer Load Error story). The Storybook stories
  show it as the preview draws it; fixing it is a change to the preview's
  Lens-parity drawing in `experience.ts`, checked against the Lens host.
- Storybook does not show PanelButton borders or focus rings, the placement
  reticle, gaze controls, or the ModelViewer load ring, Reset button and
  autoRotate, because the preview does not draw them
  ([specs-preview.md](specs-preview.md)).
- The reference-app scenario `ViroRefPlacementCancelScenario`'s doc comment
  still says the reticle reads "Placement cancelled"; the check itself
  reads the placement session. It is left as is so the file stays
  byte-identical to the lab copy.
- The lab's committed tree has no `Packages/`; `specs:doctor` on a fresh
  checkout reports the Lens packages missing until the setup script's
  `packages` step installs them.
- `@viro-external/specs` and `@viro-external/xr-contract` are not on npm,
  and the 3.1.0-moyo line of react-viro is not either (npm has upstream
  3.0.3); consumers install the tarballs.

## 10. Skills and subagents used in this pass

Skills loaded and applied: `api-design` (the `init` command shape and its
options), `systematic-debugging` (the stale error-reference root cause),
`verification-before-completion` (every gate run fresh with its exit code;
red-green on the stale-build test), `engineering:testing-strategy` (init
tests and the consumer step), `no-ai-slop` (docs, commits, this report),
`frontend-design:frontend-design` and `ux-heuristics-review` (Storybook),
`threejs-fundamentals` (the preview Storybook mounts), `expo-app-design`
(the starter's Expo entry), `ls-clad:lens-api` (the Lens host the starter
writes).

Subagents: one general-purpose agent built the Storybook in
`web-harness/specs-preview` and its CI step; its report was checked
against the build and the screenshots before it went in. Lens Studio was
not opened in this pass.

## 11. Branch heads

- viro-external `main` at `963244f` (release merged at `3c3de8a`)
- viro `main` at `017d5f83`
- viro `feat/specs-starter`: `git log -1 fork/feat/specs-starter`; its
  PR is linked from [specs-pr-plan.md](specs-pr-plan.md)

## 12. Next milestone

Run §8's Lens Studio steps on a fresh project and record the result,
publish `@viro-external/xr-contract` and `@viro-external/specs` 0.3.0 per
`packages/specs/doc/Release.md` and react-viro 3.1.0-moyo, then start the
outside-developer beta (three developers following the docs; no
participants yet).
