import { ConfigPlugin, ExportedConfigWithProps, XcodeProject } from "@expo/config-plugins";
import { ViroConfigurationOptions } from "./withViro";
/**
 * Resolve the on-disk `@reactvision/react-viro/ios` directory as a path
 * relative to the iOS project root (where the Podfile lives).
 *
 * Hardcoding `../node_modules/...` assumes react-viro is installed in the app's
 * own `node_modules`. That is false under pnpm/yarn workspaces (and npm
 * workspaces), where the package is hoisted to the monorepo root or nested
 * under `.pnpm`, so `pod install` fails with "No podspec found for ViroKit".
 * Resolving via Node follows symlinks/hoisting and works in both flat and
 * workspace layouts.
 */
export declare function resolveViroIosRelativePath(projectRoot: string, iosRoot: string): string;
/** Environment variable that leaves every Viro pod out of `pod install`. */
export declare const VIRO_IOS_PODS_ENV = "VIRO_IOS_PODS";
export type ViroPodfileOptions = {
    /** Podfile-relative path to the package's `ios` directory. */
    viroIosRoot: string;
    cloudAnchorProvider?: string;
    geospatialAnchorProvider?: string;
    iosLinkage?: "dynamic" | "static";
    includeARCore?: boolean;
    includeSemantics?: boolean;
};
/**
 * Write the Viro pods into a Podfile. Running it again on its own output gives
 * the same Podfile, so repeated prebuilds over an existing ios/ folder are safe.
 *
 * The pods sit inside `if ENV['VIRO_IOS_PODS'] != 'skip'`. Viro's iOS binaries
 * (libViroReact.a, ViroKit.framework) are device-only arm64 builds with no
 * simulator slice, so a simulator build has to leave them out:
 *
 *     VIRO_IOS_PODS=skip pod install
 *
 * The app then builds without any Viro native code, and the JS side finds the
 * Viro native modules missing. A plain `pod install` brings them back for a
 * device build.
 */
export declare function applyViroPodfile(podfile: string, options: ViroPodfileOptions): string;
/**
 * Earlier plugin versions wrote `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`
 * into every target. That made simulator builds x86_64-only, and xcodebuild
 * rejects arm64-only simulators (any Apple-silicon simulator runtime without
 * Rosetta) because the app's platforms no longer match. Simulator builds now
 * leave Viro out with VIRO_IOS_PODS=skip instead, so this removes the old
 * setting from projects that still carry it. pbxproj files hold the key both
 * quoted and unquoted, and the value as `arm64` or `"arm64"`; every spelling
 * goes. A different value set by the app itself is left alone.
 */
export declare function removeSimulatorArm64Exclusion(project: ExportedConfigWithProps<XcodeProject>["modResults"]): XcodeProject;
export declare const withDefaultInfoPlist: ConfigPlugin<ViroConfigurationOptions>;
export declare const withViroIos: ConfigPlugin<ViroConfigurationOptions>;
