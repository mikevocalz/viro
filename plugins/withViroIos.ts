import {
  ConfigPlugin,
  ExportedConfigWithProps,
  XcodeProject,
  withDangerousMod,
  withInfoPlist,
  withPlugins,
  withXcodeProject,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import fs from "fs";
import path from "path";
import { DEFAULTS, ViroConfigurationOptions } from "./withViro";

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
export function resolveViroIosRelativePath(projectRoot: string, iosRoot: string): string {
  const fallback = "../node_modules/@reactvision/react-viro/ios";
  try {
    const pkgJson = require.resolve("@reactvision/react-viro/package.json", {
      paths: [projectRoot],
    });
    // CocoaPods resolves :path relative to the directory of the Podfile (iosRoot).
    // Always emit POSIX separators (split on the current platform's sep and
    // re-join with "/") so the generated paths are valid on Windows too.
    return path.relative(iosRoot, path.join(path.dirname(pkgJson), "ios")).split(path.sep).join("/");
  } catch {
    return fallback;
  }
}

/** Environment variable that leaves every Viro pod out of `pod install`. */
export const VIRO_IOS_PODS_ENV = "VIRO_IOS_PODS";

const PODS_BEGIN = "# @generated begin react-viro-pods";
const PODS_END = "# @generated end react-viro-pods";
const LINKAGE_BEGIN = "# @generated begin react-viro-linkage";
const LINKAGE_END = "# @generated end react-viro-linkage";
const WEAKLINK_BEGIN = "# @generated begin react-viro-arcore-weak-linking";
const WEAKLINK_END = "# @generated end react-viro-arcore-weak-linking";

export type ViroPodfileOptions = {
  /** Podfile-relative path to the package's `ios` directory. */
  viroIosRoot: string;
  cloudAnchorProvider?: string;
  geospatialAnchorProvider?: string;
  iosLinkage?: "dynamic" | "static";
  includeARCore?: boolean;
  includeSemantics?: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove a marker-delimited block (markers included) wherever it appears. */
function removeGeneratedBlock(contents: string, begin: string, end: string): string {
  const block = new RegExp(
    `^[ \\t]*${escapeRegExp(begin)}[^\\n]*\\n[\\s\\S]*?^[ \\t]*${escapeRegExp(end)}[^\\n]*\\n?`,
    "gm"
  );
  return contents.replace(block, "");
}

/**
 * Pod lines written by plugin versions before the markers existed, including
 * hand-edited copies wrapped in an `if ENV[...] != 'skip'` guard. They are
 * removed so a prebuild over an existing ios/ folder does not declare the Viro
 * pods twice.
 */
const LEGACY_PODS_BLOCK =
  /^[ \t]*# ViroReact with integrated New Architecture \(Fabric\) support\n[\s\S]*?raise "ViroReact requires New Architecture[^\n]*\n[ \t]*end\n?/m;
const LEGACY_LINKAGE_BLOCK =
  /^(?:# WARNING: ARCore SDK typically requires dynamic frameworks\.\n# Static linkage is set[^\n]*\n|# Framework linkage[^\n]*\n)use_frameworks! :linkage => :\w+\n/m;
const LEGACY_WEAKLINK_BLOCK =
  /^[ \t]*# ViroKit ARCore weak linking - makes ARCore frameworks optional at runtime\n[\s\S]*?config\.build_settings\['OTHER_LDFLAGS'\] = other_ldflags\n[ \t]*end\n[ \t]*end\n?/m;

function insertBeforeLine(contents: string, anchor: string, insert: string): string {
  const lines = contents.split("\n");
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index === -1) {
    throw new Error(
      `[@reactvision/react-viro] Cannot find "${anchor}" in the Podfile, so the Viro pods cannot be added.`
    );
  }
  return [...lines.slice(0, index), insert, ...lines.slice(index)].join("\n");
}

function insertAfterLine(contents: string, anchor: string, insert: string): string {
  const lines = contents.split("\n");
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index === -1) {
    throw new Error(
      `[@reactvision/react-viro] Cannot find "${anchor}" in the Podfile, so the ARCore weak-linking hook cannot be added.`
    );
  }
  return [...lines.slice(0, index + 1), insert, ...lines.slice(index + 1)].join("\n");
}

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
export function applyViroPodfile(podfile: string, options: ViroPodfileOptions): string {
  const {
    viroIosRoot,
    cloudAnchorProvider,
    geospatialAnchorProvider,
    iosLinkage,
    includeARCore,
    includeSemantics,
  } = options;

  let data = podfile;
  data = removeGeneratedBlock(data, PODS_BEGIN, PODS_END);
  data = removeGeneratedBlock(data, LINKAGE_BEGIN, LINKAGE_END);
  data = removeGeneratedBlock(data, WEAKLINK_BEGIN, WEAKLINK_END);
  data = data.replace(LEGACY_PODS_BLOCK, "");
  data = data.replace(LEGACY_LINKAGE_BLOCK, "");
  data = data.replace(LEGACY_WEAKLINK_BLOCK, "");

  // ARCore pods: explicitly via includeARCore/includeSemantics, or implied by an ARCore provider.
  // ViroKit.podspec declares these as weak_frameworks, making ARCore optional at runtime.
  const needsARCoreForFeatures =
    cloudAnchorProvider === "arcore" || geospatialAnchorProvider === "arcore";
  const shouldIncludeARCore = includeARCore === true || needsARCoreForFeatures;
  const shouldIncludeSemantics = shouldIncludeARCore || includeSemantics === true;

  let pods =
    `  ${PODS_BEGIN} (written by the @reactvision/react-viro config plugin)\n` +
    `  # Viro's iOS binaries are device-only (arm64, no simulator slice). Before a\n` +
    `  # simulator build, run \`${VIRO_IOS_PODS_ENV}=skip pod install\` to leave every Viro\n` +
    `  # pod out; a plain \`pod install\` puts them back for device builds.\n` +
    `  if ENV['${VIRO_IOS_PODS_ENV}'] != 'skip'\n` +
    `    # ViroReact with integrated New Architecture (Fabric) support\n` +
    `    pod 'ViroReact', :path => '${viroIosRoot}'\n` +
    `    # VRTExternalVideo is newer than the prebuilt libViroReact.a, so it builds as its own pod\n` +
    `    pod 'ViroReactExternalVideo', :path => '${viroIosRoot}'\n` +
    `    pod 'ViroKit', :path => '${viroIosRoot}/dist/ViroRenderer/'`;

  if (shouldIncludeSemantics) {
    pods +=
      `\n\n    # ARCore SDK - Cloud Anchors, Geospatial, and Scene Semantics API\n` +
      `    # ViroKit weak-links these frameworks and checks for them with NSClassFromString,\n` +
      `    # so ARCore stays optional at runtime.\n` +
      `    pod 'ARCore/CloudAnchors', '~> 1.51.0'`;
    if (geospatialAnchorProvider === "arcore" || includeARCore === true) {
      pods += `\n    pod 'ARCore/Geospatial', '~> 1.51.0'`;
    }
    pods += `\n    pod 'ARCore/Semantics', '~> 1.51.0'`;
  }

  pods +=
    `\n\n    # ViroReact requires the React Native New Architecture\n` +
    `    if ENV['RCT_NEW_ARCH_ENABLED'] != '1'\n` +
    `      raise "ViroReact requires New Architecture to be enabled. Please set RCT_NEW_ARCH_ENABLED=1 in ios/.xcode.env"\n` +
    `    end\n` +
    `  end\n` +
    `  ${PODS_END}`;

  // The user's iosLinkage wins; with ARCore/Semantics and no setting, default to dynamic.
  const effectiveLinkage = iosLinkage || (shouldIncludeSemantics ? "dynamic" : undefined);
  if (effectiveLinkage) {
    let linkageComment: string;
    if (shouldIncludeSemantics && effectiveLinkage === "static") {
      linkageComment = `# WARNING: ARCore SDK typically requires dynamic frameworks.\n# Static linkage is set but may cause build issues with ARCore pods.`;
    } else if (shouldIncludeSemantics) {
      linkageComment = `# Framework linkage: ${effectiveLinkage} (ARCore requires dynamic frameworks)`;
    } else {
      linkageComment = `# Framework linkage configured via app.json (iosLinkage: "${effectiveLinkage}")`;
    }
    data = insertBeforeLine(
      data,
      "target '",
      `${LINKAGE_BEGIN}\n${linkageComment}\nuse_frameworks! :linkage => :${effectiveLinkage}\n${LINKAGE_END}`
    );
  }

  data = insertBeforeLine(data, "post_install do |installer|", pods);

  if (shouldIncludeARCore) {
    // Only ViroKit targets are touched, so this is a no-op when VIRO_IOS_PODS=skip.
    const weakLinkingHook = `    ${WEAKLINK_BEGIN}
    # ViroKit ARCore weak linking - makes ARCore frameworks optional at runtime
    # Only applied when ARCore pods are installed to prevent linker errors
    virokit_targets = installer.pods_project.targets.select { |target|
      target.name.include?('ViroKit') ||
      target.dependencies.any? { |dep| dep.name.include?('ViroKit') }
    }

    arcore_frameworks = ['ARCoreBase', 'ARCoreGARSession', 'ARCoreCloudAnchors',
                         'ARCoreGeospatial', 'ARCoreSemantics', 'ARCoreTFShared',
                         'FBLPromises', 'GoogleDataTransport', 'GoogleUtilities',
                         'FirebaseABTesting', 'FirebaseCore', 'FirebaseCoreInternal',
                         'FirebaseInstallations', 'FirebaseRemoteConfig',
                         'FirebaseRemoteConfigInterop', 'FirebaseSharedSwift',
                         'GTMSessionFetcher', 'nanopb']

    virokit_targets.each do |target|
      target.build_configurations.each do |config|
        other_ldflags = config.build_settings['OTHER_LDFLAGS'] || ['$(inherited)']
        other_ldflags = [other_ldflags] if other_ldflags.is_a?(String)

        arcore_frameworks.each do |framework|
          unless other_ldflags.include?('-weak_framework') && other_ldflags.include?(framework)
            other_ldflags << '-weak_framework'
            other_ldflags << framework
          end
        end

        config.build_settings['OTHER_LDFLAGS'] = other_ldflags
      end
    end
    ${WEAKLINK_END}`;
    data = insertAfterLine(data, "post_install do |installer|", weakLinkingHook);
  }

  return data;
}

function readViroPodOptions(config: ExpoConfig): Omit<ViroPodfileOptions, "viroIosRoot"> {
  const pluginConfig = Array.isArray(config.plugins)
    ? config.plugins.find(
        (plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro"
      )
    : undefined;
  if (!Array.isArray(pluginConfig) || pluginConfig.length < 2) return {};

  const options = pluginConfig[1] as ViroConfigurationOptions;
  // Resolve the unified provider prop; the old props override it for backward compat.
  // Default to "reactvision" only when rvApiKey is present (implies RV intent).
  const defaultProvider = options.rvApiKey ? "reactvision" : undefined;
  const legacyOpts = options as { cloudAnchorProvider?: string; geospatialAnchorProvider?: string };
  return {
    cloudAnchorProvider: legacyOpts.cloudAnchorProvider ?? options.provider ?? defaultProvider,
    geospatialAnchorProvider:
      legacyOpts.geospatialAnchorProvider ?? options.provider ?? defaultProvider,
    iosLinkage: options.iosLinkage,
    includeARCore: options.ios?.includeARCore,
    includeSemantics: options.ios?.includeSemantics,
  };
}

const withViroPods = (config: ExpoConfig) =>
  withDangerousMod(config, [
    "ios",
    async (newConfig) => {
      const root = newConfig.modRequest.platformProjectRoot;
      const projectRoot = newConfig.modRequest.projectRoot;
      const podfilePath = path.join(root, "Podfile");

      const podfile = await fs.promises.readFile(podfilePath, "utf-8");
      const updated = applyViroPodfile(podfile, {
        viroIosRoot: resolveViroIosRelativePath(projectRoot, root),
        ...readViroPodOptions(config),
      });
      if (updated !== podfile) {
        await fs.promises.writeFile(podfilePath, updated, "utf-8");
      }
      return newConfig;
    },
  ]);

const withEnabledBitcode: ConfigPlugin = (config) =>
  withXcodeProject(config, async (newConfig) => {
    newConfig.modResults.addBuildProperty("ENABLE_BITCODE", "NO", "Release");
    return newConfig;
  });

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
export function removeSimulatorArm64Exclusion(
  project: ExportedConfigWithProps<XcodeProject>["modResults"]
) {
  const configurations = project.pbxXCBuildConfigurationSection();
  const keys = [
    '"EXCLUDED_ARCHS[sdk=iphonesimulator*]"',
    "EXCLUDED_ARCHS[sdk=iphonesimulator*]",
  ];

  for (const configuration of Object.values(configurations || {}) as any[]) {
    const buildSettings = configuration?.buildSettings;
    if (!buildSettings || typeof buildSettings !== "object") continue;
    for (const key of keys) {
      const value = buildSettings[key];
      if (typeof value === "string" && value.replace(/"/g, "").trim() === "arm64") {
        delete buildSettings[key];
      }
    }
  }

  return project;
}

const withoutSimulatorArm64Exclusion: ConfigPlugin = (config) =>
  withXcodeProject(config, (newConfig) => {
    newConfig.modResults = removeSimulatorArm64Exclusion(newConfig.modResults);
    return newConfig;
  });

export const withDefaultInfoPlist: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  _props
) => {
  let savePhotosPermission = DEFAULTS.ios.savePhotosPermission;
  let photosPermission = DEFAULTS.ios.photosPermission;
  let cameraUsagePermission = DEFAULTS.ios.cameraUsagePermission;
  let microphoneUsagePermission = DEFAULTS.ios.microphoneUsagePermission;
  let locationUsagePermission = DEFAULTS.ios.locationUsagePermission;
  let googleCloudApiKey: string | undefined;
  let rvApiKey: string | undefined;
  let rvProjectId: string | undefined;
  let rvEndpoint: string | undefined;
  let cloudAnchorProvider: string | undefined;
  let geospatialAnchorProvider: string | undefined;
  let includeARCore: boolean | undefined;

  if (Array.isArray(config.plugins)) {
    const pluginConfig = config?.plugins?.find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro"
    );
    if (Array.isArray(pluginConfig) && pluginConfig.length > 1) {
      const pluginOptions = pluginConfig[1] as ViroConfigurationOptions;
      savePhotosPermission =
        pluginOptions.ios?.savePhotosPermission || savePhotosPermission;
      photosPermission = pluginOptions.ios?.photosPermission || photosPermission;
      microphoneUsagePermission =
        pluginOptions.ios?.microphoneUsagePermission || microphoneUsagePermission;
      cameraUsagePermission =
        pluginOptions.ios?.cameraUsagePermission || cameraUsagePermission;
      locationUsagePermission =
        pluginOptions.ios?.locationUsagePermission || locationUsagePermission;
      googleCloudApiKey = pluginOptions.googleCloudApiKey;
      rvApiKey = pluginOptions.rvApiKey;
      rvProjectId = pluginOptions.rvProjectId;
      rvEndpoint = pluginOptions.rvEndpoint;
      // Resolve unified provider prop; old props override for backward compat.
      // Default to "reactvision" only when rvApiKey is present (implies RV intent).
      const defaultProvider2 = pluginOptions.rvApiKey ? "reactvision" : undefined;
      const legacyOpts2 = pluginOptions as { cloudAnchorProvider?: string; geospatialAnchorProvider?: string };
      cloudAnchorProvider = legacyOpts2.cloudAnchorProvider ?? pluginOptions.provider ?? defaultProvider2;
      geospatialAnchorProvider = legacyOpts2.geospatialAnchorProvider ?? pluginOptions.provider ?? defaultProvider2;
      includeARCore = pluginOptions.ios?.includeARCore;
    }
  }

  if (!config.ios) config.ios = {};
  if (!config.ios.infoPlist) config.ios.infoPlist = {};
  config.ios.infoPlist.NSPhotoLibraryUsageDescription =
    config.ios.infoPlist.NSPhotoLibraryUsageDescription || photosPermission;
  config.ios.infoPlist.NSPhotoLibraryAddUsageDescription =
    config.ios.infoPlist.NSPhotoLibraryAddUsageDescription ||
    savePhotosPermission;
  config.ios.infoPlist.NSCameraUsageDescription =
    config.ios.infoPlist.NSCameraUsageDescription || cameraUsagePermission;
  config.ios.infoPlist.NSMicrophoneUsageDescription =
    config.ios.infoPlist.NSMicrophoneUsageDescription ||
    microphoneUsagePermission;

  // Add Google Cloud API key for ARCore Cloud Anchors and Geospatial API (iOS)
  if (googleCloudApiKey) {
    config.ios.infoPlist.GARAPIKey = googleCloudApiKey;
  }

  // Add ReactVision credentials for ReactVision Cloud Anchors and Geospatial API (iOS)
  if (rvApiKey) {
    config.ios.infoPlist.RVApiKey = rvApiKey;
  }
  if (rvProjectId) {
    config.ios.infoPlist.RVProjectId = rvProjectId;
  }
  if (rvEndpoint) {
    config.ios.infoPlist.RVEndpoint = rvEndpoint;
  }

  // Add location permissions for Geospatial API
  if (geospatialAnchorProvider === "arcore" || geospatialAnchorProvider === "reactvision" || includeARCore === true) {
    config.ios.infoPlist.NSLocationWhenInUseUsageDescription =
      config.ios.infoPlist.NSLocationWhenInUseUsageDescription || locationUsagePermission;
    config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription =
      config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription || locationUsagePermission;
  }

  return config;
};

// A mod rather than config.ios.infoPlist, which is merged over an existing Info.plist and so
// can add a key but never remove one.
export const withViroTelemetryInfoPlist = (config: ExpoConfig) =>
  withInfoPlist(config, (newConfig) => {
    const pluginConfig = newConfig.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === "@reactvision/react-viro"
    );
    const options = Array.isArray(pluginConfig)
      ? (pluginConfig[1] as ViroConfigurationOptions | undefined)
      : undefined;
    if (options?.telemetry === false) {
      newConfig.modResults.ViroTelemetryEnabled = false;
    } else {
      delete newConfig.modResults.ViroTelemetryEnabled;
    }
    return newConfig;
  });

export const withViroIos: ConfigPlugin<ViroConfigurationOptions> = (
  config,
  props
) => {
  config = withPlugins(config, [[withViroPods, props]]);
  withDefaultInfoPlist(config, props);
  config = withViroTelemetryInfoPlist(config);
  withEnabledBitcode(config);
  withoutSimulatorArm64Exclusion(config);
  return config;
};
