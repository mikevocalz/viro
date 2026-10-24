import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { withDefaultInfoPlist } from "../plugins/withViroIos";
import {
  noInfoPlistDefinitionsAppConfigAfter,
  noInfoPlistDefinitionsAppConfigBefore,
  pluginConfigs,
} from "./noInfoPlistDefined";
import {
  infoPlistDefinedAppConfigAfter,
  infoPlistDefinedAppConfigBefore,
  infoPlistDefinedTestPluginConfigs,
} from "./infoPlistDefined";

describe("Android prebuilt AAR wrappers", () => {
  test.each(["react_viro", "viro_renderer"])(
    "%s keeps lint artifacts enabled for all device variants",
    (module) => {
      const gradle = readFileSync(resolve(__dirname, "../android", module, "build.gradle"), "utf8");
      expect(gradle).toContain("!it.name.endsWith('LocalLintAar')");
    }
  );
});

describe("withViro", () => {
  test("should correctly set InfoPlist config if no InfoPlist values are configured", () => {
    for (const configuration of pluginConfigs) {
      noInfoPlistDefinitionsAppConfigBefore.plugins = [configuration];
      noInfoPlistDefinitionsAppConfigAfter.plugins = [configuration];
      expect(
        withDefaultInfoPlist(
          noInfoPlistDefinitionsAppConfigBefore,
          undefined as any
        )
      ).toStrictEqual(noInfoPlistDefinitionsAppConfigAfter);
    }
  });

  test("should correctly set InfoPlist config if InfoPlist values are configured", () => {
    for (const scenario of infoPlistDefinedTestPluginConfigs) {
      infoPlistDefinedAppConfigBefore.ios.infoPlist = undefined;
      infoPlistDefinedAppConfigBefore.plugins = [scenario.config];
      infoPlistDefinedAppConfigAfter.plugins = [scenario.config];
      infoPlistDefinedAppConfigAfter.ios.infoPlist = scenario.afterInfoPlist;
      expect(
        withDefaultInfoPlist(infoPlistDefinedAppConfigBefore, undefined as any)
      ).toStrictEqual(infoPlistDefinedAppConfigAfter);
    }
  });

  // TODO: Testing that withViro updates files correctly (Podfile, Android files, etc.)
});

import {
  applyViroPodfile,
  removeSimulatorArm64Exclusion,
} from "../plugins/withViroIos";

const basePodfile = [
  "platform :ios, '15.1'",
  "",
  "target 'App' do",
  "  use_expo_modules!",
  "",
  "  post_install do |installer|",
  "    react_native_post_install(installer)",
  "  end",
  "end",
  "",
].join("\n");

describe("applyViroPodfile", () => {
  const options = { viroIosRoot: "../node_modules/@reactvision/react-viro/ios" };

  test("wraps every Viro pod in the VIRO_IOS_PODS skip guard", () => {
    const podfile = applyViroPodfile(basePodfile, options);
    const guardStart = podfile.indexOf("if ENV['VIRO_IOS_PODS'] != 'skip'");
    const guardEnd = podfile.indexOf("# @generated end react-viro-pods");
    expect(guardStart).toBeGreaterThan(-1);
    for (const pod of ["'ViroReact'", "'ViroReactExternalVideo'", "'ViroKit'"]) {
      const at = podfile.indexOf(`pod ${pod}`);
      expect(at).toBeGreaterThan(guardStart);
      expect(at).toBeLessThan(guardEnd);
    }
    expect(podfile.indexOf("post_install do |installer|")).toBeGreaterThan(guardEnd);
  });

  test("puts ARCore pods inside the guard too", () => {
    const podfile = applyViroPodfile(basePodfile, { ...options, includeARCore: true });
    const guardStart = podfile.indexOf("if ENV['VIRO_IOS_PODS'] != 'skip'");
    const guardEnd = podfile.indexOf("# @generated end react-viro-pods");
    const arcore = podfile.indexOf("pod 'ARCore/CloudAnchors'");
    expect(arcore).toBeGreaterThan(guardStart);
    expect(arcore).toBeLessThan(guardEnd);
  });

  test("is idempotent across repeated prebuilds", () => {
    for (const extra of [{}, { includeARCore: true }, { iosLinkage: "static" as const }]) {
      const once = applyViroPodfile(basePodfile, { ...options, ...extra });
      expect(applyViroPodfile(once, { ...options, ...extra })).toBe(once);
      expect(once.match(/pod 'ViroReact',/g)).toHaveLength(1);
    }
  });

  test("replaces pod lines written by older plugin versions, hand-edited or not", () => {
    const legacy = basePodfile.replace(
      "  post_install do |installer|",
      [
        "  # ViroReact with integrated New Architecture (Fabric) support",
        "  # Automatically includes Fabric components when RCT_NEW_ARCH_ENABLED=1",
        "  if ENV['HARLEM_VIRO'] != 'skip'",
        "    pod 'ViroReact', :path => '../old'",
        "    pod 'ViroKit', :path => '../old/dist/ViroRenderer/'",
        "  end",
        "",
        "  # Enforce New Architecture requirement",
        "  # ViroReact 2.43.1+ requires React Native New Architecture",
        "  if ENV['RCT_NEW_ARCH_ENABLED'] != '1'",
        '    raise "ViroReact requires New Architecture to be enabled. Please set RCT_NEW_ARCH_ENABLED=1 in ios/.xcode.env"',
        "  end",
        "  post_install do |installer|",
      ].join("\n")
    );
    const podfile = applyViroPodfile(legacy, options);
    expect(podfile).not.toContain("../old");
    expect(podfile).not.toContain("HARLEM_VIRO");
    expect(podfile.match(/pod 'ViroReact',/g)).toHaveLength(1);
    expect(podfile).toBe(applyViroPodfile(basePodfile, options));
  });

  test("fails loudly when the Podfile has no post_install block", () => {
    expect(() => applyViroPodfile("target 'App' do\nend\n", options)).toThrow(/post_install/);
  });
});

describe("removeSimulatorArm64Exclusion", () => {
  test("drops both spellings of the arm64 simulator exclusion and keeps other values", () => {
    const section: Record<string, any> = {
      a: { buildSettings: { PRODUCT_NAME: "App", '"EXCLUDED_ARCHS[sdk=iphonesimulator*]"': '"arm64"' } },
      b: { buildSettings: { PRODUCT_NAME: "App", "EXCLUDED_ARCHS[sdk=iphonesimulator*]": "arm64" } },
      c: { buildSettings: { "EXCLUDED_ARCHS[sdk=iphonesimulator*]": "i386" } },
      a_comment: "Debug",
    };
    const project = { pbxXCBuildConfigurationSection: () => section } as any;
    removeSimulatorArm64Exclusion(project);
    expect(section.a.buildSettings).toEqual({ PRODUCT_NAME: "App" });
    expect(section.b.buildSettings).toEqual({ PRODUCT_NAME: "App" });
    expect(section.c.buildSettings["EXCLUDED_ARCHS[sdk=iphonesimulator*]"]).toBe("i386");
  });
});
