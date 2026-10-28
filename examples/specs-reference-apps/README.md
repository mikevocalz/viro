# Specs reference apps

Three small apps written as Viro JSX against the public API. Each compiles
through `viro-specs-compile --strict` and the runtime compiler with no
diagnostics, so each one also passes the comfort rules (content 0.6-3.0 m
away, text at least 1.2 degrees tall, an accessible name on every
interactable).

| App | File | Route | What it shows |
| --- | --- | --- | --- |
| Spatial dashboard | `SpatialDashboard.tsx` | `dashboard` | A SpatialPanel with three metric cards, a 1 h / 24 h / 7 d range selector and Refresh. Every control fires a typed action. |
| Model viewer | `ModelViewer.tsx` | `model` | A ModelViewer (drag to move) with Turn left, Turn right, Smaller, Larger and Reset as typed actions. A missing GLB shows the host's placeholder and Retry panel. |
| World-placed info | `WorldPlacedInfo.tsx` | `placement` | A hidden info card that appears where a WorldQuery hit was confirmed. Place card, Cancel, and `placement.confirm` with the pose. |

Each file exports its action spec twice: keyed (`*_ACTION_SPEC`, for
`defineSpecsActions` and the reducers) and as the literal list
`ViroSpecsScene` takes (`*_ACTIONS`), because the static compiler reads a
literal list and not a `defineSpecsActions(...)` call. The test checks the two
match. Each file also exports its initial state and pure reducers
(`*_REDUCERS`) for `bindSpecsActionsToStore`.

The JSX is the initial state. The static compiler reads constants, not props
or store state, so these files describe the scene as it opens. State changes
run through the reducers on the phone, or, when the Lens runs with no phone,
through the matching views in `@viro-external/specs`
`examples/reference-apps/leaf/ViroRefAppsLogic.ts`. That file copies the data
tables here (`DASHBOARD_METRICS`, `DASHBOARD_RANGES`, `MODEL_SIZE_STEPS`,
`PLACEMENT_PROMPTS`); change both together.

## Node IDs

| App | IDs |
| --- | --- |
| Dashboard | `dash-panel`, `dash-title`, `dash-card-{temp,humidity,co2}` with `-label` and `-value` children, `dash-range-{1h,24h,7d}`, `dash-refresh`, `dash-status` |
| Model viewer | `mv-model`, `mv-panel`, `mv-status`, `mv-turn-left`, `mv-turn-right`, `mv-smaller`, `mv-larger`, `mv-reset` |
| World-placed info | `wpi-card`, `wpi-card-title`, `wpi-card-body`, `wpi-controls`, `wpi-prompt`, `wpi-place`, `wpi-cancel` |

The Lens host names each node's SceneObject `viro:<id>`, and the object SIK
binds for an interaction `viro-interactable:<id>`.

## Assets

Only the model viewer uses an asset: `examples/visionos-sweep/assets/shiba.glb`
(already in this repo). The compiled asset ID is that path. The Platform Lab
Lens project registers it under the same ID, so the scene loads there without
changes. Any other Lens project needs a `ViroSpecsAssetRegistry` entry with
that ID.

## Controls are ViroText

`PanelButton` takes `onPress` but not `specsAction`, so a typed action cannot
go on it without a `VS3002` warning, which `--strict` rejects. The controls are
`ViroText` with `accessibilityLabel` and `specsAction`, the pattern
`specs-platform-lab/SpecsActionsLab.tsx` uses. Their font size is set per
distance (the comment above each `CONTROL_PT` gives the arithmetic).

## Compile and test

```bash
npm run build:specs-cli
node bin/viro-specs-compile.cjs --entry examples/specs-reference-apps/SpatialDashboard.tsx --strict --out build/dashboard.json
node bin/viro-specs-compile.cjs --entry examples/specs-reference-apps/ModelViewer.tsx --strict --format scene-json --out build/model-viewer.scene.json
node bin/viro-specs-compile.cjs --entry examples/specs-reference-apps/WorldPlacedInfo.tsx --strict --format lens-ts --out build/ViroGeneratedSceneHost.ts
npm run test:specs -- ViroSpecsReferenceApps
```

`__test__/ViroSpecsReferenceApps.test.tsx` checks, per app: no diagnostics in
either compiler, byte-identical manifests across the two, validation, a label
on every interactable, every trigger against its declaration, the reducers
driven by triggers resolved from the compiled manifest, a layout check (boxes
inside their panel, no overlaps, text fits), and the goldens in
`__test__/fixtures/specs/reference-apps/<app>/`: `manifest.json`,
`scene.json`, `host.lens.ts` and an empty `diagnostics.txt`. Regenerate after
an intended change and review the diff:

```bash
UPDATE_SPECS_GOLDENS=1 npm run test:specs -- ViroSpecsReferenceApps
```

Then copy each `scene.json` to `@viro-external/specs`
`examples/reference-apps/scenes/<app>.scene.json` and run its
`gen-lens-scenes.mjs`; its Node test fails while the embedded copy is stale.
The Lens Studio run steps are in that folder's README.

Evidence: `portable-test-passed` (Jest, the CLI, and the mock-host suite in
`@viro-external/specs`). The LEAF scenarios are written but have not run in
Lens Studio Preview yet.
