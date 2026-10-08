import { AndroidConfig } from "@expo/config-plugins";
/**
 * Meta-only manifest entries and where they go.
 *
 * With xRMode QUEST, the plugin writes Horizon OS permissions, features,
 * <application> meta-data, VRActivity's launch category and the
 * <horizonos:uses-horizonos-sdk> element into the main manifest. An app with
 * a `quest` product flavor (expo-horizon-core adds mobile + quest, and
 * @expo-pico/core adds pico alongside) builds its PICO and phone APKs from
 * that same main manifest, so they carried every one of them. For those apps
 * a finalized mod moves the entries into app/src/quest/AndroidManifest.xml.
 * A single-variant app keeps them in main.
 */
export declare const QUEST_FLAVOR_MANIFEST: string;
/** True for an `android:name` that only means something on Meta Horizon OS. */
export declare function isMetaOnlyName(name: string | undefined): boolean;
type Manifest = AndroidConfig.Manifest.AndroidManifest;
/**
 * Moves every Meta-only entry out of `main` into `quest`, then removes the
 * names in `disabled` (opted-out Quest features) from both. Covers
 * <uses-permission>, <uses-feature>, <application> meta-data, activity
 * meta-data and intent-filter categories, and <horizonos:uses-horizonos-sdk>.
 *
 * An entry the quest manifest already has is kept as it is: expo-horizon-core
 * rewrites that file on every prebuild with its own com.oculus.supportedDevices
 * and headtracking feature, which the user configured there. Idempotent.
 */
export declare function routeMetaEntriesToQuest(main: Manifest, quest: Manifest, disabled?: readonly string[]): void;
export type QuestFeatureOptions = {
    colocation?: boolean;
    eyeTracking?: boolean;
    passthroughCamera?: boolean;
    renderModel?: boolean;
};
/**
 * Manifest names that `android.questFeatures` turns off. They are removed
 * from both manifests, so an opt-out also clears a copy an earlier prebuild
 * left behind.
 */
export declare function disabledQuestEntryNames(questFeatures: QuestFeatureOptions | undefined): string[];
/**
 * True when app/build.gradle(.kts) declares a `quest` product flavor. The
 * Gradle file decides which source sets exist, so app/src/quest alone does
 * not count.
 */
export declare function hasQuestProductFlavor(platformProjectRoot: string): boolean;
/**
 * When the app has a quest flavor, moves the Meta-only entries from the main
 * manifest on disk into the quest flavor manifest (created if missing). Does
 * nothing for a single-variant app.
 */
export declare function syncQuestFlavorManifest(platformProjectRoot: string, disabled?: readonly string[]): Promise<boolean>;
export {};
