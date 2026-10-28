import { SRGBColorSpace, TextureLoader, type Texture } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { PreviewResources } from "./backend/ThreeSceneBackend";
import type { PreviewAsset, PreviewMaterial } from "./backend/types";

/** Where each asset ended up. */
export type AssetStatus = { readonly source: string; readonly kind: "image" | "model"; readonly state: "loaded" | "missing"; readonly url: string; readonly error?: string };

/** Construction options for {@linkcode PreviewAssetStore}. */
export interface PreviewAssetStoreOptions {
  /** URL prefix for a manifest source ID. @default "/viro-repo/" (the dev server serves the viro checkout there) */
  readonly baseUrl?: string;
  /** Explicit source ID to URL overrides, checked before `baseUrl`. */
  readonly urls?: Readonly<Record<string, string>>;
  readonly materials?: ReadonlyMap<string, PreviewMaterial>;
  /** Font families to treat as registered. Lens reports VS5007 for any other. @default ["Inter"] */
  readonly fonts?: readonly string[];
}

/**
 * The preview's asset registry. The Lens asset registry answers
 * synchronously; {@linkcode preload} loads everything a scene names first so
 * the controller sees the same synchronous answers (and material textures,
 * which the controller only accepts synchronously, resolve). An asset that
 * fails to load answers null, which the controller turns into VS5003 and a
 * placeholder.
 */
export class PreviewAssetStore implements PreviewResources {
  private readonly cache = new Map<string, PreviewAsset | null>();
  private readonly inflight = new Map<string, Promise<PreviewAsset | null>>();
  private readonly statuses = new Map<string, AssetStatus>();
  private readonly gltf = new GLTFLoader();
  private readonly textures = new TextureLoader();
  private readonly fonts: Set<string>;

  constructor(private readonly options: PreviewAssetStoreOptions = {}) {
    this.fonts = new Set(options.fonts ?? ["Inter"]);
  }

  /** Load results so far, by source. */
  get status(): readonly AssetStatus[] {
    return Array.from(this.statuses.values());
  }

  urlFor(source: string): string {
    return this.options.urls?.[source] ?? (this.options.baseUrl ?? "/viro-repo/") + source.replace(/^\.?\//, "");
  }

  /** Loads every image, model and material texture `scene` names. Never rejects. */
  async preload(scene: unknown): Promise<void> {
    const wanted = collectSources(scene);
    await Promise.all(wanted.map(([kind, source]) => this.fetch(kind, source)));
  }

  /** Drops failed loads so the next preload or load fetches them again (the error panel's Retry). */
  forgetMissing(): void {
    for (const [key, asset] of Array.from(this.cache)) {
      if (asset !== null) continue;
      this.cache.delete(key);
      this.inflight.delete(key);
      this.statuses.delete(key);
    }
  }

  loadAsset(kind: "image" | "model", source: string): PreviewAsset | null | Promise<PreviewAsset | null> {
    const key = kind + ":" + source;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    return this.fetch(kind, source);
  }

  resolveMaterial(id: string): PreviewMaterial | null {
    return this.options.materials?.get(id) ?? null;
  }

  hasFont(family: string): boolean {
    return this.fonts.has(family);
  }

  private fetch(kind: "image" | "model", source: string): Promise<PreviewAsset | null> {
    const key = kind + ":" + source;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const url = this.urlFor(source);
    const done = (asset: PreviewAsset | null, error?: string): PreviewAsset | null => {
      this.cache.set(key, asset);
      this.statuses.set(key, { source, kind, url, state: asset ? "loaded" : "missing", ...(error !== undefined ? { error } : {}) });
      return asset;
    };
    const promise =
      kind === "image"
        ? this.textures.loadAsync(url).then(
            (texture: Texture) => {
              texture.colorSpace = SRGBColorSpace;
              return done({ kind: "texture", source, texture });
            },
            (error: unknown) => done(null, describe(error))
          )
        : this.gltf.loadAsync(url).then(
            (gltf) => done({ kind: "model", source, scene: gltf.scene, animations: gltf.animations }),
            (error: unknown) => done(null, describe(error))
          );
    this.inflight.set(key, promise);
    return promise;
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof ProgressEvent !== "undefined" && error instanceof ProgressEvent) return "request failed";
  return String(error);
}

/** Image and model sources and material textures named in a protocol 1 or 2 scene. */
export function collectSources(scene: unknown): ["image" | "model", string][] {
  const out = new Map<string, ["image" | "model", string]>();
  if (typeof scene !== "object" || scene === null) return [];
  const record = scene as { nodes?: unknown; materials?: unknown };
  for (const node of Array.isArray(record.nodes) ? record.nodes : []) {
    if (typeof node !== "object" || node === null) continue;
    const { kind, source } = node as { kind?: unknown; source?: unknown };
    if ((kind === "image" || kind === "model") && typeof source === "string") out.set(kind + ":" + source, [kind, source]);
  }
  for (const material of Array.isArray(record.materials) ? record.materials : []) {
    const texture = typeof material === "object" && material !== null ? (material as { texture?: unknown }).texture : undefined;
    if (typeof texture === "string") out.set("image:" + texture, ["image", texture]);
  }
  return Array.from(out.values());
}
