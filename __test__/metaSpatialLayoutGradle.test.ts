import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { compileModsAsync, withAppBuildGradle } from "@expo/config-plugins";
import fs from "fs";
import os from "os";
import path from "path";
import { withViroAndroid } from "../plugins/withViroAndroid";
import {
  META_SPATIAL_LAYOUT_BEGIN,
  META_SPATIAL_LAYOUT_END,
  META_SPATIAL_LAYOUT_FLAVOR_WARNING,
  renderMetaSpatialLayoutDependencies,
  stripMetaSpatialLayoutDependencies,
} from "../plugins/util/metaSpatialLayoutGradle";

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

const PLAIN_APP_GRADLE = `android {
    defaultConfig {
        applicationId "${PACKAGE}"
    }
}
dependencies {
    implementation("com.facebook.react:react-android")
}
`;

const FLAVORS = `    flavorDimensions += "device"
    productFlavors {
        mobile { dimension "device" }
        quest { dimension "device" }
    }
`;

const FLAVORED_APP_GRADLE = PLAIN_APP_GRADLE.replace("android {\n", `android {\n${FLAVORS}`);

const tempRoots: string[] = [];

function makeProject(appGradle: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "viro-meta-layout-"));
  tempRoots.push(root);
  const android = path.join(root, "android");
  const app = path.join(android, "app");
  const javaDir = path.join(app, "src", "main", "java", ...PACKAGE.split("."));
  fs.mkdirSync(javaDir, { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      dependencies: { "@metavr/layout-compat": "1.0.0", "@metavr/layout-window-compat": "1.0.0" },
    })
  );
  fs.writeFileSync(path.join(app, "src", "main", "AndroidManifest.xml"), MAIN_MANIFEST);
  fs.writeFileSync(path.join(app, "build.gradle"), appGradle);
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
  jest.restoreAllMocks();
});

/**
 * Runs Viro's Android mods. With `flavorsFromLaterMod`, a second plugin adds
 * the quest flavor in its own app build.gradle mod, registered before Viro so
 * it runs after Viro's (expo-horizon-core listed ahead of Viro in app.json).
 */
async function prebuild(root: string, flavorsFromLaterMod = false): Promise<string> {
  const props = { android: { xRMode: ["QUEST"], metaSpatialLayout: true } } as any;
  let config: any = {
    name: "fixture",
    slug: "fixture",
    android: { package: PACKAGE },
    _internal: { projectRoot: root },
  };
  if (flavorsFromLaterMod) {
    config = withAppBuildGradle(config, (c) => {
      c.modResults.contents = c.modResults.contents.replace("android {\n", `android {\n${FLAVORS}`);
      return c;
    });
  }
  config = withViroAndroid(config, props);
  await compileModsAsync(config, {
    projectRoot: root,
    platforms: ["android"],
    assertMissingModProviders: false,
  });
  return fs.readFileSync(path.join(root, "android", "app", "build.gradle"), "utf8");
}

describe("android.metaSpatialLayout", () => {
  test("single-variant app gets the Layout SDK as implementation", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const gradle = await prebuild(makeProject(PLAIN_APP_GRADLE));
    expect(gradle).toContain("implementation platform('com.meta.metavrx:metavrx-bom:1.2026.0.0')");
    expect(gradle).toContain("implementation 'com.meta.metavrx.layout:layout-react-compat'");
    expect(gradle).toContain("implementation 'com.meta.metavrx.layout:layout-window-react-compat'");
    expect(warn).not.toHaveBeenCalledWith(META_SPATIAL_LAYOUT_FLAVOR_WARNING);
  });

  test("app with a quest flavor gets no Layout SDK lines and a warning", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const gradle = await prebuild(makeProject(FLAVORED_APP_GRADLE));
    expect(gradle).not.toContain("com.meta.metavrx");
    expect(gradle).not.toContain(META_SPATIAL_LAYOUT_BEGIN);
    expect(gradle).toContain("implementation project(path: ':react_viro')");
    expect(warn).toHaveBeenCalledWith(META_SPATIAL_LAYOUT_FLAVOR_WARNING);
  });

  test("a quest flavor added by a mod that runs after Viro's is still seen", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const gradle = await prebuild(makeProject(PLAIN_APP_GRADLE), true);
    expect(gradle).toMatch(/productFlavors\s*\{[\s\S]*quest/);
    expect(gradle).not.toContain("com.meta.metavrx");
    expect(warn).toHaveBeenCalledWith(META_SPATIAL_LAYOUT_FLAVOR_WARNING);
  });
});

describe("stripMetaSpatialLayoutDependencies", () => {
  test("removes exactly the marked block", () => {
    const before = "dependencies {\n    implementation 'a'";
    const after = "\n    implementation 'b'\n}\n";
    const contents = before + renderMetaSpatialLayoutDependencies("1.0.0") + after;
    expect(stripMetaSpatialLayoutDependencies(contents)).toBe(before + after);
  });

  test("leaves contents without a complete block alone", () => {
    const partial = `x\n    ${META_SPATIAL_LAYOUT_BEGIN}\n    implementation 'y'\n`;
    expect(stripMetaSpatialLayoutDependencies(partial)).toBe(partial);
    expect(stripMetaSpatialLayoutDependencies(`a ${META_SPATIAL_LAYOUT_END}`)).toBe(
      `a ${META_SPATIAL_LAYOUT_END}`
    );
  });
});
