# Specs actions and state

A pinch on SPECS becomes a typed action, the action changes app state, and
the new state renders a new scene. This page covers the contract, the React
Native side (Zustand), the standalone Lens side, lifetimes and diagnostics.
Decision record: [ADR-0004](adr/0004-specs-typed-actions.md).

```
pinch on a card ─▶ trigger on the node ─▶ typed action { actionId, payload }
   ─▶ reducer(state, payload) ─▶ new state ─▶ scene (same route: patch, new route: navigate)
```

## The contract

An action has a stable ID and a declared payload. A payload is a flat object
of strings, finite numbers and booleans, so it crosses any transport as JSON.
Functions never enter a scene: a React closure has no meaning in the Lens.

```ts
import { defineSpecsActions, specsTrigger } from "@reactvision/react-viro";

export const LAB_SPEC = {
  "exhibit.open": { payload: { exhibitId: { type: "string" } } },
  "settings.set-units": { payload: { units: { type: "string", enum: ["metric", "imperial"] } } },
  "nav.back": {},
} as const;
export const LAB_ACTIONS = defineSpecsActions(LAB_SPEC);
```

| Part | Rule |
| --- | --- |
| Action ID | Lowercase segments joined by dots: `exhibit.open`, `settings.set-units`. Unique per manifest (`VS1016`). |
| Field type | `string`, `number`, `integer` (whole number) or `boolean`. `enum` on strings only. `optional: true` allows absence. |
| Trigger | `{ on, actionId, payload? }` on a node. `on` is `select` (completed pinch or click), `hover-enter` or `hover-exit`. |

A node fires an action through its `specsAction` prop, one trigger or an
array. `specsTrigger` checks the payload against the declaration at compile
time:

```tsx
<ViroText
  viroTag={"card-" + exhibit.id}
  text={exhibit.title}
  specsAction={specsTrigger(LAB_ACTIONS, "exhibit.open", { exhibitId: exhibit.id })}
/>
```

The compilers write triggers into the node's interaction entry and add the
events they need, so a node with `specsAction` and no `onClick` is still
pinchable. In the manifest:

```json
{ "nodeId": "card-orrery", "interactable": true, "manipulation": false, "events": ["select"],
  "triggers": [{ "on": "select", "actionId": "exhibit.open", "payload": { "exhibitId": "orrery" } }] }
```

`ViroSpecsScene`'s `actions` prop puts the declarations in the manifest's
`actions` list; validation checks every trigger against it.

## React Native: a Zustand store

viro already depends on Zustand. `bindSpecsActionsToStore` binds one pure
reducer per action to any store with `getState` and `setState(next, true)`;
a Zustand `StoreApi` has both.

```tsx
import { createStore, useStore } from "zustand";
import { ViroSpecsScene, ViroNode, ViroText, bindSpecsActionsToStore } from "@reactvision/react-viro";

const store = createStore<LabState>(() => INITIAL_STATE);
const dispatcher = bindSpecsActionsToStore(store, LAB_ACTIONS, {
  "exhibit.open": (s, { exhibitId }) => ({ ...s, route: "details", selectedId: exhibitId }),
  "settings.set-units": (s, { units }) => ({ ...s, units }),
  "nav.back": (s) => ({ ...s, route: "list" }),
});

function Lab({ transport }) {
  const state = useStore(store);
  return (
    <ViroSpecsScene transport={transport} route={state.route}
      actions={dispatcher.declarations} onAction={dispatcher.dispatch}>
      {state.route === "list" ? renderList(state) : renderDetails(state)}
    </ViroSpecsScene>
  );
}
```

The reducer map must name every declared action; TypeScript reports a
missing one, and a JavaScript caller gets `VS3017` when the action arrives.
A reducer that returns the state it was given changes nothing.

Without a store, `createSpecsActionDispatcher(LAB_ACTIONS, handlers)` calls
plain handlers instead.

The Specs compilers map Viro elements, not user components, so build views
as functions that return elements (`renderList(state)`), not as
`<ListView />`. A component reports `VS3001`.

The full screen is `examples/specs-platform-lab/SpecsActionsLab.tsx`.

## Lens: standalone, no phone

Inside the Lens the same loop runs with no phone or server
(`@viro-external/specs`, `lens/ViroSpecsActionRuntime.ts`):

```ts
const registry = new ViroSpecsActionRegistry<LabState>(LAB_DECLARATIONS, host.diagnosticsChannel);
registry.on("exhibit.open", (s, p) => ({ ...s, route: "details", selectedId: String(p.exhibitId) }));
registry.on("settings.set-units", (s, p) => ({ ...s, units: p.units === "imperial" ? "imperial" : "metric" }));
registry.on("nav.back", (s) => ({ ...s, route: "list" }));

const runtime = new ViroSpecsActionRuntime(host, { initialState, view, registry, diagnostics: host.diagnosticsChannel });
runtime.start();
```

`view(state)` returns a protocol 2 scene document with `route` and
`actions`. A render the controller rejects rolls the state back, so state
always matches what the wearer sees. `ViroSpecsActionsLab` and
`ViroSpecsReferenceFlow` in that package are the Lens versions of the lab.

## Transport (optional)

Neither side needs the other. When a phone app drives the Lens:

- The Lens host resolves triggers and sends actions. Forward
  `ViroSpecsSceneController.addOnActionListener` (or `ViroSpecsActionRuntime`'s
  `forward`) over your transport, and implement `onAction` on the
  `ViroSpecsSceneTransport`. `ViroSpecsScene` passes each action to `onAction`.
- A transport that only implements `onInteraction` still works:
  `ViroSpecsScene` resolves triggers on the phone against the scene the
  transport last applied, never a newer render.

Either way the phone checks every action against its declarations again and
drops undeclared (`VS1017`) or ill-typed (`VS1018`) ones.

## Navigation and scroll position

`route` names the screen a scene belongs to. When an update names a
different route than the committed scene, the Lens controller navigates:
it stages the new scene invisibly, commits it and retires the old one,
instead of patching node by node. The same route patches, so a setting change
touches only the nodes whose fields changed.

Before retiring a scene the controller remembers the scroll position of its
scroll groups (`ViroNode` `specsScroll`, manifest `scroll`) under its route,
and restores it when that route is presented again. Back from details to the
list lands at the row the wearer left. The controller keeps 16 routes by
default (`maxRememberedRoutes`); evicting one is `VS5020`.

## Lifetimes

A trigger fires while Spectacles Interaction Kit is inside its callback, and
the action usually replaces the scene that holds the Interactable. The
controller therefore delivers each action one frame later, as work owned by
the scene that showed the node. If that scene is retired first, by a
navigation or a replacement, the action is dropped with `VS5018` and no
handler runs. A patch on the same route does not retire the scene, so the
queued action still runs.

## Diagnostics

| Code | Severity | When |
| --- | --- | --- |
| `VS1016` | error | An action ID is declared twice. |
| `VS1017` | error | A trigger names an undeclared action; or the phone received one. |
| `VS1018` | error | A trigger payload, or a payload from a transport, does not match its declaration. |
| `VS1019` | error | A trigger's `on` is not enabled by the interaction's `events`. |
| `VS3016` | error | `specsAction` is not a JSON trigger (a closure, a nested payload, an unknown field). |
| `VS3017` | warning | A declared action reached the phone with no handler. |
| `VS5015`–`VS5017` | error | Lens: undeclared, duplicate, ill-typed. A scene with them is rejected; a dispatch is dropped. |
| `VS5018` | info | Lens: a queued action's scene was retired. |
| `VS5019` | warning | Lens: declared action with no handler and no `forward`. |
| `VS5020` | info | Lens: route memory full. |

Details for each are in [specs-diagnostics.md](specs-diagnostics.md).

## Known limitations

- Payloads are flat. Nested objects and arrays are `VS1004` in a manifest and
  `VS3016` in JSX.
- Triggers fire on `select`, `hover-enter` and `hover-exit`. Drag and cancel
  do not fire actions; use `onDrag` on the phone.
- The static compiler reads `actions`, `route` and `specsAction` only when
  they are static literals or same-file constants. `defineSpecsActions(...)`
  is a call, so in a statically compiled file pass the declaration array
  itself; anything else is `VS2014`.
- Scene protocol 1 transports (`applyScene` only) carry neither `route` nor
  `scroll` (`VS1015`), so back navigation there resets the scroll position.
- `specsAction` and `specsScroll` are ignored by ViroCore renderers. Whether
  every native view manager ignores the extra props silently has not been
  checked on device.

## Evidence

`portable-test-passed`: `npm run test:specs` (`__test__/ViroSpecsActions.test.tsx`,
`__test__/ViroSpecsManifest.test.ts`), `npm run test:specs-compiler`, and in
viro-external `pnpm --filter @viro-external/specs specs:test-host`. Nothing
here has run in Lens Studio Preview or on SPECS hardware.
