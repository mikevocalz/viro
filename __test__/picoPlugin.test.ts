import fs from "fs";
import os from "os";
import path from "path";

jest.mock("@expo/config-plugins", () => {
  const actual = jest.requireActual("@expo/config-plugins");
  return {
    ...actual,
    withDangerousMod: (config: any, [, mod]: any) => {
      config.dangerous = mod;
      return config;
    },
    withAndroidManifest: (config: any, mod: any) => {
      config.manifestMod = mod;
      return config;
    },
    withGradleProperties: (config: any, mod: any) => {
      config.gradleMod = mod;
      return config;
    },
  };
});
import {
  resolveViroXrModes,
  withViroOpenXRActivity,
} from "../plugins/withViroAndroid";

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "viro-pico-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

async function generate(modes: any) {
  const config: any = withViroOpenXRActivity(
    {
      name: "test",
      slug: "test",
      android: { package: "com.test.xr" },
    },
    { android: { xRMode: modes } }
  );
  await config.dangerous({
    ...config,
    modRequest: { platformProjectRoot: root },
  });
  const manifest = await config.manifestMod({
    ...config,
    modResults: {
      manifest: {
        application: [
          { $: {}, activity: [{ $: { "android:name": ".MainActivity" } }] },
        ],
      },
    },
  });
  return { config, app: manifest.modResults.manifest.application[0] };
}

test("PICO alone generates the shared VR activity without Quest packaging or metadata", async () => {
  const { config, app } = await generate(["PICO"]);
  expect(
    fs.readFileSync(
      path.join(root, "app/src/main/java/com/test/xr/VRActivity.kt"),
      "utf8"
    )
  ).toContain('getMainComponentName(): String = "VRQuestScene"');
  expect(
    app.activity.find((a: any) => a.$["android:name"] === ".VRActivity")
  ).toBeTruthy();
  expect(JSON.stringify(app)).not.toContain("oculus");
  expect(config.gradleMod).toBeUndefined();
});

test("Quest still generates its activity contract and packaging settings", async () => {
  const { config, app } = await generate(["QUEST"]);
  expect(JSON.stringify(app)).toContain("com.oculus.intent.category.VR");
  const gradle = config.gradleMod({ modResults: [] });
  expect(gradle.modResults).toContainEqual({
    type: "property",
    key: "reactNativeArchitectures",
    value: "arm64-v8a",
  });
});

test("mixed OpenXR mode generates one shared activity", async () => {
  const { app } = await generate(["QUEST", "PICO"]);
  expect(
    app.activity.filter((a: any) => a.$["android:name"] === ".VRActivity")
  ).toHaveLength(1);
});

test("mode resolution does not leak between separate prebuilds and accepts fork alias", () => {
  const config: any = {
    plugins: [["@mikevocalz/react-viro", { android: { xRMode: ["PICO"] } }]],
  };
  expect(resolveViroXrModes(config)).toEqual(["PICO"]);
  expect(resolveViroXrModes({ name: "phone", slug: "phone" })).toEqual([
    "AR",
    "GVR",
  ]);
  expect(
    resolveViroXrModes(config, { android: { xRMode: ["QUEST"] } })
  ).toEqual(["QUEST"]);
});
