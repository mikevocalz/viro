# Specs compatibility matrix

Which versions work together for a Viro app that also targets Snap
Spectacles (SPECS 27). The Lens-side detail (package minimums, the
Interaction Kit 4.0.0 seam) lives in viro-external,
`packages/specs/doc/Compatibility.md`; this page is the whole stack.

Each row says how it is checked. The tiers, lowest to highest:
`declared` (a range in a manifest, nothing run), `portable-test-passed`
(Jest or `node --test`), `consumer-checked` (packed tarballs installed into
a clean app by `npm run test:specs-consumer`), `lens-compiled` (Lens Studio
compiled the synced runtime), `preview-validated` (LEAF scenarios passed
in Lens Studio Preview). Lens Studio Preview is the final tier for this
release.

## Authoring side (React Native app)

| Component | Supported range | Latest on npm, 2026-10-28 | Checked by | Tier |
| --- | --- | --- | --- | --- |
| `@reactvision/react-viro` | this repo, 3.0.3-moyo.1 or later | 3.0.3 (upstream; the moyo line is not on npm) | `test:specs`, `test:specs-api`, `test:specs-consumer` | consumer-checked |
| `react` | peer `^19.3.0` | 19.3.1 | consumer install with 19.3.1 | consumer-checked |
| `react-native` | peer `>=0.88.0 <0.89.0` | 0.88.1 | consumer install with 0.88.1 | consumer-checked |
| `expo` (optional) | peer `>=58.0.0 <59.0.0` | 58.0.21 | repo devDependency `~58.0.19` | declared |
| `react-native-web` (optional) | peer `^0.21.0` | 0.21.4 | not installed by the Specs checks | declared |
| `@reactvision/react-native-visionos` (optional) | peer `>=0.86.0 <0.89.0` | 0.86.4 | not part of the Specs path | declared |
| `@types/react` | `~19.3.0` (app devDependency) | 19.3.0 | consumer type-check | consumer-checked |
| TypeScript in the app | any version that reads the packed `.d.ts`; checked with 7.0.2 | 7.0.2 | consumer `tsc` (strict) | consumer-checked |
| Node.js for `viro-specs` / `viro-specs-compile` | 22.13 or later (`@viro-external/specs` engines); CI uses 24 | | CI | portable-test-passed |

React is a peer only. Through 3.0.3-moyo.1 it was also a dependency
(`>=19.0.0`), which could install a second React under the package.

## Bridge packages

| Component | Supported range | Notes | Tier |
| --- | --- | --- | --- |
| `@viro-external/specs` | peer `^0.3.0` (optional peer of react-viro) | Required for `viro-specs sync/doctor/test/go`. The `lens-ts` host needs `ViroSpecsSceneControllerHost`, added in 0.3.0. 0.2.x is rejected by the consumer check's `npm ls` | consumer-checked |
| `@viro-external/xr-contract` | `^0.3.0` (peer of specs) | Pulled in by specs; apps do not import it for the JSX path | consumer-checked |
| Manifest | version 2; version 1 accepted with `VS1002` and migrated | `schemas/viro-specs-manifest.v2.json` | portable-test-passed |
| Scene protocol | 2 (`ViroSpecsSceneDocument`); protocol 1 snapshots still apply in the Lens host | `lens-runtime.json` `sceneProtocols: [1, 2]` | portable-test-passed |

## Lens side

| Component | Supported | Validated | Tier |
| --- | --- | --- | --- |
| Lens Studio | 5.22.0 or later (`specs:doctor` reads `studioVersion`) | 5.24.0.26090816 | preview-validated for the Platform Lab; reference apps pending the run in [specs-examples.md](specs-examples.md) |
| Target | SPECS 27, project `targetPlatform: Spectacles` | SPECS 27 Interactive Preview, Sunlit Room | preview-validated |
| Interaction Kit, 2.x line | `SpectaclesInteractionKit.lspkg` 2.0.0 or later | 2.0.0 | preview-validated |
| Interaction Kit, 4.0.0 line | `InteractionKit.lspkg` 4.0.0 or later, through the one import seam `lens/ViroSpecsInteractionKit.ts`; `specs:sync` rewrites the seam when it finds the 4.0.0 package, or force it with `--interaction-kit 4` | none yet | portable-test-passed (sync/doctor tests with real package archives). Pin the 2.x line for production Lenses until a Preview run of 4.0.0 passes |
| Spectacles UI Kit | `SpectaclesUIKit.lspkg` 2.0.0 or later | 2.0.0 | preview-validated |
| SurfacePlacement, VolumetricLine, SpecsNavigationKit | 2.0.0 or later each | 2.0.0 | preview-validated |
| LEAF (validation only) | `Leaf.lspkg` 2.0.2 or later | 2.0.2 | preview-validated |
| AiPreviewAgentInspect / Interact (validation only) | 2.0.1 or later | 2.0.1 | preview-validated |

Only one Interaction Kit line may be installed in a project; the doctor
fails when both are. Whether UI Kit and NavigationKit 4.0.0 kept their
2.x package names is not verified, so the runtime still imports the 2.x
names.

## Web preview (design review)

`web-harness/specs-preview/` renders a manifest or scene document in the
browser. It is a private package with its own lockfile; nothing in it ships
in `@reactvision/react-viro`. See [specs-preview.md](specs-preview.md).

| Component | Version | Checked by | Tier |
| --- | --- | --- | --- |
| Lens host core it runs | vendored from viro-external `feat/specs-release` @ `4aa25ab0` (the 13 files of `tsconfig.lens-core.json`) | `npm run vendor:check`: sha256 per file against `src/vendor/VENDOR.json` | portable-test-passed |
| Scene semantics | same controller as the Lens host on a three.js backend | `npm test`: parity with the viro-external mock host on the Platform Lab, the Navigation scroll group, the three reference apps and every gallery primitive; experience-layer tests | portable-test-passed |
| `three` | 0.186.1 | `npm run typecheck` (strict) | portable-test-passed |
| Vite / Vitest | 8.3.5 / 5.0.5 | the scripts above | portable-test-passed |
| Browser | installed Google Chrome through Playwright 1.64.1 (`channel: "chrome"`, SwiftShader) | `node scripts/screenshot.mjs`: each page settles, logs no error and draws a non-flat canvas | portable-test-passed |
| Node.js | 24 in CI | `preview` job in `specs-public-api.yml` | portable-test-passed |

The preview is not a Lens tier. A preview screenshot shows what the Lens
host's controller decided, drawn by three.js; Lens rendering, text
metrics and input differ (listed in specs-preview.md).

`viro-specs watch` (rebuild on change, atomic writes, keep the last valid
output) is covered by `__test__/ViroSpecsWatch.test.ts` in `test:specs`:
portable-test-passed.

## What runs where

React, React Native and Viro never run in the Lens. The consumer checks
assert it twice: no file in the packed `@viro-external/specs` `lens/` or
`dist/` imports them, and the `lens-ts` host compiled in a clean app
imports only `../lens/` files.
