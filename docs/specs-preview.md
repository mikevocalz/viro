# Specs web preview

`web-harness/specs-preview/` renders any Specs manifest or scene document in
the browser with three.js, using the same scene controller the Lens host
runs. Use it for design review before a Lens build. It is a preview, not a
Lens: see [What the preview does not show](#what-the-preview-does-not-show).

## Run it

```sh
cd web-harness/specs-preview
npm ci
npm run dev          # http://localhost:5173
```

The page opens the compiled Platform Lab. Other ways to load a scene:

| How | What it reads |
| --- | --- |
| Fixture picker | Platform Lab (scene document, manifest v2, manifest v1), the Platform Lab Navigation and Interaction scenes, the three reference apps (dashboard, model viewer, world-placed info), the all-fields manifest, an invalid manifest |
| File picker or drop | Any manifest v1/v2 or `viro-specs-compile --format scene-json` output |
| `?scene=<url>` | A manifest or scene document at that URL |
| `?watch=<url>` | Polls the URL each second; the first load presents, later changes go through `controller.update`, so untouched nodes keep their objects and scroll position. Point it at the `.scene.json` that [`viro-specs watch`](specs-watch.md) writes. |

Asset IDs in a manifest are paths relative to the viro checkout (the
compiler's convention). The dev server serves `examples/` and the Specs
fixtures read-only at `/viro-repo/`, so `examples/visionos-sweep/assets/shiba.glb`
loads. An asset that does not load gets the Lens placeholder and a `VS5003`
diagnostic, as in Lens. The `/viro-repo/` route exists only in the dev
server; a `vite build` of the pages needs a host that serves those paths,
or `PreviewAssetStore` options (`baseUrl`, `urls`) pointing elsewhere.

`gallery.html` shows one scene per primitive: transforms, text and text
style, image extents, GLB model, panel, polyline, materials and opacity,
lights, missing-asset placeholder, animation, interaction. viro has no
Storybook, so the gallery takes its place. Each card links into the preview.

## How it matches the Lens host

The preview does not reimplement the host. It vendors the Lens-global-free
part of `@viro-external/specs`, the files `tsconfig.lens-core.json` lists
there (`ViroSpecsSceneController`, the scene document reader, diagnostics,
resource cache, the action contract and runtime, the experience layer and
its tokens), and runs it against `ThreeSceneBackend`, a three.js
implementation of `ViroSpecsSceneBackend`.
Ordering, validation, diffs, placeholders and the `VS5xxx` diagnostics come
from the same code that runs in the Lens.

`ThreeSceneBackend` mirrors `ViroSpecsLensSceneBackend` method by method:

| Semantics | Lens host | Preview |
| --- | --- | --- |
| Units | Positions x100, Lens centimeters | Scene graph in centimeters, camera at the eye (origin) looking down -Z |
| Rotation | `[x, y, z, w]` to `quat(w, x, y, z)` | `Quaternion.set(x, y, z, w)` |
| Text | `size = fontSize` (or 48), layout rect from extents (default 72 x 8 cm), wrap with extents, `maxLines` box of `maxLines x size x 0.1` cm, truncated at the box | Same layout; glyph em `size / 43.886` cm (the type scale in the experience tokens), line advance 1.2 em, drawn to a canvas quad |
| Image | Child surface scaled to `extents x 100` cm | Same |
| Model | GLB prefab, scale 100 | `GLTFLoader`, `SkeletonUtils.clone`, scale 100 |
| Panel | UI Kit Frame, inner size = extents | Rounded frame quad sized by extents |
| Polyline | `VolumetricLine`, world-space points, radius `radiusMeters x 100` | `Line2` + `LineMaterial` in world units, width = 2 x radius |
| Materials | Owned clone: color, alpha = color alpha x opacity, base texture; `lightingModel` unmapped (VS5012) | Same, on `MeshStandardMaterial` |
| Opacity | Text fill alpha, image base color alpha, per-node model material clones | Same |
| Lights | Intensity = lumens / 1000; directional and spot aim along `direction` | `AmbientLight`, `DirectionalLight`, `PointLight`, `SpotLight` with targets |
| Placeholder | Box `w x h x d` cm, `d = min(w, h)` for models else 1 cm, tint (0.55, 0.6, 0.7, 0.6) | Same box and tint, plus edge lines |
| Animation | `AnimationPlayer`, cubic-bezier easing, from current value, position in meters, rotation in degrees | `AnimationMixer` clip sampled from the same bezier |
| Scroll group | ScrollWindow, content `y = 0` at the window top, `initialIndex` rows down, row snapping at `itemHeightMeters`, `scrollBy` clamped to the ends | Same position arithmetic; content clipped to the window with four planes; the mouse wheel calls `scrollByRows` |
| Interaction | SIK hover, select, drag; filtered by declared events | Pointer raycast; `source: "synthetic"`; manipulation drags in the camera plane |

`src/experience.ts` does for the experience layer what
`ViroSpecsExperienceHost` does in Lens, on the vendored
`ViroSpecsExperienceController`: token-colored backings on SpatialPanel and
PanelButton, panel titles, button labels with the check and error glyphs,
hover and press from `ViroSpecsButtonTracker` (scale and depth on the
backing), PanelText tone colors, the loading, notice, error and permission
panels placed 1.5 m along the view when they open, the `sceneVisible` gate
on the content root, and `VS5025` for premium features the host does not
draw (the vendored core draws all of them, so it reports none). The error panel's Retry fetches failed assets again and re-presents
the scene.

`src/backend/lensSemantics.ts` holds the copied constants.
`test/lensSemantics.test.ts` reads the vendored Lens backend source and
fails when one of them drifts.

## Tests

```sh
npm run typecheck    # strict
npm test             # Vitest, Node, no browser
npm run screenshot   # headless Chrome, writes screenshots/
npm run vendor:check # vendored files match VENDOR.json
```

`test/parity.test.ts` presents each input twice, on the viro-external mock
host (`scripts/support/mock-scene-host.mjs`, vendored) and on the three.js
backend, and compares node by node: IDs and parents, centimeter transforms,
quaternions, visibility, opacity, text, extents, bound assets,
placeholders, owned and borrowed materials, lights, polylines, interaction
bindings, running animations, and the host diagnostic codes. Inputs: the
compiled Platform Lab (scene document and manifest), the controller
round-trip document from viro-external, every valid manifest fixture, the
v1 fixture, an invalid manifest, each gallery primitive, the three
reference apps' compiled `scene.json`, the Navigation scroll group (row
step, initial position, `scrollByRows`, clamping, clipping), an update, a
scroll-keeping update and a navigation. `test/experience.test.ts` checks
the decorations against the default tokens, PanelButton hover, that the model
viewer raises no `VS5025`, and the no-fallback error panel.

`scripts/screenshot.mjs` also shoots the Navigation scene scrolled two
rows and with Card 2 hovered, through `window.__specsPreview.scrollByRows`
and `.hover`. The committed captures are in
[evidence/specs/web-preview/](evidence/specs/web-preview/).

Evidence label for all of this: portable-test-passed. Screenshots are
preview captures, not Lens captures.

## Updating the vendored host

```sh
node scripts/sync-lens-core.mjs --from /path/to/viro-external
npm test
```

`src/vendor/VENDOR.json` records the viro-external commit and a sha256 per
file. Do not edit vendored files; change them in viro-external and sync.

## What the preview does not show

- Lens rendering. Fonts, the UI Kit Frame look, `VolumetricLine` shading,
  lighting falloff and tone mapping differ. Point and spot lights use no
  distance falloff (Lens falloff is not modeled).
- Text metrics. Line breaks come from browser font metrics, so wrapping can
  differ from Lens Text by a word. Text with a `materialId` is tinted with
  the material color; Lens uses it as `customMaterial`.
- An image without extents is drawn 2 x 2 cm. The Lens Image quad's native
  size is not confirmed.
- Euler order for rotation animations. The preview uses XYZ; the Lens
  runtime's `toEulerAngles` order is not confirmed.
- The scroll window outline is a preview addition; the Lens backend adds no outline.
- Hand and gaze input, WorldQuery and placement. Pointer input stands in
  for SIK with `source: "synthetic"`, and the experience controller sees
  no capability report, so it stays in hands mode: no gaze dwell ring,
  gaze Move or Scroll buttons, or placement reticle.
- PanelText's minimum-size clamp by distance. Text keeps its compiled size.
- Lens Text line spacing. The preview assumes 1.2 em.

## What the preview shows that may be a host issue

These follow from the Lens adapter's numbers and are not confirmed in
Lens Studio Preview:

- A PanelButton's backing sits 0.5 cm in front of the button
  (`depth.raisedMeters`), and the compiler puts a card's PanelImage 0.3 cm
  in front. In the Navigation scene the backing covers the card images.
- Experience panels set no text layout rect, so a long body line (the
  asset error panel's "The rest of the scene works. Retry to load it
  again.") runs past the 20 degree backing.
- The Specs display window over the viewport assumes a 46 degree diagonal
  (Spectacles 2024) and a 1:1 aspect. It is a framing aid.
