import { Group, Mesh, MeshBasicMaterial, SRGBColorSpace, Vector3, type Camera, type Object3D } from "three";
import { CM_PER_METER } from "./backend/lensSemantics";
import { layoutText, type Rgba } from "./backend/textLayout";
import { textBounds, type TextRasterizer } from "./backend/textRaster";
import type { PreviewNode } from "./backend/types";
import { createRoundedSurface, createTextMesh } from "./backend/visuals";
import type { PreviewStage } from "./stage";
import {
  resolveViroSpecsButtonVisual,
  unrenderedViroSpecsComponentFeatures,
  ViroSpecsButtonTracker,
  ViroSpecsExperienceController,
  type ViroSpecsExperienceView,
  type ViroSpecsSceneRequirements,
} from "./vendor/lens-core/ViroSpecsExperience";
import {
  viroSpecsAngleToMeters,
  VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE,
  type ViroSpecsButtonAuthoredState,
  type ViroSpecsSpatialTokens,
} from "./vendor/lens-core/ViroSpecsExperienceTokens";
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
  hovered: boolean;
  pressed: boolean;
  open: boolean;
}

const PANEL_KEYS: readonly PanelKey[] = ["loading", "notice", "error", "permission"];

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
  private readonly panels = new Map<PanelKey, Panel>();
  private readonly reportedUnrendered = new Set<string>();
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
    controller.addOnInteractionListener((event) => this.tracker.handle(event));
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
    return out;
  }

  /** Per frame: time rules, re-decoration after a same-state replacement, button styling. */
  update(): void {
    this.controller.tick();
    const scene = this.stage.controller.committedScene;
    if (scene !== this.decoratedScene) this.decorate();
    this.styleDecorations(this.lastView.tokens);
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
          this.drawText(decoration.extra, component.title, sizeFor(tokens.type.titleDeg, distance), tokens.color.text);
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
          if (component.errorMessage !== undefined) this.drawText(decoration.extra, component.errorMessage, sizeFor(tokens.type.labelDeg, distance), tokens.color.error);
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

  /** Redraws `mesh` only when its text, size or color changed. */
  private drawText(mesh: Mesh, text: string, size: number, color: string): void {
    const key = text + "|" + size + "|" + color;
    if (mesh.userData.drawn === key) return;
    mesh.userData.drawn = key;
    const layout = layoutText({ text, style: { fontSize: size, color } }, this.options.rasterizer.measure);
    const bounds = textBounds(layout, this.options.rasterizer.measure);
    // Fit the quad to the drawn line, not the default 72 x 8 cm Lens rect.
    const w = this.options.rasterizer.measure(layout.lines[0] ?? "", layout.font, layout.lineHeightCm);
    const tight = { minX: -w / 2, maxX: w / 2, minY: -layout.lineHeightCm / 2, maxY: layout.lineHeightCm / 2 };
    const material = mesh.material as MeshBasicMaterial;
    material.map?.dispose();
    material.map = this.options.rasterizer.draw(layout, layout.lines.length === 1 ? tight : bounds);
    material.color.setRGB(...rgb(color), SRGBColorSpace);
    material.needsUpdate = true;
    const b = layout.lines.length === 1 ? tight : bounds;
    mesh.scale.set(Math.max(1e-3, b.maxX - b.minX), Math.max(1e-3, b.maxY - b.minY), 1);
    mesh.position.x = (b.minX + b.maxX) / 2;
  }

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
      body: loading.line + (loading.progress !== undefined ? "  " + Math.round(loading.progress * 100) + "%" : ""),
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
      this.placeInView(panel.root, tokens.distance.defaultMeters + (key === "loading" ? 0 : -tokens.depth.overlayMeters));
    }
    const d = tokens.distance.defaultMeters;
    const step = viroSpecsAngleToMeters(tokens.type.bodyDeg * tokens.type.lineHeight, d) * CM_PER_METER;
    const line = (mesh: Mesh, value: string, deg: number, color: string, y: number): void => {
      mesh.visible = value !== "";
      if (value !== "") this.drawText(mesh, value, sizeFor(deg, d), color);
      mesh.position.y = y;
    };
    line(panel.title, content.title, tokens.type.bodyDeg, content.accent, step * 1.5);
    line(panel.body, content.body, tokens.type.bodyDeg, tokens.color.text, 0);
    line(panel.detail, content.detail, tokens.type.labelDeg, tokens.color.textMuted, -step * 1.5);
    // 20 degrees wide (the handoff panel width) and tall enough for title, body, detail and action.
    panel.backing.scale.set(viroSpecsAngleToMeters(20, d) * CM_PER_METER, step * 8, 1);
    panel.backing.position.set(0, -step * 0.5, 0);
    setFill(panel.backing, content.surface, tokens.opacity.surface);
    panel.action.visible = content.action !== null;
    if (content.action !== null) {
      const visual = resolveViroSpecsButtonVisual(content.action, "idle", { hovered: panel.hovered, pressed: panel.pressed }, tokens);
      this.drawText(panel.actionText, visual.labelText, sizeFor(tokens.type.labelDeg, d), visual.labelColor);
      panel.action.position.set(0, -step * 3, 0.6);
      const labelM = viroSpecsAngleToMeters(tokens.type.labelDeg, d);
      const h = labelM * tokens.type.lineHeight + 2 * viroSpecsAngleToMeters(tokens.space.smDeg, d);
      const w = Math.max(h * 2.5, content.action.length * 0.55 * labelM + 2 * viroSpecsAngleToMeters(tokens.space.mdDeg, d));
      panel.actionBacking.scale.set(w * CM_PER_METER * visual.scale, h * CM_PER_METER * visual.scale, 1);
      panel.actionBacking.position.z = visual.depthMeters * CM_PER_METER;
      setFill(panel.actionBacking, visual.ring ? visual.border : visual.fill, 1);
    }
  }

  private createPanel(key: PanelKey): Panel {
    const root = new Group();
    root.name = "ViroSpecsExperience-" + key;
    this.overlay.add(root);
    const backing = createRoundedSurface(1, 1, 0.06, "backing");
    root.add(backing);
    const text = (name: string): Mesh => {
      const mesh = createTextMesh();
      mesh.name = name;
      mesh.position.z = 0.6;
      root.add(mesh);
      return mesh;
    };
    const title = text("title");
    const body = text("body");
    const detail = text("detail");
    const action = new Group();
    action.name = "action";
    root.add(action);
    const actionBacking = createRoundedSurface(1, 1, 0.25, "action-backing");
    action.add(actionBacking);
    const actionText = createTextMesh();
    actionText.name = "action-label";
    actionText.position.z = 0.6;
    action.add(actionText);
    const panel: Panel = { root, backing, title, body, detail, action, actionBacking, actionText, hovered: false, pressed: false, open: false };
    this.panels.set(key, panel);
    return panel;
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
  return Math.ceil((viroSpecsAngleToMeters(angleDeg, distanceMeters) / VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE) * 10) / 10;
}

function rgb(hex: string): [number, number, number] {
  const c: Rgba = parseViroSpecsColor(hex);
  return [c[0], c[1], c[2]];
}

function setFill(mesh: Mesh, hex: string, opacity: number): void {
  const material = mesh.material as MeshBasicMaterial;
  material.color.setRGB(...rgb(hex), SRGBColorSpace);
  material.opacity = opacity;
  material.transparent = opacity < 1;
}
