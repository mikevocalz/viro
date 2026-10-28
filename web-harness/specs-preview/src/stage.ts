import { Group, HemisphereLight, Scene } from "three";
import { PreviewAssetStore, type PreviewAssetStoreOptions } from "./assets";
import { ThreeSceneBackend } from "./backend/ThreeSceneBackend";
import type { TextRasterizer } from "./backend/textRaster";
import type { PreviewAsset, PreviewMaterial, PreviewNode } from "./backend/types";
import { readPreviewInput, type PreviewInput } from "./document";
import { FrameScheduler } from "./scheduler";
import type { ViroSpecsHostDiagnostic } from "./vendor/lens-core/ViroSpecsHostDiagnostics";
import type { ViroSpecsHostInteraction } from "./vendor/lens-core/ViroSpecsProtocol";
import { ViroSpecsSceneController, type ViroSpecsApplyResult, type ViroSpecsSceneLifecycle } from "./vendor/lens-core/ViroSpecsSceneController";

/** Result of {@linkcode PreviewStage.load}. */
export interface PreviewLoadResult {
  readonly input: PreviewInput;
  readonly apply: ViroSpecsApplyResult;
}

/** Construction options for {@linkcode PreviewStage}. */
export interface PreviewStageOptions {
  readonly rasterizer: TextRasterizer;
  readonly assets?: PreviewAssetStoreOptions;
  /**
   * Adds a hemisphere light while the scene declares no lights, so unlit
   * glTF materials are visible. Not part of the Lens scene. @default true
   */
  readonly fillLightWhenUnlit?: boolean;
}

/**
 * One previewed scene without a renderer: the three.js `Scene`, the Lens
 * controller over {@linkcode ThreeSceneBackend}, the asset store and the
 * frame clock. The app and each gallery card own one; they render it with a
 * shared `WebGLRenderer`.
 */
export class PreviewStage {
  readonly scene = new Scene();
  readonly container = new Group();
  readonly scheduler = new FrameScheduler();
  readonly assets: PreviewAssetStore;
  readonly backend: ThreeSceneBackend;
  readonly controller: ViroSpecsSceneController<PreviewNode, PreviewAsset, PreviewMaterial>;
  readonly diagnostics: ViroSpecsHostDiagnostic[] = [];
  readonly interactions: ViroSpecsHostInteraction[] = [];
  private readonly fill = new HemisphereLight(0xf2f4f8, 0x3a4250, 1.4);
  private readonly fillWhenUnlit: boolean;

  constructor(options: PreviewStageOptions) {
    this.assets = new PreviewAssetStore(options.assets);
    this.fillWhenUnlit = options.fillLightWhenUnlit ?? true;
    this.container.name = "viro-specs-preview";
    this.scene.add(this.container);
    this.fill.name = "preview-fill-light";
    this.backend = new ThreeSceneBackend({ container: this.container, resources: this.assets, rasterizer: options.rasterizer, scheduler: this.scheduler });
    this.controller = new ViroSpecsSceneController(this.backend, this.scheduler);
    this.controller.diagnostics.addOnDiagnosticListener((d) => this.diagnostics.push(d));
    this.controller.addOnInteractionListener((e) => {
      this.interactions.push(e);
      if (this.interactions.length > 50) this.interactions.shift();
    });
  }

  /** Lifecycle of the committed scene. */
  get lifecycle(): ViroSpecsSceneLifecycle {
    return this.controller.lifecycle;
  }

  /** Reads `json` with viro's validator, preloads its assets and presents it (navigation semantics). */
  async load(json: unknown, file?: string): Promise<PreviewLoadResult> {
    const input = readPreviewInput(json, file);
    await this.assets.preload(input.scene);
    this.diagnostics.length = 0;
    const apply = this.controller.present(input.scene);
    this.syncFill();
    return { input, apply };
  }

  /** Applies `json` as a state change on the committed scene (diff + patch ops). */
  async update(json: unknown, file?: string): Promise<PreviewLoadResult> {
    const input = readPreviewInput(json, file);
    await this.assets.preload(input.scene);
    const apply = this.controller.update(input.scene);
    this.syncFill();
    return { input, apply };
  }

  /** Advances the clock, the controller's frame work and animations. */
  step(deltaSeconds: number, viewportWidthPx: number, viewportHeightPx: number): void {
    this.scheduler.tick(deltaSeconds * 1000);
    this.backend.update(deltaSeconds, viewportWidthPx, viewportHeightPx);
  }

  dispose(): void {
    this.controller.dispose();
  }

  private syncFill(): void {
    const lit = this.backend.liveHandles().some((h) => h.kind === "light");
    if (this.fillWhenUnlit && !lit) this.scene.add(this.fill);
    else this.fill.removeFromParent();
  }
}
