# Viro Platform Modernization & Spatial Interoperability

**Revision 2 — platform scope; downstream apps deferred**  
**Research snapshot: September 25, 2026**

Fork-preserving upstream upgrade • native + web + visionOS • layouts, panels and input

**Scope override:** This replaces the earlier app-focused plan. Work is confined to the Viro platform and related local/forked libraries; application integration is deferred.

## Contents

01. Platform scope and non-negotiable decisions
02. Verified baseline and 3.0.1 artifact verification
03. Repository map and local discovery
04. Fork-preserving synchronization and artifact provenance
05. Named engineering reference roster
06. Named design and platform reference roster
07. Reference teams and upstream responsibility
08. Delivery roster and sign-off ownership
09. Shared platform architecture
10. Viro web baseline and first repair targets
11. WebXR adapter: retain ViroCore as renderer
12. Meta web support, IWSDK and IWER
13. WebSpatial and Viro web: matching the correct layers
14. PICO native containers, augments and hosting
15. Gaze, hover and input semantics across backends
16. Meta native layout: separate adapter
17. Meta native release and surface constraints
18. visionOS native lane and platform parity
19. Native OpenXR containers and browser composition layers
20. Proposed shared API and ownership contract
21. Native Rive, GPU and canvas bridge completion
22. Geometry, capture and spatial manipulation
23. Standalone Viro Platform Lab
24. Implementation sequence and checkpoints
25. Acceptance matrix: native, browser and immersive
26. Performance, reliability and release gates
27. Required skills, tools and source discipline
28. Copy-ready implementation brief
29. Handoff protocol and current completion boundary
30. Source register
31. Source register — continued
32. Source register — continued
33. Source register — continued
34. Source register — continued
35. Source register — continued

<!-- PAGE -->
# 01 | Platform scope and non-negotiable decisions

## This is library work, not an application rollout
Modernize the user's local and forked Viro ecosystem, preserve its custom work, and bring the shared scene/panel/interaction layer across native mobile, Quest, PICO, visionOS and the browser. Moyo integration is deferred. Do not edit its screens, tutor logic, subscriptions, backend or application dependencies in this phase.

**Confirmed upstream target: Viro 3.0.1.** The user confirmed 3.0.1 as the intended target on September 25, 2026, matching the GitHub source/release metadata already reviewed. Pin that release and verify package, source and binary provenance before integration. Do not change the target merely because a newer release appears. [U01] [U02]

Preserve ViroCore's renderer. Use its native targets and its existing WASM/WebGL2 target as the rendering foundation; add explicit platform, window and session adapters around them. The upstream browser renderer already exists, and the user's fork already lists web and visionOS peers. This is integration and modernization, not a blank-slate engine replacement. [U04] [U05]

## Architecture decisions
**AD-01 — Fork preservation first.** Inventory local branches, worktrees, patches, assets and native artifacts before merging upstream. A public remote does not reveal unpushed work.

**AD-02 — Separate renderer from presentation.** An engine panel, OS window, WebXR compositor layer and native WebSpatial element are different resources. Share intent and semantics, not fabricated equivalence.

**AD-03 — Three web responsibilities.** Viro web draws the scene; WebXR hosts an immersive browser session; WebSpatial supplies supported spatial web containers/UI. Meta IWSDK is a relevant input/tooling reference, not a drop-in renderer for Viro. [U05] [MW02]

**AD-04 — Truthful capabilities.** Separate support, permission, current tracking validity, implementation state and effective presentation. A declared prop or SDK header is not a working feature.

**AD-05 — Standalone acceptance.** Use a neutral Viro Platform Lab. No downstream app should be required to test an engine fix. Native, browser, immersive and windowed routes each receive their own evidence.

**AD-06 — Handoff is a deliverable.** Maintain a resumable checkpoint, exact revisions, unfinished gates and next commands throughout implementation. The standalone handoff accompanies this document.

<!-- PAGE -->
# 02 | Verified baseline and 3.0.1 artifact verification

These are remote observations from September 25, 2026, not a local filesystem audit or a completed upgrade.

| Item | Observed evidence | Consequence |
| --- | --- | --- |
| Upstream `ReactVision/viro` | `package.json` and latest GitHub release returned 3.0.1. [U01] [U02] | Use the confirmed 3.0.1 target; verify its registry artifact, source revision and bundled binaries. |
| User Viro fork | `decax9-three-panel` manifest returned `3.0.0-moyo.4`. [U04] | This suffix is historical package provenance, not application scope. |
| Upstream browser renderer | Source manifest says 1.0.0; Viro now requires `^1.0.0`, while the fork has `>=0.0.1`. [U01] [U04] [U07] | Upgrade the paired renderer, C API and WASM assets together. |
| Native compatibility lane | Upstream peers constrain React Native to 0.86.x and Expo to 57.x; visionOS peer is separate. [U01] | Do not force those constraints onto a user's newer working branch or widen them without builds. |
| Canvas bridge | Manifest returned 0.0.1 with broad Nitro/native dependency ranges. [U10] | Pin resolved Nitrogen, runtime and native ABI versions in the test lane. |
| Local state | No laptop worktree, installed package or headset inspected. | Local discovery and artifact checks remain first execution steps. |

## Resolve source, package and binary independently
Run the following on the authorized development machine. These are verification commands, not installation or publishing commands:

```bash
npm view @reactvision/react-viro dist-tags --json
npm view @reactvision/react-viro@3.0.1 \
  version gitHead dist.tarball dist.integrity peerDependencies --json
npm view @reactvision/virocore dist-tags --json
npm view @reactvision/viro-web-renderer dist-tags --json
```

The registry was not accessible during the earlier authoring pass. That access limitation does not change the confirmed 3.0.1 target. Archive its registry metadata and inspect the package in an isolated directory with lifecycle scripts disabled; map bundled native/WASM artifacts to their build sources. If metadata is unavailable, record a provenance-verification blocker and continue independent preservation/tests without changing the target.

Keep an upstream-compatible control lane and a separate existing-local-toolchain lane where needed. A successful baseline build does not establish compatibility with an Expo beta or a different React Native fork.

<!-- PAGE -->
# 03 | Repository map and local discovery

| Repository or dependency | Responsibility | Local policy |
| --- | --- | --- |
| `mikevocalz/viro` ↔ `ReactVision/viro` | React components, platform resolution, event contracts, plugins and package assembly. | Preserve fork-only panels and adapters; reconcile with the exact upstream target. |
| `mikevocalz/virocore` ↔ `ReactVision/virocore` | C++ scene renderer, Android/OpenXR, Apple/Metal and browser build source. | Inventory all native branches, including historical PICO work; rebuild rather than choose arbitrary prebuilt binaries. |
| `mikevocalz/nitro-canvas-in-Vision` | Native surfaces, content producers, external textures and input mapping. | Preserve Rive, GPU/Three and other existing producers found locally; do not assume a producer is complete from its type. |
| `mikevocalz/expo-pico` | PICO Expo flavors, native platform bindings, launcher and diagnostics. | Preserve OS/runtime distinctions and locally staged renderer provenance. |
| `ReactVision/viro-web-renderer` | WASM loader, browser bridge/C API, assets and browser AR. | The Viro manifest references a sibling local checkout. Locate the user's actual copy; no user-owned remote is assumed. [U04] |
| `@reactvision/react-native-visionos`, visionOS template | Native RN platform and host integration. | Locate actual aliases, patches and template revisions; avoid duplicate RN copies. |
| Existing local Horizon/Expo plugins | Quest configuration and native window integration. | Discover through remotes, package manifests and workspace links; do not invent repositories. |

## Local discovery procedure
Start from the user's authorized workspace roots, not a guessed home directory. Enumerate Git roots and linked worktrees without traversing unrelated personal folders. Capture branch, HEAD, upstream, dirty/staged status, untracked filenames, submodules, Git LFS state, lockfile and local package links.

Identify every modified file/asset needed for a reproducible build, including ignored `.riv` assets and native outputs. Do not add secrets, signing keys or credentials to an evidence archive. Redact credential-bearing remote URLs. A Git bundle captures committed history, not uncommitted or untracked work; keep an appropriate local backup for each class.

For each fork delta, record its purpose and a disposition: **preserve, adapt, already upstream, replace with upstream after equivalence proof, or defer with reason**. Include panel dragging, native texture paths, PICO renderer support, Rive state machines, Three/GPU content producers, input fixes, Expo plugins and Apple patches wherever they exist.

No `reset --hard`, `git clean`, forced push, automatic stash drop or lockfile replacement is part of discovery. Do not publish a new fork or move a remote without authorization.

<!-- PAGE -->
# 04 | Fork-preserving synchronization and artifact provenance

## Merge behavior, not only version strings
Create an integration branch/worktree from the actual local baseline after preserving work. Fetch upstream into explicit refs, resolve the target commit and compute the common ancestor. Use the diff and existing test evidence to make a delta ledger before conflict resolution.

Do not use a global “ours/theirs” strategy. For each conflict, identify the native symbol, expected behavior and test that must survive. Particularly inspect event dispatch, material descriptors, ViroCore external-image imports, scene navigation, PICO/OpenXR initialization, Metro platform resolution and visionOS plugin changes.

Upstream 3.0.x includes Quest interaction repairs, changes to shared-frame routing and plugin permissions, native artifact rebuilds and removal of a nonfunctional cloud-anchor callback. Port behavior and migration notes together. The release notes explicitly tie fixes to rebuilt renderer binaries; a TypeScript-only merge is insufficient. [U03]

## Package and native build manifest
Record the following per target:

```text
repo / remote / branch / commit / dirty-state
upstream target version / tag / commit / registry integrity
lockfile revision / package-manager version / RN + Expo versions
Nitrogen + Nitro versions / generated binding revision
NDK + CMake + compiler / Apple SDK + deployment target
Emscripten version / WASM compile flags / C API schema
AAR + SO + XCFramework + WASM/JS/DATA checksums
runtime build ID / package tarball contents / test evidence
```

Generated binaries are not text conflicts to “resolve” by keeping whichever side is larger or newer. Build them from the integrated source, retain license/provenance requirements and verify architecture slices. For browser artifacts, `.js`, `.wasm` and `.data` must come from the same build. Record any packaged tracking-module sidecars separately. [U05] [U07]

Run clean-install consumer probes against a packed artifact, not only workspace symlinks. Inspect the package file list, generated `.web` entries, native headers, podspecs, Gradle artifacts and assets. Detect a stale binary by runtime build ID/checksum, not package name alone.

Keep upgrade commits separable from new feature commits. A regression bisect should distinguish upstream synchronization, native artifact rebuild, external-frame support, new adapters and visual changes. A rollback must restore matched source/package/binary sets without deleting the user's pre-existing work.

<!-- PAGE -->
# 05 | Named engineering reference roster

These are public practitioners whose published work is relevant to the implementation. They are not assigned contributors, consultants, endorsers or confirmed available hires. The review questions below are proposed responsibilities for the fork maintainers; they are not statements that these people reviewed this project.

| Person and public work | Why their work belongs in the reference set | Review question for our implementation |
| --- | --- | --- |
| **Luigi Rosso — Rive cofounder; runtime and engine work** [E01] | Study the separation between Rive's state machine, asset model and rendering backend. | Can an artboard remain alive and interactive while its output target is resized, moved or recreated? |
| **Chris Dalton — Rive renderer and runtime writing** [E01] | Study GPU vector rendering, clipping, feathering and the costs of particular visual effects. | Are the chosen Rive features supported by the pinned backend, and do alpha and clipping survive Viro composition? |
| **Marc Rousavy — Nitro Modules and native React Native libraries** [E02] | Study typed native objects, ownership, C++/Kotlin boundaries and low-overhead data transfer. | Does the surface contract make disposal, thread affinity and stale-handle rejection explicit? |
| **Eduardo Dorantes — ReactVision/ViroReact and native spatial infrastructure** [E03] | Study ViroCore's existing renderer, bridge, event system and platform boundaries before extending the fork. | Does the change reach the real material/input path, or stop at a JavaScript wrapper? |
| **William Candillon — React Native Skia/WebGPU and Dawn contributions** [E04] [E05] | Study native GPU resource interop, frame presentation, swapchain recovery and worklet execution. | Are imported resources compatible with the actual graphics device and library build, and is presentation synchronized? |
| **Evan Bacon — published Expo Router engineering** [E06] | Study universal routing, native-first abstractions and navigation state boundaries. | Does entering a different spatial presentation preserve one workspace identity and recover cleanly after Activity recreation? |

## How to use this roster

Read a relevant technical artifact, extract one concrete principle, and apply it to a named code path or test. Record the source and the resulting decision. Avoid prompts that ask an agent to impersonate these engineers or claim their approval. A name is useful only when it points to a mechanism, implementation pattern or review question.

For graphics work, start with Rive's current rendering-loop and external-renderer documentation, then inspect the pinned source used by the application. For WebGPU work, check device/instance compatibility rather than assuming two libraries can share handles because both use Dawn. [G01] [G02] [G03]

<!-- PAGE -->
# 06 | Named design and platform reference roster

These public practitioners are references to published work, not assigned staff, consultants or endorsers. Apply their methods through the actual implementers and tests.

| Person and public work | Relevant practice | Review question |
| --- | --- | --- |
| **Guido Rosso — published Rive design work** [E07] | Layered hierarchy, interactive motion and authorable runtime behavior. | Do editable assets include targeted, pressed, grabbed, disabled, error and reduced-motion states? |
| **Mike Alger — VR OS and spatial UI research** [E08] | Ergonomic content zones and discoverable spatial affordances. | Can users select, move and restore panels seated or standing without sustained uncomfortable reach? |
| **Ada Rose Cannon — spatial web and natural-input writing** [E09] | Web input semantics and privacy-preserving spatial interaction. | Are committed activation, transient target rays and permissioned continuous tracking kept distinct? |
| **Szymon Rybczak — React Native CLI and platform work** [E10] | Native project integration and reproducible cross-platform tooling. | Do platform extensions, generated projects and native dependencies work from a fresh checkout? |

## Design direction for a reusable platform
Build a neutral, legible spatial system with configurable theme tokens, gently rounded geometry, clear focus, a separate grab region and purposeful motion. Do not embed one application's branding or content model into library components. Demonstrate the same controls with a few neutral fixtures rather than hardcoding a tutor or a lesson.

A panel's visual silhouette and hit region must agree. Target feedback should reveal the selected control without moving it out from under the pointer. During a grab, motion should follow the selected input authority; any settling or docking occurs after release. Provide an explicit restore-layout action.

Retain Rive/RML source, exported semantic names, generated assets, feature-support checks and license provenance. A web preview and a native texture path may support different effects; the compatibility report must name the difference rather than quietly substitute a static image.

Ten named references are retained across this and the engineering roster. Their presence is not evidence of project review. Actual owners and reviewers must be recorded in the delivery roster with the code and tests they inspected.

<!-- PAGE -->
# 07 | Reference teams and upstream responsibility

| Reference team or project | What to study | Boundary |
| --- | --- | --- |
| ReactVision / Viro / ViroCore | Scene bridge, native renderer and source migrations. [U01–U03] | Upstream support does not prove a packaged fork feature. |
| ReactVision browser renderer | WASM/C API, loader, events and assets. [U05–U07] | Desktop canvas rendering is not automatic WebXR stereo. |
| ReactVision visionOS platform work | Metal host, RN fork, template and lifecycle. [U08] | Preview support is not complete component parity. |
| Rive runtime/renderer team | Native and web rendering, feature support, resource lifetime. [G01] [G02] [T07] | A `RiveView` is not an offscreen bridge. |
| Rive editor/CLI/design team | Source authoring, state machines, binding and testing. [T06] | Editor success does not validate engine composition. |
| Margelo / native RN contributors | Nitro, typed native objects, C++/Kotlin boundaries. [E02] [T04] | Shared library names do not prove shared GPU devices. |
| Callstack platform/documentation teams | RN platform integration and Meta guides. [T08] [E10] | Validate snippets against installed vendor types. |
| Meta native Layout/Gaze teams | System windows, target hints and release constraints. [M01–M07] | Android APIs do not execute in a browser. |
| Meta IWSDK / IWER teams | WebXR interaction, emulation and tooling. [MW01] [MW02] | Three.js/ECS is separate from ViroCore. |
| PICO Spatial SDK / tracking teams | Containers, augments, gestures, tracking and surfaces. [P01–P11] | Hardware, permission and presentation mode matter. |
| WebSpatial maintainers | Spatial DOM, runtime packaging and web scene lifecycle. [W01–W06] [WW01] | No universal simultaneous WebSpatial/WebXR UI. |
| Khronos OpenXR implementers | Native spatial-container and gaze contracts. [O01–O05] | Extension ratification does not prove device support. |
| W3C / Immersive Web contributors | WebXR sessions, inputs, layers and browser behavior. [XR01–XR03] | Detect optional features at runtime. |
| Apple platform / WebKit teams | Compositor, Metal and browser-platform behavior. | Use platform docs plus Viro's verified integration; do not infer raw gaze access. |
| Expo / RN Skia / WebGPU contributors | Native generation, rendering interop and device compatibility. [T09] [G03] | Preserve actual toolchain constraints. |

<!-- PAGE -->
# 08 | Delivery roster and sign-off ownership

Assign an owner and a reviewer to every changed workstream. A single person may fill several roles, but an agent must not invent people, approvals or hardware results.

| Workstream | Responsibility | Evidence required |
| --- | --- | --- |
| Fork integration / release lead | Local inventory, delta ledger, upstream merge and packaging. | Preserved branches, source/artifact manifest and clean consumer install. |
| ViroCore C++ / OpenXR engineer | Native rendering, external textures, input and lifecycle. | Both-eye output, context loss, safe teardown and PICO/Quest traces. |
| WASM / WebGL / WebXR engineer | Browser frame driver, C API, stereo views and XR session owner. | Real WebXR frame submission, cancellation, reentry and disposal. |
| visionOS / Metal engineer | ImmersiveSpace host, Apple texture path, shaders and input. | Native build, on-device enter/exit, supported-component matrix. |
| Rive native/browser runtime engineer | Artboards, state, assets, output targets and local input. | Rive-originated actions and live frames on each claimed backend. |
| React Native / Nitro engineer | Specs, bindings, native object and subscription ownership. | Generated bindings, ABI pins, stale-handle/mount stress tests. |
| PICO platform engineer | Expo flavor, SDK bindings, capabilities and loader isolation. | Native window and immersive tests; binary provenance. |
| Meta native platform engineer | Layout packages, fallback and Activity transitions. | Clean prebuild, capacity/fallback traces and release dependency audit. |
| WebSpatial integration engineer | Spatial shell, supported container embedding and transitions. | Runtime-specific canvas/scene tests and truthful fallbacks. |
| Spatial interaction engineer | Rays, capture, geometry, arbitration and source identity. | Deterministic math plus direct/indirect/cancel tests. |
| Spatial UX / motion designer | Layout, grip, focus, state sheet and recovery. | Task walkthrough, legibility and reduced-motion review. |
| Accessibility reviewer | Keyboard, alternatives, semantics, focus and handedness. | Usable non-XR route and tested input alternatives. |
| Privacy / security reviewer | Gaze, logs, assets, permissions, CSP and external tools. | Data-flow and release-log audit; denied/revoked tests. |
| Automation / performance QA | Browser emulation, device matrix, pacing, leaks and regressions. | Per-platform pass/fail/unverified evidence and trace files. |
| Platform maintainer | Public API, compatibility policy and release decisions. | Reviewed migration notes, rollback and no downstream-app coupling. |

Producer and consumer owners jointly review GPU handoff. Platform and interaction owners jointly review input. A build passing does not replace those reviews.

<!-- PAGE -->
# 09 | Shared platform architecture

## Layered responsibilities
```text
Application-independent Viro scene + panel specifications
  |-- content: Rive / GPU / drawing / model / text
  |-- layout: relative relationships + world pose
  |-- interaction: activate / manipulate / cancel / focus
  |-- capability + effective-presentation reporting
  |
  |-- Native ViroCore: mobile / Quest / PICO / visionOS
  |-- Browser ViroCore: WASM + WebGL2
       |-- ordinary browser canvas
       |-- WebXR immersive host (adapter to prove/complete)
       |-- supported WebSpatial web container

System window adapters: Meta Android / PICO native /
visionOS host / WebSpatial runtime
```

The rendering foundation is already present on native and web targets. The new work belongs at session, input, content-surface and layout boundaries. Do not translate every Viro node into Three.js or WebSpatial entities merely to obtain a window or a targeting gesture. [U05] [MW02]

## Separate public concepts
A **system window** has OS-owned placement/capacity. An **engine panel** is Viro geometry. A **composition layer** is a compositor-owned render surface associated with an XR session. A **spatialized DOM element** belongs to the WebSpatial runtime. A **world anchor** tracks an environmental relationship; a **layout anchor** relates interface elements.

Use one authoritative renderer/session owner per presentation. Model transitions explicitly: idle, initializing, active, suspended, ending, ended and error. Do not allow a navigator and a manual control to independently start/stop the same immersive host.

## Shared state without application coupling
Expose session/workspace identifiers and caller-owned state contracts. The library need not know a lesson, tutor or payment model. Preserve example scene state across inline-to-immersive transitions; independent browser windows require an explicit transport, not assumed React context.

Theme tokens, target descriptors, panel grouping and local interaction commands can be shared. Native handles, WebGL resources, OS window IDs and tracking poses cannot be serialized interchangeably. Prefer a tagged backend-specific resource descriptor over an untyped “texture” number.

Version shared contracts and migration behavior. Expose an explicit reason when a requested presentation is unsupported, pending or implemented through a different fallback. Unsupported features must not emit success-shaped empty data.

<!-- PAGE -->
# 10 | Viro web baseline and first repair targets

## Existing browser foundation
`@reactvision/viro-web-renderer` is the C++ ViroCore engine compiled to WASM and WebGL2, with a typed loader and handle-based scene API. It is not a Three.js renderer. Its source package includes renderer sidecars and a separate browser AR tracker. Keep the renderer and tracking service conceptually separate. [U05] [U07]

## Source-observed risks
| Observation | Required implementation/test |
| --- | --- |
| `dispose()` removes listeners/maps but does not stop the WASM loop; the source explicitly warns about accumulated loops. | Add real pause/stop/dispose behavior in the C++/WASM boundary; stress mount/unmount and context destruction. [U06] |
| Browser input forwards CSS coordinates to pixel coordinates via `viroOnTouch`. | Retain flat-canvas mapping, but add a distinct pose/ray-driven immersive input path. [U06] |
| `pointercancel` is connected to the same handler as pointer-up. | Trace native action semantics and ensure cancellation cannot commit an activation or completed drag. [U06] |
| No pointer ID or capture is forwarded in that shown path. | Define ownership and capture for multiple inputs, off-canvas motion and loss. [U06] |
| The inspected class drives drawing internally after initialization. | Find/implement an external XR frame driver; do not bolt a second uncontrolled loop onto it. [U06] |

This inspection does not establish that every upstream branch lacks WebXR. Search the pinned 3.0.1 target and local patches first. The sampled class is evidence for the code shown, not a complete repository-wide absence proof.

## Browser distribution checks
Test `.web.tsx` resolution, RN-to-RN-web aliasing, ESM loading, server-side import safety, public asset paths and missing/corrupt sidecars. Keep browser bundles free of native-only module initialization. Verify CSP-compatible loading in the chosen bundler rather than relaxing all script restrictions. [U05]

Serve matched assets with correct MIME and caching. Test deployment under a base path, asset URLs with query strings, cold loads and service-worker cache skew. Preserve a visible initialization error and retry/dispose path. Browser AR camera/IMU permission and tracking confidence need their own capability reporting; a headset WebXR session should use its session's poses rather than simultaneously running phone-style camera tracking.

<!-- PAGE -->
# 11 | WebXR adapter: retain ViroCore as renderer

## Standard contract, proposed integration
WebXR supplies the immersive frame clock, view data and compositor destination. A compatible WebGL context and per-view viewport are required; a mono canvas or mirrored desktop frame is not stereo rendering. These standard responsibilities are the basis for the adapter. [XR01] [XR03]

**Proposed Viro engine-port requirements — not existing exported APIs:**

```ts
interface ExternalFramePort {
  pauseInternalLoop(): Promise<void>;
  beginFrame(timeMs: number): void;
  renderView(view: {
    projection: Float32Array;
    viewMatrix: Float32Array;
    viewport: readonly [number, number, number, number];
    target: WebGLFramebuffer | null;
  }): void;
  endFrame(): void;
  resumeInternalLoop(): Promise<void>;
  dispose(): Promise<void>;
}
```

Implement or reuse the corresponding real C++/WASM exports only after finding the existing renderer's ownership. The JavaScript framebuffer above is a browser object, not an integer address safe to cast into native code. A reviewed Emscripten/WebGL resource mapping must preserve the actual context and reject stale resources.

## Frame and lifecycle invariants
Run simulation/animation once for each XR frame, then draw every provided view. Do not advance physics once per eye. Respect the runtime's projection, transform and viewport rather than assuming side-by-side packing, fixed eye count or a guessed inter-pupillary distance. Restore any renderer GL state deliberately across external framebuffer use.

Session start must pause the internal clock before externally driven rendering begins. During immersive mode the XR session owns scheduling. Session end cancels outstanding work, releases its layer references and resumes inline rendering only if the component remains alive. Page/component disposal must instead destroy resources and settle in-flight operations.

Handle reference-space reset, session visibility, denied entry, no pose for a frame, context loss, resize and ending during initialization. Keep a generation token so an old asynchronous start cannot revive a disposed scene.

## Implementation order
Prove one scene in one normal canvas, then a changing object in both eyes through the external driver, then input and panels. Search for `initViroScene`, `setViroSceneSize`, `viroOnTouch`, Emscripten loop registration and the C++ web presentation entry point. Add the smallest necessary C API rather than importing a second full engine.

<!-- PAGE -->
# 12 | Meta web support, IWSDK and IWER

## Use Meta's browser route, not Android window APIs
Meta's browser path is WebXR with runtime feature detection. Native `@metavr` layout packages remain in the Android adapter and must not leak into a browser bundle. Viro web can target the browser route once its session/render/input path is verified. [MW03]

The September 24, 2026 IWSDK release notes describe gaze-and-pinch, integration with existing target/press/grab systems, IWER 2.5 gaze emulation, development-only head-directed test gaze, and direct-touch/active-grab priority. They also distinguish optional gaze requests from required ones. These are relevant interaction and test references, not evidence that every headset exposes continuous eye data. [MW01]

IWSDK combines Three.js with an entity-component architecture and runtime/tooling systems. ViroCore's WASM scene is a different renderer. Do not install `World.create()` as a second owner of the Viro session and claim native integration. [MW02]

## Proposed reuse policy
Use independently compatible WebXR input, emulation and testing facilities where their contracts permit it. Otherwise port the observable interaction rules into Viro's own adapter and validate the behavior. Keep a standalone IWSDK reference fixture when it helps distinguish vendor behavior from a Viro bug; do not ship it as the Viro implementation.

Map direct touch, active capture, controller/hand rays and optional gaze without double dispatch. A target selected by one modality must not be stolen mid-grab by a new hover source. Developer-emulated gaze must carry `synthetic` provenance and stay out of production analytics and support claims.

Keep conventional controller/hand input available when gaze is unavailable or denied. Store no raw gaze by default. Never extrapolate an SDK release note into new hardware support or native-Apple permission access.

## Testing boundaries
IWER can test the browser adapter's state transitions and input routing; its exact compatibility with a custom Viro WebXR host must be proven. IWSDK ECS introspection and UIKitML inspection do not automatically introspect a Viro WASM scene.

Record emulator/browser/tool versions, real versus synthetic input, session ownership and exact test scenario. Pair emulator coverage with physical-headset stereo, latency, input and lifecycle results. Upgrade coupled development tools together in their own fixture; do not blindly impose IWSDK's renderer dependency overrides on Viro's packages.

<!-- PAGE -->
# 13 | WebSpatial and Viro web: matching the correct layers

## What can be shared
Reuse Viro scene definitions, content assets where supported, panel identities, layout recipes and normalized interaction semantics. Put the Viro web canvas inside a supported web content container, with explicit size, redraw and input mapping tests. This is an integration to prove, not a claim that an arbitrary canvas becomes a native volumetric entity.

WebSpatial's runtime model supports spatial web shells on supported platforms. Its documentation permits a web app to start an independently rendered WebXR session where that runtime supports WebXR; the spatialized pages/UI are hidden during that session. Packaged visionOS WebSpatial apps currently cannot start WebXR through WKWebView. [WW01]

## Three explicitly named web modes
| Mode | Render/UI owner | Acceptance |
| --- | --- | --- |
| `web-inline` | Viro WASM canvas in a normal web page. | Pointer/keyboard interaction, lifecycle and usable fallback. |
| `webspatial-shell` | Supported WebSpatial container; Viro canvas remains its own content renderer. | Runtime presence, element/container behavior and correct local input. |
| `webxr-immersive` | Browser XR session; Viro external-frame driver draws views. | Real stereo, session/input lifecycle and return to shell. |

Do not promise simultaneous native WebSpatial ornaments and immersive Viro WebXR content. Design an intentional transition and restore the shell state on exit. Do not label that independent WebXR experience as WebSpatial unified rendering or PICO's native Full Space. [WW01]

WebSpatial's published support list still places Meta Horizon OS in planned support. Use Meta's browser/WebXR route today rather than equating that with an implemented Meta WebSpatial runtime. [W01] [MW03]

## Unified rendering remains a different option
`<Model>` and `<Reality>/<World>` use WebSpatial's own supported content model. Mapping a subset of Viro scene descriptions into that model would be a separate renderer adapter with explicit feature limitations, not the default plan. Preserve ViroCore and avoid a whole-scene translation layer unless a concrete requirement justifies it. [W04]

For multi-window shells, use a versioned state transport, reconnection and duplicate-event handling. Never assume React context spans independent webpages. Keep content focus, pointer cancellation, window closure and the unavailable-immersive path testable without a downstream application.

<!-- PAGE -->
# 14 | PICO native containers, augments and hosting

The inspected PICO API reference is labeled **6.1.9**. Use that as the research version, not as an automatic dependency upgrade instruction. Pin the artifact actually installed and compare its types before coding. [P01]

| API | Documented capability | Adapter requirement |
| --- | --- | --- |
| `WindowContainer` | A uniquely identified OS container; planar/volumetric forms, size and resize configuration, appearance and placement. Each is associated with an Android Activity. [P01] | Own container identity, Activity lifecycle and effective presentation state. Keep pixel/dp layout separate from physical world dimensions. |
| `Augment` | UI around the main container using normalized anchor, alignment, offsets, rotation and appearance properties. [P02] | Translate relative placement intent; expose rounded/material styling only where supported. |
| `Subwindow` | A left/right companion that fills the parent container's height. [P03] | Do not assume an arbitrary independent floating-panel size. Respect semantic start/end and layout direction. |
| `SpatialNavigator` | Open/close stages and containers; minimize/restore containers under documented stage conditions. [P09] | Represent request results and lifecycle transitions, not a guessed immediate success. |

## Shared layout intent

A workspace may request “reference beside workspace” or “tools above drawing surface.” In native PICO mode, resolve those relationships through the supported window/augment API. In immersive Viro mode, resolve them to child-node transforms. Both render the same logical workspace, but different native objects own the placement.

Treat `TabBar` and `Toolbar` as additional PICO design-component candidates for navigation and repeated tools. Confirm their installed signatures and native-host compatibility before exposing corresponding shared ornaments. Their existence does not prove that an arbitrary React Native subtree can be inserted without hosting work. [P11]

## Documentation inconsistency to test

The inspected `Augment` page contains conflicting prose between overloads about viewpoint defaults and focus behavior. Do not copy an assumed default into the adapter. Set the intended values explicitly, inspect the pinned implementation and test input/accessibility behavior on the target runtime. [P02]

## Native hosting proof

Before adding complex content, create a minimal native PICO container with a title, a selectable button and one surrounding panel. Then prove the chosen RN hosting approach: mount, input, text focus, back navigation, close/reopen and state restoration. Shared JavaScript state must have a deliberate host/runtime lifetime; “both use React” does not establish that lifetime across Activities.

<!-- PAGE -->
# 15 | Gaze, hover and input semantics across backends

## Three services, not one ambiguous callback
**System target effects** describe a control and its visual emphasis. **Committed interaction** activates, manipulates or cancels a target. **Permissioned tracking** supplies valid samples only where supported. An effect may work while no app-observable gaze stream exists.

PICO's spatial hover effects run outside the application process, while its eye-tracking provider has a separate permission/space contract. WebSpatial does not provide pre-pinch gaze motion as ordinary JavaScript hover. Those restrictions must survive the shared API. [P04–P07] [W03]

Meta's native `GazeInteraction` is a native-view targeting API, not the same feature as IWSDK web gaze handling. Keep both distinct from OpenXR eye-gaze interaction and the renderer's controller/head/hand rays. [M06] [MW01] [O05]

## Proposed sample provenance
```ts
type InputProvenance = {
  source: 'controller-ray' | 'hand-ray' | 'direct-touch'
    | 'eye-gaze' | 'head-ray' | 'screen-pointer'
    | 'transient-pointer' | 'keyboard';
  evidence: 'device' | 'emulated' | 'synthetic-test';
  spaceId: string;
  spaceRevision: number;
  monotonicTimeMs: number;
  valid: boolean;
};
```

Map input source identity from the actual provider; do not infer eye tracking merely because a gesture feels like look-and-pinch. Record unavailable/denied/invalid separately. Reject nonfinite positions, zero directions, stale generations and timestamps from unrelated clock domains.

## Arbitration policy
Use one target/input authority per active presentation. Once committed, a grip owns movement, a drawing region owns a stroke and a control owns activation until end/cancel. A second pointer cannot silently take ownership. Direct contact and active capture should not lose priority to passive targeting. Native hit testing, browser events and synthesized compatibility clicks must not independently commit the same action.

Cancel on tracking loss, session transition, destroyed target, permission revocation or explicit interruption. Do not convert cancellation into release success. Make dwell-to-activate optional and clearly configured; looking alone must not unexpectedly activate destructive actions.

Gaze diagnostics should default to counters and error categories, not recorded pose histories. Synthetic headset testing is valuable evidence for the adapter, but not proof of physical eye-tracking behavior.

<!-- PAGE -->
# 16 | Meta native layout: separate adapter

Meta's Layout SDK extends a standard Android app with surrounding spatial windows without requiring Meta Spatial SDK's scene architecture. The RN guide requires React 18.2+ and React Native 0.85+, direct app dependencies for both JS packages, a compatible Gradle BOM/native setup and standard autolinking. A clean Expo prebuild must reproduce those native changes through configuration. [M01]

Use `SpatialSceneProvider` from `@metavr/layout-compat` and `SpatialWindow` from `@metavr/layout-window-compat`. The following is an **unexecuted integration sketch** using documented API names; it must be checked against installed types and the app's native configuration. [M01]

```tsx
import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
import { SpatialSceneProvider } from '@metavr/layout-compat';
import { SpatialWindow } from '@metavr/layout-window-compat';

export function WindowLayoutProbe() {
  const [count, setCount] = useState(0);
  return (
    <SpatialSceneProvider>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <Text>Panel control probe</Text>
        <Button title="Increment counter"
          onPress={() => setCount(value => value + 1)} />
        <SpatialWindow label="tools" windowWidth={360}
          windowHeight={480} priority={3} fallback="inline"
          anchor={{ parent: 'end', child: 'start' }}>
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <Text>Count: {count}</Text>
          </View>
        </SpatialWindow>
      </View>
    </SpatialSceneProvider>
  );
}
```

## Required companion test

Extend this probe with a main Rive workspace, Tools and Inspector windows, and a lower-priority Reference window. The current RN integration reserves two spatial-window slots; displacement must exercise the configured fallback. Preserve stable labels and shared workspace state. [M02] [B01]

Use a deliberately designed inline region with appropriate width and scrolling. Observe placement independently of the window's content, including when drop fallback prevents that content from mounting. Keep fallback content available through the main task flow. [M03]

This companion route has its own acceptance gate. It does not complete the Rive-to-Viro texture path or add PICO support.

<!-- PAGE -->
# 17 | Meta native release and surface constraints

## Placement and fallback

Meta exposes RN placement values `spatial`, `pending`, `inline` and `dropped`. Host availability and an individual window's placement are separate facts. The shared adapter should preserve that distinction and avoid inventing a detailed platform rejection code where the RN layer does not expose one. [M03]

Window roots must be opaque. Keep size, anchor and offsets stable; animate the content rather than pushing whole-window geometry across process boundaries every frame. The simulator can support more windows than the current RN two-slot integration and does not prove final headset depth or comfort. [M04]

Use one main task surface with no more than two simultaneously important supporting windows as the design target. Essential actions must remain reachable when another window is closed, unplaced or displaced. [M05]

## Gaze SDK release warning

The RN Gaze SDK documentation currently labels the SDK unstable, available by request and incompatible with store submission while bundled. It also states that most apps can support Look and Pinch through the operating system's ordinary targeting inference. Keep optional SDK experiments isolated from release artifacts. [M06]

`GazeInteraction` supplies targeting hints and tooltips for native views. It is not a general raw-eye-coordinate API. For a texture-backed Viro panel, native-view targeting cannot automatically discover the Rive buttons inside the pixels. The engine must maintain its own interaction model or use a separately implemented native semantic representation. [M06]

## Stereo surface composition probe

Meta's stereo composition API routes app-provided side-by-side or top-bottom images to each eye from an Android surface. It requires OS SDK 207+ and a supported surface path. `SurfaceViewExt.setStereoComposition()` serves SurfaceView/VideoView; an app-owned SurfaceControl uses the corresponding transaction API. [M07]

Proposed experiment: render a bounded stereoscopic inspector preview in a standard Android panel beside native controls. The app must render both views and size the visible surface for the per-eye aspect ratio. This is not automatic mono-to-stereo conversion and does not reproduce an immersive Viro scene's world interactions. Verify the perceived depth on a headset, not solely in a capture. [M07]

<!-- PAGE -->
# 18 | visionOS native lane and platform parity

## Preserve upstream native support rather than replace it with web
Viro's current visionOS guide describes a preview native `ImmersiveSpace` route through `ViroXRSceneNavigator`. It uses a Metal backend, expects a `ViroScene` root and identifies the platform with `isVisionOS()` rather than `Platform.OS`, which retains the iOS identity. Mixed/full immersion and partial component coverage are documented; progressive immersion is unsafe for the described implementation. [U08]

Treat the guide's RN/Expo/Apple-toolchain combination as a control configuration. The user's local branches may use newer tooling. Resolve the active RN alias, template, plugin, pods, Metal binary slices and C++ settings before changing versions. Source migration notes include visionOS alias and native-linking fixes, so port those with their artifacts. [U03]

## Separate three Apple presentations
Native Viro/Metal, Safari WebXR and packaged WebSpatial/WKWebView are distinct hosts. Test each explicitly. Safari browser support does not establish WKWebView support, and a working web canvas does not validate the native Metal path. Preserve one native immersive-space owner.

## Native compatibility backlog
Audit rather than assume feature parity: model/material rendering, animations, shader modifiers, text/glyph coverage, video/audio, camera/AR features, portals, drawing lines, particles and custom panel producers. Classify each as device-tested, source-supported-but-unverified, unsupported, or locally extended. A warning/no-op is not equivalent to a supported feature.

For native content surfaces, implement the Apple resource path using the actual Metal/IOSurface or other supported producer contract. Android AHardwareBuffer logic cannot simply be recompiled as Apple support. Verify format, alpha, color space, synchronization, resizing and resource retirement with both eyes.

Use existing upstream input behavior as the baseline, then prove any new system-target or tracking integration separately. Do not label head/hand-directed targeting as eye gaze. Do not collect undisclosed gaze data to obtain superficial input parity.

## Acceptance
Build the isolated native host; render a neutral scene; enter, exit and reenter; interact with a real panel; resize/recreate the producer; cancel input during transition; test lifecycle and both-eye output. Include the native platform's fallback/unsupported component behavior and keep iOS phone regression checks separate. No Moyo runtime or screen is involved.

<!-- PAGE -->
# 19 | Native OpenXR containers and browser composition layers

OpenXR specification 1.1.63, dated September 1, 2026, adds the ratified multi-vendor `XR_EXT_spatial_container` and `XR_EXT_spatial_container_self_rendering` extensions. They describe container management and an application-rendered route. [O01] [O02] [O03]

The strategic opportunity is to retain Viro's renderer while participating in a system-managed bounded container, rather than translating the entire scene into each vendor's native entity system. This is an architectural hypothesis to test. The documentation reviewed did not establish that the user's target PICO or Meta runtime exposes these extensions.

## Capability probe before integration

Enumerate extension support and query the applicable system/container presentation properties. Log runtime, device, OS build, extension revisions, graphics API and supported presentations. Keep the conventional immersive path when the required extensions or graphics presentation are absent.

Use a tiny changing triangle or textured quad before bringing in Rive or the reference model. Prove creation, visibility, view location, frame submission and resource teardown. Do not infer support from headers, a newer loader, a simulator or a vendor's general OpenXR conformance statement.

## Lifecycle change

With the spatial-container mode enabled, visibility and interaction are managed per container. The specification states that the session stays in `XR_SESSION_STATE_IDLE` for its active lifetime rather than passing through the conventional ready/visible/focused states. [O04]

Viro code that waits exclusively for traditional session focus transitions therefore needs a separately reviewed path. Each container must control its render/input availability without freezing unrelated application state. Track container-visible and interactable events, denied requests and external closure. [O04]

## Promotion criteria

The experiment can become a supported adapter only after the target runtime advertises the extension, a minimal rendering path works, both eyes are correct, interaction is stable, teardown does not leak and system/window transitions pass. The runtime support matrix must name tested OS builds.

Keep this experiment independent of ordinary `XR_EXT_eye_gaze_interaction`, which supplies a separate support query and gaze-interaction contract. Do not conflate eye tracking, spatial containers and scene/world anchors because they all use OpenXR types. [O05]

## Browser compositor layers are another optional backend
WebXR Layers can provide quad/cylinder/projection surfaces inside an immersive session when supported. They are not Meta Layout windows or native OpenXR container objects. Consider them for readable panel content only after basic Viro WebXR rendering passes. [XR02]

Keep a matching Viro hit-test representation and pose for a compositor-backed panel. Test ordering, transparency, occlusion, depth expectations, redraw rules and fallback to scene geometry. A compositor layer improving text does not automatically inherit scene-mesh occlusion or native window accessibility. Do not create two visible copies when switching representations.

<!-- PAGE -->
# 20 | Proposed shared API and ownership contract

These are design types, not claimed Viro exports. Align names with upstream after the merge; avoid colliding with vendor types or existing fork APIs.

```ts
type Availability =
  | { state: 'ready' }
  | { state: 'unsupported'; reason: string }
  | { state: 'not-implemented'; reason: string }
  | { state: 'permission-required'; permission: string }
  | { state: 'presentation-required'; presentation: string }
  | { state: 'initializing' }
  | { state: 'temporarily-unavailable'; reason: string };

type Presentation =
  | { kind: 'native-viro'; platform: string }
  | { kind: 'system-window'; platform: string }
  | { kind: 'web-inline' }
  | { kind: 'webxr-immersive'; sessionId: string }
  | { kind: 'webspatial-shell'; sceneId: string }
  | { kind: 'inline-fallback'; reason: string }
  | { kind: 'pending' | 'omitted'; reason?: string };

type PanelSpec = {
  id: string;
  contentId: string;
  sizeMeters: { width: number; height: number };
  cornerRadiusMeters: number;
  interaction: 'control' | 'drawing' | 'grab-region';
};

type RelativeLayout = {
  relativeTo: string;
  side: 'start' | 'end' | 'above' | 'below';
  alignment: 'start' | 'center' | 'end';
};
```

Keep physical geometry, native dp layout and CSS pixels in separate fields. Validate dimensions, radius and finite transforms; reject invalid values instead of sending them across a native boundary. Maintain logical layout direction independently from world-coordinate handedness.

Version content-surface descriptors and capability results. A native image handle, browser texture, Rive artboard and system-window identifier are different tagged resource types. Include generation and disposal ownership. Report effective placement and presentation with subscriptions that terminate on disposal.

Define a tested fallback policy per request. Never silently promote raw tracking permission requirements just to display a button. Never call a texture-backed panel “native accessible UI” unless it has a real semantic/accessibility representation.

<!-- PAGE -->
# 21 | Native Rive, GPU and canvas bridge completion

## Complete the producer and the consumer

The earlier brief identifies three failures to revalidate: the offscreen Rive adapter, the canvas descriptor's route into Android material/JNI sampling, and world-to-local input mapping. A wrapper with an initializer callback does not complete any of those paths. [B01] [R02]

Trace the actual implementation in this order:

```text
.riv asset -> artboard/state machine -> native Rive renderer
  -> reusable surface/buffer -> material descriptor
  -> Android material bridge -> JNI -> ViroCore texture
  -> shader/material sample -> OpenXR left and right views
```

For every hop, record file/symbol, resource owner, graphics thread/context and implemented/stubbed/broken status. First prove a static colored texture on each headset. Then use a changing test texture. Attach Rive only after the consumer route is proven.

Rive's C++ documentation describes advancing state, recording draws and flushing GPU work; it also describes alignment inversion for input and resource retirement. Apply those contracts to the pinned backend rather than copying a desktop sample into Android unchanged. [G01]

Prefer a supported built-in Rive renderer and a small compatible output adapter. A custom external renderer is a separate implementation burden: Rive documents the renderer/factory interfaces and their responsibilities. Do not create a new vector renderer merely to avoid finishing the native surface bridge. [G02]

## Surface interoperability probes

PICO's `SurfaceRenderTexture` can supply an Android Surface to a Surface-based producer and defines acquire/release/close behavior. Test it as a separate PICO-native presentation path. It does not transfer the Viro scene graph, accessibility or input model. [P10]

Where the existing canvas bridge uses AHardwareBuffer or another external-image path, preserve explicit fence, format, alpha, color-space and ownership contracts. A supported GPU copy may be acceptable if measured. Do not describe an unmeasured copy as zero-copy.

## Required lifecycle behavior

Reuse bounded buffers; prevent simultaneous unsynchronized writes and reads. Recreate invalid targets after context loss, reject stale native handles and retire resources only after the GPU is finished. Stop producer scheduling before destroying the consumer. Preserve artboard state across resize or reconstruct it deliberately from session state.

Use a real display/producer clock and dirty-frame signaling. A microtask busy loop or a screenshot/base64/PNG transport is not the production rendering path. A fallback-colored quad must be visibly identified as an error, not counted as successful Rive output.

## Preserve every existing producer family
Inventory local Rive, Three/WebGPU, Skia/canvas and other producers before changing the surface contract. Each needs a compatible adapter and lifecycle test; do not leave a working producer behind merely because the first fixture uses Rive. Share surface ownership and normalized pointer semantics, not renderer-specific native internals.

Browser output needs its own supported path, such as a compatible canvas/texture upload or measured GPU transfer. Native handles cannot cross into a browser. Reuse C++/WASM texture APIs when possible and measure any copy. Keep native zero-copy claims separate from browser performance claims.

<!-- PAGE -->
# 22 | Geometry, capture and spatial manipulation

## Keep three transforms separate

The workspace has a world transform. Each panel has a transform relative to that workspace. Rive has an artboard-to-viewport fit/alignment transform. All three must be inverted or composed correctly for input; changing the workspace pose must not change which artboard point a ray intersects.

For a flat quad centered in local XY, the conceptual mapping is:

```text
p_world = ray/plane intersection at the current panel pose
p_local = inverse(panel_world_matrix) * p_world
u = p_local.x / panel_width_m + 0.5
v = 0.5 - p_local.y / panel_height_m
p_viewport = (u * texture_width_px, v * texture_height_px)
p_artboard = inverse(artboard_to_viewport) * p_viewport
```

This is a derivation under the stated centered-quad and top-left-texture assumptions. Confirm mesh UV direction, backface policy, winding, clipping and texture orientation in the actual renderer. Curved panels require real mesh intersection/UV mapping; a flat-plane approximation is not sufficient.

Reject a parallel ray, a hit behind the source, a noninvertible transform or stale space revision. Handle letterboxing using the inverse of the transform used to draw; blank margins must not become active artwork. Rive documents retaining and inverting the alignment transform for pointer conversion. [G01]

## One owner per gesture

The grip begins a workspace manipulation. The content body begins a Rive interaction. The drawing surface begins a stroke. Arbitration happens on the committed down/start event and remains stable until end/cancel. Track pointer identity so a second controller or hand cannot steal an active stroke.

During a held grip, apply motion through the native Viro path. Persist the final pose on release; do not write stale React props back over the live transform on every event. A release may settle or dock the workspace only after capture ends. Hover emphasis must not move a target away from the incoming pointer.

## Deterministic test cases

Test center/corners; translated, rotated and nested parents; different artboard and texture aspect ratios; nonuniform panel sizing; backface/miss; pointer exit; recenter; invalid tracking; two pointers; cancellation; and repeated grab/release. Assert that the same local target is reached before and after transforming the workspace. Test direct touch and ray input independently where supported.

The historical `CanvasInViroInput` mismatch is an investigation target, not permission to assume every current Viro event uses the same coordinate convention. Verify each event source and installed fork. [B01]

<!-- PAGE -->
# 23 | Standalone Viro Platform Lab

## A neutral integration suite
Locate an appropriate existing examples/test workspace first. Add a dedicated platform lab only where needed; its package/directory name is a proposal, not a claim that it already exists. It must run without application accounts, backend connections, Moyo code or private content.

| Fixture | What it isolates | Required result |
| --- | --- | --- |
| Scene baseline | Box/model, text, light and animation. | Correct render and a visible backend/build-ID panel. |
| Changing texture | Producer-to-consumer bridge without Rive. | Correct orientation, alpha and update scheduling. |
| Rive control panel | Editable authored control and semantic event. | Rive-originated selection updates fixture state. |
| Group manipulation | Separate grip plus attached drawing/reference surfaces. | Whole group moves; content input does not trigger grab. |
| Other producer panels | Existing GPU/Three/Skia paths discovered locally. | No regression across the shared surface upgrade. |
| System-window shell | Main window plus prioritized companion panels. | Effective placement, inline fallback and close/reopen. |
| Browser session transition | Inline → immersive → inline. | One frame owner, preserved state and no leaked loop. |
| Privacy/capability fixture | Denied/unsupported/invalid tracking. | Truthful states, alternatives and no fabricated gaze. |
| Stress fixture | Repeated mount, context loss and asynchronous cancellation. | No stuck input, leak trend or stale callback. |

## Input and visual state sheet
Specify idle, targeted, pressed, selected, grabbed, moving, valid dock, released, disabled, loading and error. Each state needs a trigger, owner and exit. Give controls and grips distinct silhouettes. Make reduced motion and restore-layout available through keyboard and supported XR input.

Use reproducible neutral assets with documented license and size. The `.riv` source and compiled output must travel together; the user already has Rive CLI locally, but this authoring environment did not compile any Rive file. Run the installed CLI's version/schema/verification workflow rather than assume a dated command signature.

## Version and mode visibility
Show source commit, package version, native/WASM build ID, runtime, real/emulated input and effective presentation in a debug-only diagnostics panel. Never display a capability as ready because a developer switch is enabled. Diagnostic export must exclude private scene data and raw tracking unless deliberately authorized for a specific test.

Use the lab to graduate features before any downstream application integration. Screenshots of this lab are test artifacts, not marketing claims of complete platform parity.

<!-- PAGE -->
# 24 | Implementation sequence and checkpoints

## Phase 0 — preserve and map
Inventory local repositories/worktrees, back up work appropriately, map package links and artifacts, pin 3.0.1, verify its artifacts and create the fork-delta ledger. Identify every producer and platform patch. **Exit:** local state is understood and recoverable; 3.0.1 source/package/binary provenance is recorded, with any access gaps explicit.

## Phase 1 — synchronize upstream safely
Integrate the verified source target in isolated branches. Resolve native/plugin/API changes intentionally. Rebuild matching artifacts, pack and install them in clean lab consumers. **Exit:** existing native/mobile/browser behavior has a measured baseline with no discarded fork work.

## Phase 2 — repair foundations
Complete real native/canvas texture paths, lifecycle and input mapping; repair browser disposal/cancellation and externally driven rendering boundaries. Revalidate historical findings against the integrated code. **Exit:** a changing texture and interactive Rive fixture work on the claimed backends with bounded resources.

## Phase 3 — browser immersive support
Prove WebXR session ownership, stereo view rendering, per-frame simulation, tracking spaces, controller/hand input, cancellation and inline return. Add IWER coverage where compatible. **Exit:** real headset browser evidence, not a mono canvas or an IWSDK replacement scene.

## Phase 4 — native Apple and PICO parity
Bring forward native visionOS and PICO work, reconcile toolchains and producer resources, classify unsupported components and exercise native lifecycle. **Exit:** explicit per-platform acceptance and no falsely universal support claims.

## Phase 5 — shared spatial adapters
Map native PICO/Meta windows, WebSpatial shell behavior and supported targeting/gesture semantics into the shared contract. Evaluate optional compositor/container paths behind capability gates. **Exit:** useful layouts with correct ownership and documented degradation.

## Phase 6 — release and maintainer handoff
Run the full matrix, compare performance, inspect packages/binaries, write migrations and publish-ready notes. Publish only when separately authorized. **Exit:** code/artifacts/evidence match and the handoff names all remaining failures or unverified device rows.

Checkpoint the handoff after each phase, after a native ABI or branch-base change, and before switching agents or exhausting context. Preserve partially completed work in a clearly identified state; do not claim a task is blocked globally because one device gate is unavailable. Continue independent buildable work and retain the exact blocker/reproduction.

<!-- PAGE -->
# 25 | Acceptance matrix: native, browser and immersive

These are required gates, not completed test results. Record the exact device/browser/OS/build for each pass.

| Lane | Required checks | Evidence |
| --- | --- | --- |
| Fork upgrade | Delta disposition, merge target, clean install, matching binaries. | Commit IDs, registry/source mapping, package checksums. |
| iOS / Android regression | Existing scene, navigation, assets and native module loading. | Build + device/test results; no silent removed feature. |
| Quest native | Both-eye panels, grip/input ownership, recenter/resume and optional features. | Physical-headset traces and captures. |
| PICO native | Correct flavor/loader, live scene, controllers/hands as supported, permissions. | Device/OS matrix and artifact provenance. |
| Native visionOS | ImmersiveSpace lifecycle, Metal panels, supported component sweep. | Build + physical-headset results; preview gaps named. |
| Desktop/mobile browser | WebGL2 scene, loading, CSP, pointer/keyboard and disposal. | Automated tests and actual browser results. |
| Quest browser WebXR | Stereo view driver, input, session-end/reentry and resource cleanup. | Real browser/headset run; IWER separately labeled. |
| PICO browser/runtime WebXR | Feature detection, session support and transitions. | Exact runtime test; no assumption from native SDK. |
| Safari WebXR | Actual browser session feature set and adapter behavior. | Browser/OS-specific evidence, separate from native Apple. |
| WebSpatial PICO shell | Canvas/container behavior, spatial UI and supported WebXR transition. | Runtime presence and transition/restore tests. |
| WebSpatial packaged visionOS | Shell behavior and honest unavailable WebXR path. | Package/runtime tests; no false immersive entry. |
| Meta/PICO native windows | Placement, priority, opacity/focus, fallback and closure. | Effective-state traces and clean prebuild. |
| Optional layers/containers | Support probes, lifetime, visibility, input and geometry fallback. | Feature-specific device evidence. |
| All input paths | Cancel ≠ activate, pointer ownership, stale pose and two-source switching. | Deterministic tests + device interaction. |
| All producers | Live content, clipping, alpha, aspect ratio and local input. | Producer-by-backend matrix; no static substitute. |

**First accepted platform milestone:** a clean, fork-preserving upstream integration plus a lab that demonstrates the baseline native and browser paths. **Next milestone:** a real interactive moving panel and the tested browser immersive driver. No application integration is needed to pass either.

Use pass, fail, unverified or not applicable. Build-only, emulator-only and source-only results are different evidence classes. Test “not applicable” against an explicit scope/capability rule; do not use it to hide an unfinished supported feature.

<!-- PAGE -->
# 26 | Performance, reliability and release gates

## Measure before and after the merge
Record CPU/GPU frame times, p50/p95/p99, dropped/reprojected frames where exposed, memory, buffer count, time to first interactive frame and producer update rate. Separate static panels, animation, drag, drawing, multi-panel load and session transitions. A desktop number does not establish mobile or headset performance.

At 72, 90 and 120 Hz, nominal frame intervals are approximately 13.89, 11.11 and 8.33 ms. These are arithmetic reference intervals, not runtime budgets granted to the application. Leave headroom for the host/compositor.

For RGBA8, `width × height × 4 × buffer_count` gives uncompressed image bytes before driver overhead. A 1024-square triple-buffered surface is 12 MiB; four such panels are 48 MiB. Measure actual allocations, alignment and extra render targets before setting resolution policy.

## Proposed reliability requirements
No additional render loop or XR session survives disposal. Outstanding asset loads settle or cancel. A delayed callback cannot access a retired surface. Buffers remain bounded, and context recreation generates new handles. Static content does not spin a microtask frame loop.

Profile WebGL texture uploads, native image imports, copies, transparency overdraw and cross-thread dispatch. “Zero-copy,” “GPU accelerated” and “same C++ engine” are not performance measurements. WebGPU/Dawn device sharing has compatibility requirements; do not merge unrelated contexts by assumption. [G03]

Keep strict-CSP browser initialization, denied permissions, corrupt assets, external close, scene switching and reentry in regression tests. Browser cancellations must never fire a completed action; native focus or tracking loss must release capture safely.

## Release artifact audit
Verify JS/package/native/WASM build identity together. Inspect permissions, ABI slices, included headers, licenses, platform-only dependencies, debug hooks and experimental API layers. Remove restricted experimental native Gaze dependencies from store builds according to the currently reviewed Meta guidance. [M06]

Do not publish to npm, stores, release channels or production sites as a side effect of a test script. Use an explicit release approval. Provide a rollback to matched artifacts and a delta ledger showing that the user's original functionality survives.

<!-- PAGE -->
# 27 | Required skills, tools and source discipline

Use real installed tools where available and read their current instructions. The table assigns their role in the future implementation; it does not claim they were executed against a headset or Rive project while preparing this document.

| Resource | Required use |
| --- | --- |
| **No AI Slop** [T01] | Edit user-facing copy and delivery notes without vague claims or stock phrasing. Preserve technical precision. |
| **Everything Claude Code** [T02] | Apply relevant verification, evaluation and security guidance; adapt commands to the actual native repositories. |
| **ECC PR #5 and PR #2** [T03] [T13] | Inspect and pin reviewed content. The earlier same-day review recorded both as open and unmerged; recheck before implementation. Do not claim their proposals are already in main. |
| **Margelo React Native skills** [T04] | Use API design, Nitro, C++ and Kotlin guidance for the matching changes. Regenerate bindings from specs rather than patching generated code. |
| **ViroReact MCP and source** [T05] | Discover current upstream APIs/bridge locations; validate against the user's fork and packaged binaries. A web render is not a native stereo test. |
| **Rive CLI and Editor MCP** [T06] | Use the user's already installed CLI on an accessible machine; inspect version/schema, compile and drive authored interactions. Retain source and output evidence. |
| **Rive feature/runtime sources** [T07] | Check each authored feature against the pinned Android/offscreen renderer. A desktop preview is insufficient. |
| **Meta agentic tools / CLI / simulator** [T08] | Verify native build, placement, logs and performance through available supported tools; keep experimental layers out of release. |
| **Expo config-plugin guidance** [T09] | Make the native setup reproducible after clean prebuild and audit the resulting Gradle/manifest state. |
| **PICO native tools / SpatialUI sample** [T10] | Use the documented local tooling and vendor sample to verify PICO packaging and baseline behavior. |
| **Anthropic frontend-design** [T11] | Apply purposeful hierarchy and motion to the platform; validate spatial legibility rather than copying web-only techniques. |

## Pin and permission policy

Earlier ECC PR #5 reviewed head: `c7dd1f3648c6c77c6ddefce13ca1fb2ef29042d1`. PR #2 reviewed head: `65c9598786bc558517604fc32d994cb647649b7b`. Recheck before applying either. PR #5 concerns frontmatter/discovery and validation; PR #2 proposes project onboarding. [T03]

Audit hooks, shell commands and MCP permissions before enabling external instructions. Read-only research is not permission to install arbitrary automation or publish a build. Record which tools were available, which were run and which evidence each produced.

## Added platform tools
Use WebXR standards and Meta IWSDK/IWER docs for browser sessions and input, with a proven Viro-compatible emulation setup. Use browser automation only when actually available, and record its results rather than imply a browser ran. Native visionOS requires the actual Apple build/simulator/device toolchain; PICO and Quest need separate device evidence.

Inspect the user's existing local Rive CLI, Viro MCP and other connected tooling before installation. The presence of a tool on the user's machine does not make it available to a remote authoring container. Maintain a tools-available / tools-used / evidence-produced table in the handoff.

<!-- PAGE -->
# 28 | Copy-ready implementation brief

**Mission:** Modernize all relevant local/forked Viro platform work, preserve custom functionality and integrate the confirmed Viro 3.0.1 target with matched native and browser artifacts. Moyo and all downstream application work are out of scope. Work from this document and the standalone handoff.

**Start locally:** Read repository instructions; locate the actual Viro, ViroCore, canvas bridge, expo-pico, browser renderer and visionOS dependencies. Inventory worktrees, branches, dirty files, local assets, packages and binaries. Preserve them before merging. Verify the confirmed 3.0.1 package/source/binary mapping; do not invent release metadata or claim the upgrade complete before the integration gates pass.

**Roster:** Cover fork/release, C++/OpenXR, WASM/WebGL/WebXR, visionOS/Metal, Rive, RN/Nitro, PICO, Meta native, WebSpatial, interaction, spatial UX, accessibility, security and QA. Use public experts as references to published work only. Record actual owner, reviewer and evidence.

**Upgrade:** Build a fork-delta ledger. Integrate upstream behavior and migrations without dropping PICO, panels, Rive, Three/GPU, input, Expo or Apple patches. Rebuild source-matched binaries and WASM sidecars. Verify clean installed packages, not only linked source.

**Renderer:** Preserve ViroCore on native and web. Repair real disposal, frame ownership, texture handoff and input mapping. Revalidate observed browser cancellation/disposal risks. Complete the existing native producer-to-material path; retain every working producer family.

**Web:** Build or reuse a real WebXR adapter driven by XR frames with correct per-view matrices/viewports and one simulation update per frame. Do not substitute an IWSDK/Three scene or a mono screenshot. Adapt compatible Meta web input/testing behavior while preserving Viro's renderer.

**Spatial hosts:** Distinguish engine panels, native system windows, WebSpatial shells and optional compositor layers/containers. WebSpatial may transition into independent WebXR only where supported; its spatial UI is hidden during that session. Packaged visionOS WKWebView currently lacks this WebXR path. Native Viro visionOS is a separate first-class lane.

**Input:** One capture owner. Separate system effects, committed interactions and permissioned samples. Preserve real versus synthetic provenance. Cancel must not activate; world-space drag is not local artboard input.

**Evidence:** Use the neutral Platform Lab, fresh package installs, deterministic tests, device/browser builds, real stereo/input/lifecycle and measured performance. Mark missing device proof unverified. Update the handoff after every phase and before context limits. Deliver focused commits, manifests, test artifacts, migrations and rollback. Do not publish, force-push, discard work or modify downstream applications without authorization.

<!-- PAGE -->
# 29 | Handoff protocol and current completion boundary

## Handoff now
The companion `Viro_Platform_Handoff_v3.0.1_2026-09-25.md` is the authoritative continuation checklist for this research/document revision. It contains the scope override, source observations, uncertainty, repository inventory procedure, implementation order, commands, evidence rules and next-agent prompt. It is deliberately not a success report for code that has not been written.

**Completed in this pass:** source/document research; platform-first architecture and ownership; fork-preserving upgrade specification; browser/visionOS additions; a revised engineer/team roster; acceptance gates; this document and handoff.

**Not completed:** no local repository inspection, merge/rebase/cherry-pick, code patch, native artifact rebuild, npm upgrade, Rive compilation, browser application test, simulator run, headset test or release. The registry could not be read from this environment. Some prior code findings and source comments still require validation against the selected target.

## Checkpoint before a context or agent boundary
```text
Handoff timestamp / owner / next agent:
Scope and decisions that must not change:
Repo paths + branch + HEAD + dirty/staged/untracked summary:
Target upstream release + source + package integrity:
Fork delta disposition and unresolved conflicts:
Changed files/symbols; native/WASM artifacts and checksums:
Commands actually run; exit codes; logs and test evidence:
Per-lane pass / fail / unverified results:
Exact blocker + minimal reproduction + attempted remedies:
Next three executable steps:
Rollback and saved-work locations:
Tools available versus actually used:
```

Update before beginning another long native build or major phase when the remaining context is limited. Record a running process by exact identifier only if it truly exists and can be resumed; never say work will continue asynchronously without a supporting execution mechanism.

Do not attach credentials, signing material or raw private tracking logs. Do not treat a GitHub branch as the entire local workspace. Do not erase this revision's uncertainty by replacing it with an unsupported completion claim.

The next execution step is **local inventory plus release verification**, not another broad product-research pass. Subsequent application integration is a later, separately requested phase.

<!-- PAGE -->
# 30 | Source register

Sources are primary vendor/source references unless explicitly described as a historical internal brief. Links identify the reviewed material; they do not establish device validation. Recheck version-sensitive contracts during implementation.

**[U01]** Upstream Viro package manifest; observed 3.0.1, RN/Expo peer ranges and web/visionOS peers. [Open source](https://github.com/ReactVision/viro/blob/main/package.json).

**[U02]** GitHub latest release endpoint; returned v3.0.1 during this review, not proof of npm latest. [Open source](https://github.com/ReactVision/viro/releases/latest).

**[U03]** Upstream migration changes, Quest fixes, event removals and native binary rebuild requirements. [Open source](https://github.com/ReactVision/viro/blob/main/CHANGELOG.md).

**[U04]** User fork manifest; observed 3.0.0-moyo.4, existing web/visionOS peers and sibling web-renderer development path. [Open source](https://github.com/mikevocalz/viro/blob/decax9-three-panel/package.json).

**[U05]** ViroCore WASM/WebGL2 browser renderer, assets, browser AR and lifecycle limitations. [Open source](https://github.com/ReactVision/viro-web-renderer/blob/main/README.md).

**[U06]** Observed browser input forwarding and incomplete disposal; blob 774a7cdc155a349cd7c42ff33717a860c78d8118. [Open source](https://github.com/ReactVision/viro-web-renderer/blob/main/src/ViroWebRenderer.ts).

**[U07]** Browser renderer source manifest observed at 1.0.0; packaging/test commands and sidecar assets. [Open source](https://github.com/ReactVision/viro-web-renderer/blob/main/package.json).

**[U08]** Current visionOS preview guide; native ImmersiveSpace, platform detection and support limits. [Open source](https://viro-community.readme.io/docs/visionos-setup-guide).

**[U09]** Fork README distinguishes platform-service bridges from XR methods still described as seams; revalidate native implementations. [Open source](https://github.com/mikevocalz/expo-pico/blob/main/README.md).

**[U10]** Canvas bridge manifest; observed 0.0.1 and broad Nitro/native peer ranges; pin implementation toolchain. [Open source](https://github.com/mikevocalz/nitro-canvas-in-Vision/blob/decax9-three-panel/package.json).

**[U11]** User ViroCore fork; native C++ renderer responsibilities and separate upstream relationship. [Open source](https://github.com/mikevocalz/virocore/blob/main/README.md).

**[MW01]** Meta IWSDK release notes updated September 24, 2026; gaze, interaction priority, IWER and tooling changes. [Open source](https://developers.meta.com/horizon/downloads/package/immersive-web-sdk/v1.0/?view=full_width).

**[MW02]** IWSDK overview; Three.js/ECS architecture and browser tooling, distinct from ViroCore. [Open source](https://developers.meta.com/horizon/documentation/iwsdk/guides/overview/).

**[MW03]** Meta browser WebXR route and runtime feature detection. [Open source](https://developers.meta.com/horizon/documentation/web/webxr-overview/).

<!-- PAGE -->
# 31 | Source register — continued

Sources are primary vendor/source references unless explicitly described as a historical internal brief. Links identify the reviewed material; they do not establish device validation. Recheck version-sensitive contracts during implementation.

**[WW01]** WebSpatial app/runtime distinction; WebXR transition hides spatial UI; packaged visionOS limitation. [Open source](https://webspatial.dev/docs/concepts/webspatial-app).

**[XR01]** WebXR Device API; session frame clock, view matrices, XR-compatible WebGL and base layers. [Open source](https://immersive-web.github.io/webxr/).

**[XR02]** WebXR Layers specification; optional composition layers and resource/visibility requirements. [Open source](https://immersive-web.github.io/layers/).

**[XR03]** WebXR explainer; session setup and externally driven rendering reference. [Open source](https://github.com/immersive-web/webxr/blob/main/explainer.md).

**[P01]** PICO Spatial SDK 6.1.9 — WindowContainer. Planar/volumetric container, properties and Activity relationship. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.dsl/-window-container.html).

**[P02]** PICO Spatial SDK 6.1.9 — Augment. Anchor/alignment, offset, viewpoint, focus and appearance overloads; prose inconsistencies noted in the PICO hosting section. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.window/-augment.html).

**[P03]** PICO Spatial SDK 6.1.9 — Subwindow. Side placement and parent-height behavior. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialui/design/com.pico.spatial.ui.design.windows/-subwindow.html).

**[P04]** PICO Spatial SDK 6.1.9 — hover package. Declarative effects, disabling/grouping and out-of-process execution. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.hover/index.html).

**[P05]** PICO Spatial SDK 6.1.9 — SpatialHoverEffectScope. Supported effect operations. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.hover/-spatial-hover-effect-scope/index.html).

**[P06]** PICO Spatial SDK 6.1.9 — EyeTrackingProvider. Eye pose and runtime permission. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/trackingpack/tracking/com.pico.spatial.tracking.eye/-eye-tracking-provider/index.html).

**[P07]** PICO Spatial SDK 6.1.9 — DataProvider. Full-space annotation, support and listening lifecycle. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/trackingpack/tracking/com.pico.spatial.tracking/-data-provider/index.html).

**[P08]** PICO Spatial SDK 6.1.9 — gesture package. Spatial tap/drag/rotation/scale/transform entry points. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.gesture/index.html).

**[P09]** PICO Spatial SDK 6.1.9 — SpatialNavigator. Container/stage navigation and result/lifetime conditions. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialui/platform/com.pico.spatial.ui.platform.containers/-spatial-navigator/index.html).

**[P10]** PICO Spatial SDK 6.1.9 — SurfaceRenderTexture. Android Surface producer integration and resource ownership. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialpack/core/com.pico.spatial.core.ecs.resource/-surface-render-texture/index.html).

<!-- PAGE -->
# 32 | Source register — continued

Sources are primary vendor/source references unless explicitly described as a historical internal brief. Links identify the reviewed material; they do not establish device validation. Recheck version-sensitive contracts during implementation.

**[P11]** PICO Spatial SDK 6.1.9 — TabBar. Additional native design-component reference; validate installed signatures before use. [Open source](https://developer.picoxr.com/spatial-api/6.1.9/spatialui/design/com.pico.spatial.ui.design.windows/-tab-bar.html).

**[M01]** Meta — Layout SDK overview. RN/Compose setup, native dependencies, autolinking and minimum React/RN versions. Updated August 27, 2026. [Open source](https://developers.meta.com/horizon/documentation/android-apps/meta-vr-layout-sdk/).

**[M02]** Meta — Window priority. Allocation, displacement and current RN two-slot behavior. Updated August 27, 2026. [Open source](https://developers.meta.com/horizon/documentation/android-apps/meta-vr-layout-priority/).

**[M03]** Meta — Fallback and compatibility. Placement states, host support and observable limitations. Updated September 2, 2026. [Open source](https://developers.meta.com/horizon/documentation/android-apps/meta-vr-layout-fallback/).

**[M04]** Meta — Layout SDK best practices. Opaque roots, stable geometry and simulator/device distinctions. Updated August 27, 2026. [Open source](https://developers.meta.com/horizon/documentation/android-apps/meta-vr-layout-best-practices/).

**[M05]** Meta — Design multi-window layouts. Main-task hierarchy and capacity-independent access. Updated September 3, 2026. [Open source](https://developers.meta.com/horizon/design/multi-window-layouts/).

**[M06]** Meta — Gaze SDK for React Native. Target hints, tooltips and unstable/store-rejection warning. Updated August 28, 2026. [Open source](https://developers.meta.com/horizon/documentation/android-apps/gaze-and-hands-react-native-sdk/).

**[M07]** Meta — Stereo surface composition. App-supplied stereo buffers, API paths and headset verification. Updated September 3, 2026. [Open source](https://developers.meta.com/horizon/documentation/android-apps/stereo-surface-composition/).

**[W01]** WebSpatial — Getting Started. Current supported/planned runtime list and PICO OS Web App Runtime. [Open source](https://webspatial.dev/docs/introduction/getting-started).

**[W02]** WebSpatial — Spatial Scenes. Top-level scene model, window/volume behavior and placement ownership. [Open source](https://webspatial.dev/docs/concepts/spatial-scenes).

**[W03]** WebSpatial — Natural Interactions. Pre-pinch privacy, committed input and compatibility events. [Open source](https://webspatial.dev/docs/concepts/natural-interactions).

**[W04]** WebSpatial — 3D Content Containers. Model/Reality/World, unified-rendering restrictions and coordinate systems. [Open source](https://webspatial.dev/docs/concepts/3d-content-containers).

**[W05]** WebSpatial — Spatialized HTML Elements. Spatial elevation, CSS and material behavior. [Open source](https://webspatial.dev/docs/concepts/spatialized-html-elements).

**[W06]** WebSpatial — Event API. Supported React event integration and spatial gesture APIs. [Open source](https://webspatial.dev/docs/api/react-sdk/event-api).

<!-- PAGE -->
# 33 | Source register — continued

Sources are primary vendor/source references unless explicitly described as a historical internal brief. Links identify the reviewed material; they do not establish device validation. Recheck version-sensitive contracts during implementation.

**[O01]** Khronos — OpenXR documentation changelog. Specification 1.1.63, September 1, 2026. [Open source](https://github.com/KhronosGroup/OpenXR-Docs/blob/main/CHANGELOG.Docs.md).

**[O02]** Khronos — XR_EXT_spatial_container. Ratified container extension. [Open source](https://registry.khronos.org/OpenXR/specs/1.1/man/html/XR_EXT_spatial_container.html).

**[O03]** Khronos — XR_EXT_spatial_container_self_rendering. Application-rendered container extension. [Open source](https://registry.khronos.org/OpenXR/specs/1.1/man/html/XR_EXT_spatial_container_self_rendering.html).

**[O04]** Khronos — XrSpatialContainerEXT. Container visibility/lifetime and session-state behavior. [Open source](https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrSpatialContainerEXT.html).

**[O05]** Khronos — XrSystemEyeGazeInteractionPropertiesEXT. Runtime eye-gaze interaction support query. [Open source](https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrSystemEyeGazeInteractionPropertiesEXT.html).

**[G01]** Rive — C++ Rendering Loop. Advance/record/submit, resource retirement, resize and alignment/input mapping. [Open source](https://rive.app/docs/runtimes/cpp/rendering-loop).

**[G02]** Rive — External Renderer. Renderer/factory interfaces and backend integration responsibilities. [Open source](https://rive.app/docs/runtimes/cpp/external-renderer).

**[G03]** React Native WebGPU — Native APIs. Threading, native textures and external Dawn device compatibility. [Open source](https://wcandillon.github.io/react-native-webgpu/docs/getting-started/native-api).

**[R01]** User fork — ViroBase.tsx, branch surfaced as decax9-three-panel. Same-day source read; blob a5ae2edef02c9d3d988a66232f73966376e77994. [Open source](https://github.com/mikevocalz/viro/blob/decax9-three-panel/components/ViroBase.tsx).

**[R02]** User fork — ViroRivePanel.tsx, branch surfaced as decax9-three-panel. Same-day source read; blob 293411a25502fe8af5aaa75e0b4751eb3a3c100c. [Open source](https://github.com/mikevocalz/viro/blob/decax9-three-panel/components/ViroRivePanel.tsx).

**[R03]** User fork — expo-pico spatial index.ts. Same-day source read; blob a353070ee3cccbb87558e3944431776bf1d4c0f1. [Open source](https://github.com/mikevocalz/expo-pico/blob/main/packages/expo-pico-spatial/src/index.ts).

**[R04]** User fork — expo-pico spatial types.ts. Same-day source read; blob 290e0c306466777f679a7324c4637a65fdf47d71. [Open source](https://github.com/mikevocalz/expo-pico/blob/main/packages/expo-pico-spatial/src/types.ts).

**[R05]** Callstack — commit 76ac1077bd56f77208db4cf9dd0b76f5e8dba497. Documentation change, not the vendor native runtime. [Open source](https://github.com/callstack/react-native-meta-horizon-os/commit/76ac1077bd56f77208db4cf9dd0b76f5e8dba497).

**[E01]** Rive — Chris Dalton, Reinventing feathering for the Vectorian era. April 2, 2025. Includes the renderer work and Luigi/Guido Rosso context. [Open source](https://www.rive.app/blog/how-rive-reinvented-feathering-for-the-vectorian-era).

<!-- PAGE -->
# 34 | Source register — continued

Sources are primary vendor/source references unless explicitly described as a historical internal brief. Links identify the reviewed material; they do not establish device validation. Recheck version-sensitive contracts during implementation.

**[E02]** Marc Rousavy — My Projects. Primary portfolio for Nitro and native React Native work. [Open source](https://mrousavy.com/projects).

**[E03]** Eduardo Dorantes — public GitHub profile and ReactVision project description. [Open source](https://github.com/doranteseduardo).

**[E04]** William Candillon — public GitHub profile and maintained/pinned graphics projects. [Open source](https://github.com/wcandillon).

**[E05]** Google Dawn — commit b7c54fe31563534b4be635ed0690d8743bbba415 by William Candillon, August 13, 2026; swapchain-recovery contribution. [Open source](https://dawn.googlesource.com/dawn/+/b7c54fe31563534b4be635ed0690d8743bbba415).

**[E06]** Expo — Evan Bacon, Introducing Expo Router v5. May 5, 2025. Used for engineering authorship/reference, not as the current app version. [Open source](https://expo.dev/blog/expo-router-v5).

**[E07]** Rive — Guido Rosso public creator profile, Founder and Design at Rive. [Open source](https://rive.app/%40guidorosso/).

**[E08]** Mike Alger — VR OS portfolio. Historical spatial ergonomics/design reference; not current device guidance. [Open source](https://mikealger.com/portfolio/vr-os/).

**[E09]** Ada Rose Cannon — personal site, spatial web and natural-input writing. [Open source](https://ada.is/).

**[E10]** Szymon Rybczak — Work. Primary account of React Native CLI and cross-platform R&D work. [Open source](https://szymonrybczak.dev/work).

**[T01]** Peter Yang — No AI Slop, skills/no-ai-slop/SKILL.md. Read in the earlier same-day document pass; file blob e2008aa08d688846b0373b83d7c3d33b85eaabdd. [Open source](https://github.com/petergyang/no-ai-slop/blob/main/skills/no-ai-slop/SKILL.md).

**[T02]** WorldFlowAI — Everything Claude Code; verification-loop, eval-harness and security-review. Verification-loop read in the earlier same-day document pass; file blob b56bb7e838e3b2c895974653a11dd2684912a7e8. [Open source](https://github.com/WorldFlowAI/everything-claude-code).

**[T03]** WorldFlowAI — ECC pull requests #5 and #2. Status and heads checked in the earlier same-day document pass; both open/unmerged. See the skills/tools section for the earlier reviewed revisions. [Open source](https://github.com/WorldFlowAI/everything-claude-code/pull/5).

**[T04]** Margelo — React Native skills. Implementation resource for api-design, build-nitro-modules, cpp and kotlin; select and read relevant current files before editing. [Open source](https://github.com/margelo/react-native-skills/tree/main/skills).

**[T05]** ViroReact — MCP server documentation. Implementation discovery resource; verify upstream/fork/tool limitations before use. [Open source](https://viro-community.readme.io/docs/viroreact-mcp-server).

<!-- PAGE -->
# 35 | Source register — continued

Sources are primary vendor/source references unless explicitly described as a historical internal brief. Links identify the reviewed material; they do not establish device validation. Recheck version-sensitive contracts during implementation.

**[T06]** Rive — CLI overview and Editor MCP. CLI overview rechecked; Editor MCP is an implementation resource requiring the appropriate connected environment. [Open source](https://rive.app/docs/cli/overview).

**[T07]** Rive — feature-support matrix and rive-nitro-react-native repository. Implementation compatibility resources; verify against pinned native artifacts. [Open source](https://rive.app/docs/feature-support).

**[T08]** Meta — agentic-tools; Meta VR tooling; Callstack React Native Meta VR documentation. Implementation resources; availability and commands must be checked in the execution environment. [Open source](https://github.com/meta-quest/agentic-tools/tree/main/skills).

**[T09]** Expo — Config plugin development and debugging. Implementation resource for repeatable native generation. [Open source](https://docs.expo.dev/config-plugins/development-and-debugging/).

**[T10]** PICO — SpatialUI sample repository. Implementation resource for the native spatial UI baseline; verify the active local tooling before use. [Open source](https://github.com/Pico-Developer/PICO-Spatial-SDK-Sample-SpatialUI).

**[T11]** Anthropic — frontend-design skill. Design implementation resource; read and pin before applying. [Open source](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md).

**[B01]** Earlier Rive/Viro implementation brief, read from the user Library in this conversation. Historical source only; not an app integration requirement. No public URL.

**[T13]** WorldFlowAI — ECC PR #2, project-onboarding proposal. Earlier same-day status was open/unmerged; recheck before use. [Open source](https://github.com/WorldFlowAI/everything-claude-code/pull/2).

[P01]: https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.dsl/-window-container.html
[P02]: https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.window/-augment.html
[P03]: https://developer.picoxr.com/spatial-api/6.1.9/spatialui/design/com.pico.spatial.ui.design.windows/-subwindow.html
[P04]: https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.hover/index.html
[P05]: https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.hover/-spatial-hover-effect-scope/index.html
[P06]: https://developer.picoxr.com/spatial-api/6.1.9/trackingpack/tracking/com.pico.spatial.tracking.eye/-eye-tracking-provider/index.html
[P07]: https://developer.picoxr.com/spatial-api/6.1.9/trackingpack/tracking/com.pico.spatial.tracking/-data-provider/index.html
[P08]: https://developer.picoxr.com/spatial-api/6.1.9/spatialui/foundation/com.pico.spatial.ui.foundation.gesture/index.html
[P09]: https://developer.picoxr.com/spatial-api/6.1.9/spatialui/platform/com.pico.spatial.ui.platform.containers/-spatial-navigator/index.html
[P10]: https://developer.picoxr.com/spatial-api/6.1.9/spatialpack/core/com.pico.spatial.core.ecs.resource/-surface-render-texture/index.html
[P11]: https://developer.picoxr.com/spatial-api/6.1.9/spatialui/design/com.pico.spatial.ui.design.windows/-tab-bar.html
[M01]: https://developers.meta.com/horizon/documentation/android-apps/meta-vr-layout-sdk/
[M02]: https://developers.meta.com/horizon/documentation/android-apps/meta-vr-layout-priority/
[M03]: https://developers.meta.com/horizon/documentation/android-apps/meta-vr-layout-fallback/
[M04]: https://developers.meta.com/horizon/documentation/android-apps/meta-vr-layout-best-practices/
[M05]: https://developers.meta.com/horizon/design/multi-window-layouts/
[M06]: https://developers.meta.com/horizon/documentation/android-apps/gaze-and-hands-react-native-sdk/
[M07]: https://developers.meta.com/horizon/documentation/android-apps/stereo-surface-composition/
[W01]: https://webspatial.dev/docs/introduction/getting-started
[W02]: https://webspatial.dev/docs/concepts/spatial-scenes
[W03]: https://webspatial.dev/docs/concepts/natural-interactions
[W04]: https://webspatial.dev/docs/concepts/3d-content-containers
[W05]: https://webspatial.dev/docs/concepts/spatialized-html-elements
[W06]: https://webspatial.dev/docs/api/react-sdk/event-api
[O01]: https://github.com/KhronosGroup/OpenXR-Docs/blob/main/CHANGELOG.Docs.md
[O02]: https://registry.khronos.org/OpenXR/specs/1.1/man/html/XR_EXT_spatial_container.html
[O03]: https://registry.khronos.org/OpenXR/specs/1.1/man/html/XR_EXT_spatial_container_self_rendering.html
[O04]: https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrSpatialContainerEXT.html
[O05]: https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrSystemEyeGazeInteractionPropertiesEXT.html
[G01]: https://rive.app/docs/runtimes/cpp/rendering-loop
[G02]: https://rive.app/docs/runtimes/cpp/external-renderer
[G03]: https://wcandillon.github.io/react-native-webgpu/docs/getting-started/native-api
[R01]: https://github.com/mikevocalz/viro/blob/decax9-three-panel/components/ViroBase.tsx
[R02]: https://github.com/mikevocalz/viro/blob/decax9-three-panel/components/ViroRivePanel.tsx
[R03]: https://github.com/mikevocalz/expo-pico/blob/main/packages/expo-pico-spatial/src/index.ts
[R04]: https://github.com/mikevocalz/expo-pico/blob/main/packages/expo-pico-spatial/src/types.ts
[R05]: https://github.com/callstack/react-native-meta-horizon-os/commit/76ac1077bd56f77208db4cf9dd0b76f5e8dba497
[E01]: https://www.rive.app/blog/how-rive-reinvented-feathering-for-the-vectorian-era
[E02]: https://mrousavy.com/projects
[E03]: https://github.com/doranteseduardo
[E04]: https://github.com/wcandillon
[E05]: https://dawn.googlesource.com/dawn/+/b7c54fe31563534b4be635ed0690d8743bbba415
[E06]: https://expo.dev/blog/expo-router-v5
[E07]: https://rive.app/%40guidorosso/
[E08]: https://mikealger.com/portfolio/vr-os/
[E09]: https://ada.is/
[E10]: https://szymonrybczak.dev/work
[T01]: https://github.com/petergyang/no-ai-slop/blob/main/skills/no-ai-slop/SKILL.md
[T02]: https://github.com/WorldFlowAI/everything-claude-code
[T03]: https://github.com/WorldFlowAI/everything-claude-code/pull/5
[T04]: https://github.com/margelo/react-native-skills/tree/main/skills
[T05]: https://viro-community.readme.io/docs/viroreact-mcp-server
[T06]: https://rive.app/docs/cli/overview
[T07]: https://rive.app/docs/feature-support
[T08]: https://github.com/meta-quest/agentic-tools/tree/main/skills
[T09]: https://docs.expo.dev/config-plugins/development-and-debugging/
[T10]: https://github.com/Pico-Developer/PICO-Spatial-SDK-Sample-SpatialUI
[T11]: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
[U01]: https://github.com/ReactVision/viro/blob/main/package.json
[U02]: https://github.com/ReactVision/viro/releases/latest
[U03]: https://github.com/ReactVision/viro/blob/main/CHANGELOG.md
[U04]: https://github.com/mikevocalz/viro/blob/decax9-three-panel/package.json
[U05]: https://github.com/ReactVision/viro-web-renderer/blob/main/README.md
[U06]: https://github.com/ReactVision/viro-web-renderer/blob/main/src/ViroWebRenderer.ts
[U07]: https://github.com/ReactVision/viro-web-renderer/blob/main/package.json
[U08]: https://viro-community.readme.io/docs/visionos-setup-guide
[U09]: https://github.com/mikevocalz/expo-pico/blob/main/README.md
[U10]: https://github.com/mikevocalz/nitro-canvas-in-Vision/blob/decax9-three-panel/package.json
[U11]: https://github.com/mikevocalz/virocore/blob/main/README.md
[MW01]: https://developers.meta.com/horizon/downloads/package/immersive-web-sdk/v1.0/?view=full_width
[MW02]: https://developers.meta.com/horizon/documentation/iwsdk/guides/overview/
[MW03]: https://developers.meta.com/horizon/documentation/web/webxr-overview/
[WW01]: https://webspatial.dev/docs/concepts/webspatial-app
[XR01]: https://immersive-web.github.io/webxr/
[XR02]: https://immersive-web.github.io/layers/
[XR03]: https://github.com/immersive-web/webxr/blob/main/explainer.md
[T13]: https://github.com/WorldFlowAI/everything-claude-code/pull/2
