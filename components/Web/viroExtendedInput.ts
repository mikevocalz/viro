import type {
  ViroHandle,
  ViroWebRenderer,
} from "@reactvision/viro-web-renderer";

type Vec3 = [number, number, number];

export type ExtendedWebNodeHandlers = {
  onClick?: (clickState: number, source: number, position: Vec3) => void;
  onHover?: (isHovering: boolean, source: number, position: Vec3) => void;
  onScroll?: (source: number, delta: Vec3) => void;
  onDrag?: (source: number, position: Vec3) => void;
  onPinch?: (source: number, scaleFactor: number, pinchState: number) => void;
};

type ExtendedWebModule = {
  viroSetEventCallback?: (
    callback: (
      handle: number,
      action: number,
      source: number,
      intArg: number,
      x: number,
      y: number,
      z: number,
    ) => void,
  ) => void;
  viroOnTouch?: (action: number, x: number, y: number) => void;
  viroOnPinch?: (scaleFactor: number, state: number) => void;
  viroOnScroll?: (x: number, y: number) => void;
  viroSetNodeDragConfig?: (
    handle: number,
    dragType: number,
    pointX: number,
    pointY: number,
    pointZ: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    maxDistance: number,
  ) => void;
};

type ExtendedState = {
  handlers: Map<ViroHandle, ExtendedWebNodeHandlers>;
};

const installed = new WeakMap<ViroWebRenderer, ExtendedState>();

function distance(a: PointerEvent, b: PointerEvent): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Adds the event actions the published web renderer does not yet understand:
 * Viro OnDrag (8) and OnPinch (10).
 *
 * The WASM binary remains feature-detected so a JS bundle can still load
 * against an older renderer; those two capabilities simply stay unavailable.
 */
export function installExtendedWebInput(renderer: ViroWebRenderer): ExtendedState {
  const existing = installed.get(renderer);
  if (existing) return existing;

  const handlers = new Map<ViroHandle, ExtendedWebNodeHandlers>();
  const state: ExtendedState = { handlers };
  installed.set(renderer, state);

  const module = renderer.wasmModule as unknown as ExtendedWebModule;
  const originalSet = renderer.setNodeEventHandlers.bind(renderer);
  const originalClear = renderer.clearNodeEventHandlers.bind(renderer);

  // Keep the renderer's public registration methods useful after replacing the
  // WASM callback. React-Viro and direct renderer users both flow into this map.
  renderer.setNodeEventHandlers = ((handle: ViroHandle, next: unknown) => {
    handlers.set(handle, next as ExtendedWebNodeHandlers);
    originalSet(handle, next as never);
  }) as typeof renderer.setNodeEventHandlers;

  renderer.clearNodeEventHandlers = ((handle: ViroHandle) => {
    handlers.delete(handle);
    originalClear(handle);
  }) as typeof renderer.clearNodeEventHandlers;

  // Nodes that registered before this install went only into the renderer's
  // own map. Replacing the WASM callback below would silently drop their click
  // and hover events, so fall back to that map for any handle missing here.
  const rendererHandlers = (renderer as unknown as {
    eventHandlers?: Map<ViroHandle, ExtendedWebNodeHandlers>;
  }).eventHandlers;

  module.viroSetEventCallback?.((handle, action, source, intArg, x, y, z) => {
    const nodeHandlers = handlers.get(handle) ?? rendererHandlers?.get(handle);
    if (!nodeHandlers) return;

    const position: Vec3 = [x, y, z];
    switch (action) {
      case 1:
        nodeHandlers.onHover?.(intArg === 1, source, position);
        break;
      case 2:
        nodeHandlers.onClick?.(intArg, source, position);
        break;
      case 7:
        nodeHandlers.onScroll?.(source, position);
        break;
      case 8:
        nodeHandlers.onDrag?.(source, position);
        break;
      case 10:
        nodeHandlers.onPinch?.(source, x, intArg);
        break;
    }
  });

  const canvas = renderer.canvasElement;

  // Browser wheel / trackpad -> Viro OnScroll. Refresh the hit ray at the
  // pointer location first so scrolling targets the panel actually under the
  // cursor, not the node last clicked.
  if (module.viroOnScroll && module.viroOnTouch) {
    const onWheel = (event: WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      module.viroOnTouch?.(1, x, y);
      module.viroOnScroll?.(event.deltaX, event.deltaY);
      event.preventDefault();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
  }

  // Browser two-pointer pinch -> Viro's existing native pinch pipeline.
  // Single-pointer dragging is already fed by ViroWebRenderer's pointer events.
  if (module.viroOnPinch) {
    const pointers = new Map<number, PointerEvent>();
    let pinchStartDistance: number | null = null;
    let lastScale = 1;

    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, event);
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Some synthetic/browser pointer implementations do not support capture.
      }

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        if (!a || !b) return;
        pinchStartDistance = Math.max(1, distance(a, b));
        lastScale = 1;
        module.viroOnPinch?.(1, 1);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, event);
      if (pointers.size !== 2 || pinchStartDistance == null) return;

      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      lastScale = distance(a, b) / pinchStartDistance;
      module.viroOnPinch?.(lastScale, 2);
    };

    const finishPointer = (event: PointerEvent) => {
      const wasPinching = pinchStartDistance != null && pointers.size >= 2;
      pointers.delete(event.pointerId);
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // See setPointerCapture above.
      }
      if (wasPinching && pointers.size < 2) {
        module.viroOnPinch?.(lastScale, 3);
        pinchStartDistance = null;
        lastScale = 1;
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", finishPointer);
    canvas.addEventListener("pointercancel", finishPointer);
  }

  return state;
}

/**
 * The renderer bindings each extended input needs. All three arrived together in
 * mikevocalz/virocore#79, so a renderer missing one is missing all of them.
 */
const REQUIRED_EXPORTS = {
  drag: "viroSetNodeDragConfig",
  pinch: "viroOnPinch",
  scroll: "viroOnScroll",
} as const;

export type ExtendedInputKind = keyof typeof REQUIRED_EXPORTS;

/** Which of the requested inputs the loaded renderer cannot deliver. */
export function missingWebInput(
  renderer: ViroWebRenderer,
  wanted: readonly ExtendedInputKind[],
): ExtendedInputKind[] {
  const module = renderer.wasmModule as unknown as Record<string, unknown>;
  return wanted.filter((kind) => typeof module[REQUIRED_EXPORTS[kind]] !== "function");
}

const warned = new WeakSet<ViroWebRenderer>();

/**
 * Warn once per renderer when a node asks for drag, pinch or scroll that the
 * loaded binary cannot deliver. Without this the props are accepted and then
 * nothing happens, which is what @reactvision/viro-web-renderer 1.0.1 does.
 * Returns true if it warned.
 */
export function warnIfWebInputUnavailable(
  renderer: ViroWebRenderer,
  wanted: readonly ExtendedInputKind[],
): boolean {
  if (wanted.length === 0 || warned.has(renderer)) return false;
  const missing = missingWebInput(renderer, wanted);
  if (missing.length === 0) return false;
  warned.add(renderer);
  console.warn(
    `[Viro web] ${missing.join(", ")} input is off: the loaded WASM renderer has no ` +
      missing.map((kind) => REQUIRED_EXPORTS[kind]).join(", ") +
      ". Serve the renderer shipped in @reactvision/react-viro/web/renderer and pass " +
      "webRendererOptions={{ assetBaseUrl }} pointing at it. See docs/WEB_PANEL_INPUT_PARITY.md.",
  );
  return true;
}

export type WebDragConfig = {
  dragType?: "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane" | "Gizmo";
  dragPlane?: {
    planePoint: Vec3;
    planeNormal: Vec3;
    maxDistance: number;
  };
};

export function configureWebDrag(
  renderer: ViroWebRenderer,
  handle: ViroHandle,
  config: WebDragConfig,
): boolean {
  const module = renderer.wasmModule as unknown as ExtendedWebModule;
  if (!module.viroSetNodeDragConfig || config.dragType === "Gizmo") return false;

  const dragType = (() => {
    switch (config.dragType) {
      case "FixedDistanceOrigin": return 1;
      case "FixedToPlane": return 2;
      case "FixedToWorld": return 3;
      case "FixedDistance":
      default:
        return 0;
    }
  })();

  const point = config.dragPlane?.planePoint ?? [0, 0, 0];
  const normal = config.dragPlane?.planeNormal ?? [0, 0, 0];
  const maxDistance = config.dragPlane?.maxDistance ?? 1000;

  module.viroSetNodeDragConfig(
    handle,
    dragType,
    point[0],
    point[1],
    point[2],
    normal[0],
    normal[1],
    normal[2],
    maxDistance,
  );
  return true;
}
