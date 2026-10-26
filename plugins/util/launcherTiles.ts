import { AndroidConfig } from "@expo/config-plugins";
import fs from "fs";
import path from "path";

/**
 * One launcher tile per app.
 *
 * Horizon OS and PICO OS list every activity whose intent-filter pairs
 * android.intent.action.MAIN with one of LAUNCHER_VISIBLE_CATEGORIES. Viro's
 * VRActivity used to carry MAIN + com.oculus.intent.category.VR, and
 * @expo-pico/core added MAIN + the PICO/OpenXR categories to it, so a PICO 4
 * Ultra showed the app twice. VRActivity is started by VRLauncher with an
 * explicit intent and never needs MAIN.
 *
 * The rule: exactly one activity in an app may be launcher-visible.
 */

export const MAIN_ACTION = "android.intent.action.MAIN";

/** Categories that put a MAIN activity in a phone or headset app library. */
export const LAUNCHER_VISIBLE_CATEGORIES = [
  "android.intent.category.LAUNCHER",
  "com.oculus.intent.category.VR",
  "com.pico.intent.category.VR",
  "com.picovr.intent.category.VR",
  "org.khronos.openxr.intent.category.IMMERSIVE_HMD",
] as const;

/**
 * Action used for VRActivity's headset categories. Anything but MAIN keeps
 * the categories on the activity without making it a launcher entry.
 */
export const VR_ACTIVITY_ACTION = "com.viro.intent.action.VR";

export const VR_ACTIVITY_NAME = ".VRActivity";

type Attrs = Record<string, string | undefined>;
type Node = { $?: Attrs; [key: string]: any };
type Manifest = AndroidConfig.Manifest.AndroidManifest;

const nameOf = (node: Node | undefined) => node?.$?.["android:name"];

/** True when `filter` lists MAIN and at least one launcher-visible category. */
export function isLauncherVisibleFilter(filter: Node): boolean {
  const actions: Node[] = filter.action ?? [];
  const categories: Node[] = filter.category ?? [];
  return (
    actions.some((a) => nameOf(a) === MAIN_ACTION) &&
    categories.some((c) => (LAUNCHER_VISIBLE_CATEGORIES as readonly string[]).includes(nameOf(c)!))
  );
}

/**
 * Replaces MAIN with VR_ACTIVITY_ACTION in every intent-filter of `activity`.
 * Clears filters an older plugin version left with MAIN, and keeps the
 * headset categories. Filters that end up identical collapse into one.
 * Idempotent.
 */
export function removeMainActionFromActivity(activity: Node): void {
  const filters: Node[] = activity["intent-filter"] ?? [];
  if (filters.length === 0) return;
  const seen = new Set<string>();
  const kept: Node[] = [];
  for (const filter of filters) {
    const actions: Node[] = filter.action ?? [];
    if (actions.some((a) => nameOf(a) === MAIN_ACTION)) {
      const rest = actions.filter((a) => nameOf(a) !== MAIN_ACTION);
      if (!rest.some((a) => nameOf(a) === VR_ACTIVITY_ACTION)) {
        rest.push({ $: { "android:name": VR_ACTIVITY_ACTION } });
      }
      filter.action = rest;
    }
    const key = JSON.stringify(filter);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(filter);
  }
  activity["intent-filter"] = kept;
}

/** Activity and activity-alias names that are launcher-visible in `manifest`. */
export function launcherVisibleActivities(manifest: Manifest): string[] {
  const app = (manifest.manifest.application?.[0] ?? {}) as Node;
  const names: string[] = [];
  for (const key of ["activity", "activity-alias"]) {
    for (const activity of (app[key] ?? []) as Node[]) {
      const filters: Node[] = activity["intent-filter"] ?? [];
      if (filters.some(isLauncherVisibleFilter)) names.push(nameOf(activity) ?? "(unnamed)");
    }
  }
  return names;
}

/**
 * Launcher-visible activities for the main manifest merged with one flavor
 * manifest. Approximates the manifest merger: an activity counts when either
 * file gives it a launcher-visible filter, unless the flavor removes it.
 */
export function launcherVisibleAcrossManifests(main: Manifest, flavor?: Manifest): string[] {
  const names = new Set(launcherVisibleActivities(main));
  if (flavor) {
    const app = (flavor.manifest.application?.[0] ?? {}) as Node;
    for (const key of ["activity", "activity-alias"]) {
      for (const activity of (app[key] ?? []) as Node[]) {
        const name = nameOf(activity);
        if (!name) continue;
        const node = activity.$?.["tools:node"];
        if (node === "remove" || node === "removeAll") {
          names.delete(name);
          continue;
        }
        const filters: Node[] = activity["intent-filter"] ?? [];
        // replace, or <intent-filter tools:node="removeAll"/>, drops the
        // filters main gave this activity.
        if (
          node === "replace" ||
          filters.some((f) => f.$?.["tools:node"] === "removeAll")
        ) {
          names.delete(name);
        }
        if (filters.some(isLauncherVisibleFilter)) names.add(name);
      }
    }
  }
  return [...names];
}

export function launcherTileError(where: string, names: string[]): Error {
  return new Error(
    `[one-launcher-tile] ${where} declares ${names.length} launcher-visible activities ` +
      `(${names.join(", ")}). PICO OS and Horizon OS show one app-library tile per ` +
      `activity whose intent-filter pairs ${MAIN_ACTION} with one of ` +
      `${LAUNCHER_VISIBLE_CATEGORIES.join(", ")}. Exactly one activity may do that. ` +
      `Start immersive activities with an explicit intent and give their headset ` +
      `categories a non-MAIN action such as ${VR_ACTIVITY_ACTION}.`
  );
}

/** Throws when `manifest` (optionally merged with a flavor) has more than one tile. */
export function assertAtMostOneLauncherTile(where: string, main: Manifest, flavor?: Manifest): void {
  const names = launcherVisibleAcrossManifests(main, flavor);
  if (names.length > 1) throw launcherTileError(where, names);
}

/**
 * Reads app/src/main and every app/src/<flavor> manifest on disk and throws
 * when main alone, or main plus any one flavor, has more than one
 * launcher-visible activity. Library manifests are checked by the Gradle
 * task in android/one-launcher-tile.gradle, which reads the merged result.
 */
export async function assertOneLauncherTileOnDisk(platformProjectRoot: string): Promise<void> {
  const srcDir = path.join(platformProjectRoot, "app", "src");
  const mainPath = path.join(srcDir, "main", "AndroidManifest.xml");
  if (!fs.existsSync(mainPath)) return;
  const main = await AndroidConfig.Manifest.readAndroidManifestAsync(mainPath);
  assertAtMostOneLauncherTile("app/src/main/AndroidManifest.xml", main);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "main") continue;
    const flavorPath = path.join(srcDir, entry.name, "AndroidManifest.xml");
    if (!fs.existsSync(flavorPath)) continue;
    const flavor = await AndroidConfig.Manifest.readAndroidManifestAsync(flavorPath);
    assertAtMostOneLauncherTile(
      `app/src/main + app/src/${entry.name} AndroidManifest.xml`,
      main,
      flavor
    );
  }
}
