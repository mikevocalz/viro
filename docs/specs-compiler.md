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
[viro-specs] src/SpecsScene.tsx:14:31 error VS2009 [title]: ViroText text `user.name` cannot be resolved statically: `user`: user is not a top-level const or import (props, state and locals are only known at runtime).
  hint: Use a literal, a top-level const, a const imported from a relative module, or a .map() parameter. The message quotes the expression.
```

Errors stop the build. Warnings are printed and the file is written, unless
`--strict` is set, which also fails on warnings. Every element without a
`viroTag` raises warning `VS3012`, so `--strict` requires a `viroTag` on
every element.

| Flag | Meaning |
| --- | --- |
| `--entry <file.tsx>` | Compile Viro JSX. |
| `--manifest <file.json>` | Read a hand-written or version 1 manifest, validate it, and write it as version 2. |
| `--out <file>` | Output path. Nothing is written when the build fails; a successful write is atomic (temp file, then rename). |
| `--format json\|scene-json\|lens-ts` | Manifest JSON (default), the scene protocol 2 document `ViroSpecsSceneController` reads, or the generated Lens Studio host. The last two carry every manifest field, so they never report `VS1015`. |
| `--root <dir>` | Project root for asset IDs and the manifest `source`. Default: the nearest directory above the entry with a `package.json`. |
| `--strict` | Fail on warnings too. |
| `--diagnostics-format text\|json` | `json` writes only a JSON array of diagnostics to stderr. |

## How it is built

The CLI is TypeScript in `src/specs-cli/`:

| File | Job |
| --- | --- |
| `modules.ts` | Parses the entry and the relative modules it imports with `@babel/parser`; records top-level bindings, imports and exports. |
| `evaluate.ts` | Works out static values, or says exactly why it cannot. |
| `compile.ts` | Walks the JSX under `<ViroSpecsScene>` and passes each element's props to the shared core. |
| `lensTs.ts` | The generated Lens Studio host: a protocol 2 document handed to `ViroSpecsSceneControllerHost` (see `docs/specs-generated-host.md`). |
| `main.ts` | Arguments, output, exit status. |

Everything about what an element compiles to (transforms, quaternions,
polylines, text style, assets, interactions, animations, IDs, validation)
lives in `components/Specs/core/`, mainly `scene.ts`
(`ViroSpecsSceneBuilder`). The runtime compiler inside `ViroSpecsScene` calls
the same builder, so the two compilers cannot drift.
`npm run build:specs-cli` compiles both directories to `bin/specs-build/`;
the package `build` and `prepare` scripts run it, and
`bin/viro-specs-compile.cjs` loads it.

## What the static compiler can read

Supported components: ViroNode, ViroText, ViroImage, Viro3DObject,
ViroPolyline and the four Viro lights.

A prop value compiles when it is one of:

- a literal, template literal, array or object (with spreads), or
  arithmetic, comparison, logical or conditional expressions over those;
- a top-level `const` in the entry file, including destructuring
  (`let` and `var` are runtime values);
- a named, default or namespace import from a relative module, following
  re-exports, or a value from an imported `.json` file;
- `require("./asset.glb")` or `import model from "./asset.glb"` for assets;
- a parameter of a `.map()` callback being expanded.

Function calls other than `require()`, props, state, hooks and package
imports are only known at runtime. The diagnostic quotes the expression
you wrote and, when the cause is deeper, the part that failed.

JSX children:

| Source | Result |
| --- | --- |
| `{CONST ? <A /> : <B />}`, `{CONST && <A />}` | Only the branch the constant selects is compiled. |
| `{prop ? <A /> : <B />}`, `{prop && <A />}` | Every branch is compiled with `visible: false` on its root, with warning `VS2016`. Polylines and lights cannot be hidden: `VS2017`. |
| `{ITEMS.map((item, index) => <A ... />)}` | Expanded once per item of a static array. The callback body must be one JSX expression or one `return`. Otherwise `VS2019`. |
| `<A {...STATIC} b={1} />` | Spread props merge in source order. An unresolved spread is `VS2013` and ignored. |
| `<>...</>`, `<React.Fragment>` | Transparent. |
| Any other call or expression | `VS2003`. |

## IDs and assets

`viroTag` is the element ID. Without it, both compilers assign a content-hash
ID such as `text-538ff9754de1`, built from the kind, the parent ID, the text
or asset, the React key, and an ordinal that only separates identical
siblings. Reordering distinct siblings keeps every ID, so callbacks stay on
their elements. Editing an untagged element's text or source changes its
ID. See [ADR-0003](adr/0003-specs-id-strategy.md).

Asset IDs are paths relative to the project root with forward slashes
(`assets/robot.glb`), whatever the working directory or OS. The Lens asset
registry binds those IDs to Lens Studio assets. A `require()` of a file that
does not exist is `VS2018`.

In the runtime compiler, bundled assets are numbers until a
`sourceResolver` maps them. Map them to the same project-relative paths to
get the same manifest from both compilers.

## Both compilers produce the same manifest

`serializeSpecsManifest` writes manifests with a fixed key order, so equal
content means equal bytes. For the Platform Lab and for every golden fixture
both compilers can run, the runtime manifest equals the CLI manifest byte for
byte except for provenance (`generator` names the producer; `source` names
the entry file, which the runtime compiler never sees).
`specsManifestSharedSubset` removes those two fields.

Tests: `__test__/ViroSpecsGolden.test.tsx` (48 fixtures under
`__test__/fixtures/specs/compiler/`, 42 compared across both compilers, plus
the Platform Lab), `__test__/ViroSpecsCore.test.tsx`, and
`scripts/test-viro-specs-compiler.cjs` for the CLI. Regenerate goldens after an
intended change with `UPDATE_SPECS_GOLDENS=1 npm run test:specs -- ViroSpecsGolden`
and review the diff.

## Compile time

The budget is 200 ms per path for the Platform Lab. `ViroSpecsGolden.test.tsx`
fails above it and prints the numbers on every CI run. Measured 2026-10-28 on
an Apple M3 Pro, Node 26.12.0, inside Jest:

| Path | First compile | Median of 25 |
| --- | --- | --- |
| Static (`compileSpecsEntry`, parse included) | 18.2-18.6 ms | 1.8 ms |
| Runtime (`compileViroSpecsChildren`) | 10.9-11.8 ms | 0.14 ms |

A cold `viro-specs-compile` process for the Platform Lab takes 0.35-0.38 s
wall time on the same machine, of which 0.28 s is Node startup (`node -e ""`).
Inside the process, loading `@babel/parser` takes about 21 ms and the CLI
modules about 18 ms. The GitHub Actions runner has not been measured yet; the
test prints its numbers in the CI log.

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
