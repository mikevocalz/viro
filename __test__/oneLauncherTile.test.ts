import { afterEach, describe, expect, test } from "@jest/globals";
import { AndroidConfig, compileModsAsync } from "@expo/config-plugins";
import fs from "fs";
import os from "os";
import path from "path";
import { applyOneLauncherTileGradle, withViroAndroid } from "../plugins/withViroAndroid";
import {
  assertAtMostOneLauncherTile,
  launcherVisibleActivities,
  MAIN_ACTION,
  removeMainActionFromActivity,
  VR_ACTIVITY_ACTION,
} from "../plugins/util/launcherTiles";

type Manifest = AndroidConfig.Manifest.AndroidManifest;

const PACKAGE = "com.example.viroapp";

const LAUNCHER_ACTIVITY = `    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>`;

const manifestXml = (activities: string) => `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <application android:name=".MainApplication">
${activities}
  </application>
</manifest>
`;

// What plugin versions before this fix wrote for xRMode QUEST.
const LEGACY_VR_ACTIVITY = `    <activity android:name=".VRActivity" android:exported="false" android:launchMode="singleTask">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="com.oculus.intent.category.VR"/>
      </intent-filter>
      <meta-data android:name="com.oculus.vr.focusaware" android:value="true"/>
    </activity>`;

const APP_GRADLE = `android {
    defaultConfig {
        applicationId "${PACKAGE}"
    }
}
dependencies {
    implementation("com.facebook.react:react-android")
}
`;

const FLAVORED_APP_GRADLE = `android {
    flavorDimensions += "device"
    productFlavors {
        mobile { dimension "device" }
        quest { dimension "device" }
        pico { dimension "device" }
    }
    defaultConfig {
        applicationId "${PACKAGE}"
    }
}
dependencies {
    implementation("com.facebook.react:react-android")
}
`;

// The PICO overlay @expo-pico/core wrote before its fix.
const LEGACY_PICO_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <application>
    <activity android:name=".VRActivity" tools:node="merge">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="com.pico.intent.category.VR"/>
        <category android:name="com.picovr.intent.category.VR"/>
        <category android:name="org.khronos.openxr.intent.category.IMMERSIVE_HMD"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
`;

const tempRoots: string[] = [];

function makeProject(
  mainManifest: string,
  appGradle = APP_GRADLE,
  flavors: Record<string, string> = {}
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "viro-one-tile-"));
  tempRoots.push(root);
  const android = path.join(root, "android");
  const app = path.join(android, "app");
  const javaDir = path.join(app, "src", "main", "java", ...PACKAGE.split("."));
  fs.mkdirSync(javaDir, { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(app, "src", "main", "AndroidManifest.xml"), mainManifest);
  fs.writeFileSync(path.join(app, "build.gradle"), appGradle);
  fs.writeFileSync(path.join(android, "build.gradle"), "buildscript {}\n");
  fs.writeFileSync(path.join(android, "settings.gradle"), "rootProject.name = 'fixture'\n");
  fs.writeFileSync(path.join(android, "gradle.properties"), "android.targetSdkVersion=36\n");
  fs.writeFileSync(
    path.join(javaDir, "MainApplication.kt"),
    `package ${PACKAGE}\n\nclass MainApplication {\n  val packages = PackageList(this).packages\n}\n`
  );
  for (const [flavor, xml] of Object.entries(flavors)) {
    fs.mkdirSync(path.join(app, "src", flavor), { recursive: true });
    fs.writeFileSync(path.join(app, "src", flavor, "AndroidManifest.xml"), xml);
  }
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

async function prebuild(root: string, androidOptions: Record<string, unknown>) {
  const props = { android: androidOptions } as any;
  let config: any = {
    name: "fixture",
    slug: "fixture",
    android: { package: PACKAGE },
    plugins: [["@reactvision/react-viro", props]],
    _internal: { projectRoot: root },
  };
  config = withViroAndroid(config, props);
  await compileModsAsync(config, {
    projectRoot: root,
    platforms: ["android"],
    assertMissingModProviders: false,
  });
}

const read = (root: string, flavor = "main"): Promise<Manifest> =>
  AndroidConfig.Manifest.readAndroidManifestAsync(
    path.join(root, "android", "app", "src", flavor, "AndroidManifest.xml")
  );

const activity = (m: Manifest, name: string): any =>
  (m.manifest.application?.[0]?.activity ?? []).find((a: any) => a.$["android:name"] === name);

const actionsOf = (a: any): string[] =>
  (a?.["intent-filter"] ?? []).flatMap((f: any) => (f.action ?? []).map((x: any) => x.$["android:name"]));

const appGradle = (root: string) =>
  fs.readFileSync(path.join(root, "android", "app", "build.gradle"), "utf8");

describe("VRActivity is never launcher-visible", () => {
  test("fresh QUEST prebuild: one tile, VRActivity keeps its category under a non-MAIN action", async () => {
    const root = makeProject(manifestXml(LAUNCHER_ACTIVITY));
    await prebuild(root, { xRMode: ["QUEST"] });
    const main = await read(root);
    expect(launcherVisibleActivities(main)).toEqual([".MainActivity"]);
    const vr = activity(main, ".VRActivity");
    expect(actionsOf(vr)).toEqual([VR_ACTIVITY_ACTION]);
    expect(vr["intent-filter"][0].category).toEqual([
      { $: { "android:name": "com.oculus.intent.category.VR" } },
    ]);
  });

  test("a second prebuild changes nothing", async () => {
    const root = makeProject(manifestXml(LAUNCHER_ACTIVITY));
    await prebuild(root, { xRMode: ["QUEST"] });
    const firstManifest = fs.readFileSync(path.join(root, "android/app/src/main/AndroidManifest.xml"), "utf8");
    const firstGradle = appGradle(root);
    await prebuild(root, { xRMode: ["QUEST"] });
    expect(fs.readFileSync(path.join(root, "android/app/src/main/AndroidManifest.xml"), "utf8")).toBe(
      firstManifest
    );
    expect(appGradle(root)).toBe(firstGradle);
    expect(appGradle(root).match(/one-launcher-tile\.gradle/g)).toHaveLength(1);
  });

  test("strips the MAIN filter an older plugin version left on VRActivity", async () => {
    const root = makeProject(manifestXml(`${LAUNCHER_ACTIVITY}\n${LEGACY_VR_ACTIVITY}`));
    // AR alone: the cleanup must not depend on QUEST being configured.
    await prebuild(root, { xRMode: ["AR"] });
    const main = await read(root);
    expect(actionsOf(activity(main, ".VRActivity"))).toEqual([VR_ACTIVITY_ACTION]);
    expect(launcherVisibleActivities(main)).toEqual([".MainActivity"]);
  });

  test("strips a legacy MAIN filter from VRActivity in the quest flavor manifest", async () => {
    const legacyQuest = manifestXml(LEGACY_VR_ACTIVITY).replace(
      "<manifest ",
      '<manifest xmlns:tools="http://schemas.android.com/tools" '
    );
    const root = makeProject(manifestXml(LAUNCHER_ACTIVITY), FLAVORED_APP_GRADLE, { quest: legacyQuest });
    await prebuild(root, { xRMode: ["QUEST", "PICO"] });
    const quest = await read(root, "quest");
    expect(actionsOf(activity(quest, ".VRActivity"))).not.toContain(MAIN_ACTION);
  });

  test("applies the merged-manifest Gradle check from app/build.gradle", async () => {
    const root = makeProject(manifestXml(LAUNCHER_ACTIVITY));
    await prebuild(root, { xRMode: ["AR"] });
    expect(appGradle(root)).toMatch(/apply from: ".*\/android\/one-launcher-tile\.gradle"\n$/);
  });
});

describe("the prebuild fails on two tiles", () => {
  test("two launcher activities in main", async () => {
    const second = LAUNCHER_ACTIVITY.replace(".MainActivity", ".OtherActivity");
    const root = makeProject(manifestXml(`${LAUNCHER_ACTIVITY}\n${second}`));
    await expect(prebuild(root, { xRMode: ["AR"] })).rejects.toThrow(
      /\[one-launcher-tile\] app\/src\/main\/AndroidManifest\.xml declares 2 launcher-visible activities \(\.MainActivity, \.OtherActivity\)/
    );
  });

  test("a flavor manifest that gives VRActivity MAIN (old @expo-pico/core overlay)", async () => {
    const root = makeProject(manifestXml(LAUNCHER_ACTIVITY), FLAVORED_APP_GRADLE, {
      pico: LEGACY_PICO_MANIFEST,
    });
    await expect(prebuild(root, { xRMode: ["QUEST", "PICO"] })).rejects.toThrow(
      /app\/src\/main \+ app\/src\/pico AndroidManifest\.xml declares 2 launcher-visible activities/
    );
  });
});

describe("launcher tile helpers", () => {
  const parse = (activities: any[]): Manifest =>
    ({ manifest: { $: {}, application: [{ $: {}, activity: activities }] } }) as unknown as Manifest;
  const filter = (action: string, ...categories: string[]) => ({
    action: [{ $: { "android:name": action } }],
    category: categories.map((c) => ({ $: { "android:name": c } })),
  });

  test.each([
    "android.intent.category.LAUNCHER",
    "com.oculus.intent.category.VR",
    "com.pico.intent.category.VR",
    "com.picovr.intent.category.VR",
    "org.khronos.openxr.intent.category.IMMERSIVE_HMD",
  ])("MAIN + %s is launcher-visible", (category) => {
    const m = parse([{ $: { "android:name": ".A" }, "intent-filter": [filter(MAIN_ACTION, category)] }]);
    expect(launcherVisibleActivities(m)).toEqual([".A"]);
  });

  test("a VR category under a non-MAIN action is not", () => {
    const m = parse([
      { $: { "android:name": ".A" }, "intent-filter": [filter(VR_ACTIVITY_ACTION, "com.pico.intent.category.VR")] },
    ]);
    expect(launcherVisibleActivities(m)).toEqual([]);
  });

  test("a flavor that removes an activity takes away its tile", () => {
    const main = parse([
      { $: { "android:name": ".A" }, "intent-filter": [filter(MAIN_ACTION, "android.intent.category.LAUNCHER")] },
      { $: { "android:name": ".B" }, "intent-filter": [filter(MAIN_ACTION, "android.intent.category.LAUNCHER")] },
    ]);
    const flavor = parse([{ $: { "android:name": ".B", "tools:node": "remove" } }]);
    expect(() => assertAtMostOneLauncherTile("x", main, flavor)).not.toThrow();
    expect(() => assertAtMostOneLauncherTile("x", main)).toThrow(/declares 2/);
  });

  test('a flavor <intent-filter tools:node="removeAll"/> drops the filters main gave the activity', () => {
    const main = parse([
      { $: { "android:name": ".A" }, "intent-filter": [filter(MAIN_ACTION, "android.intent.category.LAUNCHER")] },
      { $: { "android:name": ".VRActivity" }, "intent-filter": [filter(MAIN_ACTION, "com.oculus.intent.category.VR")] },
    ]);
    const flavor = parse([
      { $: { "android:name": ".VRActivity" }, "intent-filter": [{ $: { "tools:node": "removeAll" } }] },
    ]);
    expect(() => assertAtMostOneLauncherTile("x", main, flavor)).not.toThrow();
  });

  test("removeMainActionFromActivity collapses duplicates and is idempotent", () => {
    const a: any = {
      $: { "android:name": ".VRActivity" },
      "intent-filter": [
        filter(MAIN_ACTION, "com.oculus.intent.category.VR"),
        filter(VR_ACTIVITY_ACTION, "com.oculus.intent.category.VR"),
      ],
    };
    removeMainActionFromActivity(a);
    const once = JSON.stringify(a);
    removeMainActionFromActivity(a);
    expect(JSON.stringify(a)).toBe(once);
    expect(a["intent-filter"]).toEqual([filter(VR_ACTIVITY_ACTION, "com.oculus.intent.category.VR")]);
  });

  test("applyOneLauncherTileGradle replaces a stale path", () => {
    const first = applyOneLauncherTileGradle("android {}\n", "../old/one-launcher-tile.gradle");
    const second = applyOneLauncherTileGradle(first, "../new/one-launcher-tile.gradle");
    expect(second).not.toContain("../old/");
    expect(second.match(/apply from/g)).toHaveLength(1);
  });
});
