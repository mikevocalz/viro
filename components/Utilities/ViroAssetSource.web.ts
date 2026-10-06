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
  return Image.resolveAssetSource(source);
}
