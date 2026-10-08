"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.META_SPATIAL_LAYOUT_FLAVOR_WARNING = exports.META_SPATIAL_LAYOUT_END = exports.META_SPATIAL_LAYOUT_BEGIN = void 0;
exports.renderMetaSpatialLayoutDependencies = renderMetaSpatialLayoutDependencies;
exports.stripMetaSpatialLayoutDependencies = stripMetaSpatialLayoutDependencies;
exports.removeMetaSpatialLayoutFromFlavoredApp = removeMetaSpatialLayoutFromFlavoredApp;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const questFlavorManifest_1 = require("./questFlavorManifest");
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
exports.META_SPATIAL_LAYOUT_BEGIN = "// @reactvision/react-viro: Meta VR Layout SDK";
exports.META_SPATIAL_LAYOUT_END = "// @reactvision/react-viro: end Meta VR Layout SDK";
function renderMetaSpatialLayoutDependencies(bomVersion) {
    return `
    ${exports.META_SPATIAL_LAYOUT_BEGIN}
    implementation platform('com.meta.metavrx:metavrx-bom:${bomVersion}')
    implementation 'com.meta.metavrx.layout:layout-react-compat'
    implementation 'com.meta.metavrx.layout:layout-window-react-compat'
    ${exports.META_SPATIAL_LAYOUT_END}`;
}
/** Removes the block written by {@link renderMetaSpatialLayoutDependencies}. */
function stripMetaSpatialLayoutDependencies(contents) {
    const start = contents.indexOf(exports.META_SPATIAL_LAYOUT_BEGIN);
    if (start === -1)
        return contents;
    const endMarker = contents.indexOf(exports.META_SPATIAL_LAYOUT_END, start);
    if (endMarker === -1)
        return contents;
    const lineStart = contents.lastIndexOf("\n", start);
    const from = lineStart === -1 ? start : lineStart;
    return contents.slice(0, from) + contents.slice(endMarker + exports.META_SPATIAL_LAYOUT_END.length);
}
exports.META_SPATIAL_LAYOUT_FLAVOR_WARNING = "[Viro] android.metaSpatialLayout is on, but app/build.gradle has a quest product flavor. " +
    "Viro's plain `implementation` lines would reach every flavor, so they were left out. " +
    "Set metaSpatialLayout: false and enable metaLayoutSdk in @expo-pico/core, which links " +
    "the Layout SDK into the quest flavor only.";
/**
 * Drops Viro's Layout SDK block from app/build.gradle when the app has a quest
 * flavor. Returns true when the file changed. Meant for a finalized mod, the
 * only point where flavors added by another plugin's build.gradle mod are
 * guaranteed to be on disk.
 */
function removeMetaSpatialLayoutFromFlavoredApp(platformProjectRoot) {
    if (!(0, questFlavorManifest_1.hasQuestProductFlavor)(platformProjectRoot))
        return false;
    const gradlePath = path_1.default.join(platformProjectRoot, "app", "build.gradle");
    if (!fs_1.default.existsSync(gradlePath))
        return false;
    const before = fs_1.default.readFileSync(gradlePath, "utf8");
    const after = stripMetaSpatialLayoutDependencies(before);
    if (after === before)
        return false;
    fs_1.default.writeFileSync(gradlePath, after);
    return true;
}
