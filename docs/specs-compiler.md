# SPECS build-time JSX compiler

SPECS does not run React Native or ViroCore. The production target therefore
uses a build-time compiler rather than trying to execute React on the glasses.

`ViroSpecsScene` is an authoring boundary: native ViroCore targets can render
the JSX normally, while the Specs CLI statically extracts supported Viro
primitives into the portable manifest consumed by the Lens Studio backend.

## Compile

```bash
viro-specs-compile \
  --entry src/SpecsScene.tsx \
  --out build/specs-scene.json
```

The compiler currently supports static props for:

- ViroNode
- ViroText
- ViroImage
- Viro3DObject
- ViroPolyline

Use `viroTag` for stable IDs.

Static bundled assets such as `require("./model.glb")` are converted to
project-relative logical IDs. The Lens asset registry binds those IDs to Lens
Studio assets.

## What remains portable at runtime

Scene/data state must cross through the portable transport/domain layer. React
callbacks themselves do not execute on SPECS. Interaction IDs emitted by SIK
are intended to route into the app's portable action/state layer.

That distinction is deliberate:

```text
Viro JSX source
      ↓ build
portable scene manifest
      ↓ sync
Lens Studio runtime
      ↓
SPECS

application/domain state ↔ portable messages/actions ↔ Lens runtime
```
