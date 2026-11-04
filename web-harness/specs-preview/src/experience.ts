import { Box3, Group, Mesh, MeshBasicMaterial, Quaternion, SRGBColorSpace, Vector3, type Camera, type Object3D } from "three";
import { CM_PER_METER } from "./backend/lensSemantics";
import { layoutText, type Rgba } from "./backend/textLayout";
import { textBounds, type TextRasterizer } from "./backend/textRaster";
import type { PreviewNode } from "./backend/types";
import { createRoundedSurface, createTextMesh } from "./backend/visuals";
import type { PreviewStage } from "./stage";
import {
  layoutViroSpecsButtonError,
  layoutViroSpecsModelReset,
  layoutViroSpecsStatePanel,
  resolveViroSpecsButtonVisual,
  unrenderedViroSpecsComponentFeatures,
  viroSpecsAutoRotateDegrees,
  viroSpecsShowModelRing,
  viroSpecsLoadingRing,
  viroSpecsResetProgress,
  ViroSpecsButtonTracker,
  ViroSpecsExperienceController,
  type ViroSpecsExperienceView,
  type ViroSpecsLineMeasure,
  type ViroSpecsStatePanelLayout,
  type ViroSpecsSceneRequirements,
  type ViroSpecsTextBlock,
} from "./vendor/lens-core/ViroSpecsExperience";
import {
  viroSpecsAngleToMeters,
  VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE,
  type ViroSpecsButtonAuthoredState,
  type ViroSpecsSpatialTokens,
} from "./vendor/lens-core/ViroSpecsExperienceTokens";
import { formatViroSpecsCopy } from "./vendor/lens-core/ViroSpecsExperienceCopy";
import { createViroSpecsHostDiagnostic } from "./vendor/lens-core/ViroSpecsHostDiagnostics";
import type { ViroSpecsCapabilityState, ViroSpecsInteractionPhase } from "./vendor/lens-core/ViroSpecsProtocol";
import { parseViroSpecsColor } from "./vendor/lens-core/ViroSpecsSceneDocument";

/** Construction options for {@linkcode PreviewExperience}. */
export interface PreviewExperienceOptions {
  readonly stage: PreviewStage;
  readonly rasterizer: TextRasterizer;
  /** The wearer's eye; panels open in front of it and text sizes use the distance to it. */
  readonly camera: Camera;
  /** @default `{ placement: false, gazeOnly: true }`, the Lens host's inspector defaults. */
  readonly requirements?: ViroSpecsSceneRequirements;
  /** Shows unverified notices and diagnostic lines, as a Lens debug build does. @default false */
  readonly builderMode?: boolean;
  readonly nowMs?: () => number;
}

/** A pointer target the experience layer owns (a panel action), for {@linkcode PreviewViewport}. */
export interface PreviewOverlayTarget {
  readonly object: Object3D;
  readonly label: string;
  handle(phase: ViroSpecsInteractionPhase): void;
}

type PanelKey = "loading" | "notice" | "error" | "permission";

interface Decoration {
  readonly type: "spatial-panel" | "panel-button" | "panel-text";
  readonly object: Object3D;
  readonly backing: Mesh | null;
  readonly label: Mesh | null;
  readonly extra: Mesh | null;
}

interface Panel {
  readonly root: Group;
  readonly backing: Mesh;
  readonly title: Mesh;
  readonly body: Mesh;
  readonly detail: Mesh;
  readonly action: Group;
  readonly actionBacking: Mesh;
  readonly actionText: Mesh;
  /** Loading ring: {@linkcode RING_SEGMENTS} quads, turned as one group. */
  readonly ring: Group;
  readonly segments: readonly Mesh[];
  hovered: boolean;
  pressed: boolean;
  open: boolean;
  /** `nowMs` when the panel last opened; the spinning ring's clock. */
  shownAtMs: number;
  /** The ring row from the last layout, for the per-frame spin. */
  ringLayout: ViroSpecsStatePanelLayout["ring"];
}

/** A ModelViewer's host-drawn parts (Lens `ModelDecoration`): load ring, Reset model button, turntable state. */
interface ModelDecoration {
  readonly object: Object3D;
  readonly ring: Group;
  readonly segments: readonly Mesh[];
  readonly reset: { readonly root: Group; readonly backing: Mesh; readonly label: Mesh } | null;
  /** Authored local transform, preview units (cm), from the committed node. */
  readonly authored: { readonly position: Vector3; readonly quaternion: Quaternion; readonly scale: Vector3 };
  /** Bottom of the model's bounds below its origin, meters (negative is below), once measured. */
  bottomMeters: number | undefined;
  /** A Reset in progress: when it started and the transform it started from. */
  resetting: { readonly startMs: number; readonly position: Vector3; readonly quaternion: Quaternion; readonly scale: Vector3 } | null;
  readonly pendingSinceMs: number;
}

/** Ring geometry: diameter and stroke, meters. */
type RingSize = { readonly diameterMeters: number; readonly thicknessMeters: number };

const PANEL_KEYS: readonly PanelKey[] = ["loading", "notice", "error", "permission"];

/**
 * Render order of the experience overlay, the Lens adapter's `OVERLAY_ORDER`:
 * backings, then controls (action backing, ring), then text. Overlay meshes
 * also turn depth test and depth write off, so scene content never covers a
 * state panel.
 */
const OVERLAY_ORDER = { backing: 100, control: 101, text: 102 } as const;

/** Segments in the loading ring, as in the Lens adapter. */
const RING_SEGMENTS = 24;

/**
 * The Lens experience layer (`ViroSpecsExperienceHost`) on three.js. It runs
 * the vendored {@linkcode ViroSpecsExperienceController}, so the loading,
 * degraded, error and permission panels, PanelButton states and the
 * `sceneVisible` gate come from the same code the Lens runs. This class only
 * draws: what the Lens adapter does with Lens Text and RenderMeshVisual, it
 * does with canvas text quads and rounded planes.
 *
 * Not drawn here, as in the Lens adapter without its gaze path: the gaze
 * dwell ring, gaze Move/Scroll buttons and the placement reticle. The
 * preview's input is the pointer, which the controller reads as hands.
 */
export class PreviewExperience {
  readonly controller: ViroSpecsExperienceController;
  readonly tracker: ViroSpecsButtonTracker;
  readonly overlay = new Group();
  private readonly decorations = new Map<string, Decoration>();
  private readonly models = new Map<string, ModelDecoration>();
  /** ModelViewers the wearer is holding or dragging; autoRotate pauses for them. */
  private readonly heldModels = new Set<string>();
  /** `nowMs` at the previous {@linkcode update}, for the turntable's frame time. */
  private lastUpdateMs: number | undefined;
  private readonly panels = new Map<PanelKey, Panel>();
  private readonly reportedUnrendered = new Set<string>();
  private readonly measuredLines = new Map<string, number>();
  private decoratedScene: unknown = null;
  private lastView: ViroSpecsExperienceView;
  private readonly stage: PreviewStage;

  constructor(private readonly options: PreviewExperienceOptions) {
    this.stage = options.stage;
    const controller = options.stage.controller;
    this.overlay.name = "viro-specs-experience-overlay";
    options.stage.scene.add(this.overlay);
    this.controller = new ViroSpecsExperienceController({
      requirements: options.requirements ?? { placement: false, gazeOnly: true },
      diagnostics: controller.diagnostics,
      nowMs: options.nowMs ?? (() => performance.now()),
      builderMode: options.builderMode ?? false,
    });
    this.controller.attach(controller);
    this.tracker = new ViroSpecsButtonTracker((id) => this.authoredState(id));
    controller.addOnInteractionListener((event) => {
      this.tracker.handle(event);
      if (event.phase === "select-start" || event.phase === "drag") this.heldModels.add(event.nodeId);
      else if (event.phase === "select-end" || event.phase === "cancel") this.heldModels.delete(event.nodeId);
    });
    controller.addOnLifecycleListener(() => this.decorate());
    this.lastView = this.controller.view();
    this.controller.addOnViewListener((view) => this.render(view));
    this.render(this.lastView);
    this.decorate();
  }

  /** Capability report, as the Lens runtime would send it; switches input mode and notices. */
  setCapabilities(report: Readonly<Record<string, ViroSpecsCapabilityState>>): void {
    this.controller.setCapabilities(report);
  }

  /** The last view the controller produced. */
  get view(): ViroSpecsExperienceView {
    return this.lastView;
  }

  /** Visible panel actions the viewport can hover and press. */
  targets(): PreviewOverlayTarget[] {
    const out: PreviewOverlayTarget[] = [];
    for (const key of PANEL_KEYS) {
      const panel = this.panels.get(key);
      if (!panel?.open || !panel.action.visible) continue;
      out.push({ object: panel.actionBacking, label: key + " action", handle: (phase) => this.panelInput(key, panel, phase) });
    }
    for (const [id, model] of this.models) {
      if (!model.reset?.root.visible) continue;
      // Lens `makeSceneButton`: a select-end resets.
      out.push({ object: model.reset.backing, label: id + " reset", handle: (phase) => phase === "select-end" && this.resetModel(id) });
    }
    return out;
  }

  /** Per frame: time rules, re-decoration after a same-state replacement, button styling. */
  update(): void {
    this.controller.tick();
    const scene = this.stage.controller.committedScene;
    if (scene !== this.decoratedScene) this.decorate();
    this.styleDecorations(this.lastView.tokens);
    // A spinning ring (unknown progress) moves without a view change.
    const loading = this.panels.get("loading");
    if (loading?.open && this.lastView.loading.visible === true && this.lastView.loading.indicator === "ring-spin") {
      this.drawRing(loading, this.lastView.tokens);
    }
    const now = this.nowMs();
    const deltaSeconds = this.lastUpdateMs === undefined ? 0 : (now - this.lastUpdateMs) / 1000;
    this.lastUpdateMs = now;
    this.drawModels(this.lastView, now, deltaSeconds);
  }

  /** Starts returning a ModelViewer to its authored transform over `motion.base` (Lens `resetModel`). */
  resetModel(nodeId: string): void {
    const model = this.models.get(nodeId);
    if (!model) return;
    const o = model.object;
    model.resetting = { startMs: this.nowMs(), position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() };
  }

  private authoredState(id: string): ViroSpecsButtonAuthoredState | undefined {
    const node = this.stage.controller.committedScene?.nodes.find((n) => n.id === id);
    return node?.component?.type === "panel-button" ? node.component.state : undefined;
  }

  private handle(id: string): PreviewNode | null {
    const node = this.stage.controller.getNodeHandle(id);
    return node && node.alive ? node : null;
  }

  /** Backings, titles and labels for committed premium nodes (Lens `decorate`). */
  private decorate(): void {
    const scene = this.stage.controller.committedScene;
    this.decoratedScene = scene;
    const live = new Set<string>();
    if (scene) {
      for (const node of scene.nodes) {
        const component = node.component;
        if (!component) continue;
        const missing = unrenderedViroSpecsComponentFeatures(component);
        const key = node.id + ":" + component.type;
        if (missing.length > 0 && !this.reportedUnrendered.has(key)) {
          this.reportedUnrendered.add(key);
          this.stage.controller.diagnostics.report(
            createViroSpecsHostDiagnostic("VS5025", "experience", node.id + " (" + component.type + "): not drawn yet: " + missing.join(", ") + ".", { nodeId: node.id })
          );
        }
        if (component.type === "model-viewer") {
          const handle = this.handle(node.id);
          if (!handle) continue;
          live.add(node.id);
          if (this.models.get(node.id)?.object !== handle.object) {
            this.removeModel(node.id);
            this.models.set(node.id, this.createModel(node.id, handle.object, node.position, node.rotation, node.scale, component.resettable));
          }
          continue;
        }
        if (component.type !== "spatial-panel" && component.type !== "panel-button" && component.type !== "panel-text") continue;
        const handle = this.handle(node.id);
        if (!handle) continue;
        live.add(node.id);
        const existing = this.decorations.get(node.id);
        if (existing?.object === handle.object) continue;
        if (existing) this.removeDecoration(existing);
        const extents = node.kind === "panel" ? node.extents : undefined;
        const heightCm = extents ? extents.height * CM_PER_METER : 0;
        let backing: Mesh | null = null;
        let label: Mesh | null = null;
        let extra: Mesh | null = null;
        if (component.type !== "panel-text" && extents) {
          // Unit rounded quad scaled to the node; scale and depth carry hover, as on Lens.
          backing = createRoundedSurface(1, 1, 0.08, "viro-experience-backing:" + node.id);
          backing.scale.set(extents.width * CM_PER_METER, heightCm, 1);
          handle.object.add(backing);
        }
        if (component.type === "spatial-panel" && component.title !== undefined) {
          extra = this.addText(handle.object, "viro-experience-title:" + node.id, heightCm / 2 - 4);
        }
        if (component.type === "panel-button") {
          if (component.errorMessage !== undefined) extra = this.addText(handle.object, "viro-experience-error:" + node.id, -heightCm);
          label = this.addText(handle.object, "viro-experience-label:" + node.id, 0);
        }
        this.decorations.set(node.id, { type: component.type, object: handle.object, backing, label, extra });
      }
    }
    for (const [id, decoration] of Array.from(this.decorations)) {
      if (!live.has(id)) {
        this.removeDecoration(decoration);
        this.decorations.delete(id);
      }
    }
    for (const id of Array.from(this.models.keys())) {
      if (!live.has(id)) this.removeModel(id);
    }
    this.tracker.retain(new Set(this.stage.controller.nodeIds));
  }

  private addText(parent: Object3D, name: string, yCm: number): Mesh {
    const mesh = createTextMesh();
    mesh.name = name;
    mesh.position.set(0, yCm, 0.6);
    mesh.userData.anchorYCm = yCm;
    parent.add(mesh);
    return mesh;
  }

  private removeDecoration(decoration: Decoration): void {
    for (const mesh of [decoration.backing, decoration.label, decoration.extra]) {
      if (!mesh) continue;
      mesh.removeFromParent();
      mesh.geometry.dispose();
      const material = mesh.material as MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
    }
  }

  /** Token colors, button states and label sizes on decorated nodes (Lens `styleDecorations`). */
  private styleDecorations(tokens: ViroSpecsSpatialTokens): void {
    const scene = this.stage.controller.committedScene;
    if (!scene) return;
    for (const node of scene.nodes) {
      const decoration = this.decorations.get(node.id);
      const component = node.component;
      const handle = this.handle(node.id);
      if (!decoration || !component || !handle) continue;
      const distance = this.distanceToWearer(handle.object);
      if (component.type === "spatial-panel") {
        if (decoration.backing) setFill(decoration.backing, tokens.color.surface, tokens.opacity.surface);
        if (decoration.extra && component.title !== undefined) {
          // One title line tall, wrapped at the panel less space.md each side (Lens `wrapText`).
          const box =
            node.kind === "panel" && node.extents
              ? {
                  widthCm: (node.extents.width - 2 * viroSpecsAngleToMeters(tokens.space.mdDeg, distance)) * CM_PER_METER,
                  heightCm: viroSpecsAngleToMeters(tokens.type.titleDeg, distance) * tokens.type.lineHeight * CM_PER_METER,
                }
              : undefined;
          this.drawText(decoration.extra, component.title, sizeFor(tokens.type.titleDeg, distance), tokens.color.text, box);
        }
      } else if (component.type === "panel-button") {
        const visual = resolveViroSpecsButtonVisual(node.label ?? "", component.state, this.tracker.interactionOf(node.id), tokens);
        if (decoration.backing && node.kind === "panel" && node.extents) {
          // The Lens adapter tints a scene button's backing with the fill only; the ring color goes on panel actions.
          setFill(decoration.backing, visual.fill, 1);
          decoration.backing.scale.set(node.extents.width * CM_PER_METER * visual.scale, node.extents.height * CM_PER_METER * visual.scale, 1);
          decoration.backing.position.z = visual.depthMeters * CM_PER_METER;
        }
        if (decoration.extra) {
          decoration.extra.visible = component.state === "error";
          const message = component.errorMessage;
          if (message !== undefined && node.kind === "panel" && node.extents) {
            // A row under the button, across the SpatialPanel it sits on (Lens `styleDecorations`).
            const parent = node.parentId !== undefined ? scene.nodes.find((n) => n.id === node.parentId) : undefined;
            const panel =
              parent && parent.kind === "panel" && parent.extents && parent.component?.type === "spatial-panel"
                ? { width: parent.extents.width, buttonX: node.position?.[0] ?? 0 }
                : undefined;
            const block = layoutViroSpecsButtonError(tokens, node.extents, message, distance, panel, this.measureLines);
            this.drawText(decoration.extra, message, sizeFor(tokens.type.labelDeg, distance), tokens.color.error, {
              widthCm: block.wrapWidthMeters * CM_PER_METER,
              heightCm: block.heightMeters * CM_PER_METER,
            });
            decoration.extra.position.set(block.x * CM_PER_METER, block.y * CM_PER_METER, 0.6);
          } else if (message !== undefined) {
            this.drawText(decoration.extra, message, sizeFor(tokens.type.labelDeg, distance), tokens.color.error);
          }
        }
        if (decoration.label) {
          const glyph = visual.glyph === "check" ? "✓ " : visual.glyph === "error" ? "! " : "";
          this.drawText(decoration.label, glyph + visual.labelText, sizeFor(tokens.type.labelDeg, distance), visual.labelColor);
          decoration.label.position.z = visual.depthMeters * CM_PER_METER + 0.6;
        }
      } else if (component.type === "panel-text") {
        this.stage.backend.setTextFill(handle, parseViroSpecsColor(component.tone === "muted" ? tokens.color.textMuted : tokens.color.text));
      }
    }
  }

  /**
   * Redraws `mesh` only when its text, size, color or box changed. With a
   * `box` the text wraps inside it, centred, the way the Lens adapter's
   * `wrapText` sets a Text's layout rect; without one it stays on the lines
   * it has (a PanelButton label). Lines and layout go on `userData` for tests.
   */
  private drawText(mesh: Mesh, text: string, size: number, color: string, box?: { readonly widthCm: number; readonly heightCm: number }): void {
    const key = text + "|" + size + "|" + color + "|" + (box ? box.widthCm.toFixed(4) + "x" + box.heightCm.toFixed(4) : "");
    if (mesh.userData.drawn === key) return;
    mesh.userData.drawn = key;
    const measure = this.options.rasterizer.measure;
    const extents = box ? { width: box.widthCm / CM_PER_METER, height: box.heightCm / CM_PER_METER } : undefined;
    const layout = layoutText({ text, style: { fontSize: size, color }, ...(extents ? { extents } : {}) }, measure);
    let bounds = textBounds(layout, measure);
    if (!box && layout.lines.length === 1) {
      // Fit the quad to the drawn line, not the default 72 x 8 cm Lens rect.
      const w = measure(layout.lines[0] ?? "", layout.font, layout.lineHeightCm);
      bounds = { minX: -w / 2, maxX: w / 2, minY: -layout.lineHeightCm / 2, maxY: layout.lineHeightCm / 2 };
    }
    const material = mesh.material as MeshBasicMaterial;
    material.map?.dispose();
    material.map = this.options.rasterizer.draw(layout, bounds);
    material.color.setRGB(...rgb(color), SRGBColorSpace);
    material.needsUpdate = true;
    mesh.scale.set(Math.max(1e-3, bounds.maxX - bounds.minX), Math.max(1e-3, bounds.maxY - bounds.minY), 1);
    mesh.position.x = (bounds.minX + bounds.maxX) / 2;
    mesh.userData.lines = layout.lines;
    mesh.userData.layout = layout;
  }

  /**
   * Lines `text` wraps to at `emMeters` in a box `wrapWidthMeters` wide: the
   * same {@linkcode layoutText} pass, Lens Text size and rasterizer measure
   * {@linkcode drawText} draws with, so a row the layout reserves holds
   * exactly the lines drawn into it. The Lens adapter's `measureLines` does
   * the same with a laid-out Lens Text. Cached per string, size and width.
   */
  private readonly measureLines: ViroSpecsLineMeasure = (text, emMeters, wrapWidthMeters) => {
    if (text === "") return 0;
    const size = sizeForEm(emMeters);
    const key = size + "|" + wrapWidthMeters.toFixed(6) + "|" + text;
    const cached = this.measuredLines.get(key);
    if (cached !== undefined) return cached;
    const layout = layoutText({ text, style: { fontSize: size }, extents: { width: wrapWidthMeters, height: 0 } }, this.options.rasterizer.measure);
    const lines = layout.lines.length;
    this.measuredLines.set(key, lines);
    return lines;
  };

  private distanceToWearer(object: Object3D): number {
    const eye = this.options.camera.getWorldPosition(new Vector3());
    return object.getWorldPosition(new Vector3()).distanceTo(eye) / CM_PER_METER;
  }

  /** Loading, notice, error and permission panels (Lens `render`). */
  private render(view: ViroSpecsExperienceView): void {
    this.lastView = view;
    const t = view.tokens;
    this.stage.container.visible = view.sceneVisible;
    const loading = view.loading;
    this.showPanel("loading", loading.visible === false ? null : {
      title: loading.title,
      // The ring shows the fraction; the line keeps the counts (Lens `render`).
      body: loading.line,
      detail: "",
      action: null,
      surface: t.color.surface,
      accent: t.color.focus,
    }, t);
    this.showPanel("notice", view.notice ? {
      title: "",
      body: view.notice.message,
      detail: view.notice.builderLine ?? "",
      action: view.notice.dismissLabel,
      surface: t.color.degradedSurface,
      accent: t.color.degraded,
    } : null, t);
    this.showPanel("error", view.errorPanel ? {
      title: view.errorPanel.title,
      body: view.errorPanel.message,
      detail: view.errorPanel.diagnosticLines.join("\n"),
      action: view.errorPanel.actionLabel,
      surface: t.color.errorSurface,
      accent: t.color.error,
    } : null, t);
    this.showPanel("permission", view.permissionPanel ? {
      title: view.permissionPanel.title,
      body: view.permissionPanel.body,
      detail: "",
      action: view.permissionPanel.actionLabel,
      surface: t.color.surface,
      accent: t.color.focus,
    } : null, t);
  }

  private showPanel(
    key: PanelKey,
    content: { title: string; body: string; detail: string; action: string | null; surface: string; accent: string } | null,
    tokens: ViroSpecsSpatialTokens
  ): void {
    if (!content) {
      const existing = this.panels.get(key);
      if (existing) {
        existing.root.visible = false;
        existing.open = false;
      }
      return;
    }
    const panel = this.panels.get(key) ?? this.createPanel(key);
    if (!panel.open) {
      panel.open = true;
      panel.root.visible = true;
      panel.shownAtMs = this.nowMs();
      this.placeInView(panel.root, tokens.distance.defaultMeters + (key === "loading" ? 0 : -tokens.depth.overlayMeters));
    }
    const d = tokens.distance.defaultMeters;
    // The vendored Lens layout: 20 degrees wide, rows wrapped at the width less
    // space.md, stacked with space.sm between them and the backing sized to fit.
    // The loading panel reserves a ring row above the title.
    const layout = layoutViroSpecsStatePanel(tokens, { ...content, ring: key === "loading" }, d, this.measureLines);
    const wrapCm = layout.wrapWidthMeters * CM_PER_METER;
    const line = (mesh: Mesh, value: string, block: ViroSpecsTextBlock | undefined, color: string): void => {
      mesh.visible = block !== undefined;
      if (!block) return;
      this.drawText(mesh, value, sizeForEm(block.emMeters), color, { widthCm: wrapCm, heightCm: block.heightMeters * CM_PER_METER });
      mesh.position.y = block.y * CM_PER_METER;
    };
    line(panel.title, content.title, layout.title, content.accent);
    line(panel.body, content.body, layout.body, tokens.color.text);
    line(panel.detail, content.detail, layout.detail, tokens.color.textMuted);
    // Opaque, as on Lens, so the scene behind never shows through the copy.
    panel.backing.scale.set(layout.widthMeters * CM_PER_METER, layout.heightMeters * CM_PER_METER, 1);
    panel.backing.position.set(0, 0, 0);
    setFill(panel.backing, content.surface, 1);
    panel.ringLayout = layout.ring;
    this.drawRing(panel, tokens);
    panel.action.visible = layout.action !== undefined && content.action !== null;
    if (layout.action && content.action !== null) {
      const visual = resolveViroSpecsButtonVisual(content.action, "idle", { hovered: panel.hovered, pressed: panel.pressed }, tokens);
      this.drawText(panel.actionText, visual.labelText, sizeFor(tokens.type.labelDeg, d), visual.labelColor, {
        widthCm: layout.action.widthMeters * CM_PER_METER,
        heightCm: layout.action.heightMeters * CM_PER_METER,
      });
      panel.action.position.set(0, layout.action.y * CM_PER_METER, 0.6);
      panel.actionBacking.scale.set(layout.action.widthMeters * CM_PER_METER * visual.scale, layout.action.heightMeters * CM_PER_METER * visual.scale, 1);
      panel.actionBacking.position.z = visual.depthMeters * CM_PER_METER;
      setFill(panel.actionBacking, visual.ring ? visual.border : visual.fill, 1);
    }
  }

  private createPanel(key: PanelKey): Panel {
    const root = new Group();
    root.name = "ViroSpecsExperience-" + key;
    this.overlay.add(root);
    const backing = overlayMesh(createRoundedSurface(1, 1, 0.06, "backing"), OVERLAY_ORDER.backing);
    root.add(backing);
    const text = (name: string): Mesh => {
      const mesh = overlayMesh(createTextMesh(), OVERLAY_ORDER.text);
      mesh.name = name;
      mesh.position.z = 0.6;
      root.add(mesh);
      return mesh;
    };
    const ring = new Group();
    ring.name = "ring";
    ring.visible = false;
    root.add(ring);
    const segments = createRingSegments(ring);
    const title = text("title");
    const body = text("body");
    const detail = text("detail");
    const action = new Group();
    action.name = "action";
    root.add(action);
    const actionBacking = overlayMesh(createRoundedSurface(1, 1, 0.25, "action-backing"), OVERLAY_ORDER.control);
    action.add(actionBacking);
    const actionText = overlayMesh(createTextMesh(), OVERLAY_ORDER.text);
    actionText.name = "action-label";
    actionText.position.z = 0.6;
    action.add(actionText);
    const panel: Panel = {
      root, backing, title, body, detail, action, actionBacking, actionText, ring, segments,
      hovered: false, pressed: false, open: false, shownAtMs: 0, ringLayout: undefined,
    };
    this.panels.set(key, panel);
    return panel;
  }

  /**
   * The loading ring (Lens `drawRing`): {@linkcode RING_SEGMENTS} quads on a
   * circle, lit in `color.focus` by the vendored
   * {@linkcode viroSpecsLoadingRing} over a `color.border` track. A known
   * fraction fills from the top clockwise and never turns; reduced motion
   * never turns; only unknown progress without reduced motion spins.
   */
  private drawRing(panel: Panel, tokens: ViroSpecsSpatialTokens): void {
    const ring = panel.ringLayout;
    const view = this.lastView.loading;
    panel.ring.visible = ring !== undefined && view.visible === true;
    if (!ring || view.visible === false) return;
    const state = viroSpecsLoadingRing(view.indicator, view.progress, RING_SEGMENTS, this.nowMs() - panel.shownAtMs, tokens);
    panel.ring.position.set(0, ring.y * CM_PER_METER, 0.6);
    // Clockwise as seen by the wearer, who looks at the panel's +Z face.
    panel.ring.rotation.z = state.turns === 0 ? 0 : -state.turns * 2 * Math.PI;
    drawRingSegments(panel.segments, ring, state.lit, tokens);
  }

  private createModel(
    id: string,
    object: Object3D,
    position: readonly number[] | undefined,
    rotation: readonly number[] | undefined,
    scale: readonly number[] | undefined,
    resettable: boolean
  ): ModelDecoration {
    const ring = new Group();
    ring.name = "ViroSpecsModelRing:" + id;
    ring.visible = false;
    this.overlay.add(ring);
    const segments = createRingSegments(ring);
    let reset: ModelDecoration["reset"] = null;
    if (resettable) {
      // A scene button (Lens `makeSceneButton`): depth-tested with the scene, not overlay.
      const root = new Group();
      root.name = "ViroSpecsModelReset:" + id;
      root.visible = false;
      this.overlay.add(root);
      const backing = createRoundedSurface(1, 1, 0.25, "backing");
      root.add(backing);
      const label = createTextMesh();
      label.name = "label";
      label.position.z = 0.6;
      root.add(label);
      reset = { root, backing, label };
    }
    const [px, py, pz] = position ?? [0, 0, 0];
    const [rx, ry, rz, rw] = rotation ?? [0, 0, 0, 1];
    const [sx, sy, sz] = scale ?? [1, 1, 1];
    return {
      object,
      ring,
      segments,
      reset,
      authored: {
        position: new Vector3(px, py, pz).multiplyScalar(CM_PER_METER),
        quaternion: new Quaternion(rx, ry, rz, rw),
        scale: new Vector3(sx, sy, sz),
      },
      bottomMeters: undefined,
      resetting: null,
      pendingSinceMs: this.nowMs(),
    };
  }

  private removeModel(id: string): void {
    const model = this.models.get(id);
    if (!model) return;
    this.models.delete(id);
    this.heldModels.delete(id);
    for (const root of [model.ring, model.reset?.root]) {
      if (!root) continue;
      root.removeFromParent();
      root.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.geometry.dispose();
        const material = o.material as MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
      });
    }
  }

  /**
   * ModelViewer parts, every frame (Lens `drawModels`): the load ring at the
   * model's origin while its asset loads, a Reset in progress, the
   * `autoRotate` turntable, and the Reset model button under the model's
   * bounds.
   */
  private drawModels(view: ViroSpecsExperienceView, now: number, deltaSeconds: number): void {
    const host = this.stage.controller;
    const scene = host.committedScene;
    const drawn = new Set<string>();
    const head = this.options.camera.getWorldPosition(new Vector3());
    const tokens = view.tokens;
    const reduced = view.preferences.reducedMotion;
    for (const node of scene ? scene.nodes : []) {
      const component = node.component;
      if (component?.type !== "model-viewer") continue;
      const model = this.models.get(node.id);
      if (!model) continue;
      drawn.add(node.id);
      const o = model.object;
      o.updateWorldMatrix(true, false);
      const world = o.getWorldPosition(new Vector3());
      const distance = Math.max(world.distanceTo(head) / CM_PER_METER, 0.01);
      const pending = host.isAssetPending(node.id);
      // Off while the loading panel reports the asset (Lens drawModels).
      const showRing = viroSpecsShowModelRing(view.loading, pending);
      model.ring.visible = showRing;
      if (showRing) {
        const ring: RingSize = {
          diameterMeters: 3 * viroSpecsAngleToMeters(tokens.type.bodyDeg, distance),
          thicknessMeters: viroSpecsAngleToMeters(tokens.shape.borderWidthFocusDeg, distance) * 2,
        };
        const state = viroSpecsLoadingRing(reduced ? "dots" : "ring-spin", undefined, RING_SEGMENTS, now - model.pendingSinceMs, tokens);
        // Faces the wearer (local +Z toward the head), spinning about its own axis.
        model.ring.position.copy(world);
        model.ring.lookAt(head);
        if (state.turns !== 0) model.ring.rotateZ(-state.turns * 2 * Math.PI);
        drawRingSegments(model.segments, ring, state.lit, tokens);
      }
      if (!pending && model.bottomMeters === undefined && view.sceneVisible) {
        const box = new Box3().setFromObject(o);
        if (!box.isEmpty()) model.bottomMeters = (box.min.y - world.y) / CM_PER_METER;
      }
      if (model.resetting) {
        const k = viroSpecsResetProgress(now - model.resetting.startMs, tokens, reduced);
        o.position.lerpVectors(model.resetting.position, model.authored.position, k);
        o.quaternion.slerpQuaternions(model.resetting.quaternion, model.authored.quaternion, k);
        o.scale.lerpVectors(model.resetting.scale, model.authored.scale, k);
        if (k >= 1) model.resetting = null;
      } else if (component.autoRotate && !pending && view.sceneVisible) {
        const degrees = viroSpecsAutoRotateDegrees(deltaSeconds, { reducedMotion: reduced, held: this.heldModels.has(node.id) });
        // About the model's own up axis, as the Lens adapter multiplies its local rotation.
        if (degrees !== 0) o.quaternion.multiply(new Quaternion().setFromAxisAngle(UP, (degrees * Math.PI) / 180));
      }
      if (model.reset) {
        const show = view.sceneVisible && visibleInHierarchy(o) && model.bottomMeters !== undefined;
        model.reset.root.visible = show;
        if (show && model.bottomMeters !== undefined) {
          const layout = layoutViroSpecsModelReset(tokens, { bottomMeters: model.bottomMeters }, distance);
          // Under the authored origin, turned like the model's parent (the
          // panel it sits on, or the content root).
          const parent = o.parent;
          parent?.updateWorldMatrix(true, false);
          const rotation = parent ? parent.getWorldQuaternion(new Quaternion()) : new Quaternion();
          const origin = parent ? parent.localToWorld(model.authored.position.clone()) : model.authored.position.clone();
          const at = origin.add(UP.clone().applyQuaternion(rotation).multiplyScalar(layout.y * CM_PER_METER));
          model.reset.root.position.copy(at);
          model.reset.root.quaternion.copy(rotation);
          const widthCm = layout.widthMeters * CM_PER_METER;
          const heightCm = layout.heightMeters * CM_PER_METER;
          model.reset.backing.scale.set(widthCm, heightCm, 1);
          setFill(model.reset.backing, tokens.color.surfaceRaised, 1);
          this.drawText(model.reset.label, formatViroSpecsCopy("modelViewer.reset"), sizeFor(tokens.type.labelDeg, distance), tokens.color.text, { widthCm, heightCm });
        }
      }
    }
    // Models of a scene that is gone, or not committed yet: nothing shows.
    for (const [id, model] of this.models) {
      if (drawn.has(id)) continue;
      model.ring.visible = false;
      if (model.reset) model.reset.root.visible = false;
    }
  }

  private nowMs(): number {
    return this.options.nowMs ? this.options.nowMs() : performance.now();
  }

  /** Panel action input: same press-commits-on-release rule as scene buttons. */
  private panelInput(key: PanelKey, panel: Panel, phase: ViroSpecsInteractionPhase): void {
    if (phase === "hover-enter") panel.hovered = true;
    else if (phase === "hover-exit") panel.hovered = false;
    else if (phase === "select-start") panel.pressed = true;
    else if (phase === "cancel") panel.pressed = false;
    else if (phase === "select-end") {
      const commit = panel.pressed;
      panel.pressed = false;
      if (commit) this.activatePanel(key);
    }
    this.render(this.lastView);
  }

  private activatePanel(key: PanelKey): void {
    if (key === "notice") this.controller.dismissNotice();
    else if (key === "permission") this.controller.closePermissionPanel();
    else if (key === "error") {
      const result = this.controller.activateErrorAction();
      if (result?.action === "retry") void this.stage.retry(result.nodeIds);
    }
  }

  /** World-placed along the camera's view when it opens; not head-locked (Lens `placeInView`). */
  private placeInView(object: Object3D, meters: number): void {
    const camera = this.options.camera;
    camera.updateMatrixWorld();
    const eye = camera.getWorldPosition(new Vector3());
    const direction = camera.getWorldDirection(new Vector3());
    object.position.copy(eye.addScaledVector(direction, meters * CM_PER_METER));
    object.lookAt(camera.getWorldPosition(new Vector3()));
  }
}

/** Lens Text size whose em is `angleDeg` tall at `distanceMeters` (Lens adapter `sizeFor`). */
function sizeFor(angleDeg: number, distanceMeters: number): number {
  return sizeForEm(viroSpecsAngleToMeters(angleDeg, distanceMeters));
}

/** Lens Text size whose em is `emMeters` tall, rounded up to a tenth as the Lens adapter does. */
function sizeForEm(emMeters: number): number {
  return Math.ceil((emMeters / VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE) * 10) / 10;
}

function rgb(hex: string): [number, number, number] {
  const c: Rgba = parseViroSpecsColor(hex);
  return [c[0], c[1], c[2]];
}

function setFill(mesh: Mesh, hex: string, opacity: number): void {
  const material = mesh.material as MeshBasicMaterial;
  material.color.setRGB(...rgb(hex), SRGBColorSpace);
  material.opacity = opacity;
  // Overlay meshes stay in the transparent pass, which three.js draws after
  // the opaque one, so their render order also puts them after scene content.
  material.transparent = opacity < 1 || mesh.userData.overlay === true;
}

const UP = new Vector3(0, 1, 0);

/** {@linkcode RING_SEGMENTS} overlay quads under `ring` (Lens `makeBacking` at `OVERLAY_ORDER.control`). */
function createRingSegments(ring: Group): Mesh[] {
  const segments: Mesh[] = [];
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const segment = overlayMesh(createRoundedSurface(1, 1, 0.5, "ring-segment-" + i), OVERLAY_ORDER.control);
    ring.add(segment);
    segments.push(segment);
  }
  return segments;
}

/**
 * Lays the ring's quads on a circle, lit in `color.focus` per `lit` over a
 * `color.border` track (Lens `drawRingSegments`). The caller turns the ring.
 */
function drawRingSegments(segments: readonly Mesh[], ring: RingSize, lit: readonly boolean[], tokens: ViroSpecsSpatialTokens): void {
  const radiusCm = ((ring.diameterMeters - ring.thicknessMeters) / 2) * CM_PER_METER;
  const lengthCm = ((Math.PI * ring.diameterMeters) / RING_SEGMENTS) * CM_PER_METER * 0.8;
  segments.forEach((segment, i) => {
    // Segment 0 at the top, then clockwise as seen by the wearer.
    const angle = Math.PI / 2 - (i / RING_SEGMENTS) * 2 * Math.PI;
    segment.position.set(Math.cos(angle) * radiusCm, Math.sin(angle) * radiusCm, 0);
    segment.rotation.z = angle + Math.PI / 2;
    segment.scale.set(lengthCm, ring.thicknessMeters * CM_PER_METER, 1);
    setFill(segment, lit[i] ? tokens.color.focus : tokens.color.border, 1);
  });
}

/** True when `object` and every ancestor are visible (Lens `isEnabledInHierarchy`). */
function visibleInHierarchy(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/**
 * Marks `mesh` as experience overlay (Lens `makeBacking` with an overlay
 * order): drawn at `order` after scene content, depth test and write off.
 */
function overlayMesh(mesh: Mesh, order: number): Mesh {
  const material = mesh.material as MeshBasicMaterial;
  material.depthTest = false;
  material.depthWrite = false;
  material.transparent = true;
  mesh.renderOrder = order;
  mesh.userData.overlay = true;
  return mesh;
}
