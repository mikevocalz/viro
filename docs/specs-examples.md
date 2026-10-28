# Specs examples

Scenes you can copy. Each one compiles through both compilers, is pinned
by goldens, and has LEAF scenarios for Lens Studio Preview.

## Platform Lab gallery

`examples/specs-platform-lab/`. Four scenes for the four handoff screens
in `docs/ux/handoff/`, plus the typed-actions reference flow.

| Scene | File | Shows | Goldens |
| --- | --- | --- | --- |
| Hello | `SpecsPlatformLab.tsx` | SpatialPanel, PanelText, ModelViewer, ViroPolyline, PanelButton, a 500 ms pulse | `__test__/fixtures/specs/gallery/hello.scene.json`, `lens-ts/platform-lab-hello.lens.ts` |
| Placement | `PlacementScene.tsx` | a model hidden until placement confirms, the control panel at 1.0 m; the experience layer draws the reticle, tint, pinch confirm and look-away cancel | `gallery/placement.scene.json`, `lens-ts/platform-lab-placement.lens.ts` |
| Interaction | `InteractionScene.tsx` | PanelButton disabled, error and selected states, ModelViewer select and drag | `gallery/interaction.scene.json`, `lens-ts/platform-lab-interaction.lens.ts` |
| Navigation | `NavigationScene.tsx` | SpatialScrollView, PanelImage, routes | `gallery/navigation.scene.json`, `lens-ts/platform-lab-navigation.lens.ts` |
| Actions lab | `SpecsActionsLab.tsx` | select card, details, change setting, back to list with scroll kept, on a Zustand store | `__test__/fixtures/specs/actions/`; runtime compiler only |

Tests: `__test__/ViroSpecsGallery.test.tsx`, `ViroSpecsActions.test.tsx`,
`ViroSpecsLensTs.test.ts`. The Lens side runs the same scene documents on
the mock host in viro-external `packages/specs/scripts/experience.test.mjs`
and `actions-fixtures.test.mjs`.

## Reference apps

`examples/specs-reference-apps/` ([README](../examples/specs-reference-apps/README.md)).
Written against the public API only; every control fires a typed action.

| App | File | Route | Shows |
| --- | --- | --- | --- |
| Spatial dashboard | `SpatialDashboard.tsx` | `dashboard` | three metric cards, a 1 h / 24 h / 7 d range selector, Refresh |
| Model viewer | `ModelViewer.tsx` | `model` | ModelViewer with drag, turn left/right, smaller/larger, reset; a missing GLB shows the placeholder and Retry panel |
| World-placed info | `WorldPlacedInfo.tsx` | `placement` | an info card placed at a confirmed WorldQuery hit; cancel by look-away or the Cancel control |

Each compiles with zero diagnostics under `--strict` in all three formats
and in the runtime compiler, with byte-identical manifests across the two.
Goldens: `__test__/fixtures/specs/reference-apps/<app>/` (`manifest.json`,
`scene.json`, `host.lens.ts`, empty `diagnostics.txt`), checked by
`__test__/ViroSpecsReferenceApps.test.tsx`.

In viro-external, `packages/specs/examples/reference-apps/` holds the same
scene documents (byte-identical), a mock-host suite
(`pnpm specs:test-reference-apps`) that runs each app's action loop, and
the LEAF scenarios. The mock host reports one `VS5008` warning
("maxLines is approximated") for each PanelText, as it does for the
Platform Lab scenes; the suite pins that list and allows no other host
diagnostic.

### LEAF scenarios

| ID | Asserts | Expected |
| --- | --- | --- |
| `viro_ref_dashboard_ready` | reaches `ready`, title, 24 h readings, controls interactable | pass |
| `viro_ref_dashboard_range` | "7 d" pinch delivers `dashboard.set-range`; readings change to the 7 d values; Refresh raises the count by one | pass |
| `viro_ref_dashboard_ik` | IK arm pinches Refresh at 1.5 m; count rises by one | pass |
| `viro_ref_model_ready` | model loaded, no placeholder, status text, five controls interactable | pass |
| `viro_ref_model_transform` | turn right +45° (±0.5°), larger ×1.2, reset restores, drag moves > 3 cm | pass |
| `viro_ref_model_missing_asset` | `VS5003` on `mv-model`, placeholder, "Model didn't load" panel with Retry | pass |
| `viro_ref_placement_ready` | card committed but hidden, idle prompt, Cancel hidden | pass |
| `viro_ref_placement_confirm` | injected table hit, "Table. Pinch to place.", `placement.confirm`, card within 3 cm of the hit | pass |
| `viro_ref_placement_cancel` | no hit for 1.5 s cancels; Cancel returns to idle | pass |
| `viro_ref_expected_failure` | asserts a title that does not exist | **fail**, proving the suite reports failures |

### Running them

The steps, with the Lens project and file locations, are in viro-external
`packages/specs/examples/reference-apps/README.md`. In short:

1. Check out the viro branch that carries the Platform Lab Lens project
   (`examples/specs-platform-lab/lens/ViroSpecsPlatformLab.esproj`; on
   2026-10-28 that is `feat/specs-lens-experience`) and open it in Lens
   Studio 5.22 or later with the LeafPlugin enabled.
2. From viro-external: `npx -y pnpm@12.8.1 --filter @viro-external/specs
   specs:sync -- --project "<abs path>/examples/specs-platform-lab/lens"`.
3. Copy the 14 files in `packages/specs/examples/reference-apps/leaf/` to
   `<project>/Assets/ViroSpecsRefApps/Leaf/`.
4. Add a root SceneObject `RefAppsLeafIndex` with a Script component set
   to `ViroRefAppsLeafIndex`; keep the lab's `LeafIndex`.
5. Set the Preview to a SPECS 27 Interactive Preview room, open the LEAF
   panel, run each `viro_ref_*` scenario one at a time, and compare with
   the table above. Failure reasons are in the Lens Studio log
   (`FAILED`, and `VIRO_REF <name>` lines).

Status: the Jest and mock-host suites pass (`portable-test-passed`), and
the LEAF scenarios are `preview-validated`: all ten ran in Lens Studio
5.24 SPECS 27 Preview (Sunlit Room) with the lab's 29, nine passed and
`viro_ref_expected_failure` failed as required
(`docs/evidence/specs/lens/ws4-08-polish2/leaf-suite/`). That run came before two
later changes, the dashboard panel moving from y 0 to y -0.22 and the
high-contrast surface changing from `#000000` to `#42525f`; neither has
been run in Preview since.
