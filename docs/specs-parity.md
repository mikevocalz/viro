# Viro / SPECS semantic parity matrix

This matrix defines the application-visible contract. The engines do not need
to share implementation code.

Every row names the manifest field that carries the semantic, the diagnostic
code a producer reports when a scene asks for something the row does not
cover, and the test that pins it. "WS2" or "WS3" in a cell means the
workstream that will fill it; the cell is empty of evidence until then.

Test references: `S` is `scripts/test-viro-specs-compiler.cjs` (static
compiler, `npm run test:specs-compiler`), `R` is
`__test__/ViroSpecsCompiler.test.tsx` (runtime compiler), `M` is
`__test__/ViroSpecsManifest.test.ts` (schema and validator over
`__test__/fixtures/specs/`), `G` is the Platform Lab golden
`__test__/fixtures/specs/manifest-v2/valid/platform-lab.json`, checked by `S`.
`A` is `__test__/ViroSpecsActions.test.tsx` (React Native action layer and
`SpecsActionsLab`); `L` is viro-external `packages/specs/scripts/actions.test.mjs`
and `actions-fixtures.test.mjs` (Lens controller, registry and runtime on a
mock host).

| Viro semantic | ViroCore | SPECS 27 Lens backend | Manifest v2 field | Diagnostic when unsupported | Test |
| --- | --- | --- | --- | --- | --- |
| group hierarchy | native Viro node tree | SceneObject hierarchy | `nodes[].parentId` | `VS1008` unknown parent, `VS1009` cycle, `VS3001` unmapped component | `M` missing-parent, parent-cycle; `S` ViroBox; `R` "ViroBox is an error" |
| position | meters | meters at public boundary, converted to cm | `nodes[].position` | `VS2004` non-static, `VS1004` invalid | `S` unresolved transform; `M` bad-position; `G` |
| rotation | Euler degrees in JSX | compiled quaternion | `nodes[].rotation` (quaternion) | `VS2004`, `VS1004` | `S` and `R` first case (90° yaw → quaternion) |
| scale | unitless | unitless | `nodes[].scale` | `VS2004`, `VS1004` | `G` |
| text | ViroText | Lens Text | `nodes[kind=text].text`, `.style`, `.extents`, `.maxLines` | `VS2009` non-static text; `VS3002` unsupported style keys; `VS3009` non-hex color; `VS5007` unregistered font, `VS5008` maxLines approximated (protocol 2 renders style/extents; `VS1015` only on protocol 1 transports) | `S` lights and text style; `R` "coded diagnostic objects and a schema-valid manifest" |
| image | ViroImage | Lens Image/Texture | `nodes[kind=image].source`, `.extents` | `VS2010` non-static source, `VS3008` no stable ID, `VS5003` missing asset placeholder | `M` all-fields; WS2 golden |
| GLB/model | Viro3DObject | ObjectPrefab | `nodes[kind=model].source`, `.format` | `VS2010`, `VS3008`, `VS3013` VRX | `S` vrx; `G` |
| hover | Viro event delegate | SIK hover | `interactions[].events: "hover"` | `VS1010` unknown target | `M` unknown-target; `R` "routes portable interactions" |
| click/select | Viro click | SIK trigger/pinch | `interactions[].events: "select"` | `VS1010` | `S` first case; `G` |
| drag | Viro drag | InteractableManipulation | `interactions[].manipulation`, `events: "drag"` | `VS1010` | `S` first case; `G` |
| typed action | `onClick` plus app code | trigger resolved by `ViroSpecsSceneController`, delivered one frame later | `interactions[].triggers[]`, `actions[]` | `VS1016` duplicate, `VS1017` undeclared, `VS1018` ill-typed payload, `VS1019` event not enabled, `VS3014` closure or non-JSON trigger; Lens `VS5015`–`VS5017` | `M` actions, action-*, trigger-*; `S` typed actions; `A` reference flow, dispatcher; `L` scene validation |
| app state from actions | app store (Zustand) | `ViroSpecsActionRegistry` + `ViroSpecsActionRuntime` (standalone) | none (runtime API: `bindSpecsActionsToStore`, `ViroSpecsActionRegistry.on`) | `VS3015`, Lens `VS5019` no handler; Lens `VS5009` handler threw | `A` Zustand store; `L` registry, forward |
| action lifetime | n/a (synchronous) | queued per scene; retired scene drops it | none | Lens `VS5018` (info) | `L` "queued when navigation happens"; `A` late pinch on a retired card |
| route / navigation | app navigator | update with a new `route` is a transactional present | `route` | none | `A` reference flow; `L` reference flow |
| scroll position across back navigation | native scroll view | route memory in the controller (`maxRememberedRoutes`) | `nodes[kind=group].scroll` | `VS1015` on protocol 1; Lens `VS5020` (info) eviction | `L` reference flow, 100 cycles, fixtures; `A` fixtures |
| animation | Viro animation manager | AnimationPlayer | `animations[].plan` | `VS3003` missing/chain, `VS3004` property, `VS3005` value, `VS3006` easing, `VS2011`/`VS2012` non-static | `S` bounce; `R` "refuses easings"; `M` bad-easing; `G` |
| hit test | native AR hit test | WorldQuery | none (runtime API `ViroSpecsARRuntime`) | WS3 | WS3 |
| placement | native AR placement patterns | SurfacePlacement | none (runtime API) | WS3/WS4 | WS4 |
| polyline | ViroPolyline | VolumetricLine | `polylines[]` | `VS2006` points, `VS2007` thickness, `VS2008` material | `M` polyline-one-point; `G` |
| capabilities | runtime/native queries | SPECS capability report | `ViroSpecsCapabilityStatus` (schema `$defs/capabilityStatus`): `implemented`, `installed`, `permission`, `evidence` as separate fields | none | WS3 (hosts report it) |
| lights | ViroAmbient/Directional/Omni/SpotLight | Lens LightSource (protocol 2) | `lights[]` | `VS1015` only on protocol 1 transports | `S` lights and text style, lit.tsx `--strict` |
| materials | ViroMaterials | Lens material registry | `materials[]`, `materialId` | `VS1011` (info) when only the Lens registry has it | `S` first case (`route`) |
| portal | ViroPortal, ViroPortalScene | none | none | `VS4001` | `S` capability loop; `R` capability table |
| physics | `physicsBody`, `onCollision` | none | none | `VS4002` | `S` capability loop; `R` "physics props" |
| Rive | ViroRivePanel | none | none | `VS4003` | `S`; `R` |
| video | ViroVideo, Viro360Video, ViroExternalVideo | none | `nodes[kind=video]` (contract only) | `VS4004` | `S`; `R`; `M` video-node |
| audio | ViroSound, ViroSpatialSound, ViroSoundField | none | `nodes[kind=sound]` (contract only) | `VS4005` | `S`; `R`; `M` sound-node |
| native textures | ViroCameraTexture, ViroMaterialVideo | none | none | `VS4006` | `S`; `R` |
| custom rendering | ViroGpuPanel, ViroThreeJSPanel, ViroGeometry, ViroParticleEmitter | none | none | `VS4007` | `S`; `R` |

The cross-platform Platform Lab and the SPECS LEAF suite are complementary:
the Viro repo proves JSX compilation and callback semantics; the external
backend proves real Lens execution.

Evidence for every row above is `portable-test-passed` at most. None of it has
been compiled in Lens Studio, run in Preview, or run on SPECS hardware.
