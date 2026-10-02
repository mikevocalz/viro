# SPECS runtime bridge

The public Viro package now closes the gap between Viro-authored JSX and the
validated Lens Studio backend.

`compileViroSpecsJSX()` remains renderer-neutral. The runtime bridge accepts a
structurally compatible backend and:

- publishes SPECS runtime/capability state through `useXRRuntime()`;
- applies the compiled portable scene;
- routes SIK interactions back to normal Viro callbacks;
- sends ViroPolyline geometry to the VolumetricLine backend;
- resolves registered Viro animations into native Lens AnimationPlayer plans;
- exposes WorldQuery hit testing and surface placement;
- exposes SpecsNavigationKit route presentation;
- tears the backend down without leaving interaction subscriptions/routes alive.

Applications do not import Lens Studio APIs.

## Animation

Normal registration remains valid:

```ts
ViroAnimations.registerAnimations({
  lift: {
    duration: 450,
    easing: "ease-out",
    properties: {
      positionY: 0.2,
      opacity: 1,
    },
  },
});
```

`compileRegisteredViroAnimationForSpecs("lift")` converts the numeric
transform/opacity subset into the portable native AnimationPlayer plan.
Positions remain meters until the Lens backend boundary; rotations remain Viro
Euler degrees until the backend converts them to Lens radians.

Animation chains are deliberately rejected rather than flattened incorrectly;
sequence parity should be implemented as its own runtime feature.

## WorldQuery and placement

The bridge uses Viro meters for inputs/outputs:

```ts
await mounted.hitTest({
  origin: [0, 0, 0],
  direction: [0, 0, -1],
  maxDistance: 8,
});

const stop = await mounted.startPlacement("horizontal", (pose) => {
  // pose.position is meters
});
```

Lens centimeters never leak into application code.

## Navigation

Geographic routing remains provider-neutral. Feed the bridge a normalized
`ViroSpecsNavigationPlan`; the backend owns SpecsNavigationKit and
VolumetricLine rendering.
