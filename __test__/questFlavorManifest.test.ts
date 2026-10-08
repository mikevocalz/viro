import { afterEach, describe, expect, test } from "@jest/globals";
import { AndroidConfig, compileModsAsync } from "@expo/config-plugins";
import fs from "fs";
import os from "os";
import path from "path";
import { withViroAndroid } from "../plugins/withViroAndroid";
import {
  disabledQuestEntryNames,
  hasQuestProductFlavor,
  isMetaOnlyName,
  routeMetaEntriesToQuest,
} from "../plugins/util/questFlavorManifest";

type Manifest = AndroidConfig.Manifest.AndroidManifest;

const PACKAGE = "com.example.viroapp";

const MAIN_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <application android:name=".MainApplication" android:allowBackup="true">
    <activity android:name=".MainActivity" android:exported="true" android:screenOrientation="portrait">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
`;

const PLAIN_APP_GRADLE = `android {
    defaultConfig {
        applicationId "${PACKAGE}"
    }
}
dependencies {
    implementation("com.facebook.react:react-android")
}
`;

// What expo-horizon-core inserts into app/build.gradle.
const FLAVORED_APP_GRADLE = `android {
    flavorDimensions += "device"
    productFlavors {
        mobile { dimension "device" }
        quest { dimension "device" }
    }
    defaultConfig {
        applicationId "${PACKAGE}"
    }
}
dependencies {
    implementation("com.facebook.react:react-android")
}
`;

// Shape of the quest manifest expo-horizon-core writes in its dangerous mod.
const HORIZON_QUEST_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>
  <uses-feature android:name="android.hardware.vr.headtracking" android:required="true" android:version="1"/>
  <application android:allowBackup="false" tools:replace="android:allowBackup">
    <meta-data android:name="com.oculus.supportedDevices" android:value="quest3|quest3s"/>
  </application>
</manifest>
`;

const tempRoots: string[] = [];

function makeProject(appGradle: string, questManifest?: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "viro-quest-flavor-"));
  tempRoots.push(root);
  const android = path.join(root, "android");
  const app = path.join(android, "app");
  const javaDir = path.join(app, "src", "main", "java", ...PACKAGE.split("."));
  fs.mkdirSync(javaDir, { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(app, "src", "main", "AndroidManifest.xml"), MAIN_MANIFEST);
  fs.writeFileSync(path.join(app, "build.gradle"), appGradle);
  fs.writeFileSync(path.join(android, "build.gradle"), "buildscript {}\n");
  fs.writeFileSync(path.join(android, "settings.gradle"), "rootProject.name = 'fixture'\n");
  fs.writeFileSync(path.join(android, "gradle.properties"), "android.targetSdkVersion=36\n");
  fs.writeFileSync(
    path.join(javaDir, "MainApplication.kt"),
    `package ${PACKAGE}\n\nclass MainApplication {\n  val packages = PackageList(this).packages\n}\n`
  );
  if (questManifest) {
    fs.mkdirSync(path.join(app, "src", "quest"), { recursive: true });
    fs.writeFileSync(path.join(app, "src", "quest", "AndroidManifest.xml"), questManifest);
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
  await compileModsAsync(config, { projectRoot: root, platforms: ["android"], assertMissingModProviders: false });
}

const read = (root: string, flavor: string): Promise<Manifest> =>
  AndroidConfig.Manifest.readAndroidManifestAsync(
    path.join(root, "android", "app", "src", flavor, "AndroidManifest.xml")
  );

/** Every android:name anywhere in the manifest, plus horizonos:* element names. */
function allNames(manifest: Manifest): string[] {
  const names: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "$") {
        const name = (value as Record<string, string>)["android:name"];
        if (name) names.push(name);
      } else {
        if (key.startsWith("horizonos:")) names.push(key);
        walk(value);
      }
    }
  };
  walk(manifest.manifest);
  return names;
}

const metaNames = (manifest: Manifest) =>
  allNames(manifest).filter((n) => isMetaOnlyName(n) || n.startsWith("horizonos:"));

const permissions = (m: Manifest) =>
  (m.manifest["uses-permission"] ?? []).map((p: any) => p.$["android:name"]);
const features = (m: Manifest) =>
  (m.manifest["uses-feature"] ?? []).map((f: any) => f.$["android:name"]);
const appMetaData = (m: Manifest) =>
  ((m.manifest.application?.[0] as any)?.["meta-data"] ?? []).map((d: any) => d.$["android:name"]);
const activity = (m: Manifest, name: string): any =>
  (m.manifest.application?.[0]?.activity ?? []).find((a: any) => a.$["android:name"] === name);

const EXPECTED_QUEST_PERMISSIONS = [
  "horizonos.permission.HAND_TRACKING",
  "com.oculus.permission.EYE_TRACKING",
  "horizonos.permission.USE_ANCHOR_API",
  "com.oculus.permission.USE_SCENE",
  "horizonos.permission.HEADSET_CAMERA",
  "horizonos.permission.IMPORT_EXPORT_IOT_MAP_DATA",
  "com.oculus.permission.BOUNDARY_VISIBILITY",
  "com.oculus.permission.RENDER_MODEL",
];
const EXPECTED_QUEST_FEATURES = [
  "android.hardware.vr.headtracking",
  "oculus.software.handtracking",
  "com.oculus.feature.PASSTHROUGH",
  "oculus.software.eye_tracking",
  "com.oculus.feature.RENDER_MODEL",
];

describe("Quest entries with a quest product flavor", () => {
  test('["QUEST", "PICO"]: main has no Meta entries, quest has all of them', async () => {
    const root = makeProject(FLAVORED_APP_GRADLE, HORIZON_QUEST_MANIFEST);
    await prebuild(root, {
      xRMode: ["QUEST", "PICO"],
      questAppId: "1234",
      metaVrGlassesCompatible: true,
    });
    const main = await read(root, "main");
    const quest = await read(root, "quest");

    expect(metaNames(main)).toEqual([]);
    expect(main.manifest.$).not.toHaveProperty("xmlns:horizonos");
    // VRActivity stays in main (PICO adds its own categories to it), minus
    // the Oculus launch category and focusaware.
    const mainVr = activity(main, ".VRActivity");
    expect(mainVr).toBeDefined();
    expect(mainVr["intent-filter"]).toBeUndefined();
    expect(mainVr["meta-data"]).toBeUndefined();

    expect(permissions(quest)).toEqual(expect.arrayContaining(EXPECTED_QUEST_PERMISSIONS));
    expect(features(quest)).toEqual(expect.arrayContaining(EXPECTED_QUEST_FEATURES));
    expect(appMetaData(quest)).toEqual(
      expect.arrayContaining([
        "com.oculus.supportedDevices",
        "com.oculus.app_id",
        "com.meta.store.defaultDeviceTargets",
      ])
    );
    expect(quest.manifest).toHaveProperty("horizonos:uses-horizonos-sdk");
    expect(quest.manifest.$).toHaveProperty("xmlns:horizonos", "http://schemas.horizonos/sdk");
    const questVr = activity(quest, ".VRActivity");
    expect(questVr.$["tools:node"]).toBe("merge");
    expect(questVr["intent-filter"]).toEqual([
      {
        action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
        category: [{ $: { "android:name": "com.oculus.intent.category.VR" } }],
      },
    ]);
    expect(questVr["meta-data"]).toEqual([
      { $: { "android:name": "com.oculus.vr.focusaware", "android:value": "true" } },
    ]);
  });

  test("keeps what expo-horizon-core wrote to the quest manifest", async () => {
    const root = makeProject(FLAVORED_APP_GRADLE, HORIZON_QUEST_MANIFEST);
    await prebuild(root, { xRMode: ["QUEST", "PICO"] });
    const quest = await read(root, "quest");
    const app = quest.manifest.application![0] as any;
    expect(app.$["android:allowBackup"]).toBe("false");
    const devices = app["meta-data"].filter(
      (d: any) => d.$["android:name"] === "com.oculus.supportedDevices"
    );
    expect(devices).toEqual([
      { $: { "android:name": "com.oculus.supportedDevices", "android:value": "quest3|quest3s" } },
    ]);
    expect(features(quest).filter((n) => n === "android.hardware.vr.headtracking")).toHaveLength(1);
    expect(permissions(quest)).toContain("android.permission.RECORD_AUDIO");
  });

  test("creates the quest manifest when no other plugin wrote one", async () => {
    const root = makeProject(FLAVORED_APP_GRADLE);
    await prebuild(root, { xRMode: ["AR", "QUEST"] });
    const main = await read(root, "main");
    const quest = await read(root, "quest");
    expect(metaNames(main)).toEqual([]);
    expect(permissions(quest)).toEqual(expect.arrayContaining(EXPECTED_QUEST_PERMISSIONS));
    // A combined AR + QUEST main manifest marks it optional; the quest APK
    // only installs on a headset.
    const headtracking = (quest.manifest["uses-feature"] as any[]).find(
      (f) => f.$["android:name"] === "android.hardware.vr.headtracking"
    );
    expect(headtracking.$["android:required"]).toBe("true");
  });

  test("Quest entries never include PICO ones", async () => {
    const root = makeProject(FLAVORED_APP_GRADLE, HORIZON_QUEST_MANIFEST);
    await prebuild(root, { xRMode: ["QUEST", "PICO"] });
    const quest = await read(root, "quest");
    expect(allNames(quest).filter((n) => /pico|pvr/i.test(n))).toEqual([]);
  });

  test("a second prebuild changes nothing", async () => {
    const root = makeProject(FLAVORED_APP_GRADLE, HORIZON_QUEST_MANIFEST);
    const options = { xRMode: ["QUEST", "PICO"], questAppId: "1234" };
    await prebuild(root, options);
    const mainPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
    const questPath = path.join(root, "android", "app", "src", "quest", "AndroidManifest.xml");
    const firstMain = fs.readFileSync(mainPath, "utf8");
    const firstQuest = fs.readFileSync(questPath, "utf8");
    await prebuild(root, options);
    expect(fs.readFileSync(mainPath, "utf8")).toBe(firstMain);
    expect(fs.readFileSync(questPath, "utf8")).toBe(firstQuest);
  });

  test("removes stale Meta entries an earlier prebuild left in main", async () => {
    const root = makeProject(PLAIN_APP_GRADLE);
    await prebuild(root, { xRMode: ["QUEST", "PICO"] });
    expect(metaNames(await read(root, "main")).length).toBeGreaterThan(0);

    // The app then gains flavors (expo-horizon-core added) and prebuilds again.
    fs.writeFileSync(path.join(root, "android", "app", "build.gradle"), FLAVORED_APP_GRADLE);
    await prebuild(root, { xRMode: ["QUEST", "PICO"] });
    expect(metaNames(await read(root, "main"))).toEqual([]);
    expect(permissions(await read(root, "quest"))).toEqual(
      expect.arrayContaining(EXPECTED_QUEST_PERMISSIONS)
    );
  });

  test("questFeatures opt-outs leave the entries out of both manifests", async () => {
    const root = makeProject(FLAVORED_APP_GRADLE, HORIZON_QUEST_MANIFEST);
    await prebuild(root, {
      xRMode: ["QUEST", "PICO"],
      questFeatures: { eyeTracking: false, passthroughCamera: false, colocation: false, renderModel: false },
    });
    const main = await read(root, "main");
    const quest = await read(root, "quest");
    const off = disabledQuestEntryNames({
      eyeTracking: false,
      passthroughCamera: false,
      colocation: false,
      renderModel: false,
    });
    expect(off).toHaveLength(6);
    for (const name of off) {
      expect(allNames(main)).not.toContain(name);
      expect(allNames(quest)).not.toContain(name);
    }
    expect(permissions(quest)).toContain("horizonos.permission.HAND_TRACKING");
  });

  test("an opt-out clears the copy a previous prebuild put in the quest manifest", async () => {
    const root = makeProject(FLAVORED_APP_GRADLE);
    await prebuild(root, { xRMode: ["QUEST"] });
    expect(permissions(await read(root, "quest"))).toContain("com.oculus.permission.EYE_TRACKING");
    await prebuild(root, { xRMode: ["QUEST"], questFeatures: { eyeTracking: false } });
    const quest = await read(root, "quest");
    expect(permissions(quest)).not.toContain("com.oculus.permission.EYE_TRACKING");
    expect(features(quest)).not.toContain("oculus.software.eye_tracking");
  });
});

describe("Quest entries in a single-variant app", () => {
  test("QUEST without flavors keeps everything in main", async () => {
    const root = makeProject(PLAIN_APP_GRADLE);
    await prebuild(root, { xRMode: ["QUEST"], questAppId: "1234" });
    const main = await read(root, "main");
    expect(fs.existsSync(path.join(root, "android", "app", "src", "quest"))).toBe(false);
    expect(permissions(main)).toEqual(expect.arrayContaining(EXPECTED_QUEST_PERMISSIONS));
    expect(features(main)).toEqual(expect.arrayContaining(EXPECTED_QUEST_FEATURES));
    expect(appMetaData(main)).toEqual(
      expect.arrayContaining(["com.oculus.supportedDevices", "com.oculus.app_id"])
    );
    expect(main.manifest).toHaveProperty("horizonos:uses-horizonos-sdk");
    const vr = activity(main, ".VRActivity");
    expect(vr["intent-filter"][0].category).toEqual([
      { $: { "android:name": "com.oculus.intent.category.VR" } },
    ]);
  });

  test("eyeTracking: false omits both entries instead of writing remove markers", async () => {
    const root = makeProject(PLAIN_APP_GRADLE);
    await prebuild(root, { xRMode: ["QUEST"] });
    await prebuild(root, { xRMode: ["QUEST"], questFeatures: { eyeTracking: false } });
    const names = allNames(await read(root, "main"));
    expect(names).not.toContain("com.oculus.permission.EYE_TRACKING");
    expect(names).not.toContain("oculus.software.eye_tracking");
    expect(names).toContain("horizonos.permission.HAND_TRACKING");
  });

  test("PICO alone writes no Meta entries", async () => {
    const root = makeProject(PLAIN_APP_GRADLE);
    await prebuild(root, { xRMode: ["PICO"] });
    expect(metaNames(await read(root, "main"))).toEqual([]);
  });
});

describe("routeMetaEntriesToQuest", () => {
  test("splits a filter that mixes Meta and other categories", () => {
    const main = {
      manifest: {
        $: {},
        application: [
          {
            $: {},
            activity: [
              {
                $: { "android:name": ".MainActivity" },
                "intent-filter": [
                  {
                    action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
                    category: [
                      { $: { "android:name": "android.intent.category.LAUNCHER" } },
                      { $: { "android:name": "com.oculus.intent.category.2D" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    } as unknown as Manifest;
    const quest = { manifest: { $: {} } } as unknown as Manifest;
    routeMetaEntriesToQuest(main, quest);
    expect(activity(main, ".MainActivity")["intent-filter"][0].category).toEqual([
      { $: { "android:name": "android.intent.category.LAUNCHER" } },
    ]);
    expect(activity(quest, ".MainActivity")["intent-filter"][0].category).toEqual([
      { $: { "android:name": "com.oculus.intent.category.2D" } },
    ]);
  });
});

describe("hasQuestProductFlavor", () => {
  test.each([
    [FLAVORED_APP_GRADLE, true],
    [PLAIN_APP_GRADLE, false],
    [`android {\n  productFlavors {\n    create("quest") { dimension = "device" }\n  }\n}\n`, true],
    [`android {\n  // productFlavors { quest { } }\n}\n`, false],
  ])("%#", (gradle, expected) => {
    const root = makeProject(gradle as string);
    expect(hasQuestProductFlavor(path.join(root, "android"))).toBe(expected);
  });
});
