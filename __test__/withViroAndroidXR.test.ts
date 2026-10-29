import { afterEach, describe, expect, test } from "@jest/globals";
import { AndroidConfig, compileModsAsync } from "@expo/config-plugins";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { withViroAndroid } from "../plugins/withViroAndroid";

const PACKAGE = "com.example.androidxr";
const roots: string[] = [];

function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "viro-android-xr-"));
  roots.push(root);
  const android = path.join(root, "android");
  const app = path.join(android, "app");
  const java = path.join(app, "src/main/java", ...PACKAGE.split("."));
  fs.mkdirSync(java, { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(android, "settings.gradle"), "rootProject.name = 'fixture'\n");
  fs.writeFileSync(path.join(android, "build.gradle"), "buildscript {}\n");
  fs.writeFileSync(path.join(android, "gradle.properties"), "android.targetSdkVersion=36\nandroid.minSdkVersion=28\n");
  fs.writeFileSync(path.join(app, "build.gradle"), `android {
  defaultConfig { applicationId "${PACKAGE}" }
}
dependencies { implementation("com.facebook.react:react-android") }
`);
  fs.writeFileSync(path.join(java, "MainApplication.kt"), `package ${PACKAGE}
class MainApplication {
  override fun getPackages() = PackageList(this).packages.apply {
    // add(MyReactNativePackage())
  }
}
`);
  fs.writeFileSync(path.join(app, "src/main/AndroidManifest.xml"), `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />
  <application android:name=".MainApplication">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>`);
  return { root, android, app, java };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

async function prebuild(root: string, androidOptions: Record<string, unknown> = { xRMode: ["ANDROID_XR"] }) {
  const props = { android: androidOptions } as any;
  // Exercise props as well as config.plugins: callers can compose the config
  // plugin directly instead of registering it by package name.
  let config: any = {
    name: "fixture", slug: "fixture", android: { package: PACKAGE },
    _internal: { projectRoot: root },
  };
  config = withViroAndroid(config, props);
  await compileModsAsync(config, {
    projectRoot: root, platforms: ["android"], assertMissingModProviders: false,
  });
  return AndroidConfig.Manifest.readAndroidManifestAsync(path.join(root, "android/app/src/main/AndroidManifest.xml"));
}

describe("Android XR Expo prebuild", () => {
  test("selects Android XR and generates an explicit immersive host with one launcher", async () => {
    const files = project();
    const { manifest } = await prebuild(files.root);
    const app = manifest.application![0] as any;
    expect(fs.readFileSync(path.join(files.java, "MainApplication.kt"), "utf8")).toContain(
      "add(ReactViroPackage(ReactViroPackage.ViroPlatform.ANDROID_XR))"
    );
    expect(fs.readFileSync(path.join(files.app, "build.gradle"), "utf8")).toContain(
      "missingDimensionStrategy 'device', 'androidxr'"
    );
    const vr = app.activity.find((activity: any) => activity.$["android:name"] === ".VRActivity");
    expect(vr).toBeDefined();
    expect(vr.property).toContainEqual({ $: {
      "android:name": "android.window.PROPERTY_XR_ACTIVITY_START_MODE",
      "android:value": "XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED",
    } });
    expect(vr["intent-filter"][0].category).toContainEqual({ $: {
      "android:name": "org.khronos.openxr.intent.category.IMMERSIVE_HMD",
    } });
    const launcherActivities = app.activity.filter((activity: any) =>
      activity["intent-filter"]?.some((filter: any) =>
        filter.action?.some((action: any) => action.$["android:name"] === "android.intent.action.MAIN")
      )
    );
    expect(launcherActivities.map((activity: any) => activity.$["android:name"])).toEqual([".MainActivity"]);
    expect(fs.readFileSync(path.join(files.java, "VRActivity.kt"), "utf8")).toContain(
      'override fun getMainComponentName(): String = "VRQuestScene"'
    );
    expect(manifest["uses-feature"]).toContainEqual({ $: {
      "android:name": "android.software.xr.api.openxr", "android:required": "true",
    } });
    expect(app["uses-native-library"]).toContainEqual({ $: {
      "android:name": "libopenxr.google.so", "android:required": "false",
    } });
    expect(manifest["uses-feature"]).toContainEqual({ $: {
      "android:name": "android.hardware.bluetooth_le", "android:required": "false",
    } });
    expect(JSON.stringify(manifest)).not.toMatch(/com\.oculus|horizonos|com\.google\.ar\.core/);
    expect(manifest["uses-permission"]?.some((entry) => entry.$["android:name"] === "android.permission.CAMERA")).toBe(false);
    const gradleProperties = fs.readFileSync(path.join(files.android, "gradle.properties"), "utf8");
    expect(gradleProperties).toContain("android.targetSdkVersion=36");
    expect(gradleProperties).toContain("android.minSdkVersion=28");
    expect(gradleProperties).toContain("reactNativeArchitectures=arm64-v8a");
  });

  test("repeated prebuilds keep one package, host, manifest declaration, and Gradle include", async () => {
    const files = project();
    const first = await prebuild(files.root);
    const firstGradle = fs.readFileSync(path.join(files.app, "build.gradle"), "utf8");
    const second = await prebuild(files.root);
    expect(second).toEqual(first);
    expect(fs.readFileSync(path.join(files.app, "build.gradle"), "utf8")).toBe(firstGradle);
    expect(fs.readFileSync(path.join(files.java, "MainApplication.kt"), "utf8").match(/ViroPlatform\.ANDROID_XR/g)).toHaveLength(1);
    expect(fs.readFileSync(path.join(files.android, "settings.gradle"), "utf8").match(/include ':react_viro'/g)).toHaveLength(1);
  });

  test.each(["QUEST", "PICO", "AR", "GVR"])("rejects a combined Android XR and %s build", (mode) => {
    expect(() => withViroAndroid(
      { name: "fixture", slug: "fixture" },
      { android: { xRMode: ["ANDROID_XR", mode as any] } }
    )).toThrow(/ANDROID_XR requires its own Android build/);
  });

  test("writes OpenXR render settings for Android XR", async () => {
    const files = project();
    const { manifest } = await prebuild(files.root, {
      xRMode: "ANDROID_XR",
      openxr: { eyeBufferScale: 1, foveation: { level: "off" } },
    });
    expect(manifest.application![0]["meta-data"]).toContainEqual({ $: {
      "android:name": "com.viro.openxr.eyeBufferScale", "android:value": "1",
    } });
  });

  test("an Android XR prebuild does not change a later mobile project's platform", async () => {
    await prebuild(project().root);
    const mobile = project();
    await prebuild(mobile.root, {});
    const source = fs.readFileSync(path.join(mobile.java, "MainApplication.kt"), "utf8");
    expect(source).toContain("ViroPlatform.AR");
    expect(source).toContain("ViroPlatform.GVR");
    expect(source).not.toContain("ViroPlatform.ANDROID_XR");
    expect(fs.existsSync(path.join(mobile.java, "VRActivity.kt"))).toBe(false);
  });

  test("preserves the Expo Android Gradle plugin and minimum SDK", async () => {
    const files = project();
    const rootGradle = `buildscript {
  ext { minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '28') }
  dependencies { classpath("com.android.tools.build:gradle") }
}
`;
    fs.writeFileSync(path.join(files.android, "build.gradle"), rootGradle);
    await prebuild(files.root);
    expect(fs.readFileSync(path.join(files.android, "build.gradle"), "utf8")).toBe(rootGradle);
  });
});
