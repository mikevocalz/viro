# Web drag and pinch parity

This branch consumes the WASM exports introduced by mikevocalz/virocore#79.

## Behavior

- `ViroNode onDrag` enables ViroCore's native `OnDrag` event and drag solver.
- `dragType` and `dragPlane` map to the same ViroCore fields used on native.
- `onPinch` is driven by a two-pointer browser gesture recognizer and routed through ViroCore's existing pinch pipeline.
- `Gizmo` is intentionally not mapped to ordinary web dragging. It is a Viro/Android-specific tool mode; mapping it to FixedDistance would make controls such as premium panel buttons unexpectedly draggable.

## Compatibility

The bridge feature-detects the new WASM exports. `@reactvision/viro-web-renderer` 1.0.1, the version on npm, does not have `viroOnPinch`, `viroOnScroll` or `viroSetNodeDragConfig`. On that binary the scene still loads, the three callbacks never fire, and the first node that asks for one logs:

```
[Viro web] drag, pinch, scroll input is off: the loaded WASM renderer has no viroSetNodeDragConfig, viroOnPinch, viroOnScroll. ...
```

It is worse than silent for drag. Without mikevocalz/virocore#79's held-ray fix, a dragged node is pulled toward the centre of the screen and no `onDrag` reaches JS.

## Serving the renderer that has them

This package ships a renderer built from mikevocalz/virocore `main` at `2b8caf2c` (#79 plus #80) under `web/renderer/`. `web/renderer/build.json` records the virocore commit, the CI run the files came from and their SHA-256 hashes.

The npm package's JS wrapper loads it unchanged: the embind symbol set is a superset of 1.0.1's and `viro-web.data` is byte-identical. Copy the three files to a directory the app serves and point the renderer at it:

```sh
mkdir -p public/wasm
cp node_modules/@reactvision/react-viro/web/renderer/viro-web.{js,wasm,data} public/wasm/
```

```tsx
<ViroSceneNavigator
  initialScene={{ scene: MyScene }}
  webRendererOptions={{ assetBaseUrl: "/wasm/" }}
/>
```

`globalThis.VIRO_WEB_ASSET_BASE = "/wasm/"` does the same for every navigator on the page. Keep `web/renderer/THIRD-PARTY-LICENSES.md` next to the binaries if you host them on a CDN.

When ReactVision publishes a `@reactvision/viro-web-renderer` with these exports, drop `assetBaseUrl` and delete `web/renderer/`.

To refresh the vendored build after a virocore change, download the `viro-web-renderer` artifact from that commit's "Renderer / WebAssembly renderer" job, replace the three files and update `build.json`. `__test__/webExtendedInput.test.ts` fails if the hashes or the exports do not match.

## Why no panel-specific code

`@viro-external/ui` already composes `ViroNode` through `MovableNode`. Once this layer works, `SpatialPanel draggable` and `pinchToScale` inherit web support automatically.

## Gaze reticle

The renderer draws a gaze reticle at the centre of the canvas. On web you aim with the mouse or a finger, so the web navigators (`ViroSceneNavigator`, `Viro3DSceneNavigator`, `ViroARSceneNavigator`) hide it unless you pass `showReticle`. Native and headset builds are unchanged.

Hiding it uses `viroSetReticleVisible`, added in mikevocalz/virocore#80. The npm renderer 1.0.1 does not have it, so on that binary the prop does nothing and the dot stays.
