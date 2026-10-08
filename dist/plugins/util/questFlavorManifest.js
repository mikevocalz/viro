"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEST_FLAVOR_MANIFEST = void 0;
exports.isMetaOnlyName = isMetaOnlyName;
exports.routeMetaEntriesToQuest = routeMetaEntriesToQuest;
exports.disabledQuestEntryNames = disabledQuestEntryNames;
exports.hasQuestProductFlavor = hasQuestProductFlavor;
exports.syncQuestFlavorManifest = syncQuestFlavorManifest;
const config_plugins_1 = require("@expo/config-plugins");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Meta-only manifest entries and where they go.
 *
 * With xRMode QUEST, the plugin writes Horizon OS permissions, features,
 * <application> meta-data, VRActivity's launch category and the
 * <horizonos:uses-horizonos-sdk> element into the main manifest. An app with
 * a `quest` product flavor (expo-horizon-core adds mobile + quest, and
 * @expo-pico/core adds pico alongside) builds its PICO and phone APKs from
 * that same main manifest, so they carried every one of them. For those apps
 * a finalized mod moves the entries into app/src/quest/AndroidManifest.xml.
 * A single-variant app keeps them in main.
 */
exports.QUEST_FLAVOR_MANIFEST = path_1.default.join("app", "src", "quest", "AndroidManifest.xml");
const ANDROID_NS = "http://schemas.android.com/apk/res/android";
const TOOLS_NS = "http://schemas.android.com/tools";
const HORIZONOS_NS = "http://schemas.horizonos/sdk";
const HORIZONOS_SDK_ELEMENT = "horizonos:uses-horizonos-sdk";
/** Name prefixes that only Meta's Horizon OS reads. */
const META_NAME_PREFIXES = ["com.oculus.", "oculus.", "horizonos.", "com.meta."];
/** Android feature that Viro writes only for Quest builds. */
const HEADTRACKING_FEATURE = "android.hardware.vr.headtracking";
/** True for an `android:name` that only means something on Meta Horizon OS. */
function isMetaOnlyName(name) {
    if (!name)
        return false;
    return name === HEADTRACKING_FEATURE || META_NAME_PREFIXES.some((p) => name.startsWith(p));
}
const nameOf = (entry) => entry?.$?.["android:name"];
function pushUnique(target, entry) {
    if (!target.some((existing) => nameOf(existing) === nameOf(entry)))
        target.push(entry);
}
function setOrDelete(owner, key, list) {
    if (list.length > 0)
        owner[key] = list;
    else
        delete owner[key];
}
function applicationOf(root, create) {
    if (!root.application?.length) {
        if (!create)
            return undefined;
        root.application = [{ $: {} }];
    }
    return root.application[0];
}
/**
 * Moves every Meta-only entry out of `main` into `quest`, then removes the
 * names in `disabled` (opted-out Quest features) from both. Covers
 * <uses-permission>, <uses-feature>, <application> meta-data, activity
 * meta-data and intent-filter categories, and <horizonos:uses-horizonos-sdk>.
 *
 * An entry the quest manifest already has is kept as it is: expo-horizon-core
 * rewrites that file on every prebuild with its own com.oculus.supportedDevices
 * and headtracking feature, which the user configured there. Idempotent.
 */
function routeMetaEntriesToQuest(main, quest, disabled = []) {
    const m = main.manifest;
    const q = quest.manifest;
    q.$ ??= {};
    q.$["xmlns:android"] ??= ANDROID_NS;
    for (const key of ["uses-permission", "uses-feature"]) {
        const entries = m[key] ?? [];
        const moved = entries.filter((e) => isMetaOnlyName(nameOf(e)));
        if (moved.length === 0)
            continue;
        setOrDelete(m, key, entries.filter((e) => !isMetaOnlyName(nameOf(e))));
        const target = (q[key] ??= []);
        for (const entry of moved) {
            // The quest APK runs only on a headset, so head tracking is required
            // there even when a combined AR + QUEST main manifest made it optional.
            if (nameOf(entry) === HEADTRACKING_FEATURE && entry.$) {
                entry.$ = { ...entry.$, "android:required": "true" };
            }
            pushUnique(target, entry);
        }
    }
    const mainApp = applicationOf(m, false);
    if (mainApp) {
        const appMeta = mainApp["meta-data"] ?? [];
        const movedMeta = appMeta.filter((e) => isMetaOnlyName(nameOf(e)));
        if (movedMeta.length > 0) {
            setOrDelete(mainApp, "meta-data", appMeta.filter((e) => !isMetaOnlyName(nameOf(e))));
            const questApp = applicationOf(q, true);
            const target = (questApp["meta-data"] ??= []);
            movedMeta.forEach((entry) => pushUnique(target, entry));
        }
        for (const activity of (mainApp.activity ?? [])) {
            moveActivityMetaEntries(activity, q);
        }
    }
    if (m[HORIZONOS_SDK_ELEMENT]) {
        q[HORIZONOS_SDK_ELEMENT] ??= m[HORIZONOS_SDK_ELEMENT];
        q.$["xmlns:horizonos"] = HORIZONOS_NS;
        delete m[HORIZONOS_SDK_ELEMENT];
    }
    if (m.$ && !Object.keys(m).some((key) => key.startsWith("horizonos:"))) {
        delete m.$["xmlns:horizonos"];
    }
    if (disabled.length > 0) {
        for (const root of [m, q]) {
            for (const key of ["uses-permission", "uses-feature"]) {
                if (root[key]) {
                    setOrDelete(root, key, root[key].filter((e) => !disabled.includes(nameOf(e))));
                }
            }
        }
    }
}
/**
 * Moves an activity's Meta-only meta-data and intent-filter categories (for
 * VRActivity: com.oculus.vr.focusaware and com.oculus.intent.category.VR)
 * onto the same activity in the quest manifest, merged by name. The activity
 * itself stays in main, so a PICO flavor can still add its own categories.
 */
function moveActivityMetaEntries(activity, q) {
    const activityName = nameOf(activity);
    if (!activityName)
        return;
    const meta = activity["meta-data"] ?? [];
    const movedMeta = meta.filter((e) => isMetaOnlyName(nameOf(e)));
    if (movedMeta.length > 0) {
        setOrDelete(activity, "meta-data", meta.filter((e) => !isMetaOnlyName(nameOf(e))));
    }
    const questFilters = [];
    const keptFilters = [];
    for (const filter of (activity["intent-filter"] ?? [])) {
        const categories = filter.category ?? [];
        const metaCategories = categories.filter((c) => isMetaOnlyName(nameOf(c)));
        if (metaCategories.length === 0) {
            keptFilters.push(filter);
            continue;
        }
        // Same actions and data, Meta categories only. A flavor manifest cannot
        // add a category to a main filter; the merger adds this one beside it.
        questFilters.push({ ...filter, category: metaCategories });
        const rest = categories.filter((c) => !isMetaOnlyName(nameOf(c)));
        if (rest.length > 0)
            keptFilters.push({ ...filter, category: rest });
    }
    if (questFilters.length > 0)
        setOrDelete(activity, "intent-filter", keptFilters);
    if (movedMeta.length === 0 && questFilters.length === 0)
        return;
    q.$["xmlns:tools"] ??= TOOLS_NS;
    const questApp = applicationOf(q, true);
    const activities = (questApp.activity ??= []);
    let target = activities.find((a) => nameOf(a) === activityName);
    if (!target) {
        target = { $: { "android:name": activityName, "tools:node": "merge" } };
        activities.push(target);
    }
    const targetMeta = (target["meta-data"] ??= []);
    movedMeta.forEach((entry) => pushUnique(targetMeta, entry));
    const targetFilters = (target["intent-filter"] ??= []);
    for (const filter of questFilters) {
        const key = JSON.stringify(filter);
        if (!targetFilters.some((existing) => JSON.stringify(existing) === key)) {
            targetFilters.push(filter);
        }
    }
    if (targetMeta.length === 0)
        delete target["meta-data"];
}
/**
 * Manifest names that `android.questFeatures` turns off. They are removed
 * from both manifests, so an opt-out also clears a copy an earlier prebuild
 * left behind.
 */
function disabledQuestEntryNames(questFeatures) {
    const names = [];
    if (questFeatures?.eyeTracking === false) {
        names.push("com.oculus.permission.EYE_TRACKING", "oculus.software.eye_tracking");
    }
    if (questFeatures?.passthroughCamera === false) {
        names.push("horizonos.permission.HEADSET_CAMERA");
    }
    if (questFeatures?.colocation === false) {
        names.push("horizonos.permission.IMPORT_EXPORT_IOT_MAP_DATA");
    }
    if (questFeatures?.renderModel === false) {
        names.push("com.oculus.permission.RENDER_MODEL", "com.oculus.feature.RENDER_MODEL");
    }
    return names;
}
/**
 * True when app/build.gradle(.kts) declares a `quest` product flavor. The
 * Gradle file decides which source sets exist, so app/src/quest alone does
 * not count.
 */
function hasQuestProductFlavor(platformProjectRoot) {
    for (const file of ["build.gradle", "build.gradle.kts"]) {
        const gradlePath = path_1.default.join(platformProjectRoot, "app", file);
        if (!fs_1.default.existsSync(gradlePath))
            continue;
        const contents = fs_1.default
            .readFileSync(gradlePath, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/[^\n]*/g, "");
        if (/productFlavors\s*\{[\s\S]*?\bquest\s*\{/.test(contents) ||
            /productFlavors\s*\{[\s\S]*?create\(\s*["']quest["']\s*\)/.test(contents)) {
            return true;
        }
    }
    return false;
}
/**
 * When the app has a quest flavor, moves the Meta-only entries from the main
 * manifest on disk into the quest flavor manifest (created if missing). Does
 * nothing for a single-variant app.
 */
async function syncQuestFlavorManifest(platformProjectRoot, disabled = []) {
    if (!hasQuestProductFlavor(platformProjectRoot))
        return false;
    const mainPath = path_1.default.join(platformProjectRoot, "app", "src", "main", "AndroidManifest.xml");
    if (!fs_1.default.existsSync(mainPath))
        return false;
    const questPath = path_1.default.join(platformProjectRoot, exports.QUEST_FLAVOR_MANIFEST);
    const main = await config_plugins_1.AndroidConfig.Manifest.readAndroidManifestAsync(mainPath);
    const quest = fs_1.default.existsSync(questPath)
        ? await config_plugins_1.AndroidConfig.Manifest.readAndroidManifestAsync(questPath)
        : { manifest: { $: { "xmlns:android": ANDROID_NS } } };
    const mainBefore = JSON.stringify(main);
    const questBefore = JSON.stringify(quest);
    routeMetaEntriesToQuest(main, quest, disabled);
    if (JSON.stringify(main) !== mainBefore) {
        await config_plugins_1.AndroidConfig.Manifest.writeAndroidManifestAsync(mainPath, main);
    }
    if (JSON.stringify(quest) !== questBefore || !fs_1.default.existsSync(questPath)) {
        fs_1.default.mkdirSync(path_1.default.dirname(questPath), { recursive: true });
        await config_plugins_1.AndroidConfig.Manifest.writeAndroidManifestAsync(questPath, quest);
    }
    return true;
}
