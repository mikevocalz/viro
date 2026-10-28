import { createCanvasRasterizer } from "../backend/textRaster";
import { PreviewExperience } from "../experience";
import { PreviewStage } from "../stage";
import { displayWindowPx } from "./displayWindow";
import "./styles.css";
import { PreviewViewport } from "./viewport";

/** Scenes the picker offers. Paths are served by the dev server at /viro-repo/. */
const FIXTURES = [
  { id: "platform-lab-scene", label: "Platform Lab, compiled scene", url: "/viro-repo/web-harness/specs-preview/fixtures/platform-lab.scene-v2.json" },
  { id: "platform-lab-manifest", label: "Platform Lab, manifest v2", url: "/viro-repo/web-harness/specs-preview/fixtures/platform-lab.manifest.json" },
  { id: "platform-lab-v1", label: "Platform Lab, manifest v1 (migrated)", url: "/viro-repo/__test__/fixtures/specs/manifest-v1/platform-lab.v1.json" },
  { id: "all-fields", label: "Every manifest field, no assets", url: "/viro-repo/__test__/fixtures/specs/manifest-v2/valid/all-fields.json" },
  { id: "navigation", label: "Platform Lab, Navigation (SpatialScrollView)", url: "/viro-repo/__test__/fixtures/specs/gallery/navigation.scene.json" },
  { id: "interaction", label: "Platform Lab, Interaction", url: "/viro-repo/__test__/fixtures/specs/gallery/interaction.scene.json" },
  { id: "dashboard", label: "Reference app: Spatial dashboard", url: "/viro-repo/__test__/fixtures/specs/reference-apps/dashboard/scene.json" },
  { id: "model-viewer", label: "Reference app: Model viewer", url: "/viro-repo/__test__/fixtures/specs/reference-apps/model-viewer/scene.json" },
  { id: "world-placed-info", label: "Reference app: World-placed info", url: "/viro-repo/__test__/fixtures/specs/reference-apps/world-placed-info/scene.json" },
  { id: "invalid-parent", label: "Invalid: missing parent", url: "/viro-repo/__test__/fixtures/specs/manifest-v2/invalid/missing-parent.json", unwrap: true },
] as const satisfies readonly { id: string; label: string; url: string; unwrap?: boolean }[];

const $ = <T extends HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error("Missing element " + selector);
  return el;
};

const rasterizer = createCanvasRasterizer();
const stage = new PreviewStage({ rasterizer });
const viewport = new PreviewViewport($("#viewport"));
viewport.show(stage);
const experience = new PreviewExperience({ stage, rasterizer, camera: viewport.camera, builderMode: new URLSearchParams(location.search).has("builder") });
viewport.overlayTargets = () => experience.targets();
viewport.onFrame = () => experience.update();
const inputLog: string[] = [];
viewport.onInput = (line) => {
  inputLog.unshift(line);
  inputLog.length = Math.min(inputLog.length, 12);
  renderInput();
};

const picker = $<HTMLSelectElement>("#fixture");
for (const f of FIXTURES) picker.add(new Option(f.label, f.id));
const params = new URLSearchParams(location.search);
let manifestDiagnostics: { code: string; severity: string; message: string; fieldPath?: string }[] = [];
let sourceLabel = "";

async function loadUrl(url: string, label: string, mode: "present" | "update" = "present", unwrap = false): Promise<void> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(response.status + " " + response.statusText);
    const body: unknown = await response.json();
    // Invalid-manifest test fixtures wrap the document: { description, expectCodes, manifest }.
    const json = unwrap && typeof body === "object" && body !== null && "manifest" in body ? (body as { manifest: unknown }).manifest : body;
    await loadJson(json, label, mode);
  } catch (error) {
    showLoadError(label + ": " + (error instanceof Error ? error.message : String(error)));
  }
}

async function loadJson(json: unknown, label: string, mode: "present" | "update"): Promise<void> {
  const result = mode === "update" ? await stage.update(json, label) : await stage.load(json, label);
  manifestDiagnostics = result.input.manifestDiagnostics.map((d) => ({ code: d.code, severity: d.severity, message: d.message, ...(d.fieldPath ? { fieldPath: d.fieldPath } : {}) }));
  sourceLabel = label;
  $("#load-error").hidden = true;
  render();
}

function showLoadError(message: string): void {
  const el = $("#load-error");
  el.textContent = "Could not load the scene. " + message;
  el.hidden = false;
}

picker.addEventListener("change", () => {
  const f = FIXTURES.find((x) => x.id === picker.value);
  if (f) {
    history.replaceState(null, "", "?fixture=" + f.id);
    void loadUrl(f.url, f.label, "present", "unwrap" in f && f.unwrap);
  }
});

$<HTMLInputElement>("#file").addEventListener("change", async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    await loadJson(JSON.parse(await file.text()), file.name, "present");
  } catch (error) {
    showLoadError(file.name + ": " + (error instanceof Error ? error.message : String(error)));
  }
});

const shell = $("#shell");
shell.addEventListener("dragover", (event) => {
  event.preventDefault();
  shell.classList.add("dropping");
});
shell.addEventListener("dragleave", () => shell.classList.remove("dropping"));
shell.addEventListener("drop", async (event) => {
  event.preventDefault();
  shell.classList.remove("dropping");
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  try {
    await loadJson(JSON.parse(await file.text()), file.name, "present");
  } catch (error) {
    showLoadError(file.name + ": " + (error instanceof Error ? error.message : String(error)));
  }
});

$("#reset-view").addEventListener("click", () => viewport.resetView());

function render(): void {
  const lifecycle = stage.lifecycle;
  const state = $("#state");
  state.dataset.state = lifecycle;
  state.textContent = LIFECYCLE_COPY[lifecycle];
  $("#source").textContent = sourceLabel;
  $("#revision").textContent = stage.controller.revision ? "Revision " + stage.controller.revision : "";
  const nodes = stage.backend.liveHandles().filter((h) => h.kind !== "root");
  $("#counts").textContent = nodes.length + (nodes.length === 1 ? " node" : " nodes") + ", " + stage.assets.status.filter((s) => s.state === "missing").length + " missing assets";

  const list = $("#diagnostics");
  list.replaceChildren();
  const all = [
    ...manifestDiagnostics.map((d) => ({ ...d, origin: "Manifest" })),
    ...stage.diagnostics.map((d) => ({ code: d.code, severity: d.severity, message: d.message, origin: "Lens host" })),
  ];
  for (const d of all) {
    const li = document.createElement("li");
    li.dataset.severity = d.severity;
    const code = document.createElement("strong");
    code.textContent = d.code;
    const text = document.createElement("span");
    text.textContent = d.message;
    const origin = document.createElement("small");
    origin.textContent = d.origin;
    li.append(code, text, origin);
    list.append(li);
  }
  $("#diagnostics-empty").hidden = all.length > 0;

  const tree = $("#nodes");
  tree.replaceChildren();
  for (const n of nodes) {
    const li = document.createElement("li");
    let depth = 0;
    for (let o = n.object.parent; o && o !== stage.container; o = o.parent) if (o.userData.viroNode) depth++;
    li.style.setProperty("--depth", String(Math.max(0, depth - 1)));
    const name = document.createElement("span");
    name.textContent = n.id;
    const kind = document.createElement("small");
    kind.textContent = n.placeholder ? n.kind + ", placeholder" : n.kind;
    li.append(name, kind);
    tree.append(li);
  }
  renderInput();
}

function renderInput(): void {
  const log = $("#input-log");
  log.replaceChildren(...inputLog.map((line) => Object.assign(document.createElement("li"), { textContent: line })));
  $("#input-empty").hidden = inputLog.length > 0;
}

const LIFECYCLE_COPY = {
  empty: "No scene loaded",
  loading: "Loading assets",
  ready: "Ready",
  degraded: "Ready, with placeholders for missing assets",
  error: "Scene rejected",
} as const;

stage.controller.addOnLifecycleListener(() => render());

function placeWindow(): void {
  const host = $("#viewport");
  const frame = $("#display-window");
  const { width, height } = displayWindowPx(viewport.camera.fov, host.clientHeight);
  frame.style.width = Math.min(width, host.clientWidth - 24) + "px";
  frame.style.height = Math.min(height, host.clientHeight - 24) + "px";
}
new ResizeObserver(placeWindow).observe($("#viewport"));
placeWindow();

// ?watch=<url> polls a viro-specs watch output and applies changes as updates.
const watchUrl = params.get("watch");
if (watchUrl) {
  let last = "";
  const poll = async (): Promise<void> => {
    try {
      const response = await fetch(watchUrl, { cache: "no-store" });
      const text = await response.text();
      if (response.ok && text !== last) {
        const first = last === "";
        last = text;
        await loadJson(JSON.parse(text), watchUrl, first ? "present" : "update");
      }
    } catch (error) {
      showLoadError(watchUrl + ": " + (error instanceof Error ? error.message : String(error)));
    }
    setTimeout(() => void poll(), 1000);
  };
  void poll();
} else {
  const sceneUrl = params.get("scene");
  const fixture = FIXTURES.find((f) => f.id === params.get("fixture")) ?? FIXTURES[0];
  if (sceneUrl) void loadUrl(sceneUrl, sceneUrl);
  else {
    picker.value = fixture.id;
    void loadUrl(fixture.url, fixture.label, "present", "unwrap" in fixture && fixture.unwrap);
  }
}

/** For Playwright: scene state plus the input the screenshot script drives. */
declare global {
  interface Window {
    __specsPreview: {
      readonly lifecycle: string;
      readonly nodeCount: number;
      readonly diagnostics: readonly string[];
      /** Experience view: what the wearer sees around the scene. */
      readonly experience: { readonly sceneVisible: boolean; readonly panels: readonly string[] };
      /** Steps a scroll group by rows through the controller. */
      scrollByRows(id: string, rows: number): boolean;
      /** Sends a hover-enter to a bound node, as the pointer would. */
      hover(id: string): boolean;
      /** Normalized scroll y of a scroll group (1 = top), or undefined. */
      scrollOf(id: string): number | undefined;
    };
  }
}
window.__specsPreview = {
  get lifecycle() {
    return stage.lifecycle;
  },
  get nodeCount() {
    return stage.backend.liveHandles().length;
  },
  get diagnostics() {
    return [...manifestDiagnostics.map((d) => d.code), ...stage.diagnostics.map((d) => d.code)];
  },
  get experience() {
    const view = experience.view;
    const panels = [
      ...(view.loading.visible ? ["loading"] : []),
      ...(view.notice ? ["notice"] : []),
      ...(view.errorPanel ? ["error"] : []),
      ...(view.permissionPanel ? ["permission"] : []),
    ];
    return { sceneVisible: view.sceneVisible, panels };
  },
  scrollByRows(id, rows) {
    return stage.controller.scrollByRows(id, rows);
  },
  hover(id) {
    const node = stage.backend.liveHandles().find((h) => h.id === id);
    if (!node?.interaction) return false;
    stage.backend.deliverInteraction(node, { phase: "hover-enter", source: "synthetic" });
    return true;
  },
  scrollOf(id) {
    return stage.backend.liveHandles().find((h) => h.id === id)?.scroll?.normalized[1];
  },
};
