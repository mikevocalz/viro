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

The output is a [manifest v2](specs-manifest.md). Problems are reported as
coded diagnostics with file, line and column
([reference](specs-diagnostics.md)):

```text
[viro-specs] src/SpecsScene.tsx:14:9 error VS2013: ViroText title has a spread attribute; its props were not compiled.
  hint: Write the props out on the element. The static compiler cannot see what a spread contains.
```

Errors stop the build. Warnings are printed and the file is written, unless
`--strict` is set, which also fails on warnings (for example a missing
`viroTag`, which `--strict` therefore requires).

| Flag | Meaning |
| --- | --- |
| `--entry <file.tsx>` | Compile Viro JSX. |
| `--manifest <file.json>` | Read a hand-written or version 1 manifest, validate it, and write it as version 2. |
| `--out <file>` | Output path. Nothing is written when the build fails. |
| `--format json\|lens-ts` | Manifest JSON (default) or the generated Lens Studio host. |
| `--strict` | Fail on warnings too. |
| `--diagnostics-format text\|json` | `json` writes only a JSON array of diagnostics to stderr. |

The CLI loads the shared contract code from `bin/specs-core/`, built by
`npm run build:specs-core` (the package `build` and `prepare` scripts run it).

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
