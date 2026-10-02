# XR runtime and SPECS identity

Viro now exposes one public runtime contract for immersive targets:

```ts
import {
  getXRRuntime,
  useXRRuntime,
  hasXRCapability,
  isSpecsBuild,
} from "@reactvision/react-viro";

const runtime = useXRRuntime();

if (runtime.isSpecs) {
  // Specs-specific presentation when genuinely necessary.
}

if (hasXRCapability("surface-placement", runtime)) {
  // Feature behavior should normally gate on capability.
}
```

## Runtime identity vs capability

Device/runtime identity is intentionally separate from capability reporting.

Use `runtime.isSpecs` when presentation needs to differ on glasses. Use
`runtime.capabilities` for feature behavior so future hardware generations do
not inherit assumptions from a device name.

## External runtime providers

Backends that do not execute inside ViroCore, such as SPECS/Lens Studio, can
register a provider:

```ts
registerViroXRRuntimeProvider({
  getSnapshot() {
    return {
      platform: "specs",
      runtime: "lens-studio",
      isSpecs: true,
      // ...
      capabilities: {
        "hand-tracking": "supported",
        pinch: "supported",
        "world-query": "supported",
      },
    };
  },
});
```

The hook is backed by Zustand rather than component-local React state, so
runtime signals can be shared consistently across Viro application surfaces.
