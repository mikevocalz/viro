# viro-specs watch

Keeps the generated Lens files current while you edit Viro JSX.

```sh
npx viro-specs watch \
  --entry src/MyScene.tsx \
  --out-dir "/path/to/LensProject/Assets/ViroSpecs/generated"
```

It compiles once, then again whenever the entry or any module it imports
changes. Stop it with Ctrl+C. `--once` builds and exits, for CI and scripts.

| Flag | Default | Meaning |
| --- | --- | --- |
| `--entry file.tsx` or `--manifest file.json` | | What to compile (one of the two) |
| `--out-dir dir` | | Where the outputs go. Put it next to the synced `lens/` folder: the generated host imports `../lens/...` |
| `--format list` | `lens-ts,scene-json` | Any of `lens-ts`, `scene-json`, `json` |
| `--name base` | entry file name | Base name of the JSON outputs |
| `--root dir` | nearest `package.json` | Root that asset IDs are relative to |
| `--strict` | off | Treat warnings as errors |
| `--debounce-ms n` | 120 | Wait this long after the last change before building |
| `--force-overwrite name` | | Replace this output even if you edited it (repeatable) |
| `--once` | off | Build once and exit with 0 or 1 |

Outputs:

| Format | File |
| --- | --- |
| `lens-ts` | `ViroGeneratedSceneHost.ts` |
| `scene-json` | `<name>.scene.json`, also what the [web preview](specs-preview.md) reads with `?watch=<url>` |
| `json` | `<name>.manifest.json` |

## What it guarantees

**Atomic writes.** Each file is written to a temporary file in the same
directory and renamed over the target. Lens Studio and the web preview see
the old file or the new one, never half of one.

**A failed build changes nothing.** A compile error, or a warning under
`--strict`, writes no file. The message names the time of the last valid
output, which stays in place. Fix the source and the next save rebuilds.
After a failure the watcher keeps watching the files of the last good
build as well as the new ones, so fixing an import that broke the build
also triggers a rebuild.

**Lens object identities survive.** Lens Studio stores each asset's UUID
in a `.meta` file next to it. Watch replaces files at the same path and
never touches `.meta` files, so components, references and inspector
wiring that point at the generated host keep working. Identical output is
not rewritten, so Lens Studio does not reimport an unchanged file.

**Your edits are kept.** `viro-specs.generated.json` in the output
directory records the sha256 of every file watch wrote. Before replacing a
file, watch checks that it still has that hash:

| File on disk | What watch does |
| --- | --- |
| Missing | Writes it |
| Same content as the new build | Leaves it alone |
| What watch last wrote | Replaces it |
| Edited since watch wrote it | Keeps it and says so on every build; `--force-overwrite <name>` replaces it |
| Not written by watch | Keeps it and says so; `--force-overwrite <name>` replaces it |

**Nothing is deleted.** No clean step, no stale-file removal. Dropping a
format leaves its old file where it is.

## With sync

`viro-specs sync` (from `@viro-external/specs`) owns `Assets/ViroSpecs/lens/`,
the Lens runtime. `viro-specs watch` owns only the files it lists in
`Assets/ViroSpecs/generated/viro-specs.generated.json`. The two never write
into each other's folders. Run sync after upgrading `@viro-external/specs`,
and keep watch running while you edit scenes:

```sh
npx viro-specs sync --project /path/to/LensProject
npx viro-specs doctor --project /path/to/LensProject
npx viro-specs watch --entry src/MyScene.tsx --out-dir /path/to/LensProject/Assets/ViroSpecs/generated
```

What sync copies, how it handles upgrades and what doctor checks are
documented with the package (`packages/specs/lens/README.md` in
viro-external).

## Tests

`__test__/ViroSpecsWatch.test.ts` (part of `npm run test:specs`) covers
argument parsing, the input set, atomicity, failed and `--strict` builds,
`.meta` preservation, unchanged files, user edits, foreign files,
`--force-overwrite`, the no-delete rule, path escapes, and a live watcher
that rebuilds on an imported-module change and recovers after a broken
save. These run in Node. Watch has not been run against an open Lens Studio
project, so Lens Studio's reimport behavior on rename is not verified.
