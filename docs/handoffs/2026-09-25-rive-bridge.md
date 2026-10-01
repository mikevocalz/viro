# Rive Surface bridge continuation

The two documents in `references/` were added at the user's request. The user
confirmed **“Add references; finish current Rive work.”** Their proposed Viro
3.0.1 modernization and replacement of application scope are deferred.

Implementation now connects `{canvasSource,width,height}` diffuse textures
through `CanvasSourceBridge` to ViroCore `ExternalSurfaceTexture`, then offers
its Android Surface to Nitro's Rive renderer. The Surface/BufferQueue route
uses Viro's existing OES texture sampling; it does not use raw AHardwareBuffer
imports or a JavaScript frame-copy loop.

`ViroRivePanel` accepts native file bytes, artboard/state machine, fit, lifecycle
callbacks and world-space input mapping. The optional `init` adapter remains
available. `examples/rive-panel/RivePanelProbe.tsx` shows a separate amber grip
with native `dragTransform="parent"`; body pointers use `dragTransform="none"`.
The input source is numeric, not an image asset descriptor; event types were
corrected accordingly.

Build evidence on 2026-09-25:
- ViroCore `:viroreact:assembleRelease`: pass. The latest live-ray rebuild targets arm64-v8a only; the earlier build covered both configured ABIs.
- All 14 arm64 native libraries: pass 16 KB ELF alignment.
- Nitro `:nitro-canvas:assembleDebug`: pass (arm64).
- Viro `:viro_bridge:assembleRelease`: pass against RN 0.88.0-rc.2.
- Rive panel + shared hook targeted TypeScript check: pass.
- Whole repository TypeScript: fails on existing web-renderer dependency,
  missing `GpuProducer` exports, and unrelated source errors. Do not report it
  as clean. No replacement GPU implementation was fabricated to silence it.

The combined consumer build uses JDK 17, Gradle 9.4.1, AGP 9.2.1, Kotlin
2.3.21, NDK 27.1.12297006, Nitro 0.37.1 and Rive Android 11.12.1. Reproduce with
Nitro's `scripts/check-android.py --gradle /path/to/gradle --viro /path/to/viro`.
Set JAVA_HOME/ANDROID_HOME. Install Nitro dev dependencies first.

The rebuilt renderer and bridge AARs are staged in this isolated worktree;
package version is `3.0.0-moyo.5-rive.10`. These are build-verified artifacts,
not a headset-qualified release. Device validation is last by user request.
The full rolling handoff is in the companion Moyo worktree at
`docs/handoffs/2026-09-25-rive-viro-panel.md`.

User requested RN 0.88.0-rc.2 during device preparation. The combined consumer harness was rerun successfully, and the React bridge AAR was rebuilt and restaged against rc.2. ViroCore’s renderer is unchanged by that RN tooling update.

The full APK check exposed duplicate React Native core codegen classes in the bridge AAR. Removed the React Gradle plugin from this handwritten Java library (it has no codegen specs), cleaned and rebuilt. The consumer harness now rejects generated React core classes in the AAR. No APK duplicate-class exclusions are used.

Quest capture confirmed Rive pixels; user confirmed parent-grip dragging but reported selection failure and ray clipping. The next renderer keeps hit testing active for input-only drags. Fraction-count converter and text-size corrections live in the Moyo probe. Android selection retry remains required; the device disconnected during diagnosis.

Latest placement update: the consumer supplies a camera-relative initial pose (1.8 m ahead, 0.2 m below eye height), then preserves world-space grip movement. Grip text uses font 20 scaled to 0.25, centered and clipped inside 0.6 × 0.09 m. Viro MCP prop lookup, scene validation (zero issues), and web layout render passed. This does not validate native Rive or controller interaction. Renderer rive.5 includes live hit testing for input-only drags; physical selection acceptance remains pending.

The user confirmed that “Moving panel” remains after releasing both triggers and grips. Renderer rive.6 (ViroCore `7a366057`) suppresses hand pinch/grab events while a controller owns that side and cancels held trigger/grip actions when inactive or tracking is lost. This prevents duplicate hand/controller edges and missing release on inactive actions. Host button-edge tests, arm64 renderer build, and all 14 native library alignment checks passed. Physical release and selection still require validation in the new APK.

Rive.7 extends inactive-action cancellation to A/B/X/Y/menu. The rive.6 runtime exposed capture from source 5 (A button), whose boolean action had the same ignored-inactive-state path. Physical acceptance remains open.

Rive.8 addresses the release loss observed in the live controller trace: normal
presses reached JS as ClickDown (1), then Clicked (3), without ClickUp (2).
ViroBridgeEvent inherited RN Event.canCoalesce=true, allowing adjacent Up/Clicked
events to merge. Click and hover events now opt out; other continuous events keep
existing coalescing. The missing grip release also left panelWorld at its initial
pose after native movement, so subsequent world hits were rejected off-plane.
Interactive Rive and grip quads now use highAccuracyEvents for plane-accurate hits.
Viro MCP confirmed ViroQuad support; bridge build and targeted TypeScript passed.
Physical release, hint toggle and post-drag selection remain acceptance checks.

The user confirmed selection works and chose a visible endpoint on the panel.
Rive.9 adds a per-controller cyan hit dot in the native OpenXR presenter, keeps
beams ending at the hit, and draws pointer geometry after scene geometry. Dots
are hidden on no-hit/tracking loss and honor reticle visibility. They are excluded
from hit testing. Existing click/hover delivery and geometry-accurate input stay
in place. Headset visual acceptance follows the build/install.

Rive.10 moves shared canvas state and the example probe to scoped Zustand stores,
per user instruction (no React useState). The probe observes Rive piece0..piece3,
derives their count in Zustand, and publishes the aggregate to selectedCount.
Quest had pieces [0,1,1,0] while the authored selectedCount remained zero, so
observing that stale aggregate alone could never update the host label. Rive
continues to own click/selection behavior. The helper hydrates current values and
retires queued callbacks on cleanup; no polling is used for selection. Native
renderer/bridge AARs are unchanged from rive.9.

## 2026-09-26 audit addendum — landed on fork main

The `codex/rive-viro-panel` rive.5–10 input series was merged into
`upgrade/viro-3.0.1` (this worktree's branch), which was fast-forwarded onto
`mikevocalz/viro` `main` at `019ec2e` and pushed. Tags are pushed and the
upstream GitHub releases are mirrored 48/48 with `Latest` pointing at v3.0.1.
Moyo consumes the post-merge stack through the vendored
`reactvision-react-viro-3.0.1-moyo.0` tarball, repacked with the post-merge
`viroreact` AAR (`fbbd4cb15e9fc761a9b9b5866e52cda49ef4d3e51c9ccf265ff325e4e4e30b62`).

Device side: the Quest 3S accepted selection and the Zustand-derived count on
2026-09-25, and the three-slot `moyo://xr-layout-probe` composition (Rive
panel left, digital board centre, Natalie right) verified on the merged
3.0.1 stack. Still open post-rebuild in Moyo `8ebdf4a`: ink rendering,
board-drag persistence and Natalie speech — not yet exercised on device.
Details in the rolling Moyo handoff
(`moyo-rive-panel:docs/handoffs/2026-09-25-rive-viro-panel.md` — committed on
`codex/rive-viro-panel`, now also on `main` via the merge below).

Moyo side, same day: `f428379` merged the whole XR/quest line — including
this vendored `3.0.1-moyo.0` package — onto `moyolearn` `main` (the root
`pnpm.overrides` maps `@reactvision/react-viro` to
`file:./vendors/reactvision-react-viro-3.0.1-moyo.0.tgz`; `apps/mobile`
declares `3.0.1-moyo.0`). That merge is local only (`origin/main` is 215
commits behind) and its merged-main Quest evidence
(`quest-3s-merged-main.png`/`.log`) was **pending capture** at this audit.
The three device gaps above are unchanged.
