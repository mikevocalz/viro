# PICO floor-origin demo

`PicoFloorScene.tsx` demonstrates the `trackingOrigin` prop added for PICO
(and available on every OpenXR headset). Toggle **Eye level** / **Floor level**
and watch the cyan grid and the amber marker cube: in floor mode the grid sits
on the physical floor and the cube rests on it; in eye mode both float at head
height.

Scope: Workstream A (floor-level reference space) only. It does not draw
controller meshes or hand rays — those native halves are not implemented yet
(see the stop-and-ask list in the virocore `pico-support` branch), and drawing
them here would show something that does not exist.

The floor origin resolves per runtime:

- **PICO 4 Ultra** — native `XR_REFERENCE_SPACE_TYPE_LOCAL_FLOOR`.
- **Quest / PICO Neo3 / PICO 4** — a `LOCAL` space offset by the STAGE floor height.
- **Runtime with neither** — stays eye-level and logs the downgrade.

Requires the `pico-support` virocore AAR (the renderer half). Against an older
AAR the prop is a no-op and the scene stays eye-level.
