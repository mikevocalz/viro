# TraceSift performance workflow

TraceSift is the default first-pass analyzer for JavaScript CPU, Hermes, and React Profiler captures in this repository.

## Setup

Requires macOS or Linux and Node.js 22.19 or newer.

```sh
npm run perf:tracesift:init
npm run perf:tracesift
```

The first command installs the matching local TraceSift app. The second starts the local UI. Provider credentials stay in TraceSift's local home directory; do not add them to this repository.

## What to profile

Capture the same scenario before and after a performance change:

- scene mount/unmount with a representative node count;
- React prop/state updates that fan out into Viro nodes;
- event-heavy interactions such as drag, gaze, hover, pointer, or controller input;
- web renderer scene updates;
- Rive/external-surface panel composition from the React layer;
- navigation into and out of XR scenes.

Use a React Profiler export for render/commit problems. Use a Hermes or JavaScript CPU profile for JS execution hot spots.

TraceSift does not replace native/GPU profiling. If the handoff points at renderer, JNI/JSI, OpenXR, Metal, Vulkan, or C++ work, continue with the appropriate native profiler and keep the TraceSift finding as the JS-side evidence.

## Repeatable comparison

1. Use the same device/simulator, build type, scene, asset set, and interaction.
2. Warm the app before recording.
3. Capture 15-30 seconds and avoid unrelated navigation.
4. Analyze the profile in TraceSift and copy the smallest actionable handoff prompt.
5. Fix one bottleneck at a time.
6. Re-run the exact scenario and record the before/after result in the PR.

Do not commit raw profiles by default. They can contain source paths, interaction details, and other local/session information. Prefer a short written finding plus before/after measurements.
