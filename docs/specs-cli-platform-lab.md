# Viro SPECS CLI and cross-platform Platform Lab

The public Viro package now owns the developer-facing command surface. Lens
Studio implementation details remain in the optional
`@viro-external/specs` backend.

## CLI

Install the backend next to Viro:

```bash
pnpm add @reactvision/react-viro
pnpm add -D @viro-external/specs
```

Then:

```bash
viro specs doctor --project "/path/to/LensProject"
viro specs sync --project "/path/to/LensProject"
viro specs init --project "/path/to/LensProject"
viro specs test
viro specs go --project "/path/to/LensProject"
viro specs platform-lab --project "/path/to/LensProject"
```

`platform-lab` runs the validated CLAD loop and forces `--exec` unless the
caller already supplied it.

## One source scene

`examples/specs/ViroSpecsPlatformLab.tsx` is authored entirely with normal
Viro JSX. It can be mounted through the normal Viro/ViroCore scene path, or
compiled through `compileViroSpecsJSX()` for the SPECS/Lens backend.

That is the parity target: application code describes the scene once; backend
selection changes the renderer, not the lesson/game/application model.

## Boundary

The CLI deliberately does not copy the Lens implementation into
`@reactvision/react-viro`. It resolves the optional backend package at runtime
and invokes its validated scripts. This keeps the main Viro package usable on
apps that never target SPECS.
