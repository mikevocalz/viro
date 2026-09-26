# Viro platform modernization — execution handoff

**Checkpoint:** September 25, 2026.  
**Status:** Research/documentation complete; repository implementation not started in this authoring environment.  
**Companion:** `Viro_Platform_Modernization_v3.0.1_2026-09-25.docx` and matching `.md`.  
**Confirmed upgrade target:** Viro 3.0.1, as corrected by the user on September 25, 2026. Package/source/binary provenance still requires local verification.

## 1. Scope that must not drift

The user explicitly corrected the earlier app-focused plan: this work is about **all relevant local/forked Viro work and related libraries**. Moyo comes later. Do not edit Moyo screens, tutor flows, backend, payments, application lockfiles or deployment configuration. Use a neutral Viro Platform Lab and reusable library APIs.

Preserve existing PICO renderer support, Expo flavors/plugins, Rive panels, canvas/Nitro work, Three/GPU/Skia producers where found, panel dragging, input corrections, native artifacts and Apple patches. The exact local extent is unknown until the authorized development machine is inspected. A remote default branch is not the whole project.

Keep the engineer/design/team rosters from the companion document. They are references to published work, not claimed project staff. The implementation roster needs actual workstream owners, reviewers and evidence.

## 2. What was and was not done

**Done:** Read the earlier document and historical implementation brief; inspected selected upstream/fork files via GitHub; checked current vendor documentation; designed a platform-first upgrade and adapter plan; created the revised full document and this handoff.

**Not done:** No user-local filesystem inspection, branch creation, merge/rebase/cherry-pick, code change, dependency install/upgrade, native build, WASM rebuild, Rive compile, live browser app run, simulator/headset validation, repository push or release. No code test result is claimed by this checkpoint.

The document-authoring container contains the generated artifacts, not the user's development worktrees. Do not mistake `/mnt/data` for the user's local repository root.

## 3. Verified remote evidence and uncertainty

| Observation | Source / precision | Next action |
| --- | --- | --- |
| Upstream Viro manifest and GitHub latest release reported **3.0.1**. | `ReactVision/viro`, `package.json`; release endpoint. This matches the user-confirmed target. [U01] [U02] | Pin 3.0.1 and match its registry package to source and bundled artifacts. The version-choice discrepancy is resolved. |
| User fork manifest reported **3.0.0-moyo.4**. | `mikevocalz/viro`, `decax9-three-panel`, package blob `a0d07b0509514707c3518fbc62313e48489f1080`. [U04] | Find the actual local branch/worktree and installed package; keep the historical suffix only as provenance. |
| Upstream browser package source reported **1.0.0**. | Viro upstream peer `^1.0.0`; fork peer `>=0.0.1`; source manifest blob `e52ee482e3339256b5586c51e7bf1e6dc2f21a08`. [U01] [U04] [U07] | Upgrade the matching loader/C API/WASM assets, not just the main package. |
| Browser renderer has a real lifecycle gap. | `src/ViroWebRenderer.ts`, blob `774a7cdc155a349cd7c42ff33717a860c78d8118`: disposal does not cancel the WASM loop. [U06] | Recheck target/local changes, then implement teardown and mount/unmount regression. |
| Browser pointer cancellation follows pointer-up; shown path does not forward pointer identity/capture. | Same class/snapshot. This is a source risk, not a measured user-visible bug. [U06] | Trace native actions; cancellation must never commit activation. |
| Viro web is WASM/WebGL2 ViroCore. | Upstream README/source. [U05] | Preserve that engine. Verify/complete immersive frame and input adapters rather than replace it with Three.js. |
| Native visionOS support exists but is preview/partial. | Current Viro visionOS guide. [U08] | Treat native Apple, Safari WebXR and packaged WebSpatial as separate acceptance lanes. |
| `expo-pico` README describes XR services as seams despite typed wrappers. | README blob `302fa2196f92d90ceaa1520ea02462aa5a59b199`. [U09] | Inspect native methods and actual local branches. Do not equate this with absence of the separate ViroCore PICO renderer. |
| Canvas bridge source manifest reported 0.0.1. | Blob `9d067f8d33dc17432d61275902e00acd1d8c6dfe`. [U10] | Pin resolved native/Nitro toolchain and inspect real producer/consumer implementations. |

Registry access failed during the earlier authoring pass: the web fetch was unavailable/blocked and the container could not resolve `registry.npmjs.org`. **The user has confirmed 3.0.1; version selection is no longer an open question.** Verify its package metadata and source/binary provenance locally. This is an artifact-verification task, not a search for a different release. Do not claim the upgrade is installed or tested until the implementation gates pass.

Some `docs/` or platform-specific filename requests returned 404. Use the actual repository tree and vendor documentation index; do not infer a feature's absence from one guessed path.

## 4. Repository inventory

Required discovery targets:

- `mikevocalz/viro` and upstream `ReactVision/viro`.
- `mikevocalz/virocore` and upstream `ReactVision/virocore`.
- `mikevocalz/nitro-canvas-in-Vision`.
- `mikevocalz/expo-pico`.
- The actual local checkout/installed artifact for `ReactVision/viro-web-renderer`; Viro's development manifest references a sibling directory. No user-owned browser-renderer remote has been established.
- The installed `@reactvision/react-native-visionos`, actual RN alias, template and native project patches.
- Relevant local Horizon/Expo plugins discovered through manifests/remotes. Do not invent repository names.

For every checkout record: absolute path, remote with credentials redacted, worktree list, current branch/HEAD, upstream tracking, dirty/staged/untracked state, submodules/LFS, lockfile/package manager, linked dependencies and native output locations.

Back up committed and uncommitted work appropriately. A Git bundle does not preserve unstaged or untracked files. Keep local binary diffs/assets secure; do not add secrets or signing material to an evidence attachment. No hard reset, clean, forced push or automatic stash drop.

## 5. First commands on the authorized machine

Run these inside each **actual** discovered repository; they inspect state and do not perform the upgrade:

```bash
pwd
git status --porcelain=v2 --branch
git worktree list --porcelain
git branch --all --verbose --no-abbrev
git log -12 --oneline --decorate
git diff --stat
git diff --cached --stat
git ls-files --others --exclude-standard
```

Review/redact remote URLs before placing them in shared logs. Inspect repo-specific `AGENTS.md`, workspace manifests, package scripts and lockfiles. Use the existing package manager; do not generate a competing lockfile.

Verify release metadata:

```bash
npm view @reactvision/react-viro dist-tags --json
npm view @reactvision/react-viro@3.0.1 \
  version gitHead dist.tarball dist.integrity peerDependencies --json
npm view @reactvision/virocore dist-tags --json
npm view @reactvision/viro-web-renderer dist-tags --json
```

Inspect package contents in an isolated directory, with lifecycle scripts disabled for the inspection step. Resolve the source revision and binary provenance before choosing the integration target. Later installation/build steps must use a reviewed toolchain and the repository's actual commands.

Search the integrated/local renderer for `initViroScene`, `setViroSceneSize`, `viroOnTouch`, `emscripten_set_main_loop` and corresponding disposal/frame functions. Names in proposed interfaces are not confirmed native exports.

## 6. Architectural decisions to preserve

**Renderer and host are separate.** ViroCore remains the native and WASM rendering foundation. The browser host must provide real WebXR per-view rendering, input and lifecycle. IWSDK uses Three.js/ECS; use compatible modules, interaction patterns and tests without handing its `World` a competing renderer/session. [MW02]

**Spatial web is not one uniform mode.** Keep `web-inline`, `webspatial-shell` and `webxr-immersive` explicit. WebSpatial permits a supported transition into independently rendered WebXR with its spatial UI hidden. Packaged visionOS WebSpatial currently cannot launch WebXR through WKWebView. Meta's WebXR browser route is not proof of Meta WebSpatial runtime support. [WW01] [W01]

**One frame owner.** During immersive browser mode, the XR frame driver owns timing. Simulate once per frame and render each provided view. Stop/resume/dispose the internal WASM loop correctly; do not add a second loop or render one mono image into both eyes. [XR01]

**One input owner.** Separate system targeting effects, committed interaction and permissioned samples. Preserve pointer identity, coordinate space and real/emulated/synthetic provenance. Grip input moves the group; control input activates content; drawing owns strokes. Cancel never activates.

**One native resource contract per backend.** Android native buffers, Apple Metal resources and browser WebGL objects are not interchangeable handles. Preserve format, synchronization, generation and disposal. A typed producer initializer is not its implementation.

**Capabilities are evidence.** Unsupported, unimplemented, denied, wrong-presentation and temporarily invalid states are distinct. A property declaration or README cannot replace a running path.

## 7. Ordered work queue

1. Preserve local work, resolve release provenance and create the fork-delta ledger.
2. Integrate the verified upstream target in isolated branches; port behavior and rebuild matched artifacts.
3. Establish clean package-consumer baselines and a neutral Platform Lab, including all existing producer families.
4. Revalidate/fix native Rive/material/input gaps and browser lifecycle/cancellation; add a real external-frame engine boundary where missing.
5. Complete WebXR rendering/input/session transitions with emulation and physical-device evidence.
6. Preserve/complete native visionOS and PICO lanes with explicit component/feature support.
7. Add shared layout/interaction contracts, native Meta/PICO windows and WebSpatial shell integration.
8. Gate optional OpenXR containers and browser layers behind runtime tests; they do not block independent core work.
9. Run regressions/performance/accessibility, inspect release artifacts and deliver evidence, migrations and rollback. Publishing requires approval.

The companion document provides the full workstream roster and per-lane gates. Do not skip fork preservation in order to demonstrate a new SDK feature quickly.

## 8. Required acceptance and failure handling

Keep separate results for mobile native, Quest native, PICO native, native visionOS, ordinary web, Quest/PICO browser WebXR, Safari WebXR, WebSpatial PICO, packaged WebSpatial visionOS and system-window adapters.

Require matched build identity; real pixels and authored interaction; correct stereo; moved/rotated panel mapping; grip/content arbitration; cancellation and multi-input behavior; context/session restoration; no leaked loop/resources; supported fallbacks and reproducible package installs.

A static fallback-colored quad, overlay button, screenshot stream or reference IWSDK scene does not pass the Viro producer/renderer gate. A simulator does not pass physical-headset proof. Report **pass / fail / unverified / not applicable** with the evidence class.

If hardware or a native API blocks a gate, finish independent code/build/tests, save the exact error/minimal reproduction and leave only the affected rows unverified. Do not claim implementation success, invent test counts or use a generic blocker to abandon unrelated work.

## 9. Skills and tools

Retain No AI Slop, Everything Claude Code, PRs #5 and #2 ([T03] [T13]), relevant Margelo API/Nitro/C++/Kotlin skills, Viro MCP, Rive CLI/MCP, Meta tools, PICO tooling, Expo and design guidance. Recheck versions/status and audit hooks/permissions before use. The user has Rive CLI installed locally; no `.riv` was compiled in this authoring environment.

Use browser automation/IWER only after confirming they can drive the chosen Viro host. IWSDK-specific ECS inspection is not Viro scene introspection. Do not claim a connected tool is available in the next agent's environment until actually discovered/run.

## 10. Rolling handoff template

Create/update a project-local handoff in the appropriate existing docs directory after each phase, after branch/ABI changes and before context limits. Keep private environment paths/evidence out of public commits when necessary.

```text
Timestamp / current owner / next owner:
Scope and non-negotiable decisions:
Repo paths, branches, HEADs, dirty state:
Target release, source SHA, registry integrity:
Fork delta ledger / unresolved conflicts:
Files and symbols changed:
Native/WASM outputs, build IDs and checksums:
Commands actually run, exit codes and logs:
Per-lane pass/fail/unverified table:
Exact blocker and reproduction:
Next three executable steps:
Saved-work locations and rollback:
Available tools / tools used / evidence produced:
```

Do not describe unstarted work as in progress. Do not invent a background process or promised future delivery. If a real process is continuing in a persistent environment, record its actual identifier and how to inspect/cancel it.

## 11. Copy-ready next-agent instruction

> Continue the Viro platform modernization from this handoff and its companion document. Moyo is out of scope. Start with the user's actual local/forked repository inventory and verify the confirmed Viro 3.0.1 package/source/binary mapping. Preserve all existing work before upstream synchronization. Keep ViroCore as the native and browser renderer; implement the missing host/input/surface paths rather than replacing it with IWSDK or WebSpatial's scene engine. Use the workstream roster and exact per-platform gates. Mark source-only, build-only, emulated and device-tested results separately. Update the rolling handoff with concrete files, revisions, commands, evidence, blockers and next steps before changing agents or running low on context. Do not publish, force-push, discard work or touch downstream applications without authorization.

## Source links

The full document has the complete source register. The links below cover the critical continuation facts.

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
[MW01]: https://developers.meta.com/horizon/downloads/package/immersive-web-sdk/v1.0/?view=full_width
[MW02]: https://developers.meta.com/horizon/documentation/iwsdk/guides/overview/
[MW03]: https://developers.meta.com/horizon/documentation/web/webxr-overview/
[W01]: https://webspatial.dev/docs/introduction/getting-started
[WW01]: https://webspatial.dev/docs/concepts/webspatial-app
[XR01]: https://immersive-web.github.io/webxr/

[T03]: https://github.com/WorldFlowAI/everything-claude-code/pull/5
[T13]: https://github.com/WorldFlowAI/everything-claude-code/pull/2
