import { createRequire } from "module";
import path from "path";
/** The package whose config plugin carries the spatial shell's native pieces. */
export const SPATIAL_SHELL_PACKAGE = "@viro-external/spatial-shell";
/** The config plugin entry inside {@link SPATIAL_SHELL_PACKAGE}. */
export const SPATIAL_SHELL_PLUGIN = `${SPATIAL_SHELL_PACKAGE}/plugin`;
/**
 * Resolves and loads {@link SPATIAL_SHELL_PLUGIN} from the app's root, the
 * way Node would from the app. The require is anchored at the app, so it
 * works whether this file runs as CommonJS or ESM.
 */
export const resolveSpatialShellPlugin = (projectRoot) => {
    const appRequire = createRequire(path.join(projectRoot, "package.json"));
    let file;
    try {
        file = appRequire.resolve(SPATIAL_SHELL_PLUGIN);
    }
    catch {
        return undefined;
    }
    const loaded = appRequire(file);
    return typeof loaded === "function" ? loaded : loaded.default;
};
/** The headset modes in `xRMode`, in a stable order. */
export function headsetPlatforms(xRMode) {
    const modes = Array.isArray(xRMode) ? xRMode : xRMode === undefined ? [] : [xRMode];
    return ["QUEST", "PICO"].filter((mode) => modes.includes(mode));
}
/**
 * Applies the spatial shell's config plugin for headset builds, so every Viro
 * app on Quest or PICO gets the left rail, the detail panel activity, the
 * immersive-activity marker, quest flavor ordering, the Horizon OS SDK
 * declaration and the activity-identity guard without adding a plugin entry.
 *
 * - `xRMode` without QUEST or PICO: nothing happens (phone and AR apps).
 * - `spatialShell: false`: nothing happens.
 * - Package installed: its plugin runs with `platforms` from `xRMode`.
 * - Package missing: one warning naming the install command; the build goes on.
 */
export const withViroSpatialShell = (config, input) => {
    if (input.spatialShell === false)
        return config;
    const platforms = headsetPlatforms(input.xRMode);
    if (platforms.length === 0)
        return config;
    const internal = config._internal;
    const projectRoot = typeof internal?.projectRoot === "string" ? internal.projectRoot : process.cwd();
    const plugin = (input.resolvePlugin ?? resolveSpatialShellPlugin)(projectRoot);
    if (plugin === undefined) {
        (input.warn ?? console.warn)(`[Viro] android.xRMode includes ${platforms.join(" and ")}, but ${SPATIAL_SHELL_PACKAGE} is not installed, ` +
            "so this headset build has no guarantee of the left navigation rail, the detail panel or the XR entry fixes. " +
            `Install it with \`npx expo install ${SPATIAL_SHELL_PACKAGE}\` and render <SpatialShell> at the app root, ` +
            "or set android.spatialShell to false in the @reactvision/react-viro plugin options to opt out.");
        return config;
    }
    return plugin(config, { ...input.spatialShell, platforms });
};
