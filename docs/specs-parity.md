# Viro / SPECS semantic parity matrix

This matrix defines the application-visible contract. The engines do not need
to share implementation code.

Every row names the manifest field that carries the semantic, the diagnostic
code a producer reports when a scene asks for something the row does not
cover, and the test that pins it. "WS3" or "WS4" in a cell means the
workstream that will fill it; the cell has no evidence until then.

Test references:

- `G:<fixture>` is the golden fixture `__test__/fixtures/specs/compiler/<fixture>/`,
  checked by `__test__/ViroSpecsGolden.test.tsx`. A fixture marked `=` is
  also compiled by the runtime compiler, which must produce a byte-identical
  manifest (except `generator` and `source`) and the same diagnostic codes.
- `PL` is the Platform Lab: `__test__/fixtures/specs/manifest-v2/valid/platform-lab.json`,
  checked byte for byte in both compilers by `ViroSpecsGolden.test.tsx` and by
  the CLI from two working directories in `scripts/test-viro-specs-compiler.cjs`.
- `C` is `__test__/ViroSpecsCore.test.tsx` (IDs, paths, transform and
  animation core, static-analysis edge cases).
- `R` is `__test__/ViroSpecsCompiler.test.tsx` (runtime compiler), `M` is
  `__test__/ViroSpecsManifest.test.ts` (schema and validator over
  `__test__/fixtures/specs/manifest-v2/`), `S` is
  `scripts/test-viro-specs-compiler.cjs` (CLI exit codes and formats).

| Viro semantic | ViroCore | SPECS 27 Lens backend | Manifest v2 field | Diagnostic when unsupported | Test |
| --- | --- | --- | --- | --- | --- |
| group hierarchy | native Viro node tree | SceneObject hierarchy | `nodes[].parentId` | `VS1008` unknown parent, `VS1009` cycle, `VS3001` unmapped component | `G:nested-three-levels=`, `G:nested-fragments=`, `PL`; `M` missing-parent, parent-cycle; `C` unsupported children |
| position | meters | meters at the public boundary; the Lens host converts to cm | `nodes[].position` | `VS2004` not static, `VS1004` invalid | `G:units-meters=`, `G:units-polyline-scaled=`, `G:dynamic-expression`; `M` bad-position |
| rotation | Euler degrees in JSX | compiled quaternion, ViroCore order (X, then Y, then Z) | `nodes[].rotation` (quaternion) | `VS2004`, `VS1004` | `G:quat-yaw-90=`, `G:quat-xy-order=`, `G:quat-roll-negative=`, `G:quat-xyz-all=`; `C` ViroCore order |
| scale | unitless | unitless | `nodes[].scale` | `VS2004`, `VS1004` | `G:nested-three-levels=`, `G:units-polyline-scaled=`, `PL` |
| nested transforms | node tree | SceneObject tree; polylines in world space | `polylines[].points` (world) | none | `G:nested-translate-rotate=`, `G:nested-three-levels=`, `G:quat-xy-order=` |
| visibility | `visible` | SceneObject enabled | `nodes[].visible` | `VS1004` not boolean, `VS2005` not static, `VS2016` runtime condition (both branches hidden), `VS2017` polyline or light in a runtime condition | `G:visible-static-false=`, `G:visible-static-ternary=`, `G:visible-static-and=`, `G:visible-runtime-ternary`, `G:visible-runtime-polyline` |
| text | ViroText | Lens Text | `nodes[kind=text].text`, `.style`, `.extents`, `.maxLines` | `VS2009` not static, `VS1005` missing; `VS3002` style keys or values not carried, partial extents; `VS3009` non-hex color; `VS5007` unregistered font, `VS5008` maxLines approximated (protocol 2 renders style/extents; `VS1015` only on protocol 1 transports) | `G:text-style-full=`, `G:text-style-array=`, `G:text-style-dropped=`, `G:text-extents-maxlines=`, `G:text-extents-partial=`; `R` schema-valid manifest |
| image | ViroImage | Lens Image/Texture | `nodes[kind=image].source`, `.extents` | `VS2010` not static, `VS3008` no stable ID, `VS2018` missing file, `VS5003` missing asset placeholder, `VS1015` extents only on protocol 1 transports | `G:assets-require=`, `G:assets-uri-and-id=` |
| GLB/model | Viro3DObject | ObjectPrefab | `nodes[kind=model].source`, `.format` | `VS2010`, `VS3008`, `VS2018`, `VS3013` VRX, `VS3002` unknown `type` | `G:assets-require=`, `G:assets-import=`, `G:assets-vrx-rejected=`, `G:assets-missing`, `PL`; `C` cwd and Windows paths |
| hover | Viro event delegate | SIK hover | `interactions[].events: "hover"` | `VS1010` unknown target | `G:interaction-hover-select-drag=`; `R` routes interactions |
| click/select | Viro click | SIK trigger/pinch | `interactions[].events: "select"` | `VS1010` | `G:interaction-hover-select-drag=`, `G:interaction-click-state=`, `PL` |
| drag | Viro drag | InteractableManipulation | `interactions[].manipulation`, `events: "drag"` | `VS1010` | `G:interaction-hover-select-drag=`, `PL` |
| animation | Viro animation manager | AnimationPlayer | `animations[].plan` | `VS3003` missing/chain, `VS3004` property, `VS3005` value, `VS3006` easing, `VS3014` timing, `VS2011`/`VS2012` not static | `G:anim-relative-add=`, `G:anim-relative-multiply-divide=`, `G:anim-translate-offset=`, `G:anim-rotate-relative=`, `G:anim-opacity-relative=`, `G:timing-delay-sum=`, `G:timing-invalid-duration=`, `G:timing-easing-rejected=`, `G:timing-run-false=`, `PL`; `C` division by zero; `M` bad-easing |
| element IDs | `viroTag` | SceneObject binding key | `nodes[].id` and every reference | `VS3012` no `viroTag` (content-hash ID assigned; `--strict` fails), `VS1007` duplicate | `G:ids-content-hash=`, `G:ids-key-hash=`, `G:ids-duplicate=`; `C` reorder stability in both compilers; `S` `--strict` |
| static analysis | n/a | n/a | n/a | `VS2003` unexpandable JSX, `VS2013` unresolved spread, `VS2014` unresolved expression, `VS2018` unresolved import, `VS2019` unexpandable `.map()` | `G:imports-constants=`, `G:spread-static=`, `G:spread-unresolved`, `G:map-static-array=`, `G:map-block-destructure=`, `G:map-unresolved`, `G:dynamic-expression`; `C` edge cases |
| hit test | native AR hit test | WorldQuery | none (runtime API `ViroSpecsARRuntime`) | WS3 | WS3 |
| placement | native AR placement patterns | SurfacePlacement | none (runtime API) | WS3/WS4 | WS4 |
| polyline | ViroPolyline | VolumetricLine | `polylines[]` | `VS2006` points not static, `VS2007` thickness not static, `VS2008` material not static, `VS1004` invalid values, `VS3015` children | `G:units-meters=`, `G:units-polyline-scaled=`, `G:units-default-thickness=`, `G:polyline-children=`, `PL`; `M` polyline-one-point |
| capabilities | runtime/native queries | SPECS capability report | `ViroSpecsCapabilityStatus` (schema `$defs/capabilityStatus`): `implemented`, `installed`, `permission`, `evidence` as separate fields | none | WS3 (hosts report it) |
| lights | ViroAmbient/Directional/Omni/SpotLight | Lens LightSource (protocol 2) | `lights[]` | `VS1015` only on protocol 1 transports, `VS3015` children | `G:lights-all=`; `S` lights and text style, lit.tsx `--strict` |
| materials | ViroMaterials | Lens material registry | `materials[]`, `materialId` | `VS1011` (info) when only the Lens registry has it; `VS3002` when more than one material is given | `S` first case (`route`) |
| portal | ViroPortal, ViroPortalScene | none | none | `VS4001` | `S` capability loop; `R` capability table |
| physics | `physicsBody`, `onCollision` | none | none | `VS4002` | `S` capability loop; `R` physics props |
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
