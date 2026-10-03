# Web drag and pinch parity

This branch consumes the WASM exports introduced by mikevocalz/virocore#79.

## Behavior

- `ViroNode onDrag` enables ViroCore's native `OnDrag` event and drag solver.
- `dragType` and `dragPlane` map to the same ViroCore fields used on native.
- `onPinch` is driven by a two-pointer browser gesture recognizer and routed through ViroCore's existing pinch pipeline.
- `Gizmo` is intentionally not mapped to ordinary web dragging. It is a Viro/Android-specific tool mode; mapping it to FixedDistance would make controls such as premium panel buttons unexpectedly draggable.

## Compatibility

The bridge feature-detects the new WASM exports. Older web renderer binaries continue to load, but drag/pinch remain unavailable until the updated ViroCore WASM binary is packaged into `@reactvision/viro-web-renderer`.

## Why no panel-specific code

`@viro-external/ui` already composes `ViroNode` through `MovableNode`. Once this layer works, `SpatialPanel draggable` and `pinchToScale` inherit web support automatically.
