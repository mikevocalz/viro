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
- ViroCore `:viroreact:assembleRelease`: pass, both configured Android ABIs.
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
package version is `3.0.0-moyo.5-rive.4`. These are build-verified artifacts,
not a headset-qualified release. Device validation is last by user request.
The full rolling handoff is in the companion Moyo worktree at
`docs/handoffs/2026-09-25-rive-viro-panel.md`.

User requested RN 0.88.0-rc.2 during device preparation. The combined consumer harness was rerun successfully, and the React bridge AAR was rebuilt and restaged against rc.2. ViroCore’s renderer is unchanged by that RN tooling update.

The full APK check exposed duplicate React Native core codegen classes in the bridge AAR. Removed the React Gradle plugin from this handwritten Java library (it has no codegen specs), cleaned and rebuilt. The consumer harness now rejects generated React core classes in the AAR. No APK duplicate-class exclusions are used.
