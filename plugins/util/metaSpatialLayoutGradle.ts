import fs from "fs";
import path from "path";
import { hasQuestProductFlavor } from "./questFlavorManifest";

/**
 * The Gradle lines `android.metaSpatialLayout` adds to app/build.gradle.
 *
 * They are plain `implementation`, which is right for a single-variant Quest
 * app. An app with a `quest` product flavor (expo-horizon-core) would get the
 * Layout SDK in its mobile and pico flavors too. Swapping in
 * `questImplementation` would not fix that: the autolinked @metavr/* library
 * projects declare their AARs as `api(...)`, so every flavor still inherits
 * them, and the generated PackageList instantiates their ReactPackages in the
 * main source set. Keeping the SDK out of those flavors takes classpath
 * excludes plus stub packages, which @expo-pico/core's `metaLayoutSdk` option
 * already does. For flavored apps Viro therefore removes its block and points
 * at that option.
 */

export const META_SPATIAL_LAYOUT_BEGIN = "// @reactvision/react-viro: Meta VR Layout SDK";
export const META_SPATIAL_LAYOUT_END = "// @reactvision/react-viro: end Meta VR Layout SDK";

export function renderMetaSpatialLayoutDependencies(bomVersion: string): string {
  return `
    ${META_SPATIAL_LAYOUT_BEGIN}
    implementation platform('com.meta.metavrx:metavrx-bom:${bomVersion}')
    implementation 'com.meta.metavrx.layout:layout-react-compat'
    implementation 'com.meta.metavrx.layout:layout-window-react-compat'
    ${META_SPATIAL_LAYOUT_END}`;
}

/** Removes the block written by {@link renderMetaSpatialLayoutDependencies}. */
export function stripMetaSpatialLayoutDependencies(contents: string): string {
  const start = contents.indexOf(META_SPATIAL_LAYOUT_BEGIN);
  if (start === -1) return contents;
  const endMarker = contents.indexOf(META_SPATIAL_LAYOUT_END, start);
  if (endMarker === -1) return contents;
  const lineStart = contents.lastIndexOf("\n", start);
  const from = lineStart === -1 ? start : lineStart;
  return contents.slice(0, from) + contents.slice(endMarker + META_SPATIAL_LAYOUT_END.length);
}

export const META_SPATIAL_LAYOUT_FLAVOR_WARNING =
  "[Viro] android.metaSpatialLayout is on, but app/build.gradle has a quest product flavor. " +
  "Viro's plain `implementation` lines would reach every flavor, so they were left out. " +
  "Set metaSpatialLayout: false and enable metaLayoutSdk in @expo-pico/core, which links " +
  "the Layout SDK into the quest flavor only.";

/**
 * Drops Viro's Layout SDK block from app/build.gradle when the app has a quest
 * flavor. Returns true when the file changed. Meant for a finalized mod, the
 * only point where flavors added by another plugin's build.gradle mod are
 * guaranteed to be on disk.
 */
export function removeMetaSpatialLayoutFromFlavoredApp(platformProjectRoot: string): boolean {
  if (!hasQuestProductFlavor(platformProjectRoot)) return false;
  const gradlePath = path.join(platformProjectRoot, "app", "build.gradle");
  if (!fs.existsSync(gradlePath)) return false;
  const before = fs.readFileSync(gradlePath, "utf8");
  const after = stripMetaSpatialLayoutDependencies(before);
  if (after === before) return false;
  fs.writeFileSync(gradlePath, after);
  return true;
}
