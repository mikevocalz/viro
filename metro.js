// withViroMetro — registers 3D / XR asset extensions Metro must pass through
// to the bundle so Viro's native loaders can resolve them at runtime.
//
// Mirrors the upstream @reactvision/react-viro/metro helper. Lives at the
// package root because consumers import via `@reactvision/react-viro/metro`.

const VIRO_ASSET_EXTS = [
  'glb', 'gltf',
  'obj', 'mtl', 'fbx',
  'vrx',
  'hdr', 'exr',
  'ktx', 'ktx2',
  'arobject',
  'spz',           // 3DGS via @viro-external/splat-pass
];

function withViroMetro(config) {
  const assetExts = config?.resolver?.assetExts ?? [];
  const sourceExts = config?.resolver?.sourceExts ?? [];
  const merged = Array.from(new Set([...assetExts, ...VIRO_ASSET_EXTS]));
  return {
    ...config,
    resolver: {
      ...(config?.resolver ?? {}),
      assetExts: merged,
      sourceExts,
    },
  };
}

module.exports = { withViroMetro };
