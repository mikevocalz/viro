# Meta VR Layout SDK + Viro

Viro's immersive renderer and Meta's Layout SDK solve different spatial UI
problems and should coexist instead of being folded into one runtime:

- **Viro / OpenXR** owns immersive 3D scenes, passthrough, controllers, anchors,
  and the shared Quest/PICO renderer path.
- **Meta VR Layout SDK** owns additional system-managed spatial windows around a
  Standard Android app's main panel on Meta VR devices.
- **Web** continues through `@reactvision/viro-web-renderer` (WebGL2/WASM).
- **PICO** continues through `@expo-pico/core` for flavor/launcher ownership
  and Viro's OpenXR renderer for the immersive scene.

## Install

The two Meta JavaScript packages must be direct dependencies of the consuming
app so React Native autolinking and codegen can discover both registrations:

```bash
npm install @metavr/layout-compat@^1.0.0 @metavr/layout-window-compat@^1.0.0
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

The default BOM is `1.2026.0.0`. Override it with
`android.metaSpatialLayoutBomVersion` only when Meta publishes a compatible
replacement and the JavaScript packages are updated with it.

After changing these dependencies, regenerate native Android files:

```bash
npx expo prebuild --clean
```

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

On Android with the Meta packages installed this delegates to Meta's
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
