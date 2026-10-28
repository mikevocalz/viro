<!-- Generated from components/Specs/core/diagnosticCodes.ts by scripts/specs-error-reference.cjs. Do not edit. -->

# Specs error reference

94 codes: 63 errors, 24 warnings, 7 info. Severity is fixed per code.
An `error` stops the build (`viro-specs-compile` exits 1 and writes nothing; `ViroSpecsScene` keeps the previous scene).
A `warning` lets the build through unless you pass `--strict`. Background, examples and the diagnostic object
shape are in [specs-diagnostics.md](specs-diagnostics.md); each code there has its own section.

## VS1xxx: manifest and protocol validation

Emitted by `parseSpecsManifest`, `parseSpecsManifestJson`, `validateSpecsManifestV2`, `validateSpecsSceneSnapshot`, `migrateSpecsManifest` and `viro-specs-compile --manifest`.

| Code | Severity | Problem | Fix |
| --- | --- | --- | --- |
| [VS1000](specs-diagnostics.md#vs1000--error) | error | Manifest JSON could not be parsed | Check the file for a JSON syntax error at the reported position. |
| [VS1001](specs-diagnostics.md#vs1001--error) | error | Manifest is not a JSON object | A manifest is an object with a numeric `version` and a `nodes` array. |
| [VS1002](specs-diagnostics.md#vs1002--warning) | warning | Manifest version 1 is deprecated | The manifest was migrated to version 2 in memory. Recompile with viro-specs-compile or call migrateSpecsManifest() and save the result. |
| [VS1003](specs-diagnostics.md#vs1003--error) | error | Unsupported manifest version | This SDK reads manifest versions 1 and 2. Upgrade @reactvision/react-viro to read newer manifests. |
| [VS1004](specs-diagnostics.md#vs1004--error) | error | Field has an invalid value | See docs/specs-manifest.md for the field's type and range. |
| [VS1005](specs-diagnostics.md#vs1005--error) | error | Required field is missing | See docs/specs-manifest.md for the required fields of this object. |
| [VS1006](specs-diagnostics.md#vs1006--error) | error | Unknown field | Remove the field or check its spelling. Manifests reject unknown fields so typos cannot pass silently. |
| [VS1007](specs-diagnostics.md#vs1007--error) | error | Duplicate ID | Node, polyline and light IDs share one namespace. Give each element a unique viroTag. |
| [VS1008](specs-diagnostics.md#vs1008--error) | error | Parent ID does not match any node | Set parentId to the id of a node in the same manifest, or remove it to attach the node to the scene root. |
| [VS1009](specs-diagnostics.md#vs1009--error) | error | Parent chain forms a cycle | A node cannot be its own ancestor. Fix the parentId values in the reported chain. |
| [VS1010](specs-diagnostics.md#vs1010--error) | error | Reference to an unknown node | Interactions and animations must target the id of a node in the same manifest. |
| [VS1011](specs-diagnostics.md#vs1011--info) | info | Material is not defined in the manifest | The Lens material registry must provide this material ID, or add it to `materials`. |
| [VS1012](specs-diagnostics.md#vs1012--error) | error | Unknown node kind | Use one of: group, text, image, model, panel, video, sound. |
| [VS1013](specs-diagnostics.md#vs1013--error) | error | Duplicate material ID | Each entry in `materials` needs a unique id. |
| [VS1014](specs-diagnostics.md#vs1014--error) | error | Unsupported scene protocol version | Scene snapshots are protocol 1. Lower a v2 manifest with toSpecsSceneSnapshot(), or send toSpecsSceneDocument() to a transport with applySceneDocument. |
| [VS1015](specs-diagnostics.md#vs1015--warning) | warning | Field is not carried by scene protocol 1 | The transport only implements applyScene (protocol 1), which drops this field. Implement applySceneDocument (protocol 2) or use the generated Lens host, which renders it. |
| [VS1016](specs-diagnostics.md#vs1016--error) | error | Action is declared twice | Action IDs are unique within a manifest. Remove or rename the second declaration. |
| [VS1017](specs-diagnostics.md#vs1017--error) | error | Action is not declared | Add the action to ViroSpecsScene's actions prop (defineSpecsActions) or to the manifest's actions list. |
| [VS1018](specs-diagnostics.md#vs1018--error) | error | Action payload does not match its declaration | fieldPath names the field: missing, not declared, wrong type, not a whole number, or not in enum. |
| [VS1019](specs-diagnostics.md#vs1019--error) | error | Trigger fires on an event its node does not enable | A select trigger needs select in the interaction's events, a hover trigger needs hover. The compilers add them; fix hand-written manifests. |

## VS2xxx: static source analysis

Emitted by `viro-specs-compile --entry` (Babel AST of your scene source).

| Code | Severity | Problem | Fix |
| --- | --- | --- | --- |
| [VS2001](specs-diagnostics.md#vs2001--error) | error | No ViroSpecsScene root | Wrap the Specs content of the entry file in <ViroSpecsScene>. |
| [VS2002](specs-diagnostics.md#vs2002--error) | error | ViroSpecsScene has no supported static content | Add at least one ViroNode, ViroText, ViroImage, Viro3DObject or ViroPolyline with static props. |
| [VS2003](specs-diagnostics.md#vs2003--error) | error | Element is inside JSX the static compiler cannot expand | Static conditions, ternaries, && and .map() over static arrays compile. Move the element out of other calls, loops or IIFEs, and control it with a static visible prop. |
| [VS2004](specs-diagnostics.md#vs2004--error) | error | Transform must be a static finite [x, y, z] | Use a literal array or a top-level const of three finite numbers. |
| [VS2005](specs-diagnostics.md#vs2005--error) | error | visible must be a static boolean | Use visible={true} or visible={false}, or a top-level const boolean. |
| [VS2006](specs-diagnostics.md#vs2006--error) | error | Polyline needs at least two static finite points | Pass points as a literal array of [x, y, z] arrays. |
| [VS2007](specs-diagnostics.md#vs2007--error) | error | Polyline thickness must be a positive static number | Use a literal number greater than 0, in meters. |
| [VS2008](specs-diagnostics.md#vs2008--error) | error | Material name must be static | Pass materials as a string literal or an array whose first element is a string literal. |
| [VS2009](specs-diagnostics.md#vs2009--error) | error | ViroText needs static text | Pass text as a string literal or a top-level const string. |
| [VS2010](specs-diagnostics.md#vs2010--error) | error | Asset source must be static | Use require("./asset.glb"), a string asset ID or { uri: "..." } with a literal URI. |
| [VS2011](specs-diagnostics.md#vs2011--error) | error | animation must be a static object | Pass animation={{ name: "...", run: true }} with literal values. |
| [VS2012](specs-diagnostics.md#vs2012--error) | error | animation needs static name and run | Set name to a string literal and run to true or false. |
| [VS2013](specs-diagnostics.md#vs2013--error) | error | Spread props cannot be resolved statically | Spread a top-level const object (in the entry file or imported from a relative module), or write the props out on the element. The spread's props were ignored. |
| [VS2014](specs-diagnostics.md#vs2014--error) | error | Expression cannot be resolved statically | Use a literal, a top-level const, a const imported from a relative module, or a .map() parameter. The message quotes the expression. |
| [VS2015](specs-diagnostics.md#vs2015--error) | error | Entry file could not be parsed | Fix the syntax error at the reported position. |
| [VS2016](specs-diagnostics.md#vs2016--warning) | warning | Condition is only known at runtime; both branches were emitted hidden | The static manifest emits every branch of the condition with visible: false, and the Lens shows none of them until the host sets visibility. Use a static condition, or give each branch a viroTag and drive visibility from the app. |
| [VS2017](specs-diagnostics.md#vs2017--error) | error | Polyline or light inside a runtime condition | Polylines and lights have no visible flag on Specs, so they cannot be emitted hidden. Move them out of the condition. |
| [VS2018](specs-diagnostics.md#vs2018--error) | error | Import cannot be resolved | The static compiler follows relative imports of .ts, .tsx, .js and .jsx modules and treats other relative files as assets. Package imports are not read; inline the value or move it into the project. |
| [VS2019](specs-diagnostics.md#vs2019--error) | error | .map() cannot be expanded statically | Call .map() on a static array with a callback whose body is, or returns, one JSX element. Callbacks with statements other than one return are not expanded. |

## VS3xxx: compile semantics

Emitted by both compilers (`ViroSpecsScene` at runtime and `viro-specs-compile`) and the runtime transport.

| Code | Severity | Problem | Fix |
| --- | --- | --- | --- |
| [VS3001](specs-diagnostics.md#vs3001--error) | error | Component has no Specs mapping | Specs supports ViroNode, ViroText, ViroImage, Viro3DObject, ViroPolyline and the four Viro lights. Render other components outside ViroSpecsScene. |
| [VS3002](specs-diagnostics.md#vs3002--warning) | warning | Prop is ignored on Specs | The Specs target does not carry this prop. Remove it from the Specs scene or accept the difference. |
| [VS3003](specs-diagnostics.md#vs3003--error) | error | Animation is not registered or is a chain | Register a single animation with ViroAnimations.registerAnimations. Animation chains are not compiled. |
| [VS3004](specs-diagnostics.md#vs3004--error) | error | Animation property is not supported | Specs animates position, translate, scale, rotate and opacity. |
| [VS3005](specs-diagnostics.md#vs3005--error) | error | Animation value cannot be resolved | Use a number or a relative string such as "+=0.5", "-=1", "*=2" or "/=2". |
| [VS3006](specs-diagnostics.md#vs3006--error) | error | Animation easing is not supported | Use Linear, EaseIn, EaseOut or EaseInEaseOut. Specs will not substitute a different curve. |
| [VS3008](specs-diagnostics.md#vs3008--error) | error | Asset source has no stable ID | Pass sourceResolver to ViroSpecsScene to map bundled assets to Lens asset IDs. |
| [VS3009](specs-diagnostics.md#vs3009--warning) | warning | Color is not a hex value | Specs manifests store colors as #RRGGBB or #RRGGBBAA. |
| [VS3010](specs-diagnostics.md#vs3010--error) | error | Transport cannot run an animation action | Implement playAnimation and stopAnimation on the ViroSpecsSceneTransport. |
| [VS3011](specs-diagnostics.md#vs3011--error) | error | Transport call failed | The transport threw or rejected. The previous scene stays applied. |
| [VS3012](specs-diagnostics.md#vs3012--warning) | warning | Element has no viroTag | Without viroTag the ID is a content hash of kind, parent, text or source, and React key, so it changes when that content changes. Add a unique viroTag; --strict requires one. |
| [VS3013](specs-diagnostics.md#vs3013--error) | error | Model format is not supported on Specs | Lens Studio cannot import VRX. Export the model as GLB. |
| [VS3014](specs-diagnostics.md#vs3014--error) | error | Animation timing is not a finite non-negative number | Set duration and delay in milliseconds as numbers >= 0, both in registerAnimations and in the element's animation.delay. |
| [VS3015](specs-diagnostics.md#vs3015--error) | error | Element cannot have children on Specs | Specs polylines and lights are leaves. Move the children into a ViroNode. |
| [VS3016](specs-diagnostics.md#vs3016--warning) | warning | Interactable has no label | Set accessibilityLabel on every Viro element with onClick, onHover or onDrag (label on premium components). Name the action or object ("Reset model"), not the control type. --strict fails without one. |
| [VS3017](specs-diagnostics.md#vs3017--warning) | warning | Content is outside the 0.6-3.0 m comfort band | Move the node so its distance from the wearer (the scene origin) is between 0.6 and 3.0 m. |
| [VS3018](specs-diagnostics.md#vs3018--warning) | warning | Text is smaller than 1.2 degrees | Raise fontSize or move the text closer, or use PanelText, which sizes text from the type tokens at its distance. |
| [VS3019](specs-diagnostics.md#vs3019--warning) | warning | Animation is longer than 500 ms | Keep transitions at or under 500 ms (motion.maxMs). Split a long movement into a state change instead. |
| [VS3020](specs-diagnostics.md#vs3020--warning) | warning | Animation easing is not EaseInEaseOut | Use EaseInEaseOut for transitions. Linear is only for host-drawn continuous indicators. |
| [VS3021](specs-diagnostics.md#vs3021--warning) | warning | Large surface moves across the view | Do not animate the position of a surface 10 degrees or wider. Fade and scale it in place, and swap content inside the panel instead of sliding the panel. |
| [VS3022](specs-diagnostics.md#vs3022--error) | error | Premium component prop is invalid | See docs/specs-experience.md for each component's props and their allowed values. |
| [VS3023](specs-diagnostics.md#vs3023--error) | error | specsAction is not a JSON trigger | specsAction takes { actionId, on?, payload? } with a flat payload of strings, numbers and booleans. Functions and other closures cannot cross to the Lens; handle the action in the store instead. |
| [VS3024](specs-diagnostics.md#vs3024--warning) | warning | Declared action has no handler | Add a reducer for the action to bindSpecsActionsToStore or a handler to createSpecsActionDispatcher. The action was dropped. |

## VS4xxx: capability errors

Emitted by both compilers, for Viro features the SPECS target does not implement.

| Code | Severity | Problem | Fix |
| --- | --- | --- | --- |
| [VS4001](specs-diagnostics.md#vs4001--error) | error | Portals are not supported on Specs | No Specs equivalent ships. Render portals on ViroCore only. |
| [VS4002](specs-diagnostics.md#vs4002--error) | error | Physics is not supported on Specs | Remove physicsBody and onCollision from the Specs scene. Specs will not fake physics with a static node. |
| [VS4003](specs-diagnostics.md#vs4003--error) | error | Rive is not supported on Specs | Render ViroRivePanel on ViroCore only. |
| [VS4004](specs-diagnostics.md#vs4004--error) | error | Video is not supported on Specs | The Specs host has no video player. Render video on ViroCore only. |
| [VS4005](specs-diagnostics.md#vs4005--error) | error | Audio is not supported on Specs | The Specs host has no audio player. Play sound on ViroCore only. |
| [VS4006](specs-diagnostics.md#vs4006--error) | error | Native textures are not supported on Specs | Camera and video textures need a native surface the Lens runtime does not expose. |
| [VS4007](specs-diagnostics.md#vs4007--error) | error | Custom rendering is not supported on Specs | GPU, three.js, custom geometry and particle surfaces do not compile to Lens content. |

## VS5xxx: Lens scene host

Emitted by `ViroSpecsHostDiagnostics` inside the Lens (`@viro-external/specs`), mirrored here so a Lens log code reads the same.

| Code | Severity | Problem | Fix |
| --- | --- | --- | --- |
| [VS5001](specs-diagnostics.md#vs5001--error) | error | Unsupported scene protocol | The host reads scene protocols 1 and 2. Recompile with a viro-specs-compile that matches this @viro-external/specs. |
| [VS5002](specs-diagnostics.md#vs5002--error) | error | Scene failed host validation | The previous scene stays on screen. Fix the field named by fieldPath; viro-specs-compile reports the same problem with a source position. |
| [VS5003](specs-diagnostics.md#vs5003--warning) | warning | Asset is not registered; placeholder shown | Add the asset to ViroSpecsAssetRegistry under the reported source ID. The node shows a bounded tinted box until then. |
| [VS5004](specs-diagnostics.md#vs5004--warning) | warning | Material is not registered; default material used | Register the material ID in ViroSpecsAssetRegistry or define it in the scene's materials list. |
| [VS5005](specs-diagnostics.md#vs5005--error) | error | Staging failed; previous scene kept | The staged scene was disposed and the committed scene is unchanged. The message names the node and the backend error. |
| [VS5006](specs-diagnostics.md#vs5006--info) | info | Async work finished after its scene was retired | No action needed. The result was discarded because navigation or replacement retired the scene that started it. |
| [VS5007](specs-diagnostics.md#vs5007--warning) | warning | Font family is not registered; default font used | Register the font in ViroSpecsAssetRegistry fontIds/fonts under the fontFamily name. |
| [VS5008](specs-diagnostics.md#vs5008--warning) | warning | maxLines is approximated by the text box height | Lens Text has no line limit. The host sizes the text box to maxLines lines and truncates overflow; give the node extents for exact layout. |
| [VS5009](specs-diagnostics.md#vs5009--error) | error | Listener or action handler threw | The exception was caught so the Lens keeps running. Fix the listener named in the message. |
| [VS5010](specs-diagnostics.md#vs5010--info) | info | Resource cache is full; least recently used entry released | Raise maxCachedMaterials if this repeats every frame. |
| [VS5011](specs-diagnostics.md#vs5011--warning) | warning | Placeholder visual is unavailable | Set placeholderMaterial (or defaultImageMaterial) on ViroSpecsAssetRegistry so missing assets render as a tinted box instead of an empty node. |
| [VS5012](specs-diagnostics.md#vs5012--warning) | warning | Material lightingModel is not mapped | Lens shading comes from the base material, not from lightingModel. Register a Lens material under the material ID to control shading. |
| [VS5013](specs-diagnostics.md#vs5013--warning) | warning | Patch op skipped | The op named a node that does not exist or would create a parent cycle. The rest of the patch applied. |
| [VS5014](specs-diagnostics.md#vs5014--error) | error | Backend operation failed | A Lens call threw while updating a committed node. The node keeps its previous state; the message names the operation. |
| [VS5015](specs-diagnostics.md#vs5015--error) | error | Action is not declared | Declare the action ID in the scene's actions list and in the ViroSpecsActionRegistry. The trigger or dispatch was dropped. |
| [VS5016](specs-diagnostics.md#vs5016--error) | error | Action is declared or handled twice | Action IDs are unique per scene and per registry. The first declaration or handler stays; remove the second. |
| [VS5017](specs-diagnostics.md#vs5017--error) | error | Action payload does not match its declaration | The fieldPath names the field: missing, unknown, wrong type or not in enum. The action was dropped and state is unchanged. |
| [VS5018](specs-diagnostics.md#vs5018--info) | info | Queued action invalidated by navigation | No action needed. The scene that showed the node was retired before the action ran, so it was dropped. |
| [VS5019](specs-diagnostics.md#vs5019--warning) | warning | Declared action has no handler | Register a handler with ViroSpecsActionRegistry.on, or set forward on ViroSpecsActionRuntime to send the action to a phone app. |
| [VS5020](specs-diagnostics.md#vs5020--info) | info | Route memory is full; least recently used route forgotten | Scroll positions of the forgotten route reset when it is shown again. Raise maxRememberedRoutes if this repeats. |
| [VS5021](specs-diagnostics.md#vs5021--info) | info | Capability degraded; dependent UI hidden | No action needed for the build. The message names the capability, its state and the UI the experience layer hid; the wearer sees a one-line notice. |
| [VS5022](specs-diagnostics.md#vs5022--warning) | warning | Text raised to the 1.2 degree minimum | The text rendered smaller than 1.2 degrees at its distance, so the host raised its size. Size it from the type tokens (PanelText) to avoid the clamp. |
| [VS5023](specs-diagnostics.md#vs5023--warning) | warning | Position clamped into the 0.6-3.0 m comfort band | A placement or drag would have put the node nearer than 0.6 m or farther than 3.0 m; the host stopped it at the band edge. |
| [VS5024](specs-diagnostics.md#vs5024--info) | info | Gaze-only input active | Hand tracking is not available, so selection works by gaze dwell and drag is replaced by step buttons. It switches back when hand tracking returns. |
| [VS5025](specs-diagnostics.md#vs5025--warning) | warning | Premium component feature not drawn by this host | The scene carries the feature but this host version does not render it yet; the message names the node and the features. See doc/Experience.md#not-drawn-yet. |
