# Moyo Learn cross-platform layout reference

**Purpose:** capture the layout work already proven in `mikevocalz/moyolearn` so Viro platform expansion reuses it instead of inventing a second layout system.

**Reference snapshot:** Moyo Learn `main`, October 1, 2026.

This is a reference implementation, not a new dependency from Viro to Moyo. The reusable ideas should move into Viro or `viro-external` as small platform contracts; product-specific tutor/learner UI stays in Moyo.

## 1. The four rules Moyo already established

1. **The app window is a contract.** Meta/PICO system-window dimensions and orientation survive every config plugin and prebuild.
2. **Window size decides visibility.** Responsive pane count is based on the current window width, not product/device names.
3. **Physical geometry decides placement.** A hinge/fold moves an already-visible boundary; it does not invent product visibility policy.
4. **Immersive layout has one transform source of truth.** The visible panel, its input plane, chrome and drag carrier all derive from the same head-relative pose.

Those rules map cleanly onto the new Viro targets.

---

## 2. Existing Moyo files to treat as prior art

| Concern | Moyo source | What to reuse |
| --- | --- | --- |
| Meta + PICO window contract | `apps/mobile/plugins/with-spatial-window-contract.js` | Validate generated vendor manifests after every other config writer |
| Contract tests | `apps/mobile/plugins/__tests__/spatial-window-contract.test.cjs` | Fail prebuild when width, height or orientation silently changes |
| Meta/PICO app config | `apps/mobile/app.config.ts` | Meta 1024×640 system window; PICO Shared Space + WindowContainer; explicit immersive transition |
| Cross-platform panes | `packages/ui/adaptive-panes/README.md` | One renderer across native/web; width-class visibility; Inspector parity |
| Fold geometry | `packages/ui/adaptive-panes/fold-layout.ts` | iOS/Android physical-region normalization; single and multi-hinge plans |
| Fold native adapter | `packages/ui/adaptive-panes/use-fold-layout.native.ts` | Native region facts -> pure platform-independent layout math |
| Physical region type | `packages/ui/reserved-regions.types.ts` | One normalized division/occlusion record for UIKit + WindowManager |
| Persistent pane state | `packages/ui/adaptive-panes/store.ts` | Per-instance vanilla Zustand state survives fold/resize/remount |
| Spatial design tokens | `packages/ui/xr/premium/spatialTokens.ts` | Meter-based spacing, comfortable distance bands and a three-slot comfort arc |
| Head-relative transform | `packages/ui/xr/world-slot.ts` | Single transform helper for panel + input surfaces |
| Transform tests | `packages/ui/xr/world-slot.test.ts` | Test head translation/yaw math instead of judging screenshots |
| Real three-slot probe | `apps/mobile/src/native-3d/xr-layout-probe.tsx` | Rive left, live board center, avatar right; grouped drag carrier |
| Settled-pose placement | `apps/mobile/app/xr-layout-probe.tsx` | Do not latch the first camera frame; wait for a stable worn-head pose |

---

## 3. App-window contract: Meta and PICO

Moyo deliberately treats the headset's **2D/system window** as separate from the Viro world-space scene.

### Meta reference

Moyo configures the Horizon app window independently from immersive panels:

```ts
[
  "expo-horizon-core",
  {
    horizonAppId: process.env.HORIZON_APP_ID ?? "",
    supportedDevices: "quest2|questpro|quest3|quest3s",
    defaultWidth: "1024dp",
    defaultHeight: "640dp",
    disableVrHeadtracking: false,
    allowBackup: false,
  },
]
```

The important part is not those exact dimensions. It is that **dimensions are declared once and defended after prebuild**.

### PICO reference

Moyo starts PICO in Shared Space / WindowContainer rather than forcing an immersive launcher:

```ts
[
  "@expo-pico/core",
  {
    xrMode: "pico-os5",
    appType: "mr",
    buildVariant: "pico",
    spatialMode: "shared-space",
    defaultContainerMode: "window-container",
    targetProfile: "auto",
    targetDevices: ["pico-4", "pico-4-ultra"],
    handTracking: true,
    passthrough: true,
  },
]
```

The immersive Viro activity remains an explicit transition.

### The validation pattern

Moyo's `with-spatial-window-contract` runs after other Android writers and re-reads the generated vendor manifests:

```js
function validateWindow(manifest, options, label) {
  const app = manifest.manifest.application?.[0];
  const activity = app?.activity?.find(
    (item) => item.$?.["android:name"] === ".MainActivity"
  );

  for (const key of ["defaultWidth", "defaultHeight"]) {
    if (options[key] === undefined) continue;

    const actual =
      activity?.layout?.[0]?.$?.[`android:${key}`];

    if (actual !== options[key]) {
      throw new Error(
        `${label}: ${key} must stay ${options[key]}, got ${actual ?? "missing"}`
      );
    }
  }
}
```

### What moves into Viro

Add a generic platform-window contract to the Platform Lab:

```ts
export type PlatformWindowContract = {
  defaultWidth?: string;
  defaultHeight?: string;
  orientation?: "default" | "portrait" | "landscape";
  presentation:
    | "standard-window"
    | "shared-space-window"
    | "immersive";
};

export type GeneratedWindowEvidence = {
  backend: "meta-horizon" | "pico" | "android";
  width?: string;
  height?: string;
  orientation?: string;
};
```

Each vendor config plugin writes its own manifest format; the contract test verifies the result.

---

## 4. Responsive panes: width decides what may exist

Moyo's `AdaptivePanes` is already a cross-platform renderer for iOS, Android and web.

The key rule:

> **Collapse by current window width, never by device type.**

The current five bands are:

```text
compact     >=    0
medium      >=  600
expanded    >=  840
large       >= 1200
extraLarge  >= 1600
```

The hook reads the **window**, not a cached device dimension:

```ts
export function useWindowSizeClass(): WindowSizeClass {
  const { width } = useWindowDimensions();
  return windowSizeClassForWidth(width);
}
```

That automatically handles:

- phone rotation;
- Android multi-window;
- fold/unfold;
- desktop window resizing;
- headset system-window resizing.

### Viro generalization

Do not build separate "Quest layout", "PICO layout", "Vision Pro layout" and "glasses layout" policies when the issue is simply available surface size.

The shared layer should expose:

```ts
export type SpatialWindowClass =
  | "compact"
  | "medium"
  | "expanded"
  | "large"
  | "extraLarge";

export type PaneVisibilityPolicy = {
  primary: boolean;
  supplementary: boolean;
  detail: boolean;
  inspector: boolean;
};
```

A platform adapter reports the usable system-window extent; the same policy chooses the authored panes.

---

## 5. Physical regions: geometry decides where boundaries land

Moyo already normalizes physical display divisions across Apple and Android:

```ts
export interface ReservedRegion {
  kind: "division" | "occlusion";
  x: number;
  y: number;
  width: number;
  height: number;
  margins: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
  active: boolean;

  orientation?: "vertical" | "horizontal";
  state?: "flat" | "halfOpened";
  occlusionType?: "none" | "full";
  separating?: boolean;
}
```

Sources:

```text
UIKit reserved regions
        |
        +----> ReservedRegion
        |
Jetpack WindowManager FoldingFeature
```

Then pure layout math handles it.

### Important separation

Moyo's rule is excellent and should become a Viro invariant:

```text
window size class
      |
      +--> WHICH panes may be visible

physical region / hinge
      |
      +--> WHERE an already-visible boundary lands
```

A hinge never decides to hide tutor controls or reveal another pane.

### Multi-hinge/trifold

The Moyo planner preserves **every** fold and, when there are three authored panes, selects a usable pair of separating vertical hinges to put one pane in each physical region.

That is exactly the right design for future:

- dual-screen Android;
- trifold Android;
- vendor window segmentation;
- any future glasses display with multiple independently safe regions.

The common data structure should allow multiple regions from day one.

---

## 6. Inspector semantics are already solved

Moyo mirrors `SplitView.Inspector` semantics cross-platform:

```text
primary | supplementary | detail
                         [ inspector overlay ]
```

The Inspector:

- is an overlay, not a fourth tiled column;
- enters from logical trailing edge;
- flips for RTL;
- remains mounted/frozen when hidden;
- is constrained to the trailingmost physical region around hinges.

This maps nicely onto headset auxiliary panels.

Proposed shared intent:

```ts
export type SpatialSurfaceRole =
  | "primary"
  | "supplementary"
  | "detail"
  | "inspector";

export type SpatialSurfaceIntent = {
  id: string;
  role?: SpatialSurfaceRole;
  preferredPresentation:
    | "inline"
    | "system-window"
    | "spatial-web-element"
    | "immersive-scene"
    | "wearable-display";
  fallback: "inline" | "drop";
};
```

Meta `SpatialWindow`, PICO WebSpatial and ordinary DOM can each implement the same Inspector role differently.

---

## 7. State must survive presentation changes

Moyo's pane state is a **per-instance vanilla Zustand store**, not component-local state:

```ts
export function createAdaptivePanesStore() {
  return createStore((set) => ({
    column: null,
    primaryWidth: null,
    selectedId: null,

    setColumn: (column) => set({ column }),
    select: (id) => set({ selectedId: id }),
  }));
}
```

The important behavior:

```text
compact
  -> expanded
  -> fold / Activity recreation
  -> compact
```

still lands on the same logical pane and selected record.

For Viro platform adapters that means **presentation is not state ownership**.

Do not store application selection separately in:

- Meta SpatialWindow;
- PICO WindowContainer;
- WebSpatial Scene;
- Viro world panel;
- Specs Lens.

The adapter renders state; it does not own it.

---

## 8. Immersive layout: one comfort arc

Moyo's three-panel composition already has a reusable spatial model.

```text
                 child
                   o

     LEFT        CENTER        RIGHT
      \            |            /
       \           |           /
        +------ comfort arc ----+
                 R = 2.6m
```

The slot table is head-relative and meter-based:

```ts
export type PanelSlot = "left" | "center" | "right";

const ARC_RADIUS = 2.6;
const PANEL_AZIMUTH_DEG = 34;
const TOE_DEG = 3;
const SLOT_Y = -0.1;

const onArc = (azimuthDeg: number) => ({
  position: [
    ARC_RADIUS * Math.sin(rad(azimuthDeg)),
    SLOT_Y,
    -ARC_RADIUS * Math.cos(rad(azimuthDeg)),
  ] as [number, number, number],
  yaw: -azimuthDeg - Math.sign(azimuthDeg) * TOE_DEG,
});
```

Then one function turns a local slot with the user's current heading:

```ts
export function worldSlot(
  slot: PanelSlot,
  head: readonly [number, number, number],
  yawDeg: number
) {
  const { position, yaw } = SLOTS[slot];
  const [x, y, z] = xrRotateY(position, yawDeg);

  return {
    position: [
      head[0] + x,
      head[1] + y,
      head[2] + z,
    ] as [number, number, number],
    yaw: yaw + yawDeg,
  };
}
```

This should become the reference example for the new Viro Platform Lab.

---

## 9. Never duplicate a transform for input

The Moyo board probe demonstrates a subtle but critical rule.

The visible board, pointer/input surface, tray and drag grip are all children of **one carrier node**:

```tsx
<ViroNode
  ref={boardGroup}
  position={boardOffset?.position ?? [0, 0, 0]}
  rotation={boardOffset?.rotation ?? [0, 0, 0]}
>
  <VisibleBoard />
  <PointerSurface />
  <BoardTray />
  <DragGrip dragTransform="parent" />
</ViroNode>
```

Why: if artwork and its hit/input plane independently restate the world transform, a tiny yaw/offset disagreement becomes "the child drew here but the ink landed there."

The reusable invariant:

> A rendered interactive surface and the geometry that interprets its pointer coordinates must share a transform ancestor.

This applies to:

- Viro Rive panels;
- whiteboards;
- WebGPU canvases;
- Mux/video surfaces;
- future Specs model/panel adapters.

---

## 10. Placement waits for a settled wearer pose

Moyo already hit the hardware failure where the **first plausible head pose** was captured while the headset was still being handled.

The engineering probe samples until two observations are stable:

```ts
const SETTLE_MS = 350;
const SETTLE_TRAVEL_M = 0.2;
const SETTLE_TURN_DOT = 0.9;
```

Conceptually:

```ts
if (
  elapsed >= 350 &&
  distance(previous.position, current.position) < 0.2 &&
  dot(previous.forward, current.forward) > 0.9
) {
  placeWorkspace(current);
}
```

It also asks Viro for:

```tsx
<ViroXRSceneNavigator trackingOrigin="floor" />
```

so floor-relative avatar/board geometry is meaningful.

### Move this into reusable Viro tooling

The Platform Lab should gain a helper such as:

```ts
export type SettledPosePolicy = {
  sampleIntervalMs: number;
  maxTravelM: number;
  minForwardDot: number;
  samplesRequired: number;
};
```

This is useful on Quest, Meta VR Glasses and PICO without being product-specific.

---

## 11. Mapping Moyo's work to the new targets

### Meta VR Glasses

Reuse:

- Meta system-window contract from Moyo's Horizon setup;
- width-class pane behavior for Standard Android windows;
- Viro `worldSlot` comfort-arc logic for immersive scenes;
- settled-pose placement;
- capability-first gaze/hand input from the new OpenXR probe.

Do **not** branch layout on a reported Quest model.

### PICO native

Reuse:

- Shared Space + WindowContainer startup;
- explicit immersive transition;
- the same width/pane logic in the system window;
- Viro OpenXR comfort arc after entering XR.

### PICO OS 6 WebSpatial

Reuse the **same pane roles and sizing intent**, but map them into DOM/WebSpatial instead of React Native views:

```text
AdaptivePanes role          WebSpatial
------------------          ----------
primary                 -> main scene/window
supplementary           -> spatialized DOM region
detail                  -> spatialized DOM region
inspector               -> trailing auxiliary scene/element
```

Application selection/state stays in the shared store.

### Vision Pro

Reuse:

- current-window width policy for windowed content;
- the same Inspector role semantics;
- Viro immersive comfort arc when entering ImmersiveSpace;
- physical/reserved region normalization where Apple supplies it.

### Meta AI glasses

Only reuse **application intent/state**, not the immersive arc by default.

For display-capable glasses:

```text
detail / inspector content
        |
wearable-display adapter
```

For displayless glasses, the visual surface simply reports unsupported and the app uses audio/camera flows.

### Snap Specs

Reuse:

- portable pane/node roles;
- meter-based slot intent where a Lens scene needs three world panels;
- shared interaction semantics.

Lens Studio owns actual rendering and transform objects.

---

## 12. Proposed extraction sequence

Do not move Moyo product code directly into Viro. Extract the mechanisms in small pieces:

```text
Moyo prior art
   |
   +--> Viro / xr-contract
          |
          +-- SpatialSurfaceIntent / pane roles
          +-- capability states
          +-- platform window evidence
          +-- settled-pose policy
          +-- portable world-slot math
          |
          +--> vendor adapters
                Meta Layout
                PICO/WebSpatial
                Meta Wearables
                Snap Specs
```

### Keep in Moyo

- tutor/learner pane contents;
- Natalie;
- board toolbar commands;
- Moyo brand spatial tokens;
- learner selection/domain state;
- exact app window dimensions when they are product choices.

### Generalize outward

- validation patterns;
- layout roles;
- window/fold geometry contracts;
- carrier transform pattern;
- head-relative transform math;
- settled-pose placement;
- capability-first backend selection.

---

## 13. Platform Lab acceptance cases borrowed from Moyo

The Platform Lab should include these concrete regressions:

1. **Window contract:** vendor config plugin cannot silently replace declared width/height/orientation.
2. **Resize:** width class changes without losing selected content.
3. **Single fold:** visible boundary lands on hinge and no content straddles full occlusion.
4. **Trifold:** three authored panes map one per usable region.
5. **Inspector:** trailing overlay never crosses a separating hinge and respects RTL.
6. **XR yaw:** rotating the wearer rotates the entire three-slot workspace with them.
7. **XR height:** workspace remains at the same head-relative vertical offset seated or standing.
8. **Settled pose:** first transient head pose is ignored.
9. **Interactive carrier:** visible surface and pointer plane remain coincident during drag.
10. **Presentation switch:** Standard Android window -> immersive OpenXR -> window returns to the same application selection/state.

Those are stronger tests than a device-name matrix because they test the actual behavior we care about.
