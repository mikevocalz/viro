# Specs scene manifest (version 2)

The manifest is the contract between whatever produces a Specs scene and
whatever renders it. Three producers write it: the runtime compiler inside
`ViroSpecsScene`, the static compiler `viro-specs-compile`, and people writing
JSON by hand. Consumers read it: the generated Lens host, test mocks, and
previews.

- Schema: [`schemas/viro-specs-manifest.v2.json`](../schemas/viro-specs-manifest.v2.json) (JSON Schema 2020-12)
- Types: `ViroSpecsManifestV2` and friends, exported from `@reactvision/react-viro`
- Diagnostics: [`docs/specs-diagnostics.md`](specs-diagnostics.md)
- Decision records: [ADR-0001](adr/0001-specs-manifest-v2.md), [ADR-0002](adr/0002-specs-diagnostics-format.md)

## Units

| Quantity | Unit |
| --- | --- |
| position, extents, polyline points, `radiusMeters` | meters (the Lens host converts to centimeters) |
| rotation | unit quaternion `[x, y, z, w]`; compilers convert Viro's Euler degrees |
| durations, delays | seconds |
| colors | `#RRGGBB` or `#RRGGBBAA`; compilers expand `#RGB` and lower-case |
| text `fontSize` | Viro points, unchanged from `ViroText` |
| light `intensity` | Viro lumens (1000 is Viro's default) |

## Document

```json
{
  "$schema": "https://github.com/mikevocalz/viro/blob/main/schemas/viro-specs-manifest.v2.json",
  "version": 2,
  "generator": { "name": "viro-specs-compile" },
  "source": "src/SpecsScene.tsx",
  "nodes": [],
  "polylines": [],
  "lights": [],
  "materials": [],
  "interactions": [],
  "animations": []
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `version` | yes | Always `2`. Version 1 input is still read; see [Version 1](#version-1). |
| `theme` | no | Spatial tokens and wearer preferences for premium components; see [Theme](#theme). The compilers write it when a premium component compiled. |
| `nodes` | yes | Scene graph nodes, parents before children by convention (not required). |
| `polylines`, `lights`, `materials`, `interactions`, `animations` | no | Missing arrays read as empty. `parseSpecsManifest` always returns them. |
| `generator` | no | `{ name, version? }` of the producer. |
| `route` | no | Route key from `ViroSpecsScene` `route`. A new route is navigation in the Lens host. See [specs-actions.md](specs-actions.md). |
| `actions` | no | Action declarations from `ViroSpecsScene` `actions`. Required for any trigger to validate. |
| `source` | no | Entry file, relative to the working directory, `/`-separated. |
| `$schema` | no | Lets editors validate hand-written files. |

Unknown fields are errors (`VS1006`) at every level, so a typo such as
`postion` cannot pass silently.

IDs of nodes, polylines and lights share one namespace and must be unique
(`VS1007`). Material IDs have their own namespace (`VS1013`).

## Nodes

Every node has `id` and `kind`, plus these optional fields:

| Field | Type | Notes |
| --- | --- | --- |
| `parentId` | string | Must name a node in the same manifest (`VS1008`); no cycles (`VS1009`). Absent means the scene root. |
| `position` | `[x, y, z]` | Local, meters. |
| `rotation` | `[x, y, z, w]` | Local unit quaternion. |
| `scale` | `[x, y, z]` | Local. |
| `visible` | boolean | |
| `opacity` | 0 to 1 | |
| `materialId` | string | An entry in `materials`, or a material the Lens material registry provides (`VS1011`, info). |
| `label` | string | Accessible name, from `accessibilityLabel` on Viro elements or `label` on premium components. Required on every node an interaction targets (`VS3016`). |
| `component` | object | Premium component the node was compiled from; see [Premium components](#premium-components). |

| `kind` | Viro source | Required | Optional |
| --- | --- | --- | --- |
| `group` | `ViroNode`, `SpatialScrollView` | | `scroll` (from `specsScroll`, or from SpatialScrollView's `width`, `height` and its children: `width`, `height` in (0, 10] m, `contentHeight` ≥ 0). Content `y = 0` is the window's top edge. Scene protocol 1 does not carry it (`VS1015`). |
| `text` | `ViroText` | `text` | `style`, `extents` (from `width`/`height`), `maxLines` |
| `image` | `ViroImage` | `source` | `extents` |
| `model` | `Viro3DObject` | `source` | `format`: `glb`, `gltf`, `obj`, `fbx` |
| `panel` | `SpatialPanel`, `PanelButton` | `extents` | |
| `video` | none | `source` | `extents`, `loop`, `muted` |
| `sound` | none | `source` | `loop`, `volume` |

`style` holds `fontFamily`, `fontSize`, `fontWeight` (`normal`, `bold`,
`100`–`900`), `fontStyle`, `color`, `textAlign` and `textAlignVertical`.

`source` is an asset ID. The static compiler turns `require("./a.glb")` into a
path relative to the working directory; the runtime compiler uses the app's
`sourceResolver`. The Lens asset registry binds IDs to Lens assets.

`video` and `sound` are in the schema so the contract names them, and every
validator rejects them with capability errors `VS4004` and `VS4005`: no Specs
host plays video or audio. A manifest that contains them never reaches the
Lens.

## Premium components

The six components in `components/Specs/premium/` compile to ordinary node
kinds plus a `component` object the Lens host reads to draw them from the
theme tokens. `component.type` must match the node kind (`VS1004`).

| Component | `kind` | `component` |
| --- | --- | --- |
| `SpatialPanel` | `panel` | `{ type: "spatial-panel", title? }` |
| `PanelText` | `text` | `{ type: "panel-text", role: "title" \| "body" \| "label", tone: "default" \| "muted" }` |
| `PanelButton` | `panel` | `{ type: "panel-button", state: "idle" \| "selected" \| "disabled" \| "loading" \| "error", errorMessage? }` |
| `PanelImage` | `image` | `{ type: "panel-image" }` |
| `SpatialScrollView` | `group`, which must have `scroll` (`VS1005`) | `{ type: "scroll-view", itemHeightMeters, initialIndex }` |
| `ModelViewer` | `model` | `{ type: "model-viewer", autoRotate, resettable }` |

`hover` and `pressed` are not authored states; the host adds them from
interaction phases. Props and behavior: `docs/specs-experience.md`.

## Theme

```json
"theme": {
  "version": 1,
  "tokens": { "distance": {}, "type": {}, "color": {}, "tint": {}, "space": {}, "shape": {}, "depth": {}, "motion": {}, "opacity": {}, "input": {} },
  "highContrast": { "color": {}, "surfaceOpacity": 1, "borderScale": 2, "typeBoostDeg": 0.2 },
  "preferences": { "highContrast": false, "reducedMotion": false }
}
```

Every token group must have exactly the keys of `VIRO_SPECS_SPATIAL_TOKENS`
in `components/Specs/core/tokens.ts` (`VS1005`, `VS1006`): numbers where the
default is a number, `#RRGGBB` where it is a color (`VS1004`). The values come
from `docs/ux/spatial-tokens.md`. Units are in the key names: `Deg` is an
angle at the node's distance, `Meters` a physical offset, `Ms` milliseconds.
Scene protocol 1 cannot carry the theme (`VS1015`); scene protocol 2 does.

## Polylines

World-space lines from `ViroPolyline`. The compilers apply every ancestor
transform before writing the points.

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | |
| `points` | yes | At least two `[x, y, z]`, world space. |
| `radiusMeters` | yes | Greater than 0. Half of `thickness` times the largest world scale axis. |
| `materialId` | no | |
| `primitive`, `backendPackage` | no | Lens-side hints, `volumetric-line` and `VolumetricLine` today. |

## Lights

From `ViroAmbientLight`, `ViroDirectionalLight`, `ViroOmniLight` and
`ViroSpotLight`. Discriminated by `type`.

| `type` | Required | Optional |
| --- | --- | --- |
| `ambient` | | `color`, `intensity`, `parentId` |
| `directional` | `direction` | same |
| `omni` | `position` | same |
| `spot` | `position`, `direction` | same, plus `innerAngle`, `outerAngle` (degrees) |

## Materials

`{ id, color?, opacity?, texture?, lightingModel? }`. `lightingModel` is one of
`constant`, `lambert`, `blinn`, `phong`, `pbr`. The compilers do not fill
`materials` yet; Viro material names arrive as `materialId` and bind through
the Lens material registry.

## Interactions

One entry per node with `onHover`, `onClick`/`onClickState` or `onDrag`:

```json
{ "nodeId": "model", "interactable": true, "manipulation": true, "events": ["select", "drag"] }
```

`events` is a non-empty set of `hover`, `select`, `drag`. `nodeId` must name a
node (`VS1010`). React callbacks never cross into the Lens; the IDs route back
to them through the transport.

An entry may carry `triggers` from the node's `specsAction` prop: typed
actions the node fires, as JSON. A node with `specsAction` and no callback
still gets an entry, with the events its triggers need.

```json
{ "nodeId": "card-orrery", "interactable": true, "manipulation": false, "events": ["select"],
  "triggers": [{ "on": "select", "actionId": "exhibit.open", "payload": { "exhibitId": "orrery" } }] }
```

`on` is `select`, `hover-enter` or `hover-exit` (`VS1019` when the entry's
`events` lack it). `actionId` must be declared in `actions` (`VS1017`, and
`VS1016` for a repeated declaration), and `payload` must match the
declaration (`VS1018`). The full contract is in [specs-actions.md](specs-actions.md).

## Animations

```json
{
  "nodeId": "title",
  "name": "pulse",
  "plan": {
    "engine": "AnimationPlayer",
    "durationSeconds": 0.5,
    "delaySeconds": 0,
    "easing": "ease-in-out",
    "playbackMode": "loop",
    "completionEvent": "viro-animation-complete:title:pulse",
    "tracks": [{ "target": "transform.scale.x", "from": "current", "to": 1.15 }]
  }
}
```

Relative Viro values (`"+=45"`, `"*=1.2"`) are resolved against the element's
own props at compile time, so `to` is always absolute. `translate*` values are
offsets from the element's position. Easing is one of `linear`, `ease-in`,
`ease-out`, `ease-in-out`; any other Viro easing is an error (`VS3006`) rather
than a substitute curve.

## What reaches the Lens

The Lens runtime in `@viro-external/specs` reads two scene protocols, and
`ViroSpecsSceneController` checks the version before touching the live
scene (`VS5001` for anything else):

| Protocol | Built by | Carries | Read by |
| --- | --- | --- | --- |
| 2 | `toSpecsSceneDocument(manifest)` | every node field of manifest v2 (style, extents, maxLines, opacity, materialId, format), plus polylines, lights, materials, interactions, animations | `ViroSpecsSceneController`, the generated Lens host, transports with `applySceneDocument` |
| 1 | `toSpecsSceneSnapshot(manifest)` | `{ version: 1, nodes }` with transform, `source`, `text`, `visible` | transports that only implement `applyScene`, the legacy `ViroSpecsRuntimeHost` |

A protocol 2 document is the manifest without `$schema`, `generator` and
`source`, and without video and sound nodes (validation already rejected
them). `viro-specs-compile --format scene-json` writes one, and
`--format lens-ts` embeds one in the generated host, so neither reports
`VS1015`.

Lowering to protocol 1 still reports every field it drops with `VS1015`
(warning). `ViroSpecsScene` and `applySpecsManifest` only lower when the
transport has no `applySceneDocument`, and only then report it.

## Entry points

Every path into a host validates first:

| Input | Entry point | Checks |
| --- | --- | --- |
| Viro JSX at runtime | `ViroSpecsScene` / `compileViroSpecsChildren` | compile diagnostics, manifest validation, protocol gate; errors block `applyScene` |
| Viro JSX at build time | `viro-specs-compile --entry` | the same, with file:line:col; errors block output |
| Manifest JSON file | `viro-specs-compile --manifest` | version, migration, validation |
| Manifest value in app code | `parseSpecsManifest`, `applySpecsManifest` | version, migration, validation, lowering, protocol gate |
| Scene snapshot | `validateSpecsSceneSnapshot` | protocol version 1, wire kinds, fields, IDs, parents |
| Anything arriving in the Lens | `ViroSpecsSceneController` (`@viro-external/specs`) | protocol 1 or 2, every field, IDs, parents, cycles, references; `VS5001`/`VS5002` and the live scene stays |

```ts
import { applySpecsManifest, formatViroSpecsDiagnostic } from "@reactvision/react-viro";

const result = await applySpecsManifest(transport, JSON.parse(text), { file: "scene.json" });
if (!result.applied) {
  for (const d of result.diagnostics) console.error(formatViroSpecsDiagnostic(d));
}
```

## Schema and validator

The JSON Schema covers structure. `validateSpecsManifestV2` covers the same
structure plus what a schema cannot express: unique IDs, resolvable parents
and targets, parent cycles and capability errors. CI runs both over every
fixture in `__test__/fixtures/specs/` and fails if they disagree about
structure.

## Version 1

Version 1 is the document `viro-specs-compile --format json` wrote before this
change: `{ version: 1, source, scene: { version: 1, nodes }, polylines,
interactions, animations, diagnostics }`. A bare scene snapshot
`{ version: 1, nodes }` also counts as version 1.

Version 1 input is still accepted everywhere. It is migrated in memory and
reported with `VS1002` (warning), so `--strict` builds reject it. Convert files
once:

```bash
viro-specs-compile --manifest scene.v1.json --out scene.json
```

or in code with `migrateSpecsManifest(v1)`. Migration is lossless: v1 node,
polyline, interaction and animation objects already have their v2 shape;
`scene.nodes` moves to `nodes`; `lights` and `materials` start empty; the v1
`diagnostics` array is dropped. A v1 image or model without `source` was legal
in v1 and fails v2 validation with `VS1005`.

## Changes for existing callers

- `viro-specs-compile --format json` now writes version 2. Readers of the old
  file should call `parseSpecsManifest`, which accepts both.
- `ViroSpecsCompiledScene.diagnostics` and `ViroSpecsScene`'s `onDiagnostic`
  carry `ViroSpecsDiagnostic` objects instead of strings. Use
  `formatViroSpecsDiagnostic(d)` where a string is needed.
- `ViroSpecsScene` no longer applies a scene that has errors. Previously an
  unsupported child was skipped and the rest applied.
- The static compiler used to drop unknown components (compiling their
  children as if the component were a plain group) and spread props without
  a word. Both are now errors. Portals, physics, Rive, video, audio, native
  textures and custom rendering get capability errors in both compilers;
  the runtime compiler previously reported them only as an untyped
  "Unsupported Specs JSX child" string.
- React fragments inside `ViroSpecsScene` are walked by the runtime compiler.
  They used to be reported as unsupported children.
- `ViroSpecsCompiledScene` gains `manifest`. `scene` is the lowered protocol 1
  snapshot, unchanged in shape.
