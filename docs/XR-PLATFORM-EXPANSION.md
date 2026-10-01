# Viro XR Platform Expansion

**Status:** architecture + staged implementation plan
**Snapshot:** October 1, 2026

This document maps Viro's existing native, OpenXR, visionOS, web and spatial-layout work onto the next device families: Meta VR Glasses, PICO OS 6 spatial/web apps, Meta AI glasses, and Snap Specs.

The core rule is simple:

> Share scene, layout and interaction intent where the platforms overlap. Do not pretend that an OpenXR renderer, an OS-managed spatial window, a WebSpatial DOM surface, a phone-companion wearable API and a Lens Studio scene are the same runtime.

## 1. Runtime layers

```text
Application state / React feature logic
                |
      shared intent + capabilities
                |
   +------------+-------------+
   |            |             |
scene        layout        wearable I/O
intent       intent        intent
   |            |             |
   |      +-----+------+      |
   |      |            |      |
 Viro   Meta Layout  WebSpatial
   |      |            |
ViroCore Horizon OS  PICO OS 6 / visionOS
   |
OpenXR / Metal / Web renderer

Separate adapter lane:
shared intent -> Meta Wearables Device Access Toolkit
shared intent -> Snap Specs / Lens Studio adapter
```

ViroCore remains the renderer for Viro scenes. Platform window systems and wearable SDKs sit beside it.

### Moyo Learn is the reference implementation

Do not redesign the shared layout mechanics from scratch. Moyo Learn already has production-oriented implementations for:

- a Meta/PICO **system-window contract** that survives Expo prebuild;
- one cross-platform **AdaptivePanes** renderer driven by current window width;
- UIKit + Android FoldingFeature normalization into one physical-region type;
- single-hinge and trifold pane placement;
- trailing Inspector overlay semantics;
- per-instance Zustand state that survives fold/resize/remount;
- meter-based XR spatial tokens;
- a head-relative three-slot comfort arc;
- a settled-head-pose placement gate;
- one carrier transform shared by visible panel + input surface + chrome.

See [`MOYO-CROSS-PLATFORM-LAYOUT-REFERENCE.md`](./MOYO-CROSS-PLATFORM-LAYOUT-REFERENCE.md) for the concrete Moyo file map and copyable examples.

The architectural rule coming from Moyo is:

```text
window size       -> which authored surfaces may be visible
physical regions  -> where their boundaries may safely land
presentation SDK  -> how that surface is hosted on this platform
application store -> what the surface is showing
```

Those four responsibilities stay separate across Horizon OS, PICO, visionOS, WebSpatial, Meta Wearables and Specs.

## 2. Platform map

| Target | Rendering / host | Layout surface | Primary input | Viro relationship |
| --- | --- | --- | --- | --- |
| Meta Quest | ViroCore OpenXR | Horizon Android panels + Meta Layout | controllers, hands, gaze where available | native Viro target |
| Meta VR Glasses | same Horizon OS / OpenXR family | Horizon panels + spatial windows | eyes + pinch/hands; controllers optional | native Viro target; capability-first input |
| PICO 4 / 4 Ultra | ViroCore OpenXR | Android window + existing PICO integration | controller/hands by runtime | native Viro target |
| PICO OS 6 / Space Pro | ViroCore OpenXR for immersive; WebSpatial for spatial web | PICO Shared Space / WebSpatial scenes | gaze/hands/controllers by runtime | native + web-spatial composition |
| Apple Vision Pro | ViroCore visionOS | visionOS windows/immersive spaces; WebSpatial packaged web where chosen | gaze + pinch | native Viro + optional web-spatial lane |
| ordinary web | Viro web renderer / WebXR | DOM | pointer/touch/WebXR input | Viro web target |
| Meta AI glasses | Meta Wearables companion app, or Web Apps on display glasses | glasses-native display surface | voice, camera, device input | adapter; not ViroCore renderer |
| Snap Specs | Snap OS / Lens Studio | Lens scene/UI | gaze/hands/voice/device input per Snap APIs | foreign-runtime adapter |

## 3. Native Meta layout: one React component tree

The existing Viro facade stays the native-Horizon path. The layout PR gates the optional Meta packages to actual Meta Horizon hardware so a PICO Android build does not accidentally load Meta's layout runtime.

```tsx
import {
  ViroSpatialSceneProvider,
  ViroSpatialWindow,
} from "@reactvision/react-viro";

export function TutorWorkspace() {
  return (
    <ViroSpatialSceneProvider>
      <MainPanel />

      <ViroSpatialWindow
        label="reference"
        windowWidth={420}
        windowHeight={620}
        anchor="end"
        fallback="inline"
      >
        <ReferencePanel />
      </ViroSpatialWindow>
    </ViroSpatialSceneProvider>
  );
}
```

On supported Horizon OS builds, the additional surface is an OS-managed spatial window. Elsewhere it falls back to inline content or can be dropped explicitly.

## 4. Meta VR Glasses: reuse the OpenXR scene path

Meta VR Glasses should not get a second renderer. The new platform classifier treats them as part of the Meta Horizon XR family while preserving a separate form-factor fact.

```tsx
import {
  ViroXRSceneNavigator,
  isMetaHorizonXR,
  metaHorizonFormFactor,
} from "@reactvision/react-viro";

export function XRRoot() {
  return (
    <ViroXRSceneNavigator
      vrInitialScene={{ scene: LearningRoom }}
      handTrackingEnabled
      trackingOrigin="floor"
    />
  );
}

console.log({ isMetaHorizonXR, metaHorizonFormFactor });
// Android-reported Quest-compatible identity: { true, "quest" }
// Unrecognized Meta Horizon identity:          { true, "unknown" }
//
// IMPORTANT: Horizon compatibility mode can intentionally report a Quest
// identity on newer Meta VR hardware. Treat form factor/model strings as
// diagnostics only; use OpenXR capability negotiation for feature gating.
```

Do not branch core interaction on the model name. The OpenXR runtime should report which capabilities are present: hands, eye gaze, passthrough, planes, anchors, foveation and controllers.

## 5. PICO native spatial window seam

`@expo-pico/spatial` already defines the typed Shared Space / WindowContainer contract. Its native Spatial SDK backing is still a seam in the current expo-pico repo, so feature-gate it instead of treating the type surface as proof of runtime support.

```tsx
import {
  getSpatialCapabilities,
  getSpaceState,
  setWindowContainerProperties,
  requestFullSpace,
} from "@expo-pico/spatial";

export async function configurePicoWorkspace() {
  const caps = getSpatialCapabilities();

  if (!caps.spatialSdkAvailable) {
    return { mode: "fallback", spaceState: getSpaceState() };
  }

  await setWindowContainerProperties({
    width: 1280,
    height: 800,
    depthOffset: 0.15,
    resizable: true,
  });

  return { mode: "spatial", spaceState: getSpaceState() };
}

export async function enterImmersivePicoMode() {
  const caps = getSpatialCapabilities();
  if (caps.spatialSdkAvailable) {
    await requestFullSpace();
  }
}
```

The Viro renderer remains independent: `@expo-pico/core` owns PICO build/runtime configuration and Viro owns the OpenXR scene.

## 6. PICO OS 6 + WebSpatial

PICO OS 6 is the strongest current web-spatial path because its Web App Runtime includes WebSpatial. The same React website continues to behave as an ordinary site in non-spatial browsers.

Install in the web app:

```bash
pnpm add @webspatial/react-sdk @webspatial/core-sdk
```

Use the WebSpatial JSX runtime and boot once:

```tsx
import { SpatialBoot } from "@webspatial/react-sdk";

export function WebRoot() {
  return (
    <SpatialBoot>
      <Workspace />
    </SpatialBoot>
  );
}

function Workspace() {
  return (
    <main enable-xr-monitor>
      <section
        enable-xr
        style={{
          position: "relative",
          "--xr-back": "30px",
          "--xr-background-material": "translucent",
        } as React.CSSProperties}
      >
        <TutorPanel />
      </section>

      <section
        enable-xr
        style={{
          position: "relative",
          "--xr-back": "80px",
          "--xr-background-material": "thick",
        } as React.CSSProperties}
      >
        <ReferencePanel />
      </section>
    </main>
  );
}
```

Configure the start scene with the Web App Manifest rather than trying to reposition the OS window every React frame:

```json
{
  "name": "Viro Workspace",
  "start_url": "/",
  "xr_main_scene": {
    "type": "window",
    "default_size": { "width": 1280, "height": 800 },
    "resizability": {
      "min_width": 720,
      "max_width": 1800,
      "min_height": 540,
      "max_height": 1200
    }
  }
}
```

Meta Horizon OS is not currently a WebSpatial runtime target, so do not use this as Meta's native-window implementation. On Meta, use Standard Android/Meta Layout for panels or WebXR/IWSDK where a browser immersive path is appropriate.

## 7. Shared layout intent

The long-term Viro-facing API should describe what the app wants, then let an adapter choose the platform primitive.

Proposed contract:

```ts
export type SpatialPresentation =
  | "inline"
  | "system-window"
  | "spatial-web-element"
  | "immersive-scene";

export type SpatialSurfaceIntent = {
  id: string;
  preferredPresentation: SpatialPresentation;
  fallback: "inline" | "drop";
  preferredSize?: { width: number; height: number };
  placement?: "start" | "center" | "end" | "user";
  movable?: boolean;
  resizable?: boolean;
};
```

Adapters may translate that intent differently:

```text
Meta Horizon native -> SpatialWindow
PICO OS 6 native   -> WindowContainer / Shared Space
PICO OS 6 web      -> WebSpatial Scene + spatialized DOM
visionOS native    -> Window / ImmersiveSpace
ordinary web       -> normal DOM fallback
immersive Viro     -> Viro node / panel in scene space
```

## 8. Meta AI glasses

Meta AI glasses are a separate device family from Meta VR Glasses.

Two adapters are useful:

```text
React Native app
   |
@viro-external/meta-wearables
   |
Meta Wearables Device Access Toolkit
   |
camera / microphone / audio / display capability by glasses model
```

and, for Meta display glasses:

```text
React web feature logic
   |
@viro-external/meta-display-web
   |
standard HTML/CSS/JS Web App
   |
600x600 glasses display + supported device input
```

Neither path should pretend to mount a ViroCore 3D scene unless Meta exposes a renderer/runtime that can actually host it.

## 9. Snap Specs

Specs use Snap OS / Lens Studio rather than Viro's OpenXR runtime. Support therefore means an adapter that consumes portable scene/layout/input intent.

Proposed package:

```text
@viro-external/specs
```

Proposed minimum bridge contract:

```ts
export interface PortableXRNode {
  id: string;
  kind: "group" | "text" | "image" | "model" | "panel";
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  source?: string;
  text?: string;
}

export interface PortableXRInteraction {
  source: "gaze" | "hand" | "pinch" | "controller" | "voice";
  phase: "hover" | "select-start" | "select-end" | "cancel";
  targetId?: string;
}
```

Keep animation/rendering native to each runtime. Do not serialize every Viro implementation detail into the portable layer.

## 10. Input normalization

ViroCore already has controller rays, hand tracking, pinch detection and an eye-gaze source in its Android OpenXR path. The next input PR should make source priority explicit:

```text
held controller -> controller ray/select
near hand       -> direct/hand interaction
eye gaze + pinch-> gaze target + hand commit
head gaze       -> fallback only
```

The platform API should expose capability and current source separately. A device may support controllers without one being connected.

## 11. PR stack

### PR 01 - XR platform foundation

`viro PR #7`

- separate Meta Horizon family from known Quest product identity
- keep `isQuest` compatibility
- make future Meta Horizon devices enter the OpenXR path
- add testable classifier

### PR 02 - Cross-platform spatial layout

`viro PR #8` — this PR.

- prevent Meta Layout from loading on PICO just because both are Android
- document Meta native layout + PICO native seam + PICO WebSpatial
- make Moyo Learn's window-contract, AdaptivePanes, fold geometry, Inspector,
  world-slot and settled-pose implementations explicit prior art
- establish the shared layout-intent rules and examples

### PR 03 - Meta VR Glasses build target

`viro PR #9`

Repo: `viro`

- keep the existing `QUEST` enum as Viro's Meta Horizon/OpenXR build selector
  rather than inventing a second renderer enum
- add `metaVrGlassesCompatible` and optional `metaDefaultDeviceTargets`
- default glasses-ready Store targeting to Meta's documented `quest3+`
- keep the current `com.oculus.supportedDevices` Quest list because Meta VR
  Glasses have no public identifier there
- document Meta XR Simulator v207 as the first controllerless validation lane
- preserve standard Android panel mode and immersive OpenXR mode as distinct presentations

### PR 04 - Meta VR Glasses input + capabilities

`virocore PR #3` + `viro PR #10`

Repos: `virocore` + `viro`

- return negotiated runtime/device capabilities without changing expo-pico's
  existing String[10] runtime-info ABI
- make eye gaze/hands/passthrough/planes/scene/foveation/local-floor facts
  observable to JS
- treat ViroCore's legacy `getHeadset() === "quest"` string as compatibility
  metadata only; do not use it for feature gating
- preserve the existing hand/pinch/controller fallback path
- verify controllerless gaze-target + pinch-commit behavior in Simulator/device

### PR 05 - WebSpatial adapter

`viro-external PR #2` (depends on `viro-external PR #1`)

Repo: `viro-external`

- add `@viro-external/webspatial`
- map shared surface intent to WebSpatial scene/DOM configuration
- support PICO OS 6 first
- preserve normal-web fallback
- keep Viro Web/WebXR renderer independent from WebSpatial's OS window layer

### PR 06 - Meta Wearables adapter

`viro-external PR #3` (depends on `viro-external PR #1`)

Repo: `viro-external`

- add `@viro-external/meta-wearables`
- wire the official DAT 1.0 Android Maven artifacts and required app metadata
- define a capability-first injectable transport boundary
- expose display vs displayless behavior without pretending all glasses have a display
- follow with a separate native React Native session/Mock Device transport PR

### PR 07 - Snap Specs adapter

`viro-external PR #4` (depends on `viro-external PR #1`)

Repo: `viro-external`

- add `@viro-external/specs` portable scene/input compiler
- define a Lens Studio/Snap OS runtime transport boundary
- map common text/image/model/panel transforms and interaction events
- reuse Moyo's engine-independent `worldSlot` placement as reference math
- keep unsupported Viro features explicit rather than silently degrading
- follow with a concrete Lens Studio bridge/template PR

### PR 08 - Platform Lab + CI matrix

**Not opened yet** — this should land only after the adapter/runtime contracts above stabilize.

Repos: `viro`, `virocore`, `viro-external`

- one neutral sample workspace
- Meta Quest
- Meta VR Glasses simulator/device
- PICO OpenXR
- PICO OS 6 WebSpatial
- visionOS
- ordinary web + WebXR
- Meta AI glasses companion/display simulator
- Snap Specs simulator/device

Every lane reports `pass`, `fail`, `unverified`, or `not applicable`; simulator evidence is not labeled device-tested.

## 12. Dependency graph

```text
PR01 platform foundation
        |
        +---------> PR03 Meta VR Glasses build
        |                    |
        |                    +--> PR04 Meta XR input/capabilities
        |
        +---------> PR02 layout contract
                             |
               +-------------+-------------+
               |             |             |
             PR05          PR06          PR07
          WebSpatial   Meta Wearables   Snap Specs
               \             |             /
                +------------+------------+
                             |
                           PR08
                    Platform Lab + CI
```

## 13. Acceptance rules

- A product name is never used as a substitute for a capability probe.
- A TypeScript interface is not counted as native support until the underlying SDK path runs.
- WebSpatial, WebXR and the Viro web renderer remain separate layers.
- Meta AI glasses and Meta VR Glasses remain separate device families.
- Snap Specs support is an adapter unless Snap exposes a compatible native renderer path.
- One interaction produces one semantic select event even if gaze and hand data both participate.
- Fallbacks are explicit and testable.
- Existing Quest, PICO, visionOS, Android/iOS AR and ordinary web behavior must not regress.

## 14. Current source references

- Meta VR Glasses: https://developers.meta.com/vr/essentials/get-started-with-glasses/
- Meta VR Glasses Android changes: https://developers.meta.com/vr/documentation/android-apps/whats-new-in-glasses/
- Meta React Native gaze SDK: https://developers.meta.com/horizon/documentation/android-apps/gaze-and-hands-react-native-sdk/
- Meta Wearables: https://developers.meta.com/wearables/
- Meta AI-glasses Web Apps: https://developers.meta.com/wearables/web-apps/
- PICO developer platform: https://developer.picoxr.com/
- WebSpatial: https://webspatial.dev/docs/introduction/getting-started
- Snap Specs: https://www.spectacles.com/build
