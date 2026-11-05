# Meta VR Layout SDK + Viro

> For the full Meta VR Glasses, PICO OS 6/WebSpatial, Meta AI glasses and Snap Specs platform map, see [`XR-PLATFORM-EXPANSION.md`](./XR-PLATFORM-EXPANSION.md).

Viro's immersive renderer and Meta's Layout SDK solve different spatial UI
problems and should coexist instead of being folded into one runtime:

- **Viro / OpenXR** owns immersive 3D scenes, passthrough, controllers, anchors,
  and the shared Quest/PICO renderer path.
- **Meta VR Layout SDK** owns additional system-managed spatial windows around a
  Standard Android app's main panel on Meta Horizon devices, including the new
  Meta VR Glasses family where supported.
- **Web** continues through `@reactvision/viro-web-renderer` (WebGL2/WASM).
- **PICO** continues through `@expo-pico/core` for flavor/launcher ownership
  and Viro's OpenXR renderer for the immersive scene.

## Install

The two Meta JavaScript packages must be direct dependencies of the consuming
app so React Native autolinking and codegen can discover both registrations:

```bash
npm install @metavr/layout-compat@^1.1.0 @metavr/layout-window-compat@^1.1.0
```

Enable the native Maven side through Viro's Expo plugin:

```json
[
  "@reactvision/react-viro",
  {
    "android": {
      "xRMode": ["QUEST"],
      "metaSpatialLayout": true
    }
  }
]
```

The plugin injects Meta's BOM plus:

- `com.meta.metavrx.layout:layout-react-compat`
- `com.meta.metavrx.layout:layout-window-react-compat`

The default BOM is `1.2026.1.0`. Override it with
`android.metaSpatialLayoutBomVersion` only when Meta publishes a compatible
replacement and the JavaScript packages are updated with it.

After changing these dependencies, regenerate native Android files:

```bash
npx expo prebuild --clean
```

## The spatial shell is applied for headset builds

When `android.xRMode` includes `"QUEST"` or `"PICO"`, Viro's plugin also runs
the config plugin from `@viro-external/spatial-shell` if the app has it
installed. That package holds the rail, main panel and detail panel layout
that ran on a Quest 3S and a PICO 4 Ultra in expo-pico #45:

- the navigation rail on the main panel's left (its own Layout SDK window on
  Quest, a strip of the main window on PICO), never a bottom tab bar on a
  headset;
- the detail panel as a second activity beside the main panel, with a title
  and Close;
- the native pieces Enter XR needs: the `expo.modules.pico.IMMERSIVE_ACTIVITY`
  marker on `.VRActivity`, the quest flavor declared above its
  `questImplementation` dependencies, `metavr:uses-metavr-sdk` in the quest
  manifest, and `skipActivityIdentityAssertionOnHostPause` in
  `MainApplication.kt`.

Install it and render `<SpatialShell>` at the app root:

```bash
npx expo install @viro-external/spatial-shell react-native-svg react-native-safe-area-context
```

Options go under `android.spatialShell` and are passed through, with
`platforms` taken from `xRMode`:

```json
[
  "@reactvision/react-viro",
  {
    "android": {
      "xRMode": ["QUEST", "PICO"],
      "spatialShell": { "detailPanel": { "defaultWidth": "480dp", "defaultHeight": "640dp" } }
    }
  }
]
```

Set `"spatialShell": false` to opt out. Without the package installed, a
headset prebuild prints one warning with the install command and continues;
phone and AR builds are never affected. After prebuild,
`npx viro-spatial-shell-doctor` fails a headset project that renders a bottom
tab navigator, has no `<SpatialShell>`, or skipped the plugin.

## Cross-platform facade

Viro exports a compatibility facade so app code can keep one component tree:

```tsx
import {
  ViroSpatialSceneProvider,
  ViroSpatialWindow,
} from "@reactvision/react-viro";

export function Workspace() {
  return (
    <ViroSpatialSceneProvider>
      <MainPanel />

      <ViroSpatialWindow
        label="tools"
        windowWidth={320}
        windowHeight={480}
        anchor="end"
        priority={3}
        fallback="inline"
      >
        <ToolsPanel />
      </ViroSpatialWindow>
    </ViroSpatialSceneProvider>
  );
}
```

On Meta Horizon Android with the Meta packages installed this delegates to Meta's
`SpatialSceneProvider` and `SpatialWindow`. On iOS, visionOS, web, or when
the optional peers are absent, Viro applies the requested inline/drop fallback.

For Meta-specific placement state, import `useSpatialWindowState` directly
from `@metavr/layout-window-compat`; Viro intentionally does not wrap hooks
whose lifecycle is owned by Meta's scene provider.

## Constraints that must remain true

- React Native spatial windows require both `windowWidth` and
  `windowHeight`.
- Labels must be unique and stable.
- Inline fallback is the safe default; `drop` is appropriate only when the
  main panel already exposes an alternate route to the same content.
- Spatial windows are opaque surfaces; paint their root background.
- Do not animate window geometry every frame. Animate the content inside it.
- Current React Native Layout SDK capacity is limited; design around roughly
  two important simultaneous spatial windows.
- On Horizon OS releases before v207 the compatibility layer falls back
  instead of creating spatial windows.

## Web renderer

The Viro repo no longer requires a sibling `../viro-web-renderer` checkout.
Development and tests use the published
`@reactvision/viro-web-renderer@^1.0.0` package, matching the package's public
optional peer contract.

For Expo web, consumers still need the renderer installed when they actually
use Viro's web surface:

```bash
npm install @reactvision/viro-web-renderer
```

## PICO ownership

Do not add PICO launcher/activity metadata here. `@expo-pico/core` owns the
PICO build flavor, launcher contract, loader overlay, and device tooling.
Viro owns the shared React/OpenXR scene path. Keeping that boundary avoids
Quest-specific manifest metadata leaking into PICO variants.

## PICO and WebSpatial are separate layout backends

PICO is also Android, but that does **not** make Meta Layout its spatial-window
runtime. Viro now gates the Meta compatibility packages to Meta Horizon hardware.

For PICO OS 6 spatial web surfaces, use WebSpatial. PICO's Web App Runtime
includes the WebSpatial Runtime, so a React web UI can spatialize selected DOM
content while retaining an ordinary-browser fallback. Keep that presentation
layer separate from Viro's native OpenXR renderer and Viro's web/WebXR renderer.

The typed `@expo-pico/spatial` WindowContainer/Shared Space API remains the
native PICO layout seam. Feature-gate it using its runtime capability result
until the native Spatial SDK implementation is verified on the target build.
