# Snap Specs / SPECS 27

Viro exposes a first-class Specs runtime identity while keeping Lens Studio
implementation code in the separate `@viro-external/specs` backend.

The public package does **not** run ViroCore on Specs. ViroCore remains the
native renderer for its supported targets; SPECS uses a Lens Studio backend
that implements the same portable Viro semantics.

Pinches become typed actions and app state through `specsAction`,
`defineSpecsActions` and `bindSpecsActionsToStore`; see
[specs-actions.md](specs-actions.md).

## Documentation

| Page | Read it for |
| --- | --- |
| [specs-quickstart.md](specs-quickstart.md) | install, first scene, compile, Lens project, Preview |
| [specs-architecture.md](specs-architecture.md) | compilers, manifest, Lens host, packaging boundary |
| [specs-jsx.md](specs-jsx.md), [specs-parity.md](specs-parity.md) | which components and props reach the Lens, and how each is tested |
| [specs-manifest.md](specs-manifest.md) | manifest v2 fields and schema |
| [specs-compiler.md](specs-compiler.md), [specs-generated-host.md](specs-generated-host.md) | `viro-specs-compile` and the generated Lens host |
| [specs-actions.md](specs-actions.md) | typed actions and app state |
| [specs-experience.md](specs-experience.md) | lifecycle states, placement, comfort, premium components |
| [specs-error-reference.md](specs-error-reference.md), [specs-diagnostics.md](specs-diagnostics.md) | every diagnostic code; the first is generated from the catalog |
| [specs-examples.md](specs-examples.md) | gallery: Platform Lab and the three reference apps, with LEAF scenarios |
| [specs-compatibility.md](specs-compatibility.md) | supported versions across React Native, Expo, Lens Studio and Lens packages |
| [specs-migration.md](specs-migration.md) | upgrading an app and a Lens project |
| [specs-release.md](specs-release.md) | version rules, release gates, publishing |

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
npm install @reactvision/react-viro @viro-external/specs@^0.3.0 @viro-external/xr-contract@^0.3.0
```

To start a new app instead, `viro-specs init <dir>` writes an Expo app with
one scene, syncs the Lens runtime and writes the generated Lens host
([specs-quickstart.md](specs-quickstart.md)).

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
