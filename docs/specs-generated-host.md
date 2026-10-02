# Generated Lens Studio host

The static compiler can emit an attachable Lens Studio component instead of
plain JSON:

```bash
viro-specs compile \
  --entry src/SpecsScene.tsx \
  --out "/path/to/LensProject/Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts" \
  --format lens-ts
```

The generated component imports the validated runtime hosts already synced by
`@viro-external/specs` and performs the final wiring:

- applies the portable scene to `ViroSpecsRuntimeHost`;
- enables SIK interaction on nodes with Viro hover/click/drag handlers;
- enables manipulation for draggable nodes;
- plays statically registered Viro animations through
  `ViroSpecsAnimationHost` / Lens AnimationPlayer;
- presents ViroPolyline geometry through `ViroSpecsNavigationHost`.

Attach `ViroGeneratedSceneHost` to a SceneObject and assign the four host
objects in the Inspector.

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
