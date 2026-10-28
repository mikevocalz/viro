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
| `packages` | Installs SpectaclesInteractionKit, SpectaclesUIKit, SurfacePlacement, VolumetricLine, SpecsNavigationKit and Leaf from the Asset Library when `Packages/` lacks them | none |
| `sync` | Copies the `@viro-external/specs` Lens runtime into `Assets/ViroSpecs/lens` without `--clean`, then runs the doctor | none |
| `compile` | `viro-specs compile` to `lens-ts` (the generated host) and to JSON (kept as evidence) | implemented |
| `recompile` | `RecompileTypeScriptTool` | lens-compiled |
| `wire` | Runs `scripts/specs-lens/editor/wire-generated-host.ts` in the editor: camera, SIK prefab, model import, the `ViroSpecsRuntime` hierarchy, every host `@input`, the LEAF index | none |
| `chattool` | Loads the `viro-specs` ChatTool and calls its `doctor` | none |
| `preview` | Refreshes Preview, collects logs, captures the runtime view | preview-validated only for what the logs show |
| `leaf` | Runs the LEAF scenarios; the deliberate failure must fail | preview-validated |

Each run writes `report.json`, logs and captures to
`docs/evidence/specs/lens/run-<timestamp>/`, with repo and home paths
replaced by `<repo>` and `~`. Nothing in this flow is hardware-validated.

## The scene it builds

```
Camera Object            Perspective, DeviceTracking World
InteractionKit           SIK 4.0.0 root prefab
ViroSpecsRuntime
  AssetRegistry          ViroSpecsAssetRegistry: compiled model IDs -> imported GLB prefabs
  ViroGeneratedContent   root for generated nodes
  RuntimeHost            ViroSpecsRuntimeHost (root, assetRegistryObject)
  InteractionHost        ViroSpecsInteractionHost (runtimeHostObject)
  AnimationHost          ViroSpecsAnimationHost (runtimeHostObject)
  Navigation             NavigationDataComponent + ViroSpecsNavigationHost
  GeneratedHost          ViroGeneratedSceneHost: the four host @inputs
LeafIndex                ViroLabLeafIndex
LeafScenarioClient       ViroLabScenarioClient, disabled except during the leaf step
```

Objects are found by name, so a rerun repairs a partly wired scene.

## LEAF scenarios

The scenarios are in `examples/specs-platform-lab/lens/Assets/ViroSpecsLab/Leaf/`:
`viro_lab_render`, `viro_lab_select`, `viro_lab_drag`, `viro_lab_navigate`, and
`viro_lab_deliberate_failure`, which asserts a title the scene does not have.
If that scenario passes, the harness is broken.

The `leaf` step uses the LEAF panel's MCP tools when the `[ChatTool] LEAF
Plugin` provides them. Otherwise it enables `ViroLabScenarioClient`, which
calls LEAF's `DefaultScenarioManager.startScenario` for each scenario and
prints `VIRO_LAB_LEAF_RESULT {...}` lines that the step reads from the
Preview log.

## The viro-specs ChatTool

`scripts/specs-lens/chattool/` is an editor plugin built on
`LensStudio:ChatTool`. It adds one tool, `viro-specs`, with
`command: compile | doctor | sync`. It reads `viro-specs.json` from the Lens
project and machine paths from `viro-specs.local.json` (not committed). The
`chattool` step loads it with `pluginSystem.loadDirectory`; Lens Studio asks
once for the `filesystem` and `subprocess` permissions.

`node --test scripts/specs-lens/chattool/main.test.mjs` runs its command logic
in Node with the Lens Studio modules stubbed.

## Known traps

- SpectaclesUIKit 4.0.0 depends on Icons 4.0.0, which ships an editor plugin
  (Icon Atlas). Importing it opens a plugin permission dialog in Lens Studio.
  Until someone answers it, every later import waits, the project cannot save,
  and the scene model is read-only (`Invalid transition from Immutable to
  Mutable`). The MCP has no tool to answer it.
- The SIK 4.0.0 root prefab is named `InteractionKit`, not
  `SpectaclesInteractionKit`.
- `fetch` in Node gives up after 300 s waiting for response headers. Package
  imports can take longer, so `scripts/specs-lens/mcp-client.mjs` uses
  `node:http` with a 30 minute timeout.
- The scenarios in `Assets/ViroSpecs/lens/ViroSpecsLeaf*Scenario.ts` target the
  hand-written `ViroSpecsPlatformLab` component (button, status, panel). They do
  not apply to the generated host, so the lab registers `ViroLabLeafIndex`
  instead of `ViroSpecsLeafIndex`.
