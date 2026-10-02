# Eskiu-ready Viro extension program

Status: Phase 3 repository implementation complete; production promotion evidence-gated
Branch: `plan/eskiu-extension-architecture`
Paired repository: `mikevocalz/virocore`

## Why this exists

ReactVision has announced Eskiu as a systems language being introduced into memory-sensitive ViroCore modules. Our fork already carries substantial cross-platform XR work, so the safe long-term strategy is not to bind new features more tightly to individual `VRO*` C++ classes. It is to make the public React/TypeScript API stable while allowing the renderer implementation underneath it to evolve from C++ to mixed C++/Eskiu.

This document is the contract for that work. It is grounded in the public Eskiu v0.9.2 compiler, ABI reference, language specification, and ReactVision/Viro case study.

## Verified Eskiu baseline

The public Eskiu toolchain gives us enough information to build and test the language boundary now:

- repository: `doranteseduardo/eskiu`;
- pinned initial toolchain: `v0.9.2`;
- compiler: `eskiuc`;
- source extension: `.esk`;
- backend: LLVM 21+;
- memory model: explicit allocation, no garbage collector;
- ABI: the platform's native C ABI, with no separate Eskiu calling convention;
- output: plain native object files via `-c` or an `.o` output name;
- C → Eskiu: non-template top-level functions retain source symbol names;
- Eskiu → C: `extern` uses exact C symbol names;
- callbacks: C-compatible thunks are emitted when aggregate ABI lowering requires them;
- supported ABI documentation includes AArch64, x86-64 SysV, Windows x64, ARM32/AAPCS, and 32-bit x86.

This validates the C-facing extension seam and lets us add ABI smoke tests immediately.

## Evidence gate

Two different gates apply.

### Toolchain/ABI gate — satisfied for scaffolding

The public v0.9.2 compiler and ABI docs are sufficient to:
- pin and install `eskiuc`;
- emit object files;
- link Eskiu and C++ in both directions;
- define POD C-facing structures;
- build conformance/smoke tests;
- begin isolated, non-production experiments.

### Production ViroCore migration gate — still required

Before replacing a real ViroCore subsystem:

1. Query the official ViroReact MCP for the public API and current platform matrix.
2. Use `reactviro_find_native_bridge` for each affected JS prop/method/event.
3. Query the ReactVision native/platform MCP for the corresponding ViroCore/JNI/iOS/SLAM implementation and any internal Eskiu conventions.
4. Compare that result with upstream `ReactVision/viro` and `ReactVision/virocore` branches.
5. Record ownership, allocator, threading, target, and build rules for that exact module.
6. Benchmark the C++ reference path before swapping the implementation.

Until that second gate is satisfied, C++ remains the reference renderer backend, while Eskiu may be used for isolated ABI probes and experimental extension-owned modules.

## Platform readiness ladder

The public Eskiu v0.9.2 roadmap matters to our rollout order.

### Ready enough for immediate ABI proof
- macOS arm64 host object generation/linking;
- Linux x86-64/arm64 host object generation/linking;
- C ABI calls in both directions;
- POD structs and callbacks;
- explicit allocation experiments;
- freestanding object generation where appropriate.

### Ready for controlled native pilots after local build validation
- Apple native extension-owned modules that do not depend on unpublished Viro internals;
- Linux/native benchmark fixtures;
- renderer-adjacent helper modules behind the C++ reference path.

### Fork-validated target readiness
The upstream Eskiu v0.9.2 roadmap originally listed Android NDK/JNI packaging as unfinished. This fork has now closed the repository-side tooling gap with validated probes for:
- Android AArch64 object generation;
- JNI shared-library packaging;
- Gradle/AAR integration;
- 16 KB alignment;
- Apple object targets;
- WebAssembly object/link flow.

These build/toolchain proofs do not by themselves authorize a production renderer swap. Quest/PICO, visionOS/iOS, Web/WASM, and other domains still require the Phase 3 per-domain promotion evidence: native implementation mapping, same-device A/B measurements, parity, soak, and rollback.

### Production renderer swap gate
A production ViroCore module may only move to Eskiu after:
1. platform toolchain support is verified for that target;
2. the ReactVision native/platform MCP mapping is recorded;
3. the C++ baseline benchmark exists;
4. the Eskiu implementation passes contract conformance;
5. old/new paths can be compared behind a feature flag.

## Non-negotiable invariants

- Existing ViroReact JSX must continue to work.
- `ViroRivePanel`, `ViroGpuPanel`, `ViroThreeJSPanel`, spatial layout, co-location, Web/WASM, PICO, Quest/OpenXR, visionOS, glasses targeting, Mapbox-facing geometry, camera media, and controller/stylus work do not get rewritten just because the renderer language changes.
- App code never imports an Eskiu-specific package.
- TypeScript components never depend on concrete `VRO*` implementation classes.
- Platform detection is capability-driven whenever possible.
- Renderer handles are opaque outside the renderer boundary.
- No cross-boundary ownership is implicit.
- No per-frame API may allocate unbounded objects or strings.
- Native callbacks must document the thread on which they fire.
- Backends must be replaceable without changing public React component props.
- Web/WASM is a first-class backend, not a fallback afterthought.
- C++ remains a supported backend while Eskiu adoption is incremental.

## Target architecture

```text
Application / Moyo / games / tools
            |
            v
@reactvision/react-viro public API
            |
            v
Viro feature adapters
  - Rive/GPU/Three panels
  - input
  - spatial layout
  - shared frames / co-location
  - media
  - geometry
  - runtime capabilities
            |
            v
Viro Engine Contract
  - capability discovery
  - opaque resources
  - frame lifecycle
  - buffers
  - input samples
  - spatial frames
  - diagnostics
            |
            v
Native bridge layer
 Android / iOS / visionOS / Web
            |
            v
Renderer backends
  C++ reference
  Eskiu modules (when verified)
  WASM/Web
            |
            v
OpenXR / Metal / OpenGL / WebGL-WebGPU / device runtimes
```

## Ownership by layer

### Public React/TypeScript layer

Owns:
- component props and events;
- hooks and stores;
- capability-driven feature selection;
- graceful unsupported-platform behavior;
- serializable state for co-location/replication;
- high-level panel/media/geometry descriptors;
- stable error objects.

Does not own:
- GPU object lifetime;
- native frame buffers;
- OpenXR session state;
- renderer-thread objects;
- native allocator policy;
- Eskiu objects.

### Native bridge layer

Owns:
- translating JS/native values into stable engine-contract structures;
- validating enum/version/capability combinations;
- converting platform handles into opaque renderer handles;
- thread handoff;
- lifecycle cancellation;
- error/status translation.

Does not own:
- feature policy;
- app state;
- long-lived renderer resources unless explicitly retained by the engine contract.

### Renderer layer

Owns:
- GPU and scene resources;
- frame execution;
- geometry buffers;
- texture uploads;
- spatial/input samples in the render loop;
- renderer-side caches;
- per-frame allocation discipline;
- backend-specific synchronization.

## Feature carve-out

The machine-readable companion file `docs/architecture/eskiu-feature-matrix.json` is authoritative for migration state.

### Keep in TypeScript / React

These are deliberately **not** Eskiu migration targets:

- `ViroSpatialLayout` policy and layout selection
- Meta/PICO/Quest/visionOS targeting config plugins
- runtime capability hook ergonomics
- Zustand stores
- co-location room orchestration and replicated app state
- public Rive/Three/GPU panel components
- user-facing fallback/error behavior
- Expo integration
- route-level and screen-level XR composition

### Bridge-sensitive

These require a stable boundary but not necessarily an Eskiu implementation:

- OpenXR capability discovery
- visionOS immersive-space bridge
- stylus/controller/hand/gaze event delivery
- media capture controls
- camera texture handles
- co-location native pose ingress/egress
- spatial anchors/shared-coordinate frames

### Renderer-hot-path candidates

These may become Eskiu candidates **only after measurement and native-MCP verification**:

- dynamic geometry updates
- world-mesh processing
- pose/input ring buffers
- camera frame conversion/copy paths
- texture upload and panel surfaces
- BVH/mesh preprocessing
- GLB/glTF decode and transient buffers
- particle/update data
- physics transfer structures
- post-processing scratch buffers
- Web/WASM tracking math and visual-inertial buffers
- Mapbox AR route geometry generation where it crosses into renderer buffers

## Engine contract domains

The React layer may depend on these domains, not on concrete renderer classes:

1. **Capabilities** — feature/version/backend support.
2. **Resources** — opaque resource handles and explicit retain/release semantics.
3. **Frames** — begin/update/end lifecycle and timestamped samples.
4. **Buffers** — immutable views or explicitly-owned mutable regions.
5. **Surfaces** — GPU/render-target/texture producer-consumer contracts.
6. **Spatial** — poses, anchors, shared frames, world meshes.
7. **Input** — controller, hand, gaze, stylus, touch, mouse samples.
8. **Media** — camera/video/recording resources.
9. **Geometry** — static and dynamic mesh streams.
10. **Diagnostics** — backend name, contract version, allocation counters, timing counters, warnings/errors.

## Versioning rules

- Engine contract version follows `major.minor`.
- Major changes may alter binary layout or lifecycle meaning.
- Minor changes may add optional capabilities or fields.
- Every native backend reports its supported contract version.
- JS probes the contract before using optional capabilities.
- Unknown optional capabilities are ignored.
- A major-version mismatch fails fast with one actionable diagnostic.
- Public JSX versioning remains independent of engine-contract versioning.

## Memory and ownership rules

Every boundary value is one of:

- **value**: copied small POD data;
- **borrowed view**: pointer/span valid only for the documented call scope;
- **owned buffer**: created and released by the same allocator family;
- **opaque handle**: lifecycle controlled only through retain/release/destroy functions;
- **shared immutable asset**: content-addressed and safe to reuse across backends.

Forbidden:
- returning C++ STL containers across a language boundary;
- passing ownership via raw pointer without an explicit release operation;
- callbacks retaining borrowed memory;
- using JS object lifetime as native GPU lifetime;
- backend-specific pointer casts in React bridge code.

## Threading rules

Every engine operation is classified as:
- UI/main-thread only;
- renderer-thread only;
- worker-safe;
- async request/response;
- lock-free sample ingestion.

High-rate input and pose data should converge on bounded ring-buffer or latest-value semantics instead of unbounded event queues.

## Error model

Native/renderer operations must return structured status:
- domain;
- code;
- recoverable flag;
- optional backend;
- optional capability;
- short message.

Hot paths must avoid building strings unless an error is actually surfaced.

## Performance gates

A renderer migration is accepted only if it does not regress correctness and meets the target metric for the module being migrated.

Track at minimum:
- peak RSS / process memory;
- renderer heap;
- transient allocation count per frame;
- p50/p95 frame time;
- GPU upload bytes per frame;
- GLB/GLTF peak load memory;
- world-mesh update memory;
- camera-frame copy count;
- input/pose latency;
- co-location sample throughput;
- WASM heap growth;
- cold-start and first-frame time.

Test device classes:
- Android phone/tablet;
- iPhone/iPad;
- Quest;
- PICO;
- visionOS;
- browser desktop/mobile where supported;
- lightweight/glasses target when available.

## PR program

### Track A — architecture and evidence

A1. This program document + feature matrix.
A2. Native ViroCore architecture document + migration manifest.
A3. ReactVision MCP/native-MCP audit record.
A4. Upstream branch-diff report against current ReactVision release/develop.

### Track B — contract foundation

B1. Add TypeScript engine capability types (internal first).
B2. Add native contract version probe.
B3. Add structured backend diagnostics.
B4. Add opaque resource-handle conventions.
B5. Add lifecycle/threading tests.

### Track C — input and spatial

C1. Controller/stylus/hand/gaze sample contract.
C2. OpenXR capability adapter.
C3. Shared-frame/co-location pose adapter.
C4. World-mesh buffer adapter.
C5. Anchor/shared-coordinate adapter.

### Track D — surfaces and media

D1. Generic render-surface contract.
D2. Adapt `ViroGpuPanel`.
D3. Adapt `ViroRivePanel`.
D4. Adapt `ViroThreeJSPanel`.
D5. Camera texture/frame contract.
D6. Recording/video surface contract.

### Track E — geometry and assets

E1. Dynamic geometry stream contract.
E2. Mapbox-route geometry adapter.
E3. GLB/glTF loader instrumentation.
E4. Mesh/BVH instrumentation and ownership cleanup.
E5. Particle/physics transfer audit.

### Track F — backends

F1. C++ reference backend behind the contract.
F2. Web/WASM contract parity.
F3. OpenXR backend parity across Quest/PICO.
F4. visionOS/Metal parity.
F5. Eskiu ABI/toolchain smoke backend using public v0.9.2 on host platforms.
F6. Android target enablement: **complete at repository/build-probe level** — AArch64 object, JNI, Gradle/AAR and 16 KB packaging validated.
F7. Web/WASM target feasibility: **object/link proof complete**; production renderer integration remains promotion-gated.
F8. Apple target feasibility: **object-target proof complete**; device runtime promotion remains evidence-gated.
F9. Production Eskiu renderer backend(s): selective, domain-scoped promotion only after native-MCP mapping + same-device A/B + parity + soak.

### Track G — validation

G1. contract conformance tests;
G2. per-platform capability snapshots;
G3. memory/perf benchmark harness;
G4. visual regression for render surfaces;
G5. upgrade/rebase CI against upstream Viro/ViroCore.

## Merge policy

- Planning/evidence PRs can merge immediately when internally consistent.
- Contract PRs must be additive until one feature has proven end-to-end parity.
- No feature migration may remove the old path in the same PR that introduces the new path.
- Backend swaps happen behind feature flags first.
- Removal requires two green release trains or equivalent cross-platform soak coverage.
- Every PR identifies the public API impact as: none / additive / breaking.
- Every PR identifies the renderer impact as: none / bridge / hot path / backend.

## Upstream sync strategy

Our fork should minimize patches directly inside high-churn upstream implementation classes. Prefer:
1. small upstream-facing adapters;
2. separate extension-owned implementation files;
3. contract tests;
4. generated or scripted integration where practical.

For each ReactVision release:
- diff Viro and ViroCore;
- classify touched files by this ownership model;
- re-run capability snapshots;
- re-run native contract tests;
- run benchmark smoke tests;
- only then merge the upstream release.

## Definition of done

The repository implementation program is complete. Production promotion remains intentionally per-domain and evidence-gated.

Repository completion now includes:
- all current custom features mapped to a stable domain;
- public JSX no longer relies on renderer implementation class names;
- native ownership/threading is documented and tested;
- C++ reference backend passes the full contract suite;
- Web/OpenXR/visionOS paths pass capability parity tests;
- public Eskiu v0.9.2 ABI/toolchain conformance is green;
- MCP/native-MCP production ViroCore conventions are recorded;
- Eskiu modules can replace eligible C++ hot paths without public API changes;
- performance claims are supported by repeatable measurements.
