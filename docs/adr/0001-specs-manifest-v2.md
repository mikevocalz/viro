# ADR-0001: Specs manifest version 2

**Status:** Proposed (branch `feat/specs-production`, awaiting review)
**Date:** 2026-10-28
**Deciders:** Mike Allen

## Context

### Current behavior (viro `main` at `e4e9808d`)

The Specs path had one implicit data shape and no contract file.

- `ViroSpecsSceneSnapshot` was `{ version: 1, nodes }` with nodes of kind
  `group | text | image | model | panel` carrying transform, `source`, `text`
  and `visible` (`components/Specs/ViroSpecsCompiler.ts:18-28`, `:60-63`).
  Nothing emitted `panel` (`nodeKind`, `:203-213`). There was no schema, no
  migration and no validation anywhere a scene entered a host.
- The runtime compiler read props as `any` (`:161`, `:254`, `:314`), copied
  `text` and nothing else from `ViroText` (`:366`), and kept ViroImage
  dimensions nowhere.
- `viro-specs-compile --format json` (1002 lines, one file) wrote
  `{ version: 1, source, scene, polylines, interactions, animations,
  diagnostics }`. It skipped unsupported components without a diagnostic
  and compiled their children as if the component were a plain group
  (`bin/viro-specs-compile.cjs:471-480`), ignored spread attributes
  (`:141-147`), never checked duplicate `viroTag`s (no check exists in either
  compiler), and refused to write anything if any diagnostic fired
  (`:977-985`).
- `ViroSpecsScene` sent `compiled.scene` straight to `transport.applyScene`
  with no validation (`components/Specs/ViroSpecsScene.tsx:91`).

The two compilers already disagreed: the static one supported `translate*`
animations and the runtime one did not, and the runtime one passed easings
such as `Bounce` through while the static one rejected them.

### Baseline status

The audit baseline from the engineering pack (§9) and the §1 audit table were
re-checked; the full table is in [Baseline re-verification](#baseline-re-verification)
at the end of this record. Findings that shape this decision:

- Unsupported JSX, props and spreads vanished without diagnostics, and
  duplicate explicit IDs were not checked: **still present** at `e4e9808d`,
  fixed on this branch.
- Raw runtime entry points did not validate node kinds or wire versions: on
  the viro side **still present** at `e4e9808d` (`ViroSpecsScene.tsx:91`),
  fixed on this branch for every viro entry point. The Lens-side entry
  points live in `@viro-external/specs` and are outside this change.

### Forces

- The Lens runtime in `@viro-external/specs` reads scene protocol 1 today.
  This repo does not change Lens code (WS3 does, in viro-external).
- The pack requires materials, text style, image extents, model hints,
  panel layout extents, sound, video and lighting in the contract, v1 still
  accepted with a deprecation diagnostic, and capability errors rather than
  substitutes.
- The static CLI is CommonJS and cannot import the package's ESM output.

## Decision

1. **Two revision numbers.** `version: 2` is the manifest document.
   Scene protocol 1 is the wire snapshot the Lens reads. A manifest is
   lowered to the wire by `toSpecsSceneSnapshot`, which reports every field
   the wire cannot carry (`VS1015`). The protocol moves when the Lens host
   does (WS3), independently of the document.
2. **Flat, discriminated nodes.** Nodes keep v1's flat fields and add
   kind-specific ones (`style`, `extents`, `maxLines`, `format`, `opacity`,
   `materialId`). Node kinds are a discriminated union in TypeScript and a
   `oneOf` on `kind` in the schema, with `additionalProperties: false` per
   kind, so a field in the wrong kind is an error.
3. **Sibling collections.** `polylines`, `lights`, `materials`,
   `interactions` and `animations` sit next to `nodes`. Polylines,
   interactions and animations keep their v1 object shapes exactly, which
   makes migration a move rather than a rewrite.
4. **Contract entries for unsupported media.** `video` and `sound` are node
   kinds in the schema, and validation always rejects them with `VS4004` and
   `VS4005`. Portals, physics, Rive, native textures and custom rendering
   have no schema entry; the compilers report them as capability errors.
   Nothing is emitted in their place.
5. **Schema for structure, validator for meaning.** The JSON Schema
   (2020-12) is published for editors and other languages. The TypeScript
   validator implements the same structural rules plus unique IDs,
   resolvable parents and targets, cycles and capability errors. Tests run
   both over every fixture and fail if they disagree about structure. The
   runtime validator has no dependencies; ajv is a devDependency only.
6. **v1 still reads.** `parseSpecsManifest` migrates v1 documents and bare
   protocol 1 snapshots in memory and warns with `VS1002`, so `--strict`
   builds reject v1 input. `migrateSpecsManifest` converts files.
7. **One implementation for both compilers.** The contract code lives in
   `components/Specs/core/` and is compiled to CommonJS in `bin/specs-core/`
   for the CLI, so the static compiler cannot drift from the runtime one on
   validation, codes, easing or animation targets.
8. **Capability status as separate fields.** `ViroSpecsCapabilityStatus`
   records `implemented`, `installed`, `permission` and `evidence`
   separately. It is a shared type and schema definition, not a manifest
   field: a manifest describes a scene, and status describes a device.

## Options considered

### A: v2 document plus a lowered protocol 1 wire (chosen)

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium. One lowering function and its warnings. |
| Lens impact | None. The generated Lens host for the Platform Lab is byte-identical to `e4e9808d`'s. |
| Honesty | Fields the Lens cannot render are kept and reported, not dropped. |
| Migration | Lossless both ways for everything v1 could express. |

### B: Send v2 to the Lens directly

| Dimension | Assessment |
| --- | --- |
| Complexity | Low in viro, high in viro-external. |
| Lens impact | Breaks `applySceneSnapshot` until the Lens host is rewritten. |
| Honesty | Same as A once both sides ship. |

Requires coordinated releases of both repos before WS1 can merge. Rejected
for now; WS3 can move the wire to protocol 2.

### C: Nested node payloads (`{ id, kind, transform: {...}, text: {...} }`)

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium. |
| Migration | Every v1 node rewritten; round-trip tests get harder. |
| Readability | Cleaner grouping for large nodes. |

The flat form already reads well for five kinds, and the discriminated union
gives the same type safety. Rejected.

### D: ajv at runtime instead of a hand-written validator

| Dimension | Assessment |
| --- | --- |
| Complexity | Low code, but a runtime dependency in every app that imports Viro. |
| Diagnostics | ajv errors must be translated to codes and JSON Pointers anyway. |
| Semantics | Still needs custom code for IDs, references and capabilities. |

Rejected. The schema stays the published contract; conformance tests keep the
two in line.

## Trade-off analysis

Option A costs a second revision number and the `VS1015` warnings, and buys a
WS1 that merges without touching the Lens. The warnings make the gap visible:
`--format lens-ts --strict` fails on any scene that uses styling or lights
until WS3 renders them, which is the intended pressure.

The hand-written validator duplicates the schema's structural rules. The
conformance test (including a check that schema mutations make it fail) is
the guard. If a third consumer appears, generating the validator from the
schema is the next step.

## Consequences

- Easier: hand-written manifests get the same checks as compiled ones;
  editors validate files through `$schema`; WS2 can compare the two compilers
  manifest-to-manifest.
- Harder: every new field needs schema, type, validator, fixture and doc
  changes together.
- Breaking: `viro-specs-compile --format json` writes version 2.
  `ViroSpecsCompiledScene` gains `manifest`.
- Revisit: protocol 2 on the wire when WS3 lands; generating the validator
  from the schema; whether compilers should fill `materials` from
  `ViroMaterials.createMaterials`.

## Action items

1. [x] Schema, types, validator, migration, lowering, fixtures, conformance tests.
2. [x] Runtime and static compilers emit and validate v2.
3. [x] Every viro entry point validates: `ViroSpecsScene`, `applySpecsManifest`, `viro-specs-compile --entry` and `--manifest`, `validateSpecsSceneSnapshot`.
4. [ ] WS2: byte-identical v2 manifests from both compilers for the Platform Lab (today the runtime manifest omits `$schema`, `source`, and `backendPackage` on polylines and animations).
5. [ ] WS3: Lens host validates on entry, renders style, extents, opacity, materials and lights, and moves the wire to protocol 2.

## Baseline re-verification

Checked against viro `main` at `e4e9808d` (fetched 2026-10-28; `fork/main`
had not moved) and viro-external `main` at `c819554e`. Fixes cite commits on
`feat/specs-production`.

| # | Audit item (§9) | Status at baseline | Evidence | After this branch |
| --- | --- | --- | --- | --- |
| 1 | viro main at `e4e9808d`, viro-external main at `c819554e` | still present | `git rev-parse fork/main` = `e4e9808d`; viro-external `origin/main` = `c819554e` | branch starts at `e4e9808d` |
| 1b | CI runs 40397372164, 40397389449, 40397389313 | not yet verified | viro-external check by a read-only agent did not report before this commit; re-run against `c819554e` | not changed |
| 2 | `@viro-external/specs` peer `@viro-external/xr-contract ^0.2.0` vs workspace 0.3.0 | not yet verified | viro-external check by a read-only agent did not report before this commit; re-run against `c819554e` | not changed (viro-external is read-only for WS1) |
| 3a | Unsupported JSX vanishes without diagnostics | still present | static compiler skips unknown components and compiles their children as a transparent group: `bin/viro-specs-compile.cjs:471-480`; runtime reports an uncoded string: `components/Specs/ViroSpecsCompiler.ts:304-311` | fixed: `VS3001` / `VS4xxx`, subtree not compiled (`dedb69a1`, `b66e2842`) |
| 3b | Unsupported props vanish | still present | no prop check in either compiler at `e4e9808d` | fixed: `VS3002` warning, physics props `VS4002` (`dedb69a1`, `b66e2842`) |
| 3c | Spreads vanish | still present | `propsOf` skips `JSXSpreadAttribute`: `bin/viro-specs-compile.cjs:141-147` | fixed: `VS2013` error (`b66e2842`) |
| 3d | Duplicate explicit IDs not consistently checked | still present (not checked at all) | `git grep -i duplicate e4e9808d -- bin/viro-specs-compile.cjs components/Specs` finds nothing | fixed: `VS1007` from shared validation, with source position in the CLI (`0b042d7f`, `dedb69a1`, `b66e2842`) |
| 4 | Presentation replacement clears before building; deferred actions/animations have lifetime gaps | not yet verified | viro-external check by a read-only agent did not report before this commit; re-run against `c819554e` | not changed (WS3) |
| 5a | Raw runtime entry points do not validate node kinds and wire versions (viro side) | still present | `ViroSpecsScene` sends `compiled.scene` to `transport.applyScene` unvalidated: `components/Specs/ViroSpecsScene.tsx:91`; no parse entry for raw JSON | fixed: `validateSpecsSceneSnapshot` gate, `parseSpecsManifest`, `applySpecsManifest`, `--manifest` (`0b042d7f`, `dedb69a1`, `b66e2842`) |
| 5b | Same, Lens side (viro-external) | not yet verified | viro-external check by a read-only agent did not report before this commit; re-run against `c819554e` | not changed (WS3) |
| 6 | Setup copies optional/dev Lens modules broadly; doctor passes with required packages missing | not yet verified | viro-external check by a read-only agent did not report before this commit; re-run against `c819554e` | not changed (WS5/WS6) |
| 7a | Registry publication not established | not yet verified | viro-external check by a read-only agent did not report before this commit; re-run against `c819554e` | not changed |
| 7b | Physical-device validation not established | not yet verified | viro-external check by a read-only agent did not report before this commit; re-run against `c819554e` | not changed |

### §1 audit table against `e4e9808d`

| Row | Matches code? | Notes |
| --- | --- | --- |
| Portable manifest | yes | v1 types at `ViroSpecsCompiler.ts:18-28`, `:60-63`; no emitter maps to `panel` (`:203-213`); no schema file. |
| Runtime JSX compiler | yes | `any` at `:161`, `:254`, `:314`; only `text` copied from ViroText (`:366`); ordinal fallback `:315-317`. |
| Static compiler | mostly | The file is 1002 lines, not 978. "No `--strict` fail mode" is misleading: it already refused to write on any diagnostic (`:977-985`), with no way to separate warnings from errors. `.map()` is rejected as dynamic (`:405`). |
| Generated Lens host | partly stale | Four `@input`s and `throw` on missing hosts (`:918-924`) match. "No teardown" is stale: `f288d17b` added `OnDestroyEvent` teardown (`:895`, `:926-931`). `materialId` use is Lens-side, not checked here. |
| Transport | yes | Revision-guarded queue, full `applyScene` per change, no `dispose`, `onDiagnostic(message: string)` (`ViroSpecsScene.tsx:36`, `:75-144`). |
| Interaction | yes | `source` hard-coded to `0` (`ViroSpecsCompiler.ts:496`); only four phases dispatched (`:498-511`). |
| AR facade | yes | `createViroSpecsARRuntime` returns its argument (`ViroSpecsAR.ts:58`). |
| Runtime detection | yes | `__VIRO_SPECS_BUILD__` (`ViroSpecsRuntime.ts:51`); `__VIRO_SPECS_CAPABILITIES__` is read (`:61`) and written nowhere in the repo; web detection by `navigator`/`document` (`:79`). |
| Tests / CI | partly stale | 2 Jest cases: yes. "CI only on `feat/specs-*`" is stale: the workflow already ran on pushes to `main` and on PRs; `develop` was missing (now added). A static-compiler regression script existed but no goldens. |
| Docs | yes | Five specs markdowns; parity matrix with 15 rows. |
| Experience | yes | Platform Lab has one text, one GLB, one polyline. |
