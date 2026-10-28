# ADR-0004: Typed Specs actions, app state and the Zustand binding

**Status:** Proposed (branch `feat/specs-actions`, awaiting review)
**Date:** 2026-10-28
**Deciders:** Mike Allen
**Related:** ADR-0001 (manifest v2), ADR-0002 (diagnostics), viro-external
ADR 0002 (incremental apply) and ADR 0003 (Lens action runtime)

## Context

### Behavior at `feat/specs-host` (`587142ed`)

- A Specs interaction reached app code only as a raw event. The Lens sent
  `{ phase, targetId }`, and `dispatchViroSpecsInteraction` called the
  node's React `onClick`/`onHover`/`onDrag` closure kept in a phone-side map
  (`components/Specs/ViroSpecsCompiler.ts`, `callbacks`). Nothing in the
  manifest said what a pinch meant, so a Lens without a phone could not act
  on it.
- The manifest had no route. Every state change and every screen change went
  to the Lens the same way, and the controller patched node by node. Going
  from a list to a details screen removed the list's nodes, so returning
  recreated the list scrolled to the top.
- Manifest v2 group nodes had no `scroll` field, although the Lens protocol
  reads `scroll` on groups.
- Zustand 5.0.16 is already in viro's `dependencies` and is used by
  `components/CanvasPanel/useCanvasPanel.ts`.

### Forces

- The pack (§9 WS3b) asks for pinch or select → a typed semantic action with
  a stable ID and typed payload → app state (Zustand on React Native, a
  portable contract in the Lens) → a visible update; a Lens handler registry
  so an experience runs standalone; the list → details → setting → back flow
  with the scroll position kept; queued actions invalidated by navigation
  through the WS3 ownership model; transport optional.
- React closures cannot cross the transport and must never be serialized.
- Every new limitation needs a diagnostic code and a doc line.

## Decision

1. **Actions are data in the manifest.** `actions[]` declares each action:
   an ID matching `^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$` and a payload of
   typed fields (`string` with optional `enum`, `number`, `integer`,
   `boolean`, each optionally `optional`). Interaction entries carry
   `triggers[]`: `{ on: select | hover-enter | hover-exit, actionId,
   payload? }`. Payloads are flat JSON. Validation reports `VS1016`
   (duplicate), `VS1017` (undeclared), `VS1018` (ill-typed) and `VS1019`
   (trigger on an event the node does not enable). Both fields are optional,
   so every existing manifest and golden is unchanged.
2. **One prop in JSX.** `specsAction={specsTrigger(actions, id, payload)}` on
   any mapped element. Both compilers read it through one shared function
   (`readSpecsActionProp`) and report anything that is not a JSON trigger,
   including a closure in the payload, as `VS3016`. `defineSpecsActions`
   gives the TypeScript payload types; `specsTrigger` checks call sites.
3. **The Lens resolves triggers.** The controller looks up a node's triggers
   when the interaction arrives and delivers the action one frame later,
   owned by the scene (viro-external ADR 0003). Transports forward resolved
   actions through `onAction`. A transport with only `onInteraction` still
   works: `ViroSpecsScene` resolves triggers against the manifest the
   transport last applied, so a late pinch on a node that has left the
   screen fires nothing.
4. **Routes make navigation explicit.** `ViroSpecsScene` `route` becomes
   manifest `route`. A changed route is navigation (transactional present on
   the Lens), the same route is a patch. The controller remembers scroll
   positions per route, which is what keeps the list's position on back.
   Group nodes gain `scroll` (from `ViroNode` `specsScroll`), matching the
   Lens protocol.
5. **Zustand through a structural binding, no new dependency.**
   `bindSpecsActionsToStore(store, actions, reducers)` takes any
   `{ getState(): S; setState(next: S, replace: true): void }`. A Zustand
   `StoreApi` satisfies it as is, and so would another store with those two
   methods. Reducers are pure `(state, payload, event) => state`, the same
   shape as Lens handlers, so one reducer module can serve both. The
   reducer map is required per declared action, so TypeScript reports a
   missing one; `VS3017` covers JavaScript callers.
   `createSpecsActionDispatcher` covers state held elsewhere.

## Options considered

### Store integration

#### A: Structural binding typed against Zustand's `setState(next, true)` (chosen)

| Dimension | Assessment |
| --- | --- |
| Dependency cost | None: Zustand 5.0.16 is already a runtime dependency |
| Coupling | Two methods; `zustand` is imported only by the example and tests |
| Correctness | Full-state replacement, so reducers are complete and testable alone |
| Familiarity | Reducers look like Zustand actions without the `set` call |

#### B: Import Zustand in the binding (`StoreApi<S>` parameter, `create` helper)

| Dimension | Assessment |
| --- | --- |
| Dependency cost | None today |
| Coupling | Ties the Specs API to Zustand's major version |
| Correctness | Same |

Rejected: it buys no behavior over A and makes a Zustand 6 upgrade a Specs
API change.

#### C: A thin adapter only, apps wire Zustand themselves

| Dimension | Assessment |
| --- | --- |
| Dependency cost | None |
| Ergonomics | Each app repeats the getState/compare/setState glue |

Rejected: Zustand is already in the tree, so the glue belongs in the
library. `createSpecsActionDispatcher` remains the adapter for other stores.

### Where triggers resolve

#### A: On the Lens, actions on the wire (chosen)

The Lens knows which scene the wearer saw and owns its lifetime, so a
navigation between pinch and delivery drops the action there (`VS5018`)
before it crosses the transport. The same path serves a standalone Lens.

#### B: On the phone from raw interactions

The phone cannot tell which scene the Lens showed when an event left it; a
stale event can resolve against a newer render. Kept only as the fallback
for transports without `onAction`, resolved against the last applied scene.

### Payload shape

Flat JSON (chosen) over nested JSON: flat payloads have one obvious schema,
compare cheaply in the diff, and cover IDs, enums and flags. Nested data
belongs in app state, keyed by an ID in the payload.

## Trade-off analysis

Typed declarations duplicate a little of what TypeScript already knows, but
they are the only part of the type that survives into JSON and into the
Lens, where there is no TypeScript at runtime. Resolving on the Lens puts
lifetime rules where the lifetimes are; the phone fallback is weaker and is
documented as such. Route-based navigation is one string per scene and
replaces guessing navigation from how many nodes changed.

## Consequences

- Easier: a pinch means the same thing on the phone, in a standalone Lens,
  and in a test; LEAF scenarios can dispatch actions by ID.
- Easier: reducers are unit-testable without React or a device.
- Harder: action IDs are a public contract; renaming one is a breaking
  change for both sides.
- Changed: `compileViroSpecsChildren` takes an optional third argument
  (`actions`, `route`). `ViroCommonProps` gains `specsAction` and
  `specsScroll`. Manifest v2 gains optional `route`, `actions`,
  `interactions[].triggers` and group `scroll`.
- Revisit: drag-end triggers; nested payloads if a real case needs them;
  whether ViroCore view managers warn about the two Specs-only props.

## Evidence

| Claim | Label | Where |
| --- | --- | --- |
| Schema, validator, codes, both compilers | portable-test-passed | `npm run test:specs` (71 tests), `npm run test:specs-compiler` (34 groups) |
| Reference flow on a mock transport with a real Zustand store | portable-test-passed | `__test__/ViroSpecsActions.test.tsx` |
| Compiled documents drive the real Lens controller, scroll position kept | portable-test-passed | viro-external `scripts/actions-fixtures.test.mjs` |
| Lens Studio compile, Preview, device | not verified | Lens lane |

## Action items

1. [x] Contract, validation, schema, compilers, dispatcher and store binding.
2. [x] `SpecsActionsLab`, fixtures, viro-external fixture test.
3. [ ] Lens lane: LEAF scenario for the reference flow (select, setting,
   back, scroll retained) and for a pinch queued across navigation.
4. [ ] A phone transport that forwards `addOnActionListener` (WS6/WS7).
5. [ ] Check ViroCore view managers with `specsAction`/`specsScroll` set.
