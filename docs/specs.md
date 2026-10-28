# Snap Specs / SPECS 27

Viro exposes a first-class Specs runtime identity while keeping Lens Studio
implementation code in the separate `@viro-external/specs` backend.

The public package does **not** run ViroCore on Specs. ViroCore remains the
native renderer for its supported targets; SPECS uses a Lens Studio backend
that implements the same portable Viro semantics.

## Runtime detection

```ts
import {
  getViroXRRuntime,
  hasViroXRRuntimeCapability,
  isViroSpecsRuntime,
} from "@reactvision/react-viro";

if (isViroSpecsRuntime()) {
  // Running inside the Lens Studio Specs backend.
}

const runtime = getViroXRRuntime();

if (hasViroXRRuntimeCapability("world-query")) {
  // Safe to expose placement UI.
}
```

Specs build identity is explicit through `__VIRO_SPECS_BUILD__`. Feature
gating should use capabilities rather than model names.

## CLI

Install the validated backend alongside Viro:

```bash
pnpm add @reactvision/react-viro @viro-external/specs
```

Then use the Viro-facing CLI:

```bash
viro-specs doctor --project "/path/to/LensProject"
viro-specs sync --project "/path/to/LensProject"
viro-specs go --project "/path/to/LensProject"
```

The CLI delegates to the validated SPECS 27 backend and preserves the same
doctor/sync/CLAD behavior that is covered by the backend's Lens Studio and LEAF
regression suite.

`viro-specs watch` recompiles a scene on every save and writes the generated
Lens host atomically, keeping the last valid output when a build fails and
any generated file you edited: see [specs-watch.md](specs-watch.md).

## Web preview

`web-harness/specs-preview/` renders a manifest in the browser with the Lens
host's scene controller on three.js, for design review before a Lens build:
see [specs-preview.md](specs-preview.md).
