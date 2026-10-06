# Rive/XR local validation

This PR adds a local cross-repository audit and a device acceptance matrix. It intentionally does not pretend that TypeScript checks prove native GPU behavior.

## Checkouts

Keep these repositories side-by-side:

    viro/
    virocore/
    viro-external/

In viro:

    git checkout feat/rive-xr-contract-conformance
    npm install

Run:

    VIRO_EXTERNAL_ROOT=../viro-external VIROCORE_ROOT=../virocore npm run test:rive-contract

Either environment variable can be omitted for a Viro-only audit.

## TypeScript and unit validation

    npm run tsc
    npm test -- --runInBand
    npm run test:rive-contract

The Rive example is examples/rive-panel/. Use the normal native app/harness command for your local iOS, Android, and Quest builds.

## Device acceptance matrix

### Rive runtime
- [ ] .riv asset loads through the native Rive producer.
- [ ] Requested artboard loads.
- [ ] State machine starts and responds to inputs.
- [ ] Data bindings update without recreating the panel.
- [ ] Native Rive owns its frame clock; React/JS is not driving every frame.
- [ ] Panel survives background/foreground transitions.
- [ ] Disposal releases the Rive runtime and GPU surface.

### Spatial composition
- [ ] Panel is a Viro scene node, not a React Native 2D view over the scene.
- [ ] Width/height are physical Viro dimensions.
- [ ] Position and rotation are Viro transforms.
- [ ] External surface is GPU transport only; no screenshot/PNG/GIF/WebView fallback.
- [ ] Depth/occlusion behaves correctly on the target backend.
- [ ] Surface disappears cleanly when unmounted.

### Input
- [ ] gaze/hover enter
- [ ] gaze/hover move
- [ ] gaze/hover exit
- [ ] pinch/select down
- [ ] select/up
- [ ] cancel
- [ ] touch/controller where supported
- [ ] D-pad where supported by the platform adapter
- [ ] Pointer coordinates map to the Rive artboard, not the panel world AABB.

### Drag
- [ ] Drag begins only after the activation threshold.
- [ ] Free drag follows the active pointer.
- [ ] Horizontal constraint works.
- [ ] Vertical constraint works.
- [ ] Maximum displacement is respected.
- [ ] Release ends the drag.
- [ ] Cancellation does not leave a stuck capture.
- [ ] Drag moves the Viro panel/scene transform, not artwork inside the Rive artboard.

## Cross-platform semantic rule

    gaze / pinch / touch / controller / D-pad
                     ↓
                Viro / ESIK
                     ↓
             surface hit testing
                     ↓
              panel-local UV
                     ↓
              native Rive runtime
                     ↓
              Viro GPU composition

A pinch and D-pad confirmation may activate the same UI semantic, but they remain distinct input sources. Do not emulate one device's hardware on another.

## Important boundary

This PR does not claim that ViroCore already has a first-class VRORiveNode. The current native architecture composes the native Rive surface through Viro's external-surface path. A true first-class render node would require deeper ViroCore integration with render sorting, bounds, hit testing, and renderer lifecycle.

## Merge gate

Record the static audit, TypeScript/unit tests, iOS device run, Android device run, Quest/XR run when applicable, Rive state-machine/data-binding test, and the input/drag matrix before treating this as device-validated.
