# Specs migration notes

Newest first. Each section lists what an app or a Lens project has to
change; the CHANGELOG has the full list of changes.

## To the release after 3.0.3-moyo.1 (Specs production line)

Pairs with `@viro-external/specs` 0.3.0 and `@viro-external/xr-contract`
0.3.0.

### Dependencies

- `react` is no longer a dependency of this package, only a peer
  (`^19.3.0`). Apps on React Native 0.88 already satisfy it. An app on
  React 19.0 to 19.2 has to upgrade React, which React Native 0.88 already
  requires.
- `react-native-web`, if installed, must be 0.21.x.
- `@viro-external/specs` must be 0.3.x. With 0.2.x installed, `npm ls`
  reports it as invalid and the generated Lens host fails to compile in
  Lens Studio, because 0.2.x has no `ViroSpecsSceneControllerHost`.

```bash
npm install @viro-external/specs@^0.3.0 @viro-external/xr-contract@^0.3.0
```

### Imports

- `ViroSpecsScene` is exported from the package root. If you imported it
  from `@reactvision/react-viro/dist/components/Specs/ViroSpecsScene` as a
  workaround, switch to `import { ViroSpecsScene } from
  "@reactvision/react-viro"`.
- `bindSpecsActionsToStore(store, ...)` infers the state type from
  `store.getState()`. Code that passed an explicit type argument to work
  around the Zustand `setState` overload can drop it.

### Manifests

- Manifests are version 2. A version 1 manifest still loads, with a
  `VS1002` warning; convert it once with
  `viro-specs-compile --manifest old.json --out new.json` or
  `migrateSpecsManifest()`.
- Diagnostics are `ViroSpecsDiagnostic` objects with a stable code, not
  strings. Code that matched message text should match `code` instead;
  see [specs-error-reference.md](specs-error-reference.md).
- Give elements a `viroTag`. Without one the ID is a content hash, which
  survives sibling reordering but changes when the text or source
  changes. `--strict` requires `viroTag`.

### Lens project

1. Upgrade the backend and re-sync:
   ```bash
   npx viro-specs sync --project "/path/to/LensProject"
   npx viro-specs doctor --project "/path/to/LensProject"
   ```
   Sync now copies production files only. LEAF scenarios, the Platform
   Lab and the agent validation files need `--with-validation`. A project
   synced before the ownership ledger existed has runtime files the
   ledger does not know: identical ones are adopted, different ones are
   kept and listed as unowned. `--adopt-existing` overwrites those with
   the new version and records them.
2. Regenerate the host with `--format lens-ts`. The four inputs of the old
   host (`runtimeHostObject`, `interactionHostObject`,
   `animationHostObject`, `navigationHostObject`) are replaced by one,
   `sceneHostObject`. Add `ViroSpecsSceneControllerHost` to a SceneObject,
   set its `assetRegistryObject` to the existing `ViroSpecsAssetRegistry`
   object, and assign that SceneObject to `sceneHostObject`
   ([specs-generated-host.md](specs-generated-host.md)).
3. Register `placeholderMaterial`, `defaultMaterial`,
   `defaultLineMaterial` and fonts on the asset registry to get
   placeholders for missing assets, scene materials and fonts.
4. Interaction Kit 4.0.0 projects: sync detects
   `Packages/InteractionKit.lspkg` and rewrites the import seam. This line
   is not yet validated in Preview; keep production Lenses on
   SpectaclesInteractionKit 2.x
   ([specs-compatibility.md](specs-compatibility.md)).
