# ADR-0003: Specs element and asset IDs

**Status:** Proposed (branch `feat/specs-compiler`, awaiting review)
**Date:** 2026-10-28
**Deciders:** Mike Allen

## Context

Every node, polyline and light in a Specs manifest has an `id`. The Lens host
binds SceneObjects to it, interactions and animations target it, and the
runtime compiler routes callbacks back to React through it. When an ID moves
from one element to another, a tap on one card runs another card's
`onClick`.

### Behavior before this decision (`929e5680`)

- Both compilers used `viroTag` when present.
- The runtime compiler fell back to the React `key`, then to
  `viro-specs-<n>`, where `n` counted every untagged element in the scene in
  document order (`components/Specs/ViroSpecsCompiler.ts:518-535` at
  `929e5680`). The static compiler did the same without the `key` step.
- Inserting, removing or reordering any untagged element renumbered every
  later untagged element in the scene, so callbacks moved between elements.
  `VS3012` warned about it.
- React keys are only unique among siblings. Two `.map()` lists that both
  used `key={index}` produced the same ID twice.
- Asset IDs for `require()` were `path.relative(process.cwd(), asset)` with
  the OS separator normalized afterwards. Running the CLI from another
  directory changed every asset ID.

### Forces

- The pack (§2, §6 WS2) asks for content-hash IDs from
  `kind + parent + ordinal + text/source` when `viroTag` is absent, `viroTag`
  required under `--strict`, and asset IDs independent of the working
  directory and path separator.
- The runtime compiler and the CLI must agree on every ID, byte for byte,
  because the Lens host can receive either manifest.
- The runtime compiler runs in Hermes and JSC: no `node:crypto`, no Buffer.

## Decision

1. **`viroTag` is the ID** when it is a non-empty string. Nothing else is.
2. **Otherwise the ID is a content hash:**
   `<kind>-<12 hex>` over `JSON.stringify([kind, parentId, ordinal, content, key])`.
   - `kind` is the node kind, `polyline` or `light`.
   - `parentId` is the ID of the enclosing node (empty at the root), so the
     hash chains down the tree.
   - `content` is the text for `text`, the asset ID for `image` and `model`,
     the local points for `polyline`, the light type for `light`, and empty
     for `group`.
   - `key` is the React key when present. It feeds the hash; it is never
     the ID, because keys are only unique among siblings.
   - `ordinal` counts earlier siblings with the same kind, content and key.
     It is 0 unless two siblings are identical.
3. **Hash function:** two 32-bit FNV-1a passes with different offset bases
   (`Math.imul`), 24 bits from each. It is deterministic in Node, Hermes and
   JSC and needs no dependency. It is not cryptographic and does not need to
   be: collisions are caught by duplicate-ID validation (`VS1007`).
4. **`VS3012` stays a warning** on every untagged element and now names the
   assigned ID. `--strict` turns it into a failure, which is how `viroTag`
   becomes required.
5. **Duplicate IDs** are still found once, by validation (`VS1007`). The
   static compiler reports it at the second element and names the first:
   `First declared at scene.tsx:9:7.`
6. **Asset IDs** are the asset's path relative to the project root, with
   forward slashes, computed from two absolute paths after normalization
   (`specsAssetIdFromPath` in `components/Specs/core/ids.ts`). The project
   root is the nearest ancestor of the entry file with a `package.json`, or
   `--root`. The manifest `source` uses the same rule. Diagnostic `file`
   paths stay relative to the working directory so terminals can open them.
7. The implementation lives in `components/Specs/core/ids.ts` and is called
   from `ViroSpecsSceneBuilder`, which both compilers use.

## Options considered

### A: Content hash with a per-bucket ordinal (chosen)

| Dimension | Assessment |
| --- | --- |
| Reorder stability | Distinct siblings keep their IDs. Only identical twins swap, and they look the same. |
| Edit stability | Changing an element's text or source changes its ID and its descendants' IDs. |
| Parity | One function in the shared core; the goldens and `ViroSpecsCore.test.tsx` check both compilers agree. |
| Cost | One FNV pass per element. Not measurable next to parsing. |

### B: Global ordinal (previous behavior)

| Dimension | Assessment |
| --- | --- |
| Reorder stability | None. Any insertion renumbers everything after it. |
| Edit stability | Text edits keep the ID. |
| Parity | Easy, but any difference in what each compiler skips shifts every later ID. |

Rejected: it is the bug the pack names.

### C: Hash of kind, parent and sibling index (the pack's wording read literally)

| Dimension | Assessment |
| --- | --- |
| Reorder stability | Reordering siblings swaps their IDs, which is the callback-rebinding bug at sibling scope. |
| Edit stability | Text edits keep the ID. |

Rejected. The pack's stated goal is "a reorder does not rebind callbacks".
Counting the ordinal within identical siblings instead of all siblings
satisfies the formula and the goal.

### D: Use the React `key` as the ID

Keys collide across lists (`key={index}` in two `.map()` calls) and across
parents. Rejected as an ID; kept as hash input.

## Trade-off analysis

A content hash ties identity to what the element shows. Editing an untagged
label changes its ID, so the Lens host recreates that SceneObject instead of
updating it, and any app state keyed on the old ID is lost. Option B kept the
ID through text edits but broke on every reorder, which is worse for
callbacks: a recreated node is visible and correct, while a rebound callback
runs the wrong code. Elements whose identity must survive edits need a
`viroTag`, and `--strict` enforces that for production builds.

Marc Rousavy's bar for a native boundary is that identity is explicit and
typed, which argues for requiring `viroTag` outright. Sebastian Markbåge's
point about React is that keys exist so reconciliation does not depend on
position, and the hash follows that: position matters only between identical
siblings. Requiring `viroTag` everywhere would break every existing scene, so
the decision keeps the hash as the default and makes the requirement opt-in
through `--strict`.

## Consequences

- Easier: reordering, inserting and removing untagged elements keeps the
  other elements' IDs and callbacks; the CLI writes the same bytes from any
  working directory and on Windows.
- Harder: untagged IDs are opaque (`text-538ff9754de1`) and change when
  content changes. Logs and LEAF scenarios should target `viroTag`s.
- Breaking: untagged elements get new IDs, and a React key alone no longer
  becomes the ID. Apps that relied on `key` as the Lens ID must add `viroTag`.
  Asset IDs from CLI runs outside the project root change to project-root
  relative ones.
- Revisit: if the Lens host (WS3) diffs by ID, consider a stable-across-edits
  scheme for untagged nodes (for example matching by position plus kind
  during diff) instead of changing the ID rule.

## Action items

1. [x] `components/Specs/core/ids.ts`: hash, allocator, path normalization, asset IDs.
2. [x] Both compilers allocate through `ViroSpecsSceneBuilder`.
3. [x] Goldens `ids-content-hash`, `ids-key-hash`, `ids-duplicate`; reorder and cross-compiler tests in `__test__/ViroSpecsCore.test.tsx`; cwd and `--root` checks in `scripts/test-viro-specs-compiler.cjs`.
4. [ ] WS3: Lens host diff by ID, and a decision on edit-stable IDs for untagged nodes.
