# Viro JSX → SPECS portable compiler

Applications can keep authoring ordinary Viro JSX and compile the supported
subset into the portable SPECS scene bundle without importing
`@viro-external/specs`.

```tsx
const scene = (
  <ViroARScene>
    <ViroNode viroTag="lesson" position={[0, 0, -1.5]}>
      <ViroText viroTag="title" text="Fractions" />
      <Viro3DObject
        viroTag="model"
        type="GLB"
        source={{ uri: "models/fractions.glb" }}
      />
    </ViroNode>
  </ViroARScene>
);

const bundle = compileViroSpecsJSX(scene, {
  resolveAssetId(source, { id }) {
    return id;
  },
});
```

## First-wave JSX subset

- `ViroARScene` / `ViroScene`
- `ViroNode`
- `ViroText`
- `ViroImage`
- `Viro3DObject`
- `ViroFlexView` / `ViroSurface` as portable panels
- `ViroPolyline`

The compiler intentionally rejects arbitrary function/class components instead
of executing application hooks during a build step. Resolve those components to
Viro primitives before compilation.

## Semantics

- Viro positions remain meters.
- Viro Euler rotations in degrees are converted to portable quaternions.
- React key or `viroTag` becomes a stable portable node ID.
- model/image sources are converted to stable asset IDs via
  `resolveAssetId`.
- hover/gaze/select/drag bindings are retained for normalized SPECS events.
- `serializeViroSpecsCompilation` strips callback functions and emits a JSON
  bundle suitable for a Lens build/export pipeline.
