# Specs quickstart

From an empty folder to a Viro scene running in Lens Studio Preview for
SPECS 27. Versions are in [specs-compatibility.md](specs-compatibility.md).
You need Node 22.13 or newer and npm.

## 1. Create the app

```bash
npx --package @reactvision/react-viro viro-specs init my-specs-app
cd my-specs-app
```

`init` writes an Expo app with one scene, `src/HelloScene.tsx`, installs
its packages, copies the Lens runtime from `@viro-external/specs` into
`lens/Assets/ViroSpecs/lens/`, and compiles the scene to
`lens/Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts`. It refuses a
folder that is not empty (pass `--force` to write into one; it replaces only
its own files). Options:

| Option | Effect |
| --- | --- |
| `--lens-project <path>` | Sync into an existing Lens Studio project (a folder with `Assets/`) instead of `lens/` inside the app |
| `--no-install` | Skip the package install. Run `npm install` and `npm run lens:sync` yourself afterwards |
| `--force` | Write into a non-empty folder |

The app's dependencies are react-viro at its version and its peers at the
ranges react-viro declares: `@viro-external/specs`, `@viro-external/xr-contract`,
`expo`, `react` (^19.3.0) and `react-native` (0.88.x).

The 3.1.0-moyo line is not on npm yet (npm has upstream 3.0.3, which has no
`init`). Until it is, run `init` from the packed tarball and install the
tarballs, which npm records as `file:` dependencies:

```bash
npx --package /path/to/reactvision-react-viro-<version>.tgz viro-specs init my-specs-app --no-install
cd my-specs-app
npm install /path/to/reactvision-react-viro-<version>.tgz \
  /path/to/viro-external-specs-<version>.tgz /path/to/viro-external-xr-contract-<version>.tgz
npm run lens:sync
```

## 2. Check the scene

```bash
npm run specs:check
npm run typecheck
```

`specs:check` runs `viro-specs-compile --strict` on `src/HelloScene.tsx`.
Exit 0 means no errors and no warnings. A finding prints as
`file:line:col severity CODE: message` followed by a `hint:` line; look the
code up in [specs-error-reference.md](specs-error-reference.md). Give every
element a `viroTag`: it becomes the node ID and the Lens SceneObject name
(`viro:<viroTag>`), and `--strict` requires it. Positions are meters; the
Lens host converts to centimeters.

On a phone, `ViroSpecsScene` renders the same children through ViroCore
(`App.tsx` puts it in a `ViroARSceneNavigator`; run it with `npx expo
prebuild` and `npx expo run:ios` or `run:android`). On SPECS the compiler
reads the file and the Lens host presents the result.

To look at the scene before building a Lens, `npm run specs:preview` writes
`build/hello.scene.json`. Drop it on the web preview, which runs the Lens
host's scene controller on three.js and lives in a viro checkout, not in the
installed package:

```bash
# in a clone of the viro repo
cd web-harness/specs-preview && npm ci && npm run dev
```

What the preview does and does not show is in
[specs-preview.md](specs-preview.md).

## 3. Set up the Lens Studio project

Open Lens Studio 5.22+ and turn on its MCP server (AI Assistant > AI Model
Context Protocol > Configure Server). Give the setup the server's URL and
key, either as environment variables or through an MCP config file that has
a `lens-studio` server entry:

```bash
export LENS_STUDIO_MCP_URL=http://localhost:50040/mcp
export LENS_STUDIO_MCP_TOKEN=<key from Configure Server>
# or: export LENS_STUDIO_MCP_CONFIG=/path/to/mcp-config.json
npm run lens:setup
```

`lens:setup` runs these steps and stops at the first failure:

1. When `viroSpecs.lensProject` (`lens/` by default) has no `.esproj`, it
   saves a new Spectacles project there; otherwise that project must be the
   one open in Lens Studio.
2. Installs Spectacles Interaction Kit 2.0.0, Spectacles UI Kit 2.0.0,
   SurfacePlacement 2.0.0, VolumetricLine 2.0.0 and SpecsNavigationKit 2.0.0
   from the Asset Library when they are missing, plus AI Preview Agent
   Inspect 2.0.1 for the Preview capture.
3. Syncs the Lens runtime into `Assets/ViroSpecs/lens/` and runs the doctor.
4. Compiles `src/HelloScene.tsx` into
   `Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts` (`--strict`).
5. Sets Preview to a SPECS device with Interactive input in the Sunlit Room,
   recompiles TypeScript in Lens Studio, creates the registry materials,
   and wires `ViroSpecsAssetRegistry`, `ViroSpecsSceneControllerHost`,
   `ViroGeneratedSceneHost` and the experience layer under a
   `ViroSpecsRuntime` SceneObject, with the Interaction Kit prefab at the
   root.
6. Refreshes Preview and fails on any compile error, script error or `VS5xxx`
   error. The capture is `build/lens-setup/preview.png`.

After setup, `npm run lens:host` rebuilds the host and `npm run lens:watch`
rebuilds it on every save ([specs-watch.md](specs-watch.md)).
`npm run lens:doctor` names any missing or too-old package.
[specs-generated-host.md](specs-generated-host.md) explains the wiring,
including registering materials and fonts.

## 4. Run in Preview

Press Preview with the SPECS 27 Interactive Preview. A problem shows as a
`VS5xxx` line in the Lens log and, for scene-level errors, as a readable
panel; the Lens keeps running. A missing model renders a tinted placeholder
box (`VS5003`).

## 5. Handle a pinch

React callbacks do not run in the Lens. Declare typed actions with
`defineSpecsActions`, attach one to a node with its `specsAction` prop and
`specsTrigger`, and bind them to your store with `bindSpecsActionsToStore`
([specs-actions.md](specs-actions.md)). The Lens runs the same action IDs
through its own handler registry, so a standalone Lens needs no phone or
server.

## Adding Specs to an existing app

Install the three packages and copy `src/HelloScene.tsx` from a starter, or
write the scene from [specs-examples.md](specs-examples.md):

```bash
npm install @reactvision/react-viro @viro-external/specs @viro-external/xr-contract
npx viro-specs-compile --entry src/HelloScene.tsx --out build/hello.json --strict
npx viro-specs sync --project "/path/to/LensProject"
npx viro-specs watch --entry src/HelloScene.tsx --out-dir "/path/to/LensProject/Assets/ViroSpecs/generated" --strict --once
```

## Next

- Working scenes to copy: [specs-examples.md](specs-examples.md).
- How the pieces connect: [specs-architecture.md](specs-architecture.md).
- What each prop becomes in the Lens: [specs-parity.md](specs-parity.md)
  and [specs-jsx.md](specs-jsx.md).
