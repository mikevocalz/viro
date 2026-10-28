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

## Typed actions reference flow

`SpecsActionsLab.tsx` is the select card → details → change setting → back
flow on a Zustand store. Each card and button fires a typed action through
`specsAction`; `bindSpecsActionsToStore` turns actions into state; the list
is a `specsScroll` group whose position the Lens restores on back. The
standalone Lens version is `ViroSpecsReferenceFlow` / `ViroSpecsActionsLab`
in `@viro-external/specs`. Guide: [docs/specs-actions.md](../../docs/specs-actions.md).
