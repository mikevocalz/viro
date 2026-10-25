import { afterEach, describe, expect, test } from "@jest/globals";
import { AndroidConfig, compileModsAsync } from "@expo/config-plugins";
import fs from "fs";
import os from "os";
import path from "path";
import { withViroAndroid } from "../plugins/withViroAndroid";
import {
  OPENXR_EYE_BUFFER_SCALE_MAX,
  OPENXR_EYE_BUFFER_SCALE_META,
  OPENXR_EYE_BUFFER_SCALE_MIN,
  OPENXR_FOVEATION_DYNAMIC_META,
  OPENXR_FOVEATION_LEVEL_META,
  resolveOpenXRRenderQualityMetaData,
} from "../plugins/util/openxrRenderQuality";

type Manifest = AndroidConfig.Manifest.AndroidManifest;

const PACKAGE = "com.example.viroapp";

const MAIN_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <application android:name=".MainApplication">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
`;

const APP_GRADLE = `android {
    defaultConfig {
        applicationId "${PACKAGE}"
    }
}
dependencies {
    implementation("com.facebook.react:react-android")
}
`;

describe("resolveOpenXRRenderQualityMetaData", () => {
  test("no openxr options writes nothing", () => {
    expect(resolveOpenXRRenderQualityMetaData(undefined, ["QUEST"])).toEqual([]);
    expect(resolveOpenXRRenderQualityMetaData({}, ["QUEST"])).toEqual([]);
  });

  test("eye-buffer scale only", () => {
    expect(resolveOpenXRRenderQualityMetaData({ eyeBufferScale: 1.5 }, ["QUEST"])).toEqual([
      { name: OPENXR_EYE_BUFFER_SCALE_META, value: "1.5" },
    ]);
  });

  test("foveation level without dynamic leaves dynamic to the runtime default", () => {
    expect(
      resolveOpenXRRenderQualityMetaData({ foveation: { level: "medium" } }, ["PICO"])
    ).toEqual([{ name: OPENXR_FOVEATION_LEVEL_META, value: "medium" }]);
  });

  test("all three keys", () => {
    expect(
      resolveOpenXRRenderQualityMetaData(
        { eyeBufferScale: 1, foveation: { level: "off", dynamic: false } },
        ["QUEST", "AR"]
      )
    ).toEqual([
      { name: OPENXR_EYE_BUFFER_SCALE_META, value: "1" },
      { name: OPENXR_FOVEATION_LEVEL_META, value: "off" },
      { name: OPENXR_FOVEATION_DYNAMIC_META, value: "false" },
    ]);
  });

  test("range bounds are inclusive", () => {
    expect(OPENXR_EYE_BUFFER_SCALE_MIN).toBe(1);
    expect(OPENXR_EYE_BUFFER_SCALE_MAX).toBe(3);
    expect(() =>
      resolveOpenXRRenderQualityMetaData({ eyeBufferScale: OPENXR_EYE_BUFFER_SCALE_MAX }, ["QUEST"])
    ).not.toThrow();
  });

  test.each([0.9, 0, -1, 3.01, NaN, Infinity, "1.5" as unknown as number])(
    "rejects eyeBufferScale %p",
    (eyeBufferScale) => {
      expect(() =>
        resolveOpenXRRenderQualityMetaData({ eyeBufferScale }, ["QUEST"])
      ).toThrow(/android\.openxr\.eyeBufferScale/);
    }
  );

  test("rejects an unknown foveation level", () => {
    expect(() =>
      resolveOpenXRRenderQualityMetaData({ foveation: { level: "ultra" as any } }, ["QUEST"])
    ).toThrow(/android\.openxr\.foveation\.level.*"off" \| "low" \| "medium" \| "high"/);
  });

  test("rejects foveation without a level", () => {
    expect(() =>
      resolveOpenXRRenderQualityMetaData({ foveation: { dynamic: true } as any }, ["QUEST"])
    ).toThrow(/android\.openxr\.foveation\.level/);
  });

  test("rejects a non-boolean dynamic", () => {
    expect(() =>
      resolveOpenXRRenderQualityMetaData(
        { foveation: { level: "low", dynamic: "yes" as any } },
        ["QUEST"]
      )
    ).toThrow(/android\.openxr\.foveation\.dynamic/);
  });

  test("requires an OpenXR xRMode", () => {
    expect(() =>
      resolveOpenXRRenderQualityMetaData({ eyeBufferScale: 1.3 }, ["AR", "GVR"])
    ).toThrow(/android\.openxr requires android\.xRMode to include "QUEST" or "PICO"/);
  });
});

const tempRoots: string[] = [];

function makeProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "viro-openxr-quality-"));
  tempRoots.push(root);
  const android = path.join(root, "android");
  const app = path.join(android, "app");
  const javaDir = path.join(app, "src", "main", "java", ...PACKAGE.split("."));
  fs.mkdirSync(javaDir, { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(app, "src", "main", "AndroidManifest.xml"), MAIN_MANIFEST);
  fs.writeFileSync(path.join(app, "build.gradle"), APP_GRADLE);
  fs.writeFileSync(path.join(android, "build.gradle"), "buildscript {}\n");
  fs.writeFileSync(path.join(android, "settings.gradle"), "rootProject.name = 'fixture'\n");
  fs.writeFileSync(path.join(android, "gradle.properties"), "android.targetSdkVersion=36\n");
  fs.writeFileSync(
    path.join(javaDir, "MainApplication.kt"),
    `package ${PACKAGE}\n\nclass MainApplication {\n  val packages = PackageList(this).packages\n}\n`
  );
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

async function prebuild(root: string, androidOptions: Record<string, unknown>): Promise<Manifest> {
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
  return AndroidConfig.Manifest.readAndroidManifestAsync(
    path.join(root, "android", "app", "src", "main", "AndroidManifest.xml")
  );
}

function metaData(manifest: Manifest): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of manifest.manifest.application?.[0]["meta-data"] ?? []) {
    const name = entry.$["android:name"];
    if (!out[name]) out[name] = [];
    out[name].push(entry.$["android:value"] as string);
  }
  return out;
}

describe("android.openxr in the manifest", () => {
  test("writes the three meta-data entries for a QUEST build", async () => {
    const manifest = await prebuild(makeProject(), {
      xRMode: ["QUEST"],
      openxr: { eyeBufferScale: 1.6, foveation: { level: "high", dynamic: false } },
    });
    const meta = metaData(manifest);
    expect(meta[OPENXR_EYE_BUFFER_SCALE_META]).toEqual(["1.6"]);
    expect(meta[OPENXR_FOVEATION_LEVEL_META]).toEqual(["high"]);
    expect(meta[OPENXR_FOVEATION_DYNAMIC_META]).toEqual(["false"]);
  });

  test("writes nothing when openxr is omitted", async () => {
    const manifest = await prebuild(makeProject(), { xRMode: ["QUEST"] });
    const meta = metaData(manifest);
    expect(meta[OPENXR_EYE_BUFFER_SCALE_META]).toBeUndefined();
    expect(meta[OPENXR_FOVEATION_LEVEL_META]).toBeUndefined();
    expect(meta[OPENXR_FOVEATION_DYNAMIC_META]).toBeUndefined();
  });

  test("a second prebuild over the same manifest does not duplicate entries", async () => {
    const root = makeProject();
    const options = { xRMode: ["PICO"], openxr: { eyeBufferScale: 1.2 } };
    await prebuild(root, options);
    const manifest = await prebuild(root, { ...options, openxr: { eyeBufferScale: 1.4 } });
    expect(metaData(manifest)[OPENXR_EYE_BUFFER_SCALE_META]).toEqual(["1.4"]);
  });

  test("an invalid value fails when the plugin is applied", () => {
    const props = { android: { xRMode: ["QUEST"], openxr: { eyeBufferScale: 0.5 } } } as any;
    const config: any = { name: "fixture", slug: "fixture", android: { package: PACKAGE } };
    expect(() => withViroAndroid(config, props)).toThrow(/eyeBufferScale/);
  });
});
