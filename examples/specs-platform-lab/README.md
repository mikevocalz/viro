# Cross-platform Specs Platform Lab

This example deliberately uses the same Viro JSX for both native ViroCore
targets and the validated SPECS 27 Lens backend.

It exercises:

- group hierarchy;
- text;
- GLB model;
- stable `viroTag` identifiers;
- click/select;
- drag;
- registered Viro animation;
- ViroPolyline.

The SPECS transport is supplied by the app/backend integration. On Quest, PICO,
visionOS and other ViroCore targets the `ViroSpecsScene` wrapper simply renders
its children.

The canonical Lens Studio validation remains in `@viro-external/specs`, where
LEAF covers the actual Lens execution path.
