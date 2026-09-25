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
package version is `3.0.0-moyo.5-rive.8`. These are build-verified artifacts,
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
