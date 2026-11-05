import {
  Color,
  Group,
  LineBasicMaterial,
  LineLoop,
  BufferGeometry,
  GridHelper,
  PerspectiveCamera,
  Plane,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { PreviewNode } from "../backend/types";
import type { PreviewOverlayTarget } from "../experience";
import type { PreviewStage } from "../stage";

/** Eye height above the floor, cm. Content at y = 0 sits at eye level, as on Specs. */
const EYE_HEIGHT_CM = 150;
/** Comfort band from the Specs pack (section 2): 0.6 m to 3.0 m. */
const COMFORT_NEAR_CM = 60;
const COMFORT_FAR_CM = 300;

/** Renders a {@linkcode PreviewStage} with orbit controls and pointer input. */
export class PreviewViewport {
  readonly renderer: WebGLRenderer;
  readonly camera = new PerspectiveCamera(70, 1, 1, 5000);
  readonly controls: OrbitControls;
  private readonly room = new Group();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private hovered: PreviewNode | null = null;
  private pressed: PreviewNode | null = null;
  private dragging: { node: PreviewNode; plane: Plane; offset: Vector3 } | null = null;
  private stage: PreviewStage | null = null;
  private last = performance.now();
  private hoveredOverlay: PreviewOverlayTarget | null = null;
  private pressedOverlay: PreviewOverlayTarget | null = null;
  private wheelRows = 0;
  /** Called with a short description of each input event the preview sends. */
  onInput: ((line: string) => void) | null = null;
  /** Experience-layer targets (panel actions); they take the pointer before scene nodes. */
  overlayTargets: () => readonly PreviewOverlayTarget[] = () => [];
  /** Called once per rendered frame, before rendering. */
  onFrame: (() => void) | null = null;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.resetView();
    this.buildRoom();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.bindPointer();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Puts the camera at the wearer's eye (origin) looking down -Z at the content band. */
  resetView(): void {
    this.camera.position.set(0, 0, 0.01);
    this.controls.target.set(0, 0, -120);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  show(stage: PreviewStage): void {
    this.stage?.scene.remove(this.room);
    this.stage = stage;
    stage.scene.background = new Color("#2b313a");
    stage.scene.add(this.room);
  }

  private buildRoom(): void {
    const floor = new GridHelper(800, 40, 0x56606e, 0x3a424e);
    floor.position.y = -EYE_HEIGHT_CM;
    this.room.add(floor);
    for (const [radius, color] of [[COMFORT_NEAR_CM, 0x2e9cc0], [COMFORT_FAR_CM, 0x2e9cc0]] as const) {
      const points: Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = Math.PI + (i / 64) * Math.PI;
        points.push(new Vector3(Math.cos(a) * radius, -EYE_HEIGHT_CM + 0.5, Math.sin(a) * radius));
      }
      const arc = new LineLoop(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color, transparent: true, opacity: 0.55 }));
      arc.name = "comfort-band-" + radius;
      this.room.add(arc);
    }
    this.room.name = "preview-room";
    this.room.traverse((o: Object3D) => {
      o.raycast = () => undefined;
    });
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.stage) return;
    const size = this.renderer.getSize(new Vector2());
    this.stage.step(dt, size.x, size.y);
    this.onFrame?.();
    this.controls.update();
    this.renderer.render(this.stage.scene, this.camera);
  }

  private pick(event: PointerEvent): { node: PreviewNode; point: Vector3; normal: Vector3 | undefined } | null {
    if (!this.stage) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.stage.backend.interactables();
    const hits = this.raycaster.intersectObjects(targets.map((n) => n.object), true);
    for (const hit of hits) {
      let o: Object3D | null = hit.object;
      while (o) {
        const node = targets.find((n) => n.object === o);
        if (node) return { node, point: hit.point, normal: hit.face?.normal.clone().transformDirection(hit.object.matrixWorld) };
        o = o.parent;
      }
    }
    return null;
  }

  private pickOverlay(event: PointerEvent | WheelEvent): PreviewOverlayTarget | null {
    this.setRay(event);
    const targets = this.overlayTargets();
    const hit = this.raycaster.intersectObjects(targets.map((t) => t.object), false)[0];
    return hit ? targets.find((t) => t.object === hit.object) ?? null : null;
  }

  private setRay(event: PointerEvent | WheelEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  /** The nearest scroll group whose window rectangle is under the pointer. */
  private pickScroll(event: WheelEvent): PreviewNode | null {
    if (!this.stage) return null;
    this.setRay(event);
    let best: { node: PreviewNode; distance: number } | null = null;
    for (const node of this.stage.backend.liveHandles()) {
      if (!node.scroll || !isShown(node.object)) continue;
      node.object.updateWorldMatrix(true, false);
      const origin = node.object.getWorldPosition(new Vector3());
      const normal = new Vector3(0, 0, 1).transformDirection(node.object.matrixWorld);
      const hit = this.raycaster.ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(normal, origin), new Vector3());
      if (!hit) continue;
      const local = node.object.worldToLocal(hit);
      const halfWidthCm = (node.scroll.spec.width * 100) / 2;
      const halfHeightCm = (node.scroll.spec.height * 100) / 2;
      if (Math.abs(local.x) > halfWidthCm || Math.abs(local.y) > halfHeightCm) continue;
      const distance = origin.distanceTo(this.camera.position);
      if (!best || distance < best.distance) best = { node, distance };
    }
    return best?.node ?? null;
  }

  private send(node: PreviewNode, phase: Parameters<PreviewStage["backend"]["deliverInteraction"]>[1]["phase"], point?: Vector3, normal?: Vector3): void {
    if (!this.stage) return;
    const toMeters = (v: Vector3): [number, number, number] => [v.x / 100, v.y / 100, v.z / 100];
    const dir = this.raycaster.ray.direction;
    this.stage.backend.deliverInteraction(node, {
      phase,
      source: "synthetic",
      ...(point ? { position: toMeters(point) } : {}),
      ...(normal ? { normal: [normal.x, normal.y, normal.z] as [number, number, number] } : {}),
      direction: [dir.x, dir.y, dir.z],
    });
    this.onInput?.(phase + " " + node.id);
  }

  private bindPointer(): void {
    const el = this.renderer.domElement;
    el.addEventListener("pointermove", (event) => {
      if (this.dragging) {
        const { node, plane, offset } = this.dragging;
        this.pick(event); // updates the ray for this pointer position
        const hit = this.raycaster.ray.intersectPlane(plane, new Vector3());
        if (hit && node.object.parent) {
          // Preview stand-in for SIK manipulation: move the node in the camera plane.
          node.object.position.copy(node.object.parent.worldToLocal(hit.clone().add(offset)));
          this.send(node, "drag", hit);
        }
        return;
      }
      const overlay = this.pickOverlay(event);
      if (overlay !== this.hoveredOverlay) {
        this.hoveredOverlay?.handle("hover-exit");
        this.hoveredOverlay = overlay;
        overlay?.handle("hover-enter");
      }
      if (overlay) {
        if (this.hovered) this.send(this.hovered, "hover-exit");
        this.hovered = null;
        el.style.cursor = "pointer";
        return;
      }
      const hit = this.pick(event);
      if (hit?.node !== this.hovered) {
        if (this.hovered) this.send(this.hovered, "hover-exit");
        this.hovered = hit?.node ?? null;
        if (hit) this.send(hit.node, "hover-enter", hit.point, hit.normal);
        el.style.cursor = hit ? "pointer" : "";
      } else if (hit) {
        this.stage?.backend.deliverInteraction(hit.node, { phase: "hover-move", source: "synthetic", position: [hit.point.x / 100, hit.point.y / 100, hit.point.z / 100] });
      }
    });
    el.addEventListener("pointerdown", (event) => {
      const overlay = this.pickOverlay(event);
      if (overlay) {
        this.controls.enabled = false;
        this.pressedOverlay = overlay;
        overlay.handle("select-start");
        this.onInput?.("select-start " + overlay.label);
        el.setPointerCapture(event.pointerId);
        return;
      }
      const hit = this.pick(event);
      if (!hit) return;
      this.controls.enabled = false;
      this.pressed = hit.node;
      this.send(hit.node, "select-start", hit.point, hit.normal);
      if (hit.node.interaction?.spec.manipulation) {
        const normal = this.camera.getWorldDirection(new Vector3());
        const plane = new Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
        const origin = hit.node.object.getWorldPosition(new Vector3());
        this.dragging = { node: hit.node, plane, offset: origin.sub(hit.point) };
      }
      el.setPointerCapture(event.pointerId);
    });
    const end = (phase: "select-end" | "cancel"): void => {
      const overlay = this.pressedOverlay;
      this.pressedOverlay = null;
      if (overlay) {
        this.controls.enabled = true;
        overlay.handle(phase);
        this.onInput?.(phase + " " + overlay.label);
        return;
      }
      const node = this.pressed;
      this.pressed = null;
      this.dragging = null;
      this.controls.enabled = true;
      if (node) this.send(node, phase);
    };
    el.addEventListener("pointerup", () => end("select-end"));
    // Wheel over a scroll group steps it by rows through the controller, as
    // the Lens gaze Scroll buttons do; elsewhere the wheel zooms the camera.
    el.addEventListener(
      "wheel",
      (event) => {
        const node = this.pickScroll(event);
        if (!node || !this.stage) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.wheelRows += event.deltaY / 100;
        const rows = Math.trunc(this.wheelRows);
        if (rows === 0) return;
        this.wheelRows -= rows;
        if (this.stage.controller.scrollByRows(node.id, rows)) this.onInput?.("scroll " + node.id + " " + (rows > 0 ? "+" : "") + rows + " rows");
      },
      { passive: false, capture: true }
    );
    el.addEventListener("pointercancel", () => end("cancel"));
  }
}

/** True when `object` and all its ancestors are visible. */
function isShown(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}
