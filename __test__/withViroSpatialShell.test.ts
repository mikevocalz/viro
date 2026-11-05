import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import withViro from "../plugins/withViro";
import {
  SPATIAL_SHELL_PACKAGE,
  headsetPlatforms,
  resolveSpatialShellPlugin,
  withViroSpatialShell,
} from "../plugins/withViroSpatialShell";

type Config = { name: string; slug: string; _internal?: { projectRoot: string }; applied?: unknown[] };

const baseConfig = (projectRoot = "/app"): Config => ({ name: "app", slug: "app", _internal: { projectRoot } });

function fakePlugin() {
  const calls: unknown[] = [];
  const plugin = (config: Config, options: unknown) => {
    calls.push(options);
    return { ...config, applied: [...(config.applied ?? []), options] };
  };
  return { calls, plugin };
}

describe("headsetPlatforms", () => {
  test("keeps QUEST and PICO in a stable order and drops phone modes", () => {
    expect(headsetPlatforms(["PICO", "AR", "QUEST", "GVR"])).toEqual(["QUEST", "PICO"]);
    expect(headsetPlatforms("QUEST")).toEqual(["QUEST"]);
    expect(headsetPlatforms(["AR", "GVR"])).toEqual([]);
    expect(headsetPlatforms(undefined)).toEqual([]);
  });
});

describe("withViroSpatialShell", () => {
  test("applies the shell plugin for QUEST and PICO with platforms from xRMode", () => {
    const { calls, plugin } = fakePlugin();
    const resolvePlugin = jest.fn(() => plugin as never);
    const result = withViroSpatialShell(baseConfig() as never, {
      xRMode: ["AR", "QUEST", "PICO"],
      spatialShell: { detailPanel: { defaultWidth: "480dp" } },
      resolvePlugin,
      warn: () => {
        throw new Error("no warning expected");
      },
    }) as unknown as Config;
    expect(resolvePlugin).toHaveBeenCalledWith("/app");
    expect(calls).toEqual([{ detailPanel: { defaultWidth: "480dp" }, platforms: ["QUEST", "PICO"] }]);
    expect(result.applied).toHaveLength(1);
  });

  test("applies with defaults when spatialShell is unset", () => {
    const { calls, plugin } = fakePlugin();
    withViroSpatialShell(baseConfig() as never, {
      xRMode: ["QUEST"],
      spatialShell: undefined,
      resolvePlugin: () => plugin as never,
    });
    expect(calls).toEqual([{ platforms: ["QUEST"] }]);
  });

  test("does nothing for phone and AR builds", () => {
    const resolvePlugin = jest.fn();
    const warn = jest.fn();
    const config = baseConfig();
    expect(withViroSpatialShell(config as never, { xRMode: ["AR", "GVR"], spatialShell: undefined, resolvePlugin, warn })).toBe(config);
    expect(resolvePlugin).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  test("spatialShell: false opts out without resolving or warning", () => {
    const resolvePlugin = jest.fn();
    const warn = jest.fn();
    const config = baseConfig();
    expect(withViroSpatialShell(config as never, { xRMode: ["QUEST", "PICO"], spatialShell: false, resolvePlugin, warn })).toBe(config);
    expect(resolvePlugin).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  test("a missing package warns once with the install command and leaves the config alone", () => {
    const warn = jest.fn();
    const config = baseConfig();
    const result = withViroSpatialShell(config as never, {
      xRMode: ["QUEST"],
      spatialShell: undefined,
      resolvePlugin: () => undefined,
      warn,
    });
    expect(result).toBe(config);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(`npx expo install ${SPATIAL_SHELL_PACKAGE}`);
    expect(warn.mock.calls[0][0]).toContain("android.spatialShell");
  });
});

describe("resolveSpatialShellPlugin", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(path.join(tmpdir(), "viro-spatial-shell-"));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  test("returns undefined when the app does not have the package", () => {
    expect(resolveSpatialShellPlugin(projectRoot)).toBeUndefined();
  });

  test("loads the package's ./plugin export from the app's node_modules", () => {
    const dir = path.join(projectRoot, "node_modules", "@viro-external", "spatial-shell");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: SPATIAL_SHELL_PACKAGE, exports: { "./plugin": "./app.plugin.js" } })
    );
    writeFileSync(
      path.join(dir, "app.plugin.js"),
      "module.exports = (config, options) => ({ ...config, shell: options });\n"
    );
    const plugin = resolveSpatialShellPlugin(projectRoot);
    expect(typeof plugin).toBe("function");
    expect((plugin as never as (c: object, o: object) => object)({ name: "x" }, { platforms: ["PICO"] })).toEqual({
      name: "x",
      shell: { platforms: ["PICO"] },
    });
  });
});

describe("withViro injects the spatial shell", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(path.join(tmpdir(), "viro-with-viro-"));
    const dir = path.join(projectRoot, "node_modules", "@viro-external", "spatial-shell");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: SPATIAL_SHELL_PACKAGE, exports: { "./plugin": "./app.plugin.js" } })
    );
    writeFileSync(
      path.join(dir, "app.plugin.js"),
      "module.exports = (config, options) => ({ ...config, spatialShellOptions: options });\n"
    );
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  const run = (android: object) =>
    withViro(
      { name: "app", slug: "app", _internal: { projectRoot } } as never,
      { android } as never
    ) as unknown as { spatialShellOptions?: unknown };

  test("a QUEST and PICO build gets the shell plugin", () => {
    expect(run({ xRMode: ["QUEST", "PICO"] }).spatialShellOptions).toEqual({ platforms: ["QUEST", "PICO"] });
  });

  test("the default xRMode (GVR, AR) does not", () => {
    expect(run({}).spatialShellOptions).toBeUndefined();
  });

  test("spatialShell: false opts a headset build out", () => {
    expect(run({ xRMode: ["QUEST"], spatialShell: false }).spatialShellOptions).toBeUndefined();
  });
});
