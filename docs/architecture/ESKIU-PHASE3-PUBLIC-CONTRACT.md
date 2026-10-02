# Eskiu Phase 3 — public Viro contract

The renderer migration is intentionally invisible to application code.

## Public API guarantee

Existing Viro components, hooks, and events keep their current public shapes while
eligible native hot paths are evaluated for Eskiu.

Application code does not:
- import Eskiu;
- select native object files;
- handle C ABI structs;
- branch on C++ class names;
- own renderer memory;
- change JSX when a backend is promoted.

## Backend selection

Backend preference is domain-scoped and routed through the internal engine contract.

Supported preferences:
- `auto` — release default; remains C++ until that domain is formally promoted;
- `cpp` — force the reference/rollback implementation;
- `eskiu` — request the Eskiu implementation; an unavailable backend must not
  silently masquerade as active.

Domains are intentionally coarse:
- input;
- spatial;
- surface;
- media;
- geometry;
- world mesh;
- asset loading.

## Stable feature surfaces

The following stay public-feature APIs rather than language-specific APIs:

- `ViroRivePanel`
- `ViroGpuPanel`
- `ViroThreeJSPanel`
- `ViroCameraTexture`
- `ViroPolyline` / route geometry consumers
- co-location/shared frames
- controller/hand/gaze/stylus events
- OpenXR/Quest/PICO runtime helpers
- visionOS immersive-space and stylus helpers
- Specs/universal XR helpers
- Web/WASM component surfaces

## Promotion rule

A domain can change AUTO from C++ to Eskiu only after the paired ViroCore
promotion gate is satisfied. The React package must not promote a domain merely
because an Eskiu implementation compiles.

The public package remains backwards-compatible with older bundled renderer
artifacts: new engine-contract functions probe or fail closed rather than making
older AAR/framework combinations crash.

## Rollback rule

Every production Eskiu promotion retains the C++ implementation and a domain
preference switch for the soak period. Public JSX is unchanged during rollback.
