import type { ConfigPlugin } from "@expo/config-plugins";
import { createRequire } from "module";
import path from "path";

/** The package whose config plugin carries the spatial shell's native pieces. */
export const SPATIAL_SHELL_PACKAGE = "@viro-external/spatial-shell";

/** The config plugin entry inside {@link SPATIAL_SHELL_PACKAGE}. */
export const SPATIAL_SHELL_PLUGIN = `${SPATIAL_SHELL_PACKAGE}/plugin`;

/** Headset xRModes the spatial shell configures. */
export type SpatialShellPlatform = "QUEST" | "PICO";

/**
 * Options forwarded to `@viro-external/spatial-shell/plugin`. `platforms` is
 * always derived from `android.xRMode`, so it is not settable here. See that
 * package's README for every field.
 */
export interface SpatialShellOptions {
  /** The detail panel activity, or `false` to skip it. */
  detailPanel?:
    | {
        activity?: string;
        defaultWidth?: string;
        defaultHeight?: string;
      }
    | false;
  /** `metavr:uses-metavr-sdk` versions for the quest flavor, or `false` to skip it. */
  horizonSdk?: { minSdkVersion?: number; targetSdkVersion?: number } | false;
  /** Mark Viro's `.VRActivity` as the immersive activity. Default true. */
  immersiveActivityMarker?: boolean;
  /** Keep `skipActivityIdentityAssertionOnHostPause` on in `MainApplication.kt`. Default true. */
  activityIdentityGuard?: boolean;
}

type SpatialShellPlugin = ConfigPlugin<SpatialShellOptions & { platforms: SpatialShellPlatform[] }>;

/**
 * Finds the spatial shell's config plugin from the app, or returns undefined
 * when the package is not installed.
 */
export type SpatialShellPluginResolver = (projectRoot: string) => SpatialShellPlugin | undefined;

/**
 * Resolves and loads {@link SPATIAL_SHELL_PLUGIN} from the app's root, the
 * way Node would from the app. The require is anchored at the app, so it
 * works whether this file runs as CommonJS or ESM.
 */
export const resolveSpatialShellPlugin: SpatialShellPluginResolver = (projectRoot) => {
  const appRequire = createRequire(path.join(projectRoot, "package.json"));
  let file: string;
  try {
    file = appRequire.resolve(SPATIAL_SHELL_PLUGIN);
  } catch {
    return undefined;
  }
  const loaded = appRequire(file) as SpatialShellPlugin | { default: SpatialShellPlugin };
  return typeof loaded === "function" ? loaded : loaded.default;
};

/** The headset modes in `xRMode`, in a stable order. */
export function headsetPlatforms(xRMode: unknown): SpatialShellPlatform[] {
  const modes = Array.isArray(xRMode) ? xRMode : xRMode === undefined ? [] : [xRMode];
  return (["QUEST", "PICO"] as const).filter((mode) => modes.includes(mode));
}

/** Input to {@link withViroSpatialShell}. */
export interface ViroSpatialShellInput {
  /** `android.xRMode` as the app set it. */
  xRMode: unknown;
  /** `android.spatialShell`: options, or `false` to opt out. */
  spatialShell: SpatialShellOptions | false | undefined;
  /** Where to resolve the package from. Defaults to the Expo project root. */
  resolvePlugin?: SpatialShellPluginResolver;
  /** Where install hints go. Defaults to `console.warn`. */
  warn?: (message: string) => void;
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
export const withViroSpatialShell: ConfigPlugin<ViroSpatialShellInput> = (config, input) => {
  if (input.spatialShell === false) return config;
  const platforms = headsetPlatforms(input.xRMode);
  if (platforms.length === 0) return config;
  const internal = (config as { _internal?: { projectRoot?: unknown } })._internal;
  const projectRoot = typeof internal?.projectRoot === "string" ? internal.projectRoot : process.cwd();
  const plugin = (input.resolvePlugin ?? resolveSpatialShellPlugin)(projectRoot);
  if (plugin === undefined) {
    (input.warn ?? console.warn)(
      `[Viro] android.xRMode includes ${platforms.join(" and ")}, but ${SPATIAL_SHELL_PACKAGE} is not installed, ` +
        "so this headset build has no guarantee of the left navigation rail, the detail panel or the XR entry fixes. " +
        `Install it with \`npx expo install ${SPATIAL_SHELL_PACKAGE}\` and render <SpatialShell> at the app root, ` +
        "or set android.spatialShell to false in the @reactvision/react-viro plugin options to opt out."
    );
    return config;
  }
  return plugin(config, { ...input.spatialShell, platforms });
};
