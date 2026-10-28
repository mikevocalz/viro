// Wires ViroGeneratedSceneHost into the open Lens Studio project.
//
// Runs inside Lens Studio through the MCP ExecuteEditorCode tool (pass this
// file as `path`). It is an async function body: `pluginSystem` and `args` are
// injected, and there are no top-level imports. Idempotent: objects are found
// by name and reused, so a rerun repairs a partly wired scene instead of
// duplicating it.
//
// args:
//   modelIds:      string[]  portable model source IDs from the compiled scene
//   modelGlb:      string    absolute path of the GLB to import for modelIds[0]
//   leafIndex:     boolean   attach ViroLabLeafIndex (default true)
//   save:          boolean   save the project at the end (default true)
//
// Returns { steps: string[], inputs: {...} } describing what it did.
const model = pluginSystem.findInterface(Editor.Model.IModel) as any;
const project = model.project;
const scene = project.scene;
const am = project.assetManager;
const opts = args as any;
const steps: string[] = [];
const inputs: Record<string, Record<string, string>> = {};

function sourcePath(asset: any): string {
  try {
    return String(asset.fileMeta?.sourcePath ?? "");
  } catch {
    return "";
  }
}

function findAsset(label: string, predicate: (asset: any) => boolean): any {
  const found = am.assets.find(predicate);
  if (!found) throw new Error(`Asset not found: ${label}`);
  return found;
}

function scriptAsset(name: string): any {
  return findAsset(`script ${name}`, (a: any) => a.name === name && /ScriptAsset$/.test(String(a.type)));
}

function rootObject(name: string): any {
  return scene.rootSceneObjects.find((o: any) => o.name === name) ?? null;
}

function ensureRoot(name: string): any {
  const existing = rootObject(name);
  if (existing) return existing;
  steps.push(`create root ${name}`);
  return scene.createSceneObject(name);
}

function ensureChild(parent: any, name: string): any {
  const existing = parent.children.find((o: any) => o.name === name);
  if (existing) return existing;
  const created = scene.createSceneObject(name);
  scene.reparentSceneObject(created, parent);
  steps.push(`create ${parent.name}/${name}`);
  return created;
}

function ensureScript(object: any, name: string): any {
  const asset = scriptAsset(name);
  const existing = object.components.find(
    (c: any) => String(c.getTypeName?.() ?? "").endsWith("ScriptComponent") && c.scriptAsset && c.scriptAsset.isSame(asset)
  );
  if (existing) return existing;
  const component = object.addComponent("ScriptComponent");
  component.scriptAsset = asset;
  steps.push(`attach ${name} to ${object.name}`);
  return component;
}

function setInput(component: any, owner: string, name: string, value: any, label: string): void {
  const names: string[] = component.inputNames ?? [];
  if (!names.includes(name)) {
    throw new Error(`${owner} has no @input ${name}; inputs are [${names.join(", ")}]`);
  }
  component[name] = value;
  (inputs[owner] ??= {})[name] = label;
}

// 1. Camera: Perspective with World device tracking, as SPECS needs.
const camera = scene.rootSceneObjects.find((o: any) => o.components.some((c: any) => String(c.getTypeName?.()) .endsWith("Camera")));
if (!camera) throw new Error("No root Camera in the scene.");
const cameraComponent = camera.components.find((c: any) => String(c.getTypeName?.()).endsWith("Camera"));
if (cameraComponent.cameraType !== Editor.Components.CameraType.Perspective) {
  cameraComponent.cameraType = Editor.Components.CameraType.Perspective;
  steps.push("camera -> Perspective");
}
let tracking = camera.components.find((c: any) => String(c.getTypeName?.()).endsWith("DeviceTracking"));
if (!tracking) {
  tracking = camera.addComponent("DeviceTracking");
  steps.push("camera + DeviceTracking");
}
if (tracking.deviceTrackingMode !== Editor.Components.DeviceTrackingMode.World) {
  tracking.deviceTrackingMode = Editor.Components.DeviceTrackingMode.World;
  steps.push("DeviceTracking -> World");
}

// 2. Spectacles Interaction Kit root prefab. SIK 4.0.0 names it InteractionKit.
const sikPrefab = findAsset(
  "SIK InteractionKit prefab",
  (a: any) => String(a.type) === "ObjectPrefab" && (a.name === "InteractionKit" || a.name === "SpectaclesInteractionKit")
);
if (!rootObject(sikPrefab.name)) {
  scene.instantiatePrefab(sikPrefab, null);
  steps.push(`instantiate ${sikPrefab.name} prefab at root`);
}

// Installing SurfacePlacement, VolumetricLine and NavigationKit through the
// Asset Library drops their demo content at the scene root. Disable it so it
// cannot interfere with the generated scene (reversible; nothing is deleted).
const DEMO_ROOTS = ["SurfacePlacement", "VolumetricLine", "NavigationKit", "Example Surface", "VolumetricLineExample"];
for (const root of scene.rootSceneObjects) {
  if (DEMO_ROOTS.includes(root.name) && root.enabled) {
    root.enabled = false;
    steps.push(`disable package demo root ${root.name}`);
  }
}

// 3. Model prefab for the compiled model source.
const modelIds: string[] = opts.modelIds ?? [];
const modelPrefabs: any[] = [];
if (modelIds.length) {
  if (!opts.modelGlb) throw new Error("modelGlb is required when modelIds is set.");
  const glbName = String(opts.modelGlb).split("/").pop()!.replace(/\.[^.]+$/, "");
  let prefab = am.assets.find((a: any) => String(a.type) === "ObjectPrefab" && a.name === glbName && sourcePath(a).startsWith("ViroSpecsLab/"));
  if (!prefab) {
    const imported = await am.importExternalFileAsync(
      new Editor.Path(opts.modelGlb),
      new Editor.Path("ViroSpecsLab/Models"),
      Editor.Model.ResultType.Auto
    );
    prefab = imported.primary;
    steps.push(`import ${glbName} -> ${String(prefab?.type)}`);
  }
  if (!prefab || String(prefab.type) !== "ObjectPrefab") {
    throw new Error(`Importing ${opts.modelGlb} did not produce an ObjectPrefab (got ${String(prefab?.type)}).`);
  }
  modelPrefabs.push(prefab);
}

// 4. Runtime hierarchy.
const runtime = ensureRoot("ViroSpecsRuntime");
const registryObject = ensureChild(runtime, "AssetRegistry");
const contentObject = ensureChild(runtime, "ViroGeneratedContent");
const generatedHostObject = ensureChild(runtime, "GeneratedHost");

const registry = ensureScript(registryObject, "ViroSpecsAssetRegistry");
setInput(registry, "AssetRegistry", "modelIds", modelIds, JSON.stringify(modelIds));
setInput(registry, "AssetRegistry", "modelPrefabs", modelPrefabs, modelPrefabs.map((p) => p.name).join(","));

// Packed packages live under ../Cache/<package-uuid>/<hash>/Data/. Scope
// lookups to the folder of a script the package ships, so a same-named
// asset from another package cannot be picked up.
function packageFolder(anchorScript: string): string {
  const parts = sourcePath(scriptAsset(anchorScript)).split("/");
  return parts.slice(0, 4).join("/") + "/";
}

// The generated host's own inputs say which runtime it targets.
const generatedHost = ensureScript(generatedHostObject, "ViroGeneratedSceneHost");
const hostInputs: string[] = generatedHost.inputNames ?? [];

if (hostInputs.includes("sceneHostObject")) {
  // Scene protocol 2: one ViroSpecsSceneControllerHost does render,
  // interaction, animation and polylines.
  const sceneHostObject = ensureChild(runtime, "SceneHost");
  const sceneHost = ensureScript(sceneHostObject, "ViroSpecsSceneControllerHost");
  setInput(sceneHost, "SceneHost", "assetRegistryObject", registryObject, registryObject.name);
  setInput(sceneHost, "SceneHost", "root", contentObject, contentObject.name);

  // Materials created by the setup script's materials step (asset-graphql presets).
  const material = (name: string) =>
    findAsset(`material ${name}`, (a: any) => String(a.type) === "Material" && a.name === name && sourcePath(a).startsWith("ViroSpecsLab/"));
  const placeholder = material("ViroPlaceholder");
  const base = material("ViroDefaultMaterial");
  const line = material("ViroDefaultLine");
  setInput(registry, "AssetRegistry", "placeholderMaterial", placeholder, placeholder.name);
  setInput(registry, "AssetRegistry", "defaultMaterial", base, base.name);
  setInput(registry, "AssetRegistry", "defaultLineMaterial", line, line.name);
  // No Font asset ships in the pinned packages and the lab scene sets no
  // fontFamily, so fontIds/fonts stay empty.
  setInput(registry, "AssetRegistry", "fontIds", [], "[]");
  setInput(registry, "AssetRegistry", "fonts", [], "[]");

  setInput(generatedHost, "GeneratedHost", "sceneHostObject", sceneHostObject, sceneHostObject.name);

  // Typed actions (WS3b): the standalone reference flow on the same scene
  // controller. It presents its own scene on start, so it stays disabled and
  // the LEAF action scenarios enable it for their run; a Lens reset puts it
  // back to disabled.
  const actionsLabObject = ensureChild(runtime, "ActionsLab");
  const actionsLab = ensureScript(actionsLabObject, "ViroSpecsActionsLab");
  setInput(actionsLab, "ActionsLab", "controllerHostObject", sceneHostObject, sceneHostObject.name);
  setInput(actionsLab, "ActionsLab", "forwardActions", true, "true");
  if (actionsLabObject.enabled) {
    actionsLabObject.enabled = false;
    steps.push("disable ActionsLab");
  }

  // The four-input hosts from protocol 1 are unused now. Disable them so
  // nothing else builds into ViroGeneratedContent (reversible).
  for (const name of ["RuntimeHost", "InteractionHost", "AnimationHost", "Navigation"]) {
    const legacy = runtime.children.find((o: any) => o.name === name);
    if (legacy && legacy.enabled) {
      legacy.enabled = false;
      steps.push(`disable legacy ${name}`);
    }
  }
} else {
  const runtimeHostObject = ensureChild(runtime, "RuntimeHost");
  const interactionHostObject = ensureChild(runtime, "InteractionHost");
  const animationHostObject = ensureChild(runtime, "AnimationHost");
  const navigationObject = ensureChild(runtime, "Navigation");

  const runtimeHost = ensureScript(runtimeHostObject, "ViroSpecsRuntimeHost");
  setInput(runtimeHost, "RuntimeHost", "root", contentObject, contentObject.name);
  setInput(runtimeHost, "RuntimeHost", "assetRegistryObject", registryObject, registryObject.name);

  const interactionHost = ensureScript(interactionHostObject, "ViroSpecsInteractionHost");
  setInput(interactionHost, "InteractionHost", "runtimeHostObject", runtimeHostObject, runtimeHostObject.name);

  const animationHost = ensureScript(animationHostObject, "ViroSpecsAnimationHost");
  setInput(animationHost, "AnimationHost", "runtimeHostObject", runtimeHostObject, runtimeHostObject.name);

  // Navigation: SpecsNavigationKit's NavigationDataComponent on the same object.
  // Its onAwake reads userCamera.getTransform(), so it needs the scene camera.
  const navigationData = ensureScript(navigationObject, "NavigationDataComponent");
  setInput(navigationData, "NavigationDataComponent", "userCamera", cameraComponent, camera.name);
  const navigationHost = ensureScript(navigationObject, "ViroSpecsNavigationHost");
  const lineFolder = packageFolder("VolumetricLine");
  const lineMaterial = findAsset(
    "VolumetricLine 2.x PBR material",
    (a: any) => String(a.type) === "Material" && a.name === "PBR" && sourcePath(a).startsWith(lineFolder)
  );
  const navigationFolder = packageFolder("NavigationDataComponent");
  const routeIcon = findAsset(
    "SpecsNavigationKit texture for route places",
    (a: any) => /Texture$/.test(String(a.type)) && sourcePath(a).startsWith(navigationFolder)
  );
  setInput(navigationHost, "Navigation", "navigationObject", navigationObject, navigationObject.name);
  setInput(navigationHost, "Navigation", "assetRegistryObject", registryObject, registryObject.name);
  setInput(navigationHost, "Navigation", "defaultLineMaterial", lineMaterial, lineMaterial.name);
  setInput(navigationHost, "Navigation", "routeIcon", routeIcon, routeIcon.name);
  setInput(navigationHost, "Navigation", "generatedContentRoot", contentObject, contentObject.name);

  // The protocol 1 generated host and its four @inputs.
  setInput(generatedHost, "GeneratedHost", "runtimeHostObject", runtimeHostObject, runtimeHostObject.name);
  setInput(generatedHost, "GeneratedHost", "interactionHostObject", interactionHostObject, interactionHostObject.name);
  setInput(generatedHost, "GeneratedHost", "animationHostObject", animationHostObject, animationHostObject.name);
  setInput(generatedHost, "GeneratedHost", "navigationHostObject", navigationObject, navigationObject.name);
}

// 5. LEAF index for the generated-host scenarios.
if (opts.leafIndex !== false) {
  const leafObject = ensureRoot("LeafIndex");
  ensureScript(leafObject, "ViroLabLeafIndex");
  // Fallback runner for when the LEAF ChatTool plugin is unavailable. Kept
  // disabled; the setup script's leaf step enables it for one Preview run.
  const clientObject = ensureRoot("LeafScenarioClient");
  ensureScript(clientObject, "ViroLabScenarioClient");
  if (clientObject.enabled) {
    clientObject.enabled = false;
    steps.push("disable LeafScenarioClient");
  }
}

if (opts.save !== false) {
  project.save();
  steps.push("save");
}

return { steps, inputs };
