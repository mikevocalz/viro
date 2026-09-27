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

Cancel the current stroke when `tracked` becomes false. Unsubscribe when the
drawing surface unmounts. The subscription is a no-op off visionOS.
Canvas projection, tool selection and stroke ownership belong to the app.

The MoyoBoard adapter projects the head-through-tip ray onto its paper while
either side button is held, and accepts tip contact near the paper plane.
It shares ownership with controller drawing and forwards pressure to Quickdraw.

## Verification still required

The native addition has not been compiled with Xcode or exercised with a paired
Muse in this environment. Verify connection, event focus during immersion,
tracking loss, reconnection, tip position, pressure, release, and exit/reentry.

The official guide lists a Metal shader limitation affecting `ViroPolyline`.
MoyoBoard's current live ink overlay uses that component; its rendering must be
verified or replaced before calling the headset drawing experience complete.
Passing JavaScript tests does not verify native ink rendering.
