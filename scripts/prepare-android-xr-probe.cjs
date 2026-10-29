#!/usr/bin/env node
"use strict";

// Builds a consumer from the actual npm tarball, then runs Expo prebuild. No
// workspace links or manually assembled Android manifests are used. The
// optional --build compiles a standalone release APK using a local Android SDK.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { AndroidConfig } = require("@expo/config-plugins");

const repo = path.resolve(__dirname, "..");
const outIndex = process.argv.indexOf("--out");
if (outIndex !== -1 && !process.argv[outIndex + 1]) {
  throw new Error("--out requires a directory");
}
const out = path.resolve(outIndex === -1 ? path.join(repo, "build", "android-xr-probe") : process.argv[outIndex + 1]);
const build = process.argv.includes("--build");
assert(!fs.existsSync(out), `Output already exists: ${out}. Choose a new --out directory.`);
assert(fs.existsSync(path.join(repo, "dist", "plugins", "withViro.js")), "Run npm run build first.");
fs.mkdirSync(path.join(out, "vendor"), { recursive: true });

function run(command, args, cwd = out) {
  execFileSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, CI: "1" } });
}

function installedVersion(name) {
  return JSON.parse(fs.readFileSync(require.resolve(`${name}/package.json`), "utf8")).version;
}

async function checkManifest(file) {
  const { manifest } = await AndroidConfig.Manifest.readAndroidManifestAsync(file);
  const app = manifest.application?.[0];
  assert(app, `${file}: missing application`);
  const vr = app.activity?.find((activity) => /(?:^|\.)VRActivity$/.test(activity.$["android:name"]));
  assert(vr, `${file}: missing VRActivity`);
  assert(vr.property?.some((property) =>
    property.$["android:name"] === "android.window.PROPERTY_XR_ACTIVITY_START_MODE" &&
    property.$["android:value"] === "XR_ACTIVITY_START_MODE_FULL_SPACE_UNMANAGED"
  ), `${file}: immersive activity must use unmanaged Full Space`);
  assert(vr["intent-filter"]?.some((filter) => filter.category?.some((category) =>
    category.$["android:name"] === "org.khronos.openxr.intent.category.IMMERSIVE_HMD"
  )), `${file}: immersive activity category missing`);
  assert(app["uses-native-library"]?.some((library) =>
    library.$["android:name"] === "libopenxr.google.so"
  ), `${file}: OpenXR runtime library missing`);
  assert(manifest["uses-feature"]?.some((feature) =>
    feature.$["android:name"] === "android.software.xr.api.openxr" && feature.$["android:required"] === "true"
  ), `${file}: Android XR runtime feature missing`);
  const launcherActivities = app.activity.filter((activity) =>
    activity["intent-filter"]?.some((filter) =>
      filter.action?.some((action) => action.$["android:name"] === "android.intent.action.MAIN") &&
      filter.category?.some((category) => category.$["android:name"] === "android.intent.category.LAUNCHER")
    )
  );
  assert.equal(launcherActivities.length, 1, `${file}: expected one launcher activity`);
  assert(!/(?:^|\.)VRActivity$/.test(launcherActivities[0].$["android:name"]), `${file}: the panel owns the launcher tile`);
}

async function main() {
  // Snapshot this before npm pack. Later commits must not relabel the source
  // that produced the tarball while installation or Gradle is still running.
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  const sourceDirty = Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" }).trim());
  const packed = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", path.join(out, "vendor")], {
    cwd: repo, encoding: "utf8",
  }));
  const tarball = packed[0].filename;
  fs.cpSync(path.join(repo, "examples", "android-xr"), out, { recursive: true });
  fs.writeFileSync(path.join(out, "package.json"), JSON.stringify({
    name: "viro-android-xr-probe",
    version: "1.0.0",
    private: true,
    main: "index.js",
    scripts: { start: "expo start", android: "expo run:android", typecheck: "tsc --noEmit" },
    dependencies: {
      "@reactvision/react-viro": `file:vendor/${tarball}`,
      expo: installedVersion("expo"),
      react: installedVersion("react"),
      "react-native": installedVersion("react-native"),
      zustand: installedVersion("zustand"),
    },
    devDependencies: {
      "@types/react": installedVersion("@types/react"),
      typescript: installedVersion("typescript"),
    },
  }, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "tsconfig.json"), JSON.stringify({
    extends: "expo/tsconfig.base", compilerOptions: { strict: true, noEmit: true },
    include: ["**/*.ts", "**/*.tsx"], exclude: ["node_modules"],
  }, null, 2) + "\n");

  run("npm", ["install", "--ignore-scripts", "--strict-peer-deps", "--no-audit", "--no-fund", "--loglevel=error"]);
  run("npm", ["run", "typecheck"]);
  const expo = path.join(out, "node_modules", "expo", "bin", "cli");
  run(process.execPath, [expo, "prebuild", "--platform", "android", "--no-install", "--clean"]);

  const manifest = path.join(out, "android", "app", "src", "main", "AndroidManifest.xml");
  await checkManifest(manifest);
  const appGradle = fs.readFileSync(path.join(out, "android", "app", "build.gradle"), "utf8");
  assert.match(appGradle, /missingDimensionStrategy\s+["']device["']\s*,\s*["']androidxr["']/);
  const sourceRoot = path.join(out, "android", "app", "src", "main", "java", "com", "viro", "androidxrprobe");
  assert(fs.existsSync(path.join(sourceRoot, "VRActivity.kt")), "Generated immersive activity is missing");
  assert.match(fs.readFileSync(path.join(sourceRoot, "MainApplication.kt"), "utf8"), /ViroPlatform\.ANDROID_XR/);

  // A second prebuild must preserve valid project output and a single launcher.
  run(process.execPath, [expo, "prebuild", "--platform", "android", "--no-install"]);
  await checkManifest(manifest);

  let apkSha256 = null;
  if (build) {
    // Keep this diagnostic APK unminified. The inherited GVR 1.180 telemetry
    // classes reference private types unavailable to R8; production shrinking
    // requires isolating that legacy dependency and is a separate limitation.
    run(path.join(out, "android", "gradlew"), [
      ":app:assembleRelease", "--no-daemon", "-PreactNativeArchitectures=arm64-v8a",
      "-Pandroid.enableMinifyInReleaseBuilds=false",
    ], path.join(out, "android"));
    const apkDir = path.join(out, "android", "app", "build", "outputs", "apk", "release");
    const apks = fs.readdirSync(apkDir).filter((file) => file.endsWith(".apk"));
    assert.equal(apks.length, 1, "Expected one arm64 probe APK");
    const apk = path.join(apkDir, apks[0]);
    apkSha256 = crypto.createHash("sha256").update(fs.readFileSync(apk)).digest("hex");

    // Read the manifest from the actual APK. Checking only app/src/main would
    // miss permissions/features merged in from the packaged native libraries.
    const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    assert(sdk, "Set ANDROID_HOME or ANDROID_SDK_ROOT to inspect the built APK.");
    const cmdlineRoot = path.join(sdk, "cmdline-tools");
    const analyzer = fs.readdirSync(cmdlineRoot)
      .map((version) => path.join(cmdlineRoot, version, "bin", "apkanalyzer"))
      .find((file) => fs.existsSync(file));
    assert(analyzer, "Install Android SDK command-line tools (apkanalyzer). ");
    const apkManifest = path.join(out, "apk-AndroidManifest.xml");
    fs.writeFileSync(apkManifest, execFileSync(analyzer, ["manifest", "print", apk], { encoding: "utf8" }));
    await checkManifest(apkManifest);
    const parsed = await AndroidConfig.Manifest.readAndroidManifestAsync(apkManifest);
    const permissions = parsed.manifest["uses-permission"] ?? [];
    for (const permission of ["CAMERA", "RECORD_AUDIO", "EYE_TRACKING_FINE"]) {
      assert(!permissions.some((entry) => entry.$["android:name"] === `android.permission.${permission}`),
        `Probe APK unexpectedly declares ${permission}`);
    }
  }

  const report = {
    sourceCommit,
    sourceDirty,
    packageSha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(out, "vendor", tarball))).digest("hex"),
    consumerTypecheck: "passed",
    cleanPrebuild: "passed",
    repeatedPrebuild: "passed",
    apkBuild: build ? "passed" : "not-run",
    minification: "disabled-for-diagnostic-probe",
    apkManifest: build ? "passed" : "not-run",
    apkSha256,
    androidXrDeviceValidation: "not-run",
  };
  fs.writeFileSync(path.join(out, "validation.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`Android XR probe prepared: ${out}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
