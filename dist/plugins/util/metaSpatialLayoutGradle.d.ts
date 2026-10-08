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
export declare const META_SPATIAL_LAYOUT_BEGIN = "// @reactvision/react-viro: Meta VR Layout SDK";
export declare const META_SPATIAL_LAYOUT_END = "// @reactvision/react-viro: end Meta VR Layout SDK";
export declare function renderMetaSpatialLayoutDependencies(bomVersion: string): string;
/** Removes the block written by {@link renderMetaSpatialLayoutDependencies}. */
export declare function stripMetaSpatialLayoutDependencies(contents: string): string;
export declare const META_SPATIAL_LAYOUT_FLAVOR_WARNING: string;
/**
 * Drops Viro's Layout SDK block from app/build.gradle when the app has a quest
 * flavor. Returns true when the file changed. Meant for a finalized mod, the
 * only point where flavors added by another plugin's build.gradle mod are
 * guaranteed to be on disk.
 */
export declare function removeMetaSpatialLayoutFromFlavoredApp(platformProjectRoot: string): boolean;
