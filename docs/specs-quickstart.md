# Specs quickstart

From an existing React Native app to a Viro scene running in Lens Studio
Preview for SPECS 27. Versions are in
[specs-compatibility.md](specs-compatibility.md).

## 1. Install

```bash
npm install @reactvision/react-viro @viro-external/specs @viro-external/xr-contract
```

`react` (^19.3.0) and `react-native` (0.88.x) are peers your app already
has. `@viro-external/specs` is optional for ViroCore targets and required
for SPECS: it holds the Lens runtime and the `sync`, `doctor` and `test`
commands.

## 2. Write the scene once

```tsx
import * as React from "react";
import {
  PanelButton,
  PanelText,
  SpatialPanel,
  ViroSpecsScene,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "@reactvision/react-viro";

export function HelloScene(props: {
  transport: ViroSpecsSceneTransport;
  sourceResolver: ViroSpecsSourceResolver;
  onNext?: () => void;
}) {
  return (
    <ViroSpecsScene transport={props.transport} sourceResolver={props.sourceResolver}>
      <SpatialPanel viroTag="hello-root" position={[0, 0, -1.5]} width={0.53} height={0.5}>
        <PanelText viroTag="hello-title" role="title" text="Hello, Specs" position={[0, 0.2, 0.005]} />
        <PanelButton viroTag="hello-next" label="Next" position={[0.13, -0.19, 0.005]} onPress={() => props.onNext?.()} />
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
```

On ViroCore targets this renders as Viro components. On SPECS it compiles
to a portable manifest. Give every element a `viroTag`: it becomes the node
ID, the Lens SceneObject name (`viro:<viroTag>`), and `--strict` requires
it. Positions are meters; the Lens host converts to centimeters.

## 3. Compile

```bash
npx viro-specs-compile --entry src/HelloScene.tsx --out build/hello.json --strict
```

Exit 0 means no errors and, with `--strict`, no warnings. Any finding
prints as `file:line:col severity CODE: message` followed by a `hint:` line; look the code
up in [specs-error-reference.md](specs-error-reference.md). Add
`--diagnostics-format json` for machine-readable output.

## 4. Set up the Lens Studio project

Create a Lens Studio 5.22+ project targeting Spectacles and install, from
the Asset Library: Spectacles Interaction Kit 2.0.0, Spectacles UI Kit
2.0.0, SurfacePlacement 2.0.0, VolumetricLine 2.0.0 and SpecsNavigationKit
2.0.0. Then:

```bash
npx viro-specs doctor --project "/path/to/LensProject"
npx viro-specs sync --project "/path/to/LensProject"
```

`doctor` exits 1 and names each missing or too-old package. `sync` copies
the production Lens runtime into `Assets/` and records what it owns, so a
later sync never overwrites your files.

## 5. Generate the Lens host

```bash
npx viro-specs-compile --entry src/HelloScene.tsx --strict --format lens-ts \
  --out "/path/to/LensProject/Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts"
```

In Lens Studio, add `ViroSpecsAssetRegistry` and
`ViroSpecsSceneControllerHost` to a SceneObject, point the controller's
`assetRegistryObject` at the registry, then attach
`ViroGeneratedSceneHost` to another SceneObject and set its one input,
`sceneHostObject`. [specs-generated-host.md](specs-generated-host.md) has
the details, including registering materials and fonts.

## 6. Run in Preview

Press Preview with the SPECS 27 Interactive Preview. A problem shows as a
`VS5xxx` line in the Lens log and, for scene-level errors, as a readable
panel; the Lens keeps running. A missing model renders a tinted placeholder
box (`VS5003`).

## 7. Handle a pinch

React callbacks do not run in the Lens. Declare typed actions with
`defineSpecsActions`, attach one to a node with its `specsAction` prop and
`specsTrigger`, and bind them to your store with `bindSpecsActionsToStore`
([specs-actions.md](specs-actions.md)). The Lens runs the same action IDs
through its own handler registry, so a standalone Lens needs no phone or
server.

## Next

- Working scenes to copy: [specs-examples.md](specs-examples.md).
- How the pieces connect: [specs-architecture.md](specs-architecture.md).
- What each prop becomes in the Lens: [specs-parity.md](specs-parity.md)
  and [specs-jsx.md](specs-jsx.md).
