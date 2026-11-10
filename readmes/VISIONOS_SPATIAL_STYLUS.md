# Spatial stylus input on visionOS

This branch adds Logitech Muse input to Viro's existing visionOS renderer.

## App setup

Follow the [ReactVision visionOS setup guide](https://viro-community.readme.io/docs/visionos-setup-guide).

The app needs a native `visionos/` project generated from ReactVision's template.
The `withViroVisionOS` Expo config plugin configures that project, including the
pods, Metro platform resolver, SwiftUI host and ImmersiveSpace. The renderer
already exists in Viro; the generated project is the app that hosts it.

Register both plugins:

```json
{
  "expo": {
    "plugins": [
      "@reactvision/react-viro",
      "@reactvision/react-viro/plugins/withViroVisionOS"
    ]
  }
}
```

Use the template and dependency versions supported by the current guide. Its
verified stack currently names Expo 57 and React Native visionOS 0.86.4.
Moyo Learn uses Expo 58 / React Native 0.88; native compatibility with that
combination still needs verification.

## Package this branch

Build the package from this branch before installing it in the app. The package
entry point is `dist/index.js`, so changing TypeScript sources alone does not
update an already packed artifact. Run the repository's build/release process,
then replace the app's vendored package and update its lockfile.

The native Swift changes live in `ios/ViroReact/VisionOS`, shipped by ViroReact.
This event stream requires no additional C++ input API in virocore: it uses
ARKit's accessory pose in the same world space as the existing renderer.

The new SwiftUI stylus event opt-in requires the visionOS 26.2 SDK or newer to
compile. Follow the current setup guide's full Xcode requirements for the
renderer. The host must apply `.viroImmersiveSpaceController()` and register the
Viro ImmersiveSpace. The plugin also adds the accessory tracking usage string.

## Subscribe

```tsx
import { useEffect } from "react";
import {
  subscribeSpatialStylus,
  type ViroSpatialStylusSample,
} from "@reactvision/react-viro";

export function usePen(onSample: (sample: ViroSpatialStylusSample) => void) {
  useEffect(() => subscribeSpatialStylus(onSample), [onSample]);
}
```

Each sample contains:

- `tracked`: whether the tip currently has a usable pose.
- `position`: tracked aim/tip location in Viro world coordinates, or null.
- `headPosition`: current headset position in the same world coordinates.
- `tipPressed`, `primaryPressed`, `secondaryPressed`: current controls.
- `pressure`: normalized maximum pressure across those controls.
- `orientation`: actual aim rotation as a unit quaternion `[x, y, z, w]` in
  the same world space. It is null when tracking is lost. Older provider builds
  omit this field; consumers must report position-only capability in that case.
- `poseTimestampMs`: native monotonic time when this pose was read. This is
  useful for ordering and diagnostics; it is not a sensor or display latency measurement.
- `tipPressure`: pressure from the tip sensor alone, retaining valid zero.
  It is null when that input is unavailable. Drawing adapters should prefer it
  to the legacy maximum-control `pressure`, so a side button cannot alter tip force.

Cancel the current stroke when `tracked` becomes false. Unsubscribe when the
drawing surface unmounts. The subscription is a no-op off visionOS.
Canvas projection, tool selection and stroke ownership belong to the app.

`ViroSpatialStylusPose` serializes translation and quaternion directly from the
existing ARKit aim transform. It rejects nonfinite, scaled, reflected and
nonrigid transforms before they can be reported as a tracked 6DoF pose.
The spatial-stylus contract workflow compiles this original Swift source and
executes its pose tests on macOS. That check does not certify physical Muse
pairing, visionOS app linking or headset latency; the device checks below still apply.

The MoyoBoard adapter projects the head-through-tip ray onto its paper while
either side button is held, and accepts tip contact near the paper plane.
It shares ownership with controller drawing and forwards pressure to Quickdraw.

## Verification still required

The native addition has not been compiled with Xcode or exercised with a paired
Muse in this environment. Verify connection, event focus during immersion,
tracking loss, reconnection, tip position, pressure, release, and exit/reentry.

The official guide lists a Metal shader limitation affecting `ViroPolyline`.
MoyoBoard PR #73 replaces its visionOS live ink overlay with ViroGeometry triangle
meshes. The workaround still needs visual verification on the headset.
Passing JavaScript tests does not verify native ink rendering.

## Monorepo setup

The plugin resolves pods through Node instead of assuming app-local node_modules,
and preserves existing Metro resolvers and wrapped exports. Apps using pnpm patches
can pass `{ applyCompatibilityPatches: false }` to disable the SDK 57 patch-package
copies and postinstall mutation. Audit their installed native module versions separately.

Run `node --test scripts/visionos-plugin.test.cjs` after building the plugin.

