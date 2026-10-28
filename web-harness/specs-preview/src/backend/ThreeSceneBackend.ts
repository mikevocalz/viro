import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Texture,
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import type {
  ViroSpecsDocumentInteraction,
  ViroSpecsDocumentLight,
  ViroSpecsDocumentMaterial,
  ViroSpecsDocumentPolyline,
  ViroSpecsExtents,
  ViroSpecsNativeAnimationPlan,
  ViroSpecsScroll,
} from "../vendor/lens-core/ViroSpecsProtocol";
import type {
  ViroSpecsBackendInteraction,
  ViroSpecsBackendText,
  ViroSpecsBackendTransform,
  ViroSpecsCancel,
  ViroSpecsHostScheduler,
  ViroSpecsNodeUiState,
  ViroSpecsSceneBackend,
} from "../vendor/lens-core/ViroSpecsSceneBackend";
import { parseViroSpecsColor, type ViroSpecsHostNode } from "../vendor/lens-core/ViroSpecsSceneDocument";
import { PreviewAnimationPlayer } from "./animationPlayer";
import { CM_PER_METER, GLB_PREFAB_SCALE, IMAGE_NATIVE_SIZE_CM, LUMENS_PER_LENS_INTENSITY } from "./lensSemantics";
import { cloneForNode, createPreviewMaterial, nodeMaterialName } from "./materials";
import { layoutText, type Rgba } from "./textLayout";
import { textBounds, type TextRasterizer } from "./textRaster";
import type { PreviewAsset, PreviewMaterial, PreviewNode } from "./types";
import { ALPHA_TARGET, applyRgba, createImageSurface, createPanelSurface, createPlaceholder, createScrollOutline, createTextMesh } from "./visuals";

/** Where the backend gets assets and registered resources. */
export interface PreviewResources {
  /** Image textures and glTF models by manifest source ID. Sync after preload, async otherwise. */
  loadAsset(kind: "image" | "model", source: string): PreviewAsset | null | Promise<PreviewAsset | null>;
  /** Materials registered by ID (the Lens asset registry's material table). */
  resolveMaterial(id: string): PreviewMaterial | null;
  /** Font families the preview treats as registered. Unregistered families report VS5007, as in Lens. */
  hasFont(family: string): boolean;
}

/** Construction options for {@linkcode ThreeSceneBackend}. */
export interface ThreeSceneBackendOptions {
  readonly container: Group;
  readonly resources: PreviewResources;
  readonly rasterizer: TextRasterizer;
  readonly scheduler: ViroSpecsHostScheduler;
  /** Color for polylines without a material (Lens `defaultLineMaterial`). @default "#e8f1ff" */
  readonly defaultLineColor?: string;
}

/**
 * `ViroSpecsSceneBackend` on three.js. Each method does what the same method
 * of `ViroSpecsLensSceneBackend` does to Lens SceneObjects: centimeters,
 * `[x, y, z, w]` quaternions, Lens Text layout, image extents on a child
 * surface, the placeholder box, light and material mapping.
 */
export class ThreeSceneBackend implements ViroSpecsSceneBackend<PreviewNode, PreviewAsset, PreviewMaterial> {
  private readonly handles = new Set<PreviewNode>();
  readonly animations: PreviewAnimationPlayer;
  private readonly lineMaterials = new Set<LineMaterial>();

  constructor(private readonly options: ThreeSceneBackendOptions) {
    this.animations = new PreviewAnimationPlayer(options.scheduler);
  }

  /** Live handles, scene roots included. */
  liveHandles(): PreviewNode[] {
    return Array.from(this.handles).filter((h) => h.alive);
  }

  /** Live handles with an interaction binding. */
  interactables(): PreviewNode[] {
    return this.liveHandles().filter((h) => h.interaction !== undefined);
  }

  /** Delivers an input event for `node`, filtered by its declared events as the Lens SIK binding filters them. */
  deliverInteraction(node: PreviewNode, event: ViroSpecsBackendInteraction): void {
    const binding = node.interaction;
    if (!binding || !node.alive) return;
    if (event.phase.startsWith("hover") && !binding.spec.events.includes("hover")) return;
    if (event.phase === "drag" && !binding.spec.events.includes("drag")) return;
    binding.emit(event);
  }

  /** Per-frame work: animations, line resolution. */
  update(deltaSeconds: number, viewportWidthPx: number, viewportHeightPx: number): void {
    this.animations.update(deltaSeconds);
    for (const m of this.lineMaterials) m.resolution.set(viewportWidthPx, viewportHeightPx);
  }

  private track(node: PreviewNode): PreviewNode {
    this.handles.add(node);
    node.object.userData.viroNode = node;
    return node;
  }

  createSceneRoot(revision: number): PreviewNode {
    const object = new Group();
    object.name = "viro-scene:" + revision;
    this.options.container.add(object);
    return this.track({ id: "viro-scene:" + revision, kind: "root", object, alive: true });
  }

  setEnabled(node: PreviewNode, enabled: boolean): void {
    node.object.visible = enabled;
  }

  createNode(spec: ViroSpecsHostNode, parent: PreviewNode): PreviewNode {
    const object = new Group();
    object.name = "viro:" + spec.id;
    (parent.contentParent ?? parent.object).add(object);
    const node = this.track({ id: spec.id, kind: spec.kind, object, alive: true });
    if (spec.kind === "image") {
      node.imageSurface = createImageSurface(IMAGE_NATIVE_SIZE_CM, IMAGE_NATIVE_SIZE_CM);
      object.add(node.imageSurface);
    }
    return node;
  }

  setParent(node: PreviewNode, parent: PreviewNode): void {
    (parent.contentParent ?? parent.object).add(node.object);
  }

  destroy(node: PreviewNode): void {
    node.object.removeFromParent();
    node.object.traverse((child) => {
      const owner = child.userData.viroNode as PreviewNode | undefined;
      if (owner) owner.alive = false;
      if (child instanceof Mesh) {
        child.geometry.dispose();
        const materials: Material[] = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of materials) if (m.name.startsWith("viro-node:") || m.name === "") m.dispose();
      }
      if (child instanceof Line2) this.lineMaterials.delete(child.material);
    });
    node.alive = false;
  }

  setTransform(node: PreviewNode, transform: ViroSpecsBackendTransform): void {
    const [px, py, pz] = transform.position;
    node.object.position.set(px * CM_PER_METER, py * CM_PER_METER, pz * CM_PER_METER);
    const [x, y, z, w] = transform.rotation;
    node.object.quaternion.set(x, y, z, w);
    node.object.scale.set(...transform.scale);
  }

  setVisible(node: PreviewNode, visible: boolean): void {
    node.object.visible = visible;
  }

  setOpacity(node: PreviewNode, opacity: number): void {
    node.opacity = opacity;
    if (node.text) {
      const color = node.textColor ?? node.text.layout.color;
      node.text.mesh.material = this.textMaterial(node, color[3] * opacity);
    }
    if (node.imageSurface) {
      const m = node.imageSurface.material as MeshBasicMaterial;
      m.opacity = opacity;
      m.transparent = true;
    }
    if (node.model) {
      // Prefab and registry materials are shared; clone once per visual before fading (Lens does the same).
      const own = (m: Material): Material => {
        const mine = m.name === nodeMaterialName(node.id) ? m : cloneForNode(m, node.id);
        mine.opacity = opacity;
        mine.transparent = true;
        return mine;
      };
      node.model.root.traverse((child) => {
        if (child instanceof Mesh) child.material = Array.isArray(child.material) ? child.material.map(own) : own(child.material);
      });
    }
  }

  private textMaterial(node: PreviewNode, alpha: number): MeshBasicMaterial {
    const text = node.text;
    const previous = text?.mesh.material as MeshBasicMaterial | undefined;
    const material = previous ?? new MeshBasicMaterial({ transparent: true, depthWrite: false });
    const fill = node.textColor ?? text?.layout.color ?? [1, 1, 1, 1];
    const tint = text?.tint ?? [1, 1, 1, 1];
    material.color.setRGB(fill[0] * tint[0], fill[1] * tint[1], fill[2] * tint[2], SRGBColorSpace);
    material.opacity = alpha;
    material.transparent = true;
    return material;
  }

  setText(node: PreviewNode, content: ViroSpecsBackendText): void {
    if (node.kind !== "text") throw new Error("Text content on non-text node " + node.id);
    const layout = layoutText(content, this.options.rasterizer.measure);
    const mesh = node.text?.mesh ?? createTextMesh();
    if (!node.text) node.object.add(mesh);
    const bounds = textBounds(layout, this.options.rasterizer.measure);
    const material = mesh.material as MeshBasicMaterial;
    material.map?.dispose();
    material.map = this.options.rasterizer.draw(layout, bounds);
    material.needsUpdate = true;
    mesh.scale.set(Math.max(1e-3, bounds.maxX - bounds.minX), Math.max(1e-3, bounds.maxY - bounds.minY), 1);
    mesh.position.set((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0);
    node.text = { layout, mesh, tint: node.text?.tint };
    node.textColor = layout.color;
    node.text.mesh.material = this.textMaterial(node, layout.color[3] * (node.opacity ?? 1));
  }

  setExtents(node: PreviewNode, extents: ViroSpecsExtents): void {
    if (node.kind === "image" && node.imageSurface) {
      node.imageSurface.scale.set(
        (extents.width * CM_PER_METER) / IMAGE_NATIVE_SIZE_CM,
        (extents.height * CM_PER_METER) / IMAGE_NATIVE_SIZE_CM,
        1
      );
      return;
    }
    if (node.kind === "panel") {
      if (node.panelSurface) {
        node.panelSurface.removeFromParent();
        node.panelSurface.geometry.dispose();
      }
      node.panelSurface = createPanelSurface(extents.width * CM_PER_METER, extents.height * CM_PER_METER);
      node.object.add(node.panelSurface);
    }
  }

  setScroll(node: PreviewNode, scroll: ViroSpecsScroll): void {
    const width = scroll.width * CM_PER_METER;
    const height = scroll.height * CM_PER_METER;
    const contentHeight = Math.max(height, scroll.contentHeight * CM_PER_METER);
    if (!node.contentParent || !node.scroll) {
      const anchor = new Group();
      anchor.name = "viro-scroll-content:" + node.id;
      for (const child of [...node.object.children]) anchor.add(child);
      node.object.add(anchor);
      node.contentParent = anchor;
      node.scroll = { spec: scroll, normalized: [0, 1], outline: createScrollOutline(width, height) };
      node.object.add(node.scroll.outline);
    } else {
      node.scroll.outline.removeFromParent();
      node.scroll.outline = createScrollOutline(width, height);
      node.object.add(node.scroll.outline);
      node.scroll.spec = scroll;
    }
    this.positionScrollContent(node, contentHeight, height);
  }

  /** Content anchor at `contentHeight / 2` when scrolled to the top, as the Lens backend sets it. */
  private positionScrollContent(node: PreviewNode, contentHeightCm: number, windowHeightCm: number): void {
    if (!node.contentParent || !node.scroll) return;
    const travel = contentHeightCm - windowHeightCm;
    node.contentParent.position.set(0, contentHeightCm / 2 + (1 - node.scroll.normalized[1]) * travel, 0);
  }

  /** Scrolls a scroll group, `normalizedY` 1 = top. */
  scrollTo(node: PreviewNode, normalizedY: number): void {
    if (!node.scroll) return;
    node.scroll.normalized = [node.scroll.normalized[0], Math.max(0, Math.min(1, normalizedY))];
    const spec = node.scroll.spec;
    this.positionScrollContent(node, Math.max(spec.height, spec.contentHeight) * CM_PER_METER, spec.height * CM_PER_METER);
  }

  setAsset(node: PreviewNode, asset: PreviewAsset): void {
    if (node.kind === "image") {
      if (asset.kind !== "texture" || !node.imageSurface) throw new Error("Image node " + node.id + " got a " + asset.kind + " asset.");
      const m = node.imageSurface.material as MeshBasicMaterial;
      m.map = asset.texture;
      m.needsUpdate = true;
      node.imageSource = asset.source;
      return;
    }
    if (node.kind === "model") {
      if (asset.kind !== "model") throw new Error("Model node " + node.id + " got a texture asset.");
      node.model?.root.removeFromParent();
      const root = cloneSkinned(asset.scene);
      root.name = "viro-model:" + node.id;
      root.scale.multiplyScalar(GLB_PREFAB_SCALE);
      root.traverse((child) => {
        if (child instanceof Mesh) child.userData[ALPHA_TARGET] = true;
      });
      node.object.add(root);
      node.model = { root, source: asset.source };
      if (node.material) this.applyMaterial(node, node.material);
      if (node.opacity !== undefined && node.opacity !== 1) this.setOpacity(node, node.opacity);
      return;
    }
    throw new Error("Assets are only valid on image and model nodes: " + node.id);
  }

  showPlaceholder(node: PreviewNode, extents: ViroSpecsExtents): boolean {
    this.clearPlaceholder(node);
    const w = extents.width * CM_PER_METER;
    const h = extents.height * CM_PER_METER;
    const d = node.kind === "model" ? Math.min(w, h) : 1;
    const mesh = createPlaceholder(w, h, d);
    node.object.add(mesh);
    node.placeholder = { mesh, widthCm: w, heightCm: h, depthCm: d };
    return true;
  }

  clearPlaceholder(node: PreviewNode): void {
    if (node.placeholder) {
      node.placeholder.mesh.removeFromParent();
      node.placeholder.mesh.geometry.dispose();
    }
    node.placeholder = undefined;
  }

  setMaterial(node: PreviewNode, material: PreviewMaterial | null): void {
    node.material = material;
    this.applyMaterial(node, material);
    if (node.opacity !== undefined && node.opacity !== 1) this.setOpacity(node, node.opacity);
  }

  private applyMaterial(node: PreviewNode, material: PreviewMaterial | null): void {
    if (node.imageSurface) {
      // Lens: the image gets its own clone of the material, keeping its texture.
      const previous = node.imageSurface.material as MeshBasicMaterial;
      const own = new MeshBasicMaterial({ transparent: true, side: previous.side });
      own.name = nodeMaterialName(node.id);
      applyRgba(own, material ? material.baseColor : [1, 1, 1, 1]);
      own.map = previous.map;
      node.imageSurface.material = own;
      return;
    }
    if (node.text) {
      // Lens assigns the material as Text.customMaterial; the preview tints the fill with its color.
      if (material) {
        node.text.tint = material.baseColor;
        node.text.mesh.material = this.textMaterial(node, (node.textColor ?? node.text.layout.color)[3] * (node.opacity ?? 1));
      }
      return;
    }
    if (node.model && material) {
      node.model.root.traverse((child) => {
        if (child instanceof Mesh) child.material = material.template;
      });
    }
  }

  loadAsset(kind: "image" | "model", source: string): PreviewAsset | null | Promise<PreviewAsset | null> {
    return this.options.resources.loadAsset(kind, source);
  }

  resolveMaterial(id: string): PreviewMaterial | null {
    return this.options.resources.resolveMaterial(id);
  }

  createMaterial(definition: ViroSpecsDocumentMaterial, texture: PreviewAsset | null): PreviewMaterial | null {
    const map: Texture | null = texture?.kind === "texture" ? texture.texture : null;
    return createPreviewMaterial(definition, map);
  }

  disposeMaterial(material: PreviewMaterial): void {
    material.disposed = true;
    material.template.dispose();
  }

  hasFont(family: string): boolean {
    return this.options.resources.hasFont(family);
  }

  createLight(spec: ViroSpecsDocumentLight, parent: PreviewNode): PreviewNode {
    const object = new Group();
    object.name = "viro-light:" + spec.id;
    (parent.contentParent ?? parent.object).add(object);
    const rgb = spec.color !== undefined ? parseViroSpecsColor(spec.color) : [1, 1, 1, 1];
    const color = new Color().setRGB(rgb[0] ?? 1, rgb[1] ?? 1, rgb[2] ?? 1, SRGBColorSpace);
    const intensity = (spec.intensity ?? LUMENS_PER_LENS_INTENSITY) / LUMENS_PER_LENS_INTENSITY;
    let light: Object3D;
    if (spec.type === "ambient") light = new AmbientLight(color, intensity);
    else if (spec.type === "directional") {
      const d = new DirectionalLight(color, intensity);
      d.target.position.set(...spec.direction).normalize();
      object.add(d.target);
      light = d;
    } else if (spec.type === "omni") {
      // decay 0: Lens light falloff is not modeled; a physical 1/r^2 in cm would black out the scene.
      light = new PointLight(color, intensity, 0, 0);
      object.position.set(spec.position[0] * CM_PER_METER, spec.position[1] * CM_PER_METER, spec.position[2] * CM_PER_METER);
    } else {
      const outer = spec.outerAngle ?? 45;
      const inner = spec.innerAngle ?? outer;
      const s = new SpotLight(color, intensity, 0, Math.min(Math.PI / 2, (outer * Math.PI) / 180), outer > 0 ? 1 - inner / outer : 0, 0);
      object.position.set(spec.position[0] * CM_PER_METER, spec.position[1] * CM_PER_METER, spec.position[2] * CM_PER_METER);
      s.target.position.set(...spec.direction).normalize();
      object.add(s.target);
      light = s;
    }
    object.add(light);
    return this.track({ id: spec.id, kind: "light", object, light: { spec, light }, alive: true });
  }

  createPolyline(spec: ViroSpecsDocumentPolyline, material: PreviewMaterial | null, parent: PreviewNode): PreviewNode {
    const object = new Group();
    object.name = "viro-line:" + spec.id;
    parent.object.add(object);
    parent.object.updateWorldMatrix(true, false);
    // Lens sets each point's world position; convert world centimeters to the parent's local space.
    const pointsCm = spec.points.map((p) => [p[0] * CM_PER_METER, p[1] * CM_PER_METER, p[2] * CM_PER_METER] as const);
    const local = pointsCm.flatMap((p) => parent.object.worldToLocal(new Vector3(p[0], p[1], p[2])).toArray());
    const geometry = new LineGeometry();
    geometry.setPositions(local);
    const rgba: Rgba = material?.baseColor ?? (this.options.defaultLineColor ? parseViroSpecsColor(this.options.defaultLineColor) : [0.91, 0.945, 1, 1]);
    const widthCm = spec.radiusMeters * CM_PER_METER * 2;
    const lineMaterial = new LineMaterial({ worldUnits: true, linewidth: widthCm, transparent: rgba[3] < 1, opacity: rgba[3] });
    lineMaterial.color.setRGB(rgba[0], rgba[1], rgba[2], SRGBColorSpace);
    this.lineMaterials.add(lineMaterial);
    const line = new Line2(geometry, lineMaterial);
    line.computeLineDistances();
    line.name = "viro-line-mesh:" + spec.id;
    object.add(line);
    return this.track({ id: spec.id, kind: "polyline", object, polyline: { line, widthCm, pointsCm, material }, alive: true });
  }

  bindInteraction(
    node: PreviewNode,
    interaction: ViroSpecsDocumentInteraction,
    emit: (event: ViroSpecsBackendInteraction) => void
  ): ViroSpecsCancel {
    const binding = { spec: interaction, emit };
    node.interaction = binding;
    return () => {
      if (node.interaction === binding) node.interaction = undefined;
    };
  }

  playAnimation(node: PreviewNode, plan: ViroSpecsNativeAnimationPlan, onComplete: () => void): ViroSpecsCancel {
    const currentOpacity = (): number =>
      node.text ? (node.textColor ?? node.text.layout.color)[3] * (node.opacity ?? 1) : node.opacity ?? 1;
    return this.animations.play(node.id, node.object, plan, currentOpacity, onComplete);
  }

  captureUiState(node: PreviewNode): ViroSpecsNodeUiState {
    return node.scroll ? { scrollNormalized: [node.scroll.normalized[0], node.scroll.normalized[1]] } : {};
  }

  restoreUiState(node: PreviewNode, state: ViroSpecsNodeUiState): void {
    if (!node.scroll || !state.scrollNormalized) return;
    node.scroll.normalized = [state.scrollNormalized[0], state.scrollNormalized[1]];
    this.scrollTo(node, state.scrollNormalized[1]);
  }
}
