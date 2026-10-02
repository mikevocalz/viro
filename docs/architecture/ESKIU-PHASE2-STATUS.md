# Eskiu integration status — ViroReact layer

The React/TypeScript layer is intentionally stable while ViroCore becomes backend-flexible.

## Landed

- typed engine capability/diagnostic contract
- Android bridge to the engine contract
- generic render-surface contract
- `ViroGpuPanel`, `ViroRivePanel`, and `ViroThreeJSPanel` adapted to that surface seam
- input/spatial/media/geometry/world-mesh contracts provided by ViroCore
- portable XR semantic contracts for backend parity
- Eskiu input shadow and geometry differential pilots underneath the public API
- Android, Apple and WASM build-target probes in ViroCore

## Stable by design

These remain React/TypeScript concerns rather than Eskiu rewrite targets:
- JSX component APIs
- spatial layout policy
- Expo/config targeting
- Zustand/application state
- co-location room orchestration and replicated app state
- platform fallback UX

## Production rule

A renderer implementation may change underneath these components only when the same public behavior passes contract tests, target/device benchmarks and feature-flagged soak coverage. The app must never need to know whether a backend module is C++ or Eskiu.
