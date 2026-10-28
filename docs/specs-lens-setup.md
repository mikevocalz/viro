# Lens Studio setup through MCP

`scripts/specs-lens-setup.mjs` builds and checks a Viro Specs Lens project by
calling the Lens Studio MCP server, so nobody wires the Inspector by hand. It
targets the Platform Lab project in `examples/specs-platform-lab/lens/` by
default.

## Requirements

- Lens Studio 5.22 or later, running, with the project open. Tested on 5.24.1.
- The MCP server enabled: AI Assistant > AI Model Context Protocol > Configure
  Server. The script reads the URL and bearer key from `~/.claude.json` (the
  `lens-studio` server), or from `LENS_STUDIO_MCP_URL` and
  `LENS_STUDIO_MCP_TOKEN`.
- A checkout of `@viro-external/specs` for the sync and doctor steps. Pass
  `--specs`, set `VIRO_SPECS_PACKAGE`, or keep `viro-external` next to `viro`.

## Run

```bash
node scripts/specs-lens-setup.mjs                      # every step
node scripts/specs-lens-setup.mjs --steps compile,recompile,preview,leaf
node scripts/specs-lens-setup.mjs --create --project /abs/path/NewLab   # save the open project there first
```

| Step | What it does | Evidence level it can reach |
| --- | --- | --- |
| `preflight` | Checks which project Lens Studio has open and that the MCP tools exist | none |
| `packages` | Installs the pinned packages (below) from the Asset Library when `Packages/` lacks them. `--replace-packages` removes existing copies first | none |
| `sync` | Copies the `@viro-external/specs` Lens runtime into `Assets/ViroSpecs/lens` without `--clean`, then runs the doctor | none |
| `compile` | `viro-specs compile` to `lens-ts` (the generated host) and to JSON (kept as evidence) | implemented |
| `recompile` | `RecompileTypeScriptTool` | lens-compiled |
| `wire` | Runs `scripts/specs-lens/editor/wire-generated-host.ts` in the editor: camera, SIK prefab, model import, the `ViroSpecsRuntime` hierarchy, every host `@input`, the LEAF index | none |
| `chattool` | Loads the `viro-specs` ChatTool and calls its `doctor` | none |
| `device` | Sets the Preview to a SPECS device, Interactive input, Sunlit Room (`--room` to change). SIK refuses to run without it | none |
| `preview` | Refreshes Preview, collects logs, captures the runtime view | lens-compiled; the logs alone do not prove behavior |
| `leaf` | Runs the LEAF scenarios; the deliberate failure must fail | preview-validated |

Each run writes `report.json`, logs and captures to
`docs/evidence/specs/lens/run-<timestamp>/`, with repo and home paths
replaced by `<repo>` and `~`. Nothing in this flow is hardware-validated.

## The scene it builds

```
Camera Object            Perspective, DeviceTracking World
SpectaclesInteractionKit SIK 2.0.0 root prefab
ViroSpecsRuntime
  AssetRegistry          ViroSpecsAssetRegistry: compiled model IDs -> imported GLB prefabs
  ViroGeneratedContent   root for generated nodes
  RuntimeHost            ViroSpecsRuntimeHost (root, assetRegistryObject)
  InteractionHost        ViroSpecsInteractionHost (runtimeHostObject)
  AnimationHost          ViroSpecsAnimationHost (runtimeHostObject)
  Navigation             NavigationDataComponent (userCamera) + ViroSpecsNavigationHost
  GeneratedHost          ViroGeneratedSceneHost: the four host @inputs
LeafIndex                ViroLabLeafIndex
LeafScenarioClient       ViroLabScenarioClient, disabled except during the leaf step
```

Objects are found by name, so a rerun repairs a partly wired scene. The demo
objects the Asset Library drops into the scene when it installs
SurfacePlacement, VolumetricLine and NavigationKit are disabled, not deleted.

## LEAF scenarios

The scenarios are in `examples/specs-platform-lab/lens/Assets/ViroSpecsLab/Leaf/`:
| Scenario | Checks |
| --- | --- |
| `viro_lab_render` | Root at -150 cm, title text, model prefab instantiated |
| `viro_lab_select` | Hover and trigger on the model reach the portable channel as `hover-enter`, `select-start`, `select-end` |
| `viro_lab_select_ik` | The same select with LEAF's IK arm and head. Run with `__leaf__diagnostic_policy: fail-fast`, so a reach that does not converge fails instead of falling back to simulated input |
| `viro_lab_drag` | SIK manipulation moves the model and emits `drag` |
| `viro_lab_navigate` | The ViroPolyline is a VolumetricLine whose three points sit at the compiled centimeter positions |
| `viro_lab_deliberate_failure` | Asserts a title the scene does not have. It must fail; if it passes, the harness is broken |

The `leaf` step follows CLAD's `specs-leaf-run-in-preview`: `open_leaf_panel`,
`list_leaf_scenarios` and `run_leaf_scenario` with `onDevice: false`, one
scenario at a time, then the Lens-side `DefaultLeafScenarioManager`
PASSED/FAILED line from the log, because the tool returns no reason.

If the `[ChatTool] LEAF Plugin` is missing or fails to load, the step falls
back to `ViroLabScenarioClient`. That component calls LEAF's
`DefaultScenarioManager.startScenario` for each scenario and prints
`VIRO_LAB_LEAF_RESULT {...}` lines that the step reads from the Preview log.

## The viro-specs ChatTool

`scripts/specs-lens/chattool/` is an editor plugin built on
`LensStudio:ChatTool`. It adds one tool, `viro-specs`, with
`command: compile | doctor | sync`. It reads `viro-specs.json` from the Lens
project and machine paths from `viro-specs.local.json` (not committed). The
`chattool` step loads it with `pluginSystem.loadDirectory`; Lens Studio asks
once for the `filesystem` and `subprocess` permissions.

`node --test scripts/specs-lens/chattool/main.nodetest.mjs` runs its command logic
in Node with the Lens Studio modules stubbed.

## Pinned packages

| Package directory | Asset Library name | Version |
| --- | --- | --- |
| `SpectaclesInteractionKit.lspkg` | SpectaclesInteractionKit | 2.0.0 |
| `SpectaclesUIKit.lspkg` | SpectaclesUIKit | 2.0.0 |
| `SurfacePlacement.lspkg` | Surface Placement | 2.0.0 |
| `VolumetricLine.lspkg` | Volumetric Line | 2.0.0 |
| `SpecsNavigationKit.lspkg` | Navigation Kit | 2.0.0 |
| `Leaf.lspkg` | Leaf | 2.0.2 |
| `AiPreviewAgentInspect.lspkg` | AI Preview Agent – Inspect | 2.0.1 |
| `AiPreviewAgentInteract.lspkg` | AI Preview Agent – Interact | 2.0.1 |

## Known traps

- Package line: the setup pins the 2.x Asset Library packages (SIK, UIKit,
  SurfacePlacement, VolumetricLine and NavigationKit 2.0.0, Leaf 2.0.2). The
  4.0.0 line renamed SIK to `InteractionKit.lspkg`, and every other 4.0.0
  package imports `"InteractionKit.lspkg/..."`. The `@viro-external/specs`
  runtime imports `"SpectaclesInteractionKit.lspkg/..."`, so no directory name
  satisfies both. The `packages` step refuses a project holding 4.0.0
  packages. Moving to 4.0.0 needs a runtime change in `viro-external`.

- Editor plugin permission prompts block Lens Studio. Importing a package that
  ships an editor plugin (Icons 4.0.0, pulled in by UIKit 4.0.0) or loading the
  `viro-specs` ChatTool opens a modal permission prompt. Until someone answers
  it in the Lens Studio window, later imports wait, the project cannot save,
  and the scene model is read-only (`Invalid transition from Immutable to
  Mutable`). The MCP has no tool to answer it. The pinned 2.x packages ship no
  editor plugins.
- The SIK 4.0.0 root prefab is named `InteractionKit`; in 2.0.0 it is
  `SpectaclesInteractionKit`. The wire step accepts either.
- `ViroSpecsAgentValidation.ts` in the synced runtime imports the
  AiPreviewAgentInspect and AiPreviewAgentInteract packages, so the project
  does not compile without them even though they are editor-only. The setup
  pins both at 2.0.1.
- `fetch` in Node gives up after 300 s waiting for response headers. Package
  imports can take longer, so `scripts/specs-lens/mcp-client.mjs` uses
  `node:http` with a 30 minute timeout.
- The scenarios in `Assets/ViroSpecs/lens/ViroSpecsLeaf*Scenario.ts` target the
  hand-written `ViroSpecsPlatformLab` component (button, status, panel). They do
  not apply to the generated host, so the lab registers `ViroLabLeafIndex`
  instead of `ViroSpecsLeafIndex`.
- Git still reads the `.gitattributes` Lens Studio writes into the project even
  though it is ignored, and its `Assets/**/* filter=lfs` rule turns new binary
  assets into LFS pointers on commit. In a working copy where Lens Studio has
  opened the lab, add this line to `.git/info/attributes`:
  `examples/specs-platform-lab/lens/** !filter !diff !merge`. Check with
  `git lfs ls-files`, which should print nothing for the lab.
