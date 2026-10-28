# Generated Lens Studio host

The static compiler can emit an attachable Lens Studio component instead of
plain JSON:

```bash
viro-specs compile \
  --entry src/SpecsScene.tsx \
  --out "/path/to/LensProject/Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts" \
  --format lens-ts
```

The generated component is a thin orchestrator over
`ViroSpecsSceneControllerHost` from `@viro-external/specs` (0.3 or later,
synced into the project). It embeds the scene as a scene protocol 2
document (`toSpecsSceneDocument`) and calls `present()` on start and
`clear()` on destroy. The controller does the rest:

- validates the document, stages it under a disabled root, commits, then
  retires the previous scene; a failure keeps the previous scene;
- renders text style, extents, maxLines, opacity, materials and lights;
- shows a tinted placeholder box for a missing asset (`VS5003`) instead of
  stopping the Lens;
- binds SIK one frame after commit and forwards all seven interaction
  phases;
- starts animations once every asset has loaded;
- presents ViroPolyline geometry with its `materialId`.

Nothing in the generated file throws. Problems are written to the Lens log
as `VS5xxx` diagnostics (see [specs-diagnostics.md](specs-diagnostics.md)).

Attach `ViroGeneratedSceneHost` to a SceneObject and assign one input,
`sceneHostObject`: the SceneObject holding `ViroSpecsSceneControllerHost`,
whose own input is the `ViroSpecsAssetRegistry` object.

### Migrating from the four-input host

Hosts generated before this change had `runtimeHostObject`,
`interactionHostObject`, `animationHostObject` and `navigationHostObject`,
and applied a protocol 1 snapshot. Regenerate the host, add
`ViroSpecsSceneControllerHost` to a SceneObject, point its
`assetRegistryObject` at the existing registry, and assign that SceneObject
to `sceneHostObject`. Register `placeholderMaterial`, `defaultMaterial`,
`defaultLineMaterial` and fonts on the registry to get placeholders,
scene-defined materials, polylines without a `materialId` and font
families. The old hosts stay in the package for apps that drive them
directly.

## Static animation support

The compiler recognizes top-level static calls of:

```ts
ViroAnimations.registerAnimations({
  pulse: {
    properties: { scaleX: 1.1, opacity: 0.8 },
    duration: 500,
    easing: "EaseInEaseOut",
  },
});
```

and a JSX animation reference:

```tsx
<ViroText animation={{ name: "pulse", run: true }} />
```

Supported native tracks are position, scale, rotation and opacity. Animation
chains and dynamic registrations currently emit diagnostics instead of silently
changing semantics.

## Event boundary

React callback functions do not execute on SPECS. Their presence is compiled
into interaction intent so the Lens runtime enables the correct SIK path.
Application behavior must route those portable interaction IDs into shared
domain/actions rather than trying to execute React closures on the glasses.

The generated-host path is covered by the focused Specs public-API workflow, including typecheck, JSX compiler regression, static compiler regression, and CLI syntax checks.
