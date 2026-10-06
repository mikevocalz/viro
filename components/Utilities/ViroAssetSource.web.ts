/**
 * Copyright © 2026 ReactVision
 *
 * Asset resolution on the web.
 *
 * The native resolver reaches into React Native's AssetSourceResolver as a
 * visionOS compatibility workaround. react-native-web has no such native
 * module, and a literal require() is resolved by web bundlers at build time
 * even when guarded at runtime. Keep the browser path isolated so importing
 * the Viro barrel never asks the web bundler to resolve native internals.
 */
import { Image } from "react-native";

export function resolveViroAssetSource(source: any): any {
  // react-native-web ships Image.getSize/prefetch/queryCache but no
  // resolveAssetSource; guard the call so a missing static is a fallback,
  // not a TypeError.
  const resolveAssetSource = (Image as any).resolveAssetSource;
  if (typeof resolveAssetSource === "function") {
    const resolved = resolveAssetSource(source);
    if (resolved) return resolved;
  }

  // On web a bundled asset arrives from the bundler as a URL string, or as
  // an ES module whose default export is one. { uri } sources pass through.
  if (typeof source === "string") return { uri: source };
  if (source && typeof source === "object") {
    if (typeof source.uri === "string") return source;
    if (typeof source.default === "string") return { uri: source.default };
  }
  return source;
}
