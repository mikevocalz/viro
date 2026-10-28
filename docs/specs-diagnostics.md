# Specs diagnostics reference

Every finding from a Specs producer is a `ViroSpecsDiagnostic` with a stable
code. The runtime compiler (`compileViroSpecsChildren` inside
`ViroSpecsScene`), the static compiler (`viro-specs-compile`), manifest
validation and the runtime transport all use the same catalog, so a code means
the same thing wherever it appears.

```ts
interface ViroSpecsDiagnostic {
  code: ViroSpecsDiagnosticCode; // "VS1007"
  severity: "error" | "warning" | "info";
  nodeId?: string;    // node, polyline or light the finding is about
  file?: string;      // relative to the working directory
  line?: number;      // 1-based
  col?: number;       // 1-based
  fieldPath?: string; // JSON Pointer into the manifest, e.g. "/nodes/2/position"
  message: string;    // what is wrong, naming the element and value
  hint: string;       // how to fix it
}
```

The catalog lives in `components/Specs/core/diagnosticCodes.ts`
(`VIRO_SPECS_DIAGNOSTICS`). This page is checked against it in CI: every code
must have a heading here with its severity, and this page may not mention a
code the catalog lacks.

## Severity

| Severity | Meaning | `viro-specs-compile` | `ViroSpecsScene` |
| --- | --- | --- | --- |
| `error` | The output would misrepresent the source. | Writes nothing, exits 1. | Does not apply the scene; the previous scene stays. |
| `warning` | The output is faithful but drops or approximates something the author wrote. | Writes output, exits 0. With `--strict`, writes nothing and exits 1. | Applies the scene and reports the warning. |
| `info` | No effect on output. | Writes output. | Applies the scene. |

Severity is fixed per code. A producer can replace the hint with a more
specific one but cannot change the severity.

## Output formats

`viro-specs-compile` prints one diagnostic per entry:

```text
[viro-specs] src/SpecsScene.tsx:14:9 error VS4004: ViroVideo needs video, which the Specs target does not implement. It was not compiled and no stand-in was emitted.
  hint: The Specs host has no video player. Render video on ViroCore only.
```

With `--diagnostics-format json`, stderr holds only a JSON array of
`ViroSpecsDiagnostic` objects, for editors and CI annotations.

In app code, format a diagnostic with `formatViroSpecsDiagnostic(d)` and test a
set with `hasViroSpecsErrors(ds)`.

## Codes

Ranges: `VS1xxx` manifest and protocol validation, `VS2xxx` static source
analysis, `VS3xxx` compile semantics shared by both compilers plus the runtime
transport, `VS4xxx` capability errors, `VS5xxx` the Lens scene host
(`ViroSpecsSceneController` in `@viro-external/specs`). Codes are append-only, and gaps in
the numbering are unassigned. Duplicate IDs are reported once, as `VS1007`,
by validation, whichever producer built the manifest.

Capability errors (`VS4xxx`) cover features the Specs target does not
implement: portals, physics, Rive, video, audio, native textures and custom
rendering. They are always errors. The compilers never emit a group, an image
or any other stand-in in their place, because a stand-in would look like
support.

## Manifest and protocol validation (VS1xxx)

### VS1000 · error

Manifest JSON could not be parsed.

Emitted by parseSpecsManifestJson, `viro-specs-compile --manifest`.

Fix: Check the file for a JSON syntax error at the reported position.

### VS1001 · error

Manifest is not a JSON object.

Emitted by parseSpecsManifest, applySpecsManifest, `viro-specs-compile --manifest`.

Fix: A manifest is an object with a numeric `version` and a `nodes` array.

### VS1002 · warning

Manifest version 1 is deprecated.

Emitted by parseSpecsManifest, applySpecsManifest, `viro-specs-compile --manifest`.

Fix: The manifest was migrated to version 2 in memory. Recompile with viro-specs-compile or call migrateSpecsManifest() and save the result.

### VS1003 · error

Unsupported manifest version.

Emitted by parseSpecsManifest, applySpecsManifest, `viro-specs-compile --manifest`.

Fix: This SDK reads manifest versions 1 and 2. Upgrade @reactvision/react-viro to read newer manifests.

### VS1004 · error

Field has an invalid value.

Emitted by validateSpecsManifestV2, which every producer runs on its output, and by the runtime compiler and `viro-specs-compile --entry` for a prop value they can read but that is invalid (for example a two-element `position` or a numeric `text`).

Fix: See docs/specs-manifest.md for the field's type and range.

### VS1005 · error

Required field is missing.

Emitted by validateSpecsManifestV2, which every producer runs on its output, and by the runtime compiler and `viro-specs-compile --entry` for a prop value they can read but that is invalid (for example a two-element `position` or a numeric `text`).

Fix: See docs/specs-manifest.md for the required fields of this object.

### VS1006 · error

Unknown field.

Emitted by validateSpecsManifestV2, which every producer runs on its output.

Fix: Remove the field or check its spelling. Manifests reject unknown fields so typos cannot pass silently.

### VS1007 · error

Duplicate ID.

Emitted by validateSpecsManifestV2, which every producer runs on its output.

Fix: Node, polyline and light IDs share one namespace. Give each element a unique viroTag.

### VS1008 · error

Parent ID does not match any node.

Emitted by validateSpecsManifestV2, which every producer runs on its output.

Fix: Set parentId to the id of a node in the same manifest, or remove it to attach the node to the scene root.

### VS1009 · error

Parent chain forms a cycle.

Emitted by validateSpecsManifestV2, which every producer runs on its output.

Fix: A node cannot be its own ancestor. Fix the parentId values in the reported chain.

### VS1010 · error

Reference to an unknown node.

Emitted by validateSpecsManifestV2, which every producer runs on its output.

Fix: Interactions and animations must target the id of a node in the same manifest.

### VS1011 · info

Material is not defined in the manifest.

Emitted by validateSpecsManifestV2, which every producer runs on its output.

Fix: The Lens material registry must provide this material ID, or add it to `materials`.

### VS1012 · error

Unknown node kind.

Emitted by validateSpecsManifestV2, which every producer runs on its output.

Fix: Use one of: group, text, image, model, panel, video, sound.

### VS1013 · error

Duplicate material ID.

Emitted by validateSpecsManifestV2, which every producer runs on its output.

Fix: Each entry in `materials` needs a unique id.

### VS1014 · error

Unsupported scene protocol version.

Emitted by validateSpecsSceneSnapshot, ViroSpecsScene, applySpecsManifest.

Fix: Scene snapshots are protocol 1. Lower a v2 manifest with toSpecsSceneSnapshot(), or send toSpecsSceneDocument() to a transport with applySceneDocument.

### VS1015 · warning

Field is not carried by scene protocol 1.

Emitted by toSpecsSceneSnapshot, and by ViroSpecsScene and applySpecsManifest when the transport only implements applyScene. `viro-specs-compile --format lens-ts` and `--format scene-json` use scene protocol 2 and never emit it.

Fix: The transport only implements applyScene (protocol 1), which drops this field. Implement applySceneDocument (protocol 2) or use the generated Lens host, which renders it.

## Static source analysis (VS2xxx)

These codes mean the static compiler could not work out a value. When it can
work out a value and the value is wrong (a two-element `position`, a
numeric `text`), the shared core reports the same `VS1xxx` or `VS3xxx` code
the runtime compiler would, so the two compilers agree on every value both
can see.

### VS2001 · error

No ViroSpecsScene root.

Emitted by `viro-specs-compile --entry`.

Fix: Wrap the Specs content of the entry file in <ViroSpecsScene>.

### VS2002 · error

ViroSpecsScene has no supported static content.

Emitted by `viro-specs-compile --entry`.

Fix: Add at least one ViroNode, ViroText, ViroImage, Viro3DObject or ViroPolyline with static props.

### VS2003 · error

Element is inside JSX the static compiler cannot expand.

Emitted by `viro-specs-compile --entry`.

Fix: Static conditions, ternaries, && and .map() over static arrays compile. Move the element out of other calls, loops or IIFEs, and control it with a static visible prop.

### VS2004 · error

Transform must be a static finite [x, y, z].

Emitted by `viro-specs-compile --entry`.

Fix: Use a literal array or a top-level const of three finite numbers.

### VS2005 · error

visible must be a static boolean.

Emitted by `viro-specs-compile --entry`.

Fix: Use visible={true} or visible={false}, or a top-level const boolean.

### VS2006 · error

Polyline needs at least two static finite points.

Emitted by `viro-specs-compile --entry`.

Fix: Pass points as a literal array of [x, y, z] arrays.

### VS2007 · error

Polyline thickness must be a positive static number.

Emitted by `viro-specs-compile --entry`.

Fix: Use a literal number greater than 0, in meters.

### VS2008 · error

Material name must be static.

Emitted by `viro-specs-compile --entry`.

Fix: Pass materials as a string literal or an array whose first element is a string literal.

### VS2009 · error

ViroText needs static text.

Emitted by `viro-specs-compile --entry`.

Fix: Pass text as a string literal or a top-level const string.

### VS2010 · error

Asset source must be static.

Emitted by `viro-specs-compile --entry`.

Fix: Use require("./asset.glb"), a string asset ID or { uri: "..." } with a literal URI.

### VS2011 · error

animation must be a static object.

Emitted by `viro-specs-compile --entry`.

Fix: Pass animation={{ name: "...", run: true }} with literal values.

### VS2012 · error

animation needs static name and run.

Emitted by `viro-specs-compile --entry`.

Fix: Set name to a string literal and run to true or false.

### VS2013 · error

Spread props cannot be resolved statically.

Emitted by `viro-specs-compile --entry`.

Fix: Spread a top-level const object (in the entry file or imported from a relative module), or write the props out on the element. The spread's props were ignored.

A spread of a static object is merged in source order, so a later attribute
overrides an earlier spread and the reverse.

### VS2014 · error

Expression cannot be resolved statically.

Emitted by `viro-specs-compile --entry`.

Fix: Use a literal, a top-level const, a const imported from a relative module, or a .map() parameter. The message quotes the expression.

The message quotes the expression as written, for example
`ViroText t text: `user.name` cannot be resolved statically (user is not a static binding).`

### VS2015 · error

Entry file could not be parsed.

Emitted by `viro-specs-compile --entry`.

Fix: Fix the syntax error at the reported position.

### VS2016 · warning

Condition is only known at runtime; both branches were emitted hidden.

Emitted by `viro-specs-compile --entry`.

Fix: The static manifest emits every branch of the condition with visible: false, and the Lens shows none of them until the host sets visibility. Use a static condition, or give each branch a viroTag and drive visibility from the app.

Applies to `cond ? <A /> : <B />` and `cond && <A />` where `cond` is not
static. The root element of each branch gets `visible: false`; its children
inherit it through the hierarchy. A static condition compiles only the branch
it selects, with no diagnostic.

### VS2017 · error

Polyline or light inside a runtime condition.

Emitted by `viro-specs-compile --entry`.

Fix: Polylines and lights have no visible flag on Specs, so they cannot be emitted hidden. Move them out of the condition.

### VS2018 · error

Import cannot be resolved.

Emitted by `viro-specs-compile --entry`.

Fix: The static compiler follows relative imports of .ts, .tsx, .js and .jsx modules and treats other relative files as assets. Package imports are not read; inline the value or move it into the project.

### VS2019 · error

.map() cannot be expanded statically.

Emitted by `viro-specs-compile --entry`.

Fix: Call .map() on a static array with a callback whose body is, or returns, one JSX element. Callbacks with statements other than one return are not expanded.

## Shared compile semantics and transport (VS3xxx)

### VS3001 · error

Component has no Specs mapping.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Specs supports ViroNode, ViroText, ViroImage, Viro3DObject, ViroPolyline and the four Viro lights. Render other components outside ViroSpecsScene.

### VS3002 · warning

Prop is ignored on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: The Specs target does not carry this prop. Remove it from the Specs scene or accept the difference.

### VS3003 · error

Animation is not registered or is a chain.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Register a single animation with ViroAnimations.registerAnimations. Animation chains are not compiled.

### VS3004 · error

Animation property is not supported.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Specs animates position, translate, scale, rotate and opacity.

### VS3005 · error

Animation value cannot be resolved.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Use a number or a relative string such as "+=0.5", "-=1", "*=2" or "/=2".

### VS3006 · error

Animation easing is not supported.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Use Linear, EaseIn, EaseOut or EaseInEaseOut. Specs will not substitute a different curve.

### VS3008 · error

Asset source has no stable ID.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Pass sourceResolver to ViroSpecsScene to map bundled assets to Lens asset IDs.

The static compiler reports it when `source` is missing; a `source` it cannot
resolve is `VS2010`.

### VS3009 · warning

Color is not a hex value.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Specs manifests store colors as #RRGGBB or #RRGGBBAA.

### VS3010 · error

Transport cannot run an animation action.

Emitted by ViroSpecsScene.

Fix: Implement playAnimation and stopAnimation on the ViroSpecsSceneTransport.

### VS3011 · error

Transport call failed.

Emitted by ViroSpecsScene, applySpecsManifest.

Fix: The transport threw or rejected. The previous scene stays applied.

### VS3012 · warning

Element has no viroTag.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Without viroTag the ID is a content hash of kind, parent, text or source, and React key, so it changes when that content changes. Add a unique viroTag; --strict requires one.

The content-hash ID is `<kind>-<12 hex>`. Reordering siblings that differ in
content keeps their IDs. See `docs/adr/0003-specs-id-strategy.md`.

### VS3013 · error

Model format is not supported on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Lens Studio cannot import VRX. Export the model as GLB.

### VS3014 · error

Animation timing is not a finite non-negative number.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Set duration and delay in milliseconds as numbers >= 0, both in registerAnimations and in the element's animation.delay.

### VS3015 · error

Element cannot have children on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Specs polylines and lights are leaves. Move the children into a ViroNode.

## Capability errors (VS4xxx)

### VS4001 · error

Portals are not supported on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: No Specs equivalent ships. Render portals on ViroCore only.

### VS4002 · error

Physics is not supported on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Remove physicsBody and onCollision from the Specs scene. Specs will not fake physics with a static node.

### VS4003 · error

Rive is not supported on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Render ViroRivePanel on ViroCore only.

### VS4004 · error

Video is not supported on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: The Specs host has no video player. Render video on ViroCore only.

### VS4005 · error

Audio is not supported on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: The Specs host has no audio player. Play sound on ViroCore only.

### VS4006 · error

Native textures are not supported on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: Camera and video textures need a native surface the Lens runtime does not expose.

### VS4007 · error

Custom rendering is not supported on Specs.

Emitted by the runtime compiler and `viro-specs-compile --entry`.

Fix: GPU, three.js, custom geometry and particle surfaces do not compile to Lens content.

## Lens scene host (VS5xxx)

`ViroSpecsSceneController` in `@viro-external/specs` reports these on its
`ViroSpecsHostDiagnostics` channel and in the Lens log, never as a thrown
exception. Errors leave the committed scene unchanged. The same table, with
the host's behavior for each code, is in that package's
`doc/LensHostDiagnostics.md`; both are generated from catalogs that the two
repos' tests keep identical.

### VS5001 · error

Unsupported scene protocol.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: The host reads scene protocols 1 and 2. Recompile with a viro-specs-compile that matches this @viro-external/specs.

### VS5002 · error

Scene failed host validation.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: The previous scene stays on screen. Fix the field named by fieldPath; viro-specs-compile reports the same problem with a source position.

### VS5003 · warning

Asset is not registered; placeholder shown.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: Add the asset to ViroSpecsAssetRegistry under the reported source ID. The node shows a bounded tinted box until then.

### VS5004 · warning

Material is not registered; default material used.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: Register the material ID in ViroSpecsAssetRegistry or define it in the scene's materials list.

### VS5005 · error

Staging failed; previous scene kept.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: The staged scene was disposed and the committed scene is unchanged. The message names the node and the backend error.

### VS5006 · info

Async work finished after its scene was retired.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: No action needed. The result was discarded because navigation or replacement retired the scene that started it.

### VS5007 · warning

Font family is not registered; default font used.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: Register the font in ViroSpecsAssetRegistry fontIds/fonts under the fontFamily name.

### VS5008 · warning

maxLines is approximated by the text box height.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: Lens Text has no line limit. The host sizes the text box to maxLines lines and truncates overflow; give the node extents for exact layout.

### VS5009 · error

Listener or action handler threw.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: The exception was caught so the Lens keeps running. Fix the listener named in the message.

### VS5010 · info

Resource cache is full; least recently used entry released.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: Raise maxCachedMaterials if this repeats every frame.

### VS5011 · warning

Placeholder visual is unavailable.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: Set placeholderMaterial (or defaultImageMaterial) on ViroSpecsAssetRegistry so missing assets render as a tinted box instead of an empty node.

### VS5012 · warning

Material lightingModel is not mapped.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: Lens shading comes from the base material, not from lightingModel. Register a Lens material under the material ID to control shading.

### VS5013 · warning

Patch op skipped.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: The op named a node that does not exist or would create a parent cycle. The rest of the patch applied.

### VS5014 · error

Backend operation failed.

Emitted by ViroSpecsSceneController (`@viro-external/specs`).

Fix: A Lens call threw while updating a committed node. The node keeps its previous state; the message names the operation.
