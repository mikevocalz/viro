# Specs JSX bridge

The Specs bridge lets an application keep familiar Viro JSX while compiling a
portable scene for the Lens Studio backend.

```tsx
import {
  Viro3DObject,
  ViroNode,
  ViroPolyline,
  ViroSpecsScene,
  ViroText,
} from "@reactvision/react-viro";

<ViroSpecsScene
  transport={specsTransport}
  sourceResolver={(source, kind) => assetRegistry.idFor(source, kind)}
>
  <ViroNode viroTag="root" position={[0, 0, -1.5]}>
    <ViroText viroTag="title" text="Hello Specs" />
    <Viro3DObject
      viroTag="model"
      source={require("./model.glb")}
      type="GLB"
      onClick={() => select()}
      onDrag={(position) => move(position)}
    />
    <ViroPolyline
      viroTag="route"
      points={[
        [-0.3, 0, 0],
        [0, 0.2, 0],
        [0.3, 0, 0],
      ]}
      thickness={0.008}
    />
  </ViroNode>
</ViroSpecsScene>
```

On ViroCore targets the children render normally. Inside a Specs build the
bridge emits the validated portable scene and returns no native React Native
view.

## Supported direct JSX

- ViroNode
- ViroText
- ViroImage
- Viro3DObject
- ViroPolyline

Nested supported Viro primitives are traversed recursively. Custom React
components should currently resolve to these primitives before being passed to
the bridge; arbitrary function-component introspection is intentionally not
attempted.

Use `viroTag` for stable IDs. JSX keys are the second choice; otherwise the
compiler generates deterministic traversal IDs.

Bundled React Native assets should supply a `sourceResolver` that maps
`require(...)` IDs to the logical asset IDs registered in Lens Studio.

Hover, click/select and drag callbacks are routed back to the original JSX node
through the portable interaction stream.
