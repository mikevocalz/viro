/**
 * Element and asset IDs shared by the runtime and static compilers.
 *
 * See `docs/adr/0003-specs-id-strategy.md` for why IDs are built this way.
 */

/**
 * 32-bit FNV-1a over UTF-16 code units. Not cryptographic; it only has to be
 * deterministic and identical in Node, Hermes and JSC, which `Math.imul`
 * guarantees.
 */
function fnv1a32(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hex8(value: number): string {
  return ("00000000" + value.toString(16)).slice(-8);
}

/**
 * 48-bit content hash as 12 lower-case hex characters: two FNV-1a passes with
 * different offset bases, 24 bits from each.
 */
export function specsContentHash(text: string): string {
  return hex8(fnv1a32(text, 0x811c9dc5)).slice(0, 6) + hex8(fnv1a32(text, 0x050c5d1f)).slice(0, 6);
}

/** What an element without `viroTag` is identified by. */
export interface ViroSpecsIdContent {
  /** Node kind (`group`, `text`, ...), `polyline`, or `light`. */
  readonly kind: string;
  /** ID of the enclosing node, or `undefined` at the scene root. */
  readonly parentId: string | undefined;
  /**
   * What the element shows: text for `text`, the asset ID for `image` and
   * `model`, the local points for `polyline`, the light type for `light`,
   * empty for `group`.
   */
  readonly content: string;
  /** React `key`, when the element has one. */
  readonly key?: string;
}

/**
 * Content-hash ID: `kind + "-" + hash(kind, parent, ordinal, content, key)`.
 *
 * `ordinal` counts earlier siblings with the same kind, content and key, so it
 * is 0 unless two siblings are identical. Reordering distinct siblings
 * therefore keeps every ID; only identical twins swap, and they look the same.
 */
export function specsContentHashId(content: ViroSpecsIdContent, ordinal: number): string {
  const input = JSON.stringify([
    content.kind,
    content.parentId ?? "",
    ordinal,
    content.content,
    content.key ?? null,
  ]);
  return content.kind + "-" + specsContentHash(input);
}

/**
 * Hands out content-hash IDs while a compiler walks one scene, counting
 * identical siblings so twins get different IDs.
 */
export class ViroSpecsIdAllocator {
  private readonly seen = new Map<string, number>();

  /** Allocates the ID for one element without `viroTag`. */
  allocate(content: ViroSpecsIdContent): string {
    const bucket = JSON.stringify([content.kind, content.parentId ?? "", content.content, content.key ?? null]);
    const ordinal = this.seen.get(bucket) ?? 0;
    this.seen.set(bucket, ordinal + 1);
    return specsContentHashId(content, ordinal);
  }
}

/**
 * Normalizes a file path to forward slashes with `.` and `..` segments
 * resolved and a lower-case drive letter, so `C:\\app\\a\\..\\b.glb` and
 * `c:/app/b.glb` compare equal. Leading `..` segments of a relative path are
 * kept.
 */
export function normalizeSpecsPath(filePath: string): string {
  let text = filePath.replace(/\\/g, "/");
  let prefix = "";
  const drive = /^([A-Za-z]):(\/|$)/.exec(text);
  if (drive) {
    prefix = drive[1].toLowerCase() + ":/";
    text = text.slice(drive[0].length);
  } else if (text.startsWith("/")) {
    prefix = "/";
    text = text.slice(1);
  }
  const out: string[] = [];
  for (const segment of text.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (prefix === "") out.push("..");
      continue;
    }
    out.push(segment);
  }
  return prefix + out.join("/");
}

/**
 * Asset ID for a file: its path relative to the project root, with forward
 * slashes. The same asset gets the same ID whatever the working directory and
 * on any OS, because both inputs are absolute and are normalized first.
 *
 * Paths outside the root keep `../` segments.
 */
export function specsAssetIdFromPath(absoluteAssetPath: string, projectRoot: string): string {
  const asset = normalizeSpecsPath(absoluteAssetPath).split("/");
  const root = normalizeSpecsPath(projectRoot).split("/").filter((segment) => segment !== "");
  const assetSegments = asset.filter((segment) => segment !== "");
  let shared = 0;
  while (
    shared < root.length &&
    shared < assetSegments.length &&
    root[shared] === assetSegments[shared]
  ) {
    shared++;
  }
  const up = root.slice(shared).map(() => "..");
  return [...up, ...assetSegments.slice(shared)].join("/");
}

/**
 * Resolves a relative module request (`./a.glb`, `../b/c.png`) against the
 * absolute path of the file that contains it.
 */
export function resolveSpecsRequest(fromFile: string, request: string): string {
  const from = normalizeSpecsPath(fromFile);
  const directory = from.slice(0, from.lastIndexOf("/") + 1);
  return normalizeSpecsPath(directory + request);
}
