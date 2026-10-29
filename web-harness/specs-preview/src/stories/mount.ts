import { ACESFilmicToneMapping, Color, PerspectiveCamera, SRGBColorSpace, WebGLRenderer } from "three";
import { createCanvasRasterizer } from "../backend/textRaster";
import { readPreviewInput } from "../document";
import { PreviewExperience } from "../experience";
import { PreviewStage } from "../stage";
import type { ViroSpecsCapabilityState, ViroSpecsInteractionPhase } from "../vendor/lens-core/ViroSpecsProtocol";
import "./stories.css";

/** Controls every story shares. They feed the Lens experience controller, not the scene. */
export interface SceneArgs {
  /** `preferences.highContrast`: swaps surface, text and focus colors and makes surfaces opaque. */
  readonly highContrast: boolean;
  /** `preferences.reducedMotion`: no hover scale, no appear scale. */
  readonly reducedMotion: boolean;
  /** Capability report sent to the experience controller, as the Lens runtime would. */
  readonly capabilities: "all supported" | "hand tracking unavailable" | "world query unsupported";
  /** Shows builder lines (capability states, diagnostic codes) on panels, as a Lens debug build does. */
  readonly builderMode: boolean;
}

export const DEFAULT_ARGS: SceneArgs = {
  highContrast: false,
  reducedMotion: false,
  capabilities: "all supported",
  builderMode: false,
};

/** Storybook argTypes for {@linkcode SceneArgs}. */
export const SCENE_ARG_TYPES = {
  highContrast: { control: "boolean", description: "Theme preference: high contrast." },
  reducedMotion: { control: "boolean", description: "Theme preference: reduced motion." },
  capabilities: {
    control: "select",
    options: ["all supported", "hand tracking unavailable", "world query unsupported"],
    description: "Capability report from the Lens runtime. Degraded states show the notice panel.",
  },
  builderMode: { control: "boolean", description: "Lens debug build: builder lines on notice and error panels." },
} as const;

/** Host input to replay on a bound node after the scene commits (hover, press). */
export interface ScriptedInput {
  readonly nodeId: string;
  readonly phases: readonly ViroSpecsInteractionPhase[];
}

/** What a story mounts. */
export interface MountOptions {
  /** Manifest v2 or scene protocol 2 JSON. Read with viro's validator, as the preview page does. */
  readonly scene: unknown;
  /** Story ID, used as the file label for diagnostics. */
  readonly id: string;
  readonly args: SceneArgs;
  /** Vertical field of view in degrees. @default 42 (the gallery's) */
  readonly fov?: number;
  /**
   * Asset sources whose request never completes, so the controller stays in
   * `loading` and the Lens loading panel shows. Only the network is held; the
   * lifecycle, progress counts and panel come from the vendored Lens code.
   */
  readonly holdSources?: readonly string[];
  readonly input?: readonly ScriptedInput[];
  /** Scrolls a scroll group by whole rows through the controller after the scene commits. */
  readonly scroll?: { readonly id: string; readonly rows: number };
  /** The scene requires world placement, so a degraded world query shows the notice. @default false */
  readonly requirePlacement?: boolean;
}

const CAPABILITY_REPORTS: Record<SceneArgs["capabilities"], Record<string, ViroSpecsCapabilityState>> = {
  "all supported": { "hand-tracking": "supported", "world-query": "supported", "surface-placement": "supported" },
  "hand tracking unavailable": { "hand-tracking": "temporarily-unavailable", "world-query": "supported", "surface-placement": "supported" },
  "world query unsupported": { "hand-tracking": "supported", "world-query": "unsupported", "surface-placement": "unsupported" },
};

const LIFECYCLE_COPY: Record<string, string> = {
  empty: "No scene",
  loading: "Loading assets",
  ready: "Ready",
  degraded: "Ready, with placeholders for missing assets",
  error: "Scene rejected",
};

// One WebGL context for every story; Storybook keeps the iframe alive between
// stories and browsers cap live contexts at about 16.
let renderer: WebGLRenderer | null = null;
let teardown: (() => void) | null = null;
const rasterizer = createCanvasRasterizer();

function sharedRenderer(): WebGLRenderer {
  if (renderer) return renderer;
  renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  return renderer;
}

/** Live state of the mounted story, for the screenshot script. */
export interface StoryProbe {
  readonly id: string;
  readonly settled: boolean;
  readonly lifecycle: string;
  readonly codes: readonly string[];
  readonly panels: readonly string[];
  readonly frames: number;
}

declare global {
  interface Window {
    __specsStory?: StoryProbe;
  }
}

/**
 * Renders one scene through the preview's own pipeline: `PreviewStage`
 * (viro validator, Lens scene controller, three.js backend) plus
 * `PreviewExperience` (Lens loading, notice, error panels and premium
 * component decoration), from the wearer's eye at the origin.
 */
export function mountScene(options: MountOptions): HTMLElement {
  teardown?.();
  const r = sharedRenderer();

  const root = document.createElement("figure");
  root.className = "specs-story";
  const frame = document.createElement("div");
  frame.className = "specs-story-frame";
  r.domElement.setAttribute("role", "img");
  r.domElement.setAttribute("aria-label", options.id + " rendered by the Specs preview");
  frame.append(r.domElement);
  const caption = document.createElement("figcaption");
  const state = document.createElement("span");
  state.className = "specs-story-state";
  const codes = document.createElement("span");
  codes.className = "specs-story-codes";
  caption.append(state, codes);
  root.append(frame, caption);

  const stage = new PreviewStage({ rasterizer });
  stage.scene.background = new Color("#2b313a");
  const camera = new PerspectiveCamera(options.fov ?? 42, 4 / 3, 1, 5000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -100);
  camera.updateMatrixWorld();
  const experience = new PreviewExperience({
    stage,
    rasterizer,
    camera,
    builderMode: options.args.builderMode,
    requirements: { placement: options.requirePlacement ?? false, gazeOnly: true },
  });
  experience.controller.setPreferences({ highContrast: options.args.highContrast, reducedMotion: options.args.reducedMotion });
  experience.setCapabilities(CAPABILITY_REPORTS[options.args.capabilities]);

  let settled = false;
  let frames = 0;
  const describe = (): void => {
    const lifecycle = stage.lifecycle;
    state.dataset.state = lifecycle;
    state.textContent = LIFECYCLE_COPY[lifecycle] ?? lifecycle;
    const list = Array.from(new Set(stage.diagnostics.map((d) => d.code)));
    codes.textContent = list.length ? "Lens host reports " + list.join(", ") : "No diagnostics";
  };
  stage.controller.addOnLifecycleListener(describe);
  describe();

  // The controller binds interactions as frame work after the scene commits,
  // so scripted input waits in the render loop until each target is bound.
  let loaded = false;
  const pendingInput = [...(options.input ?? [])];
  let pendingScroll = options.scroll;
  const applyPending = (): void => {
    for (let i = pendingInput.length - 1; i >= 0; i--) {
      const step = pendingInput[i]!;
      const node = stage.backend.liveHandles().find((h) => h.id === step.nodeId);
      if (!node?.interaction) continue;
      for (const phase of step.phases) stage.backend.deliverInteraction(node, { phase, source: "synthetic" });
      pendingInput.splice(i, 1);
    }
    if (pendingScroll && stage.controller.scrollByRows(pendingScroll.id, pendingScroll.rows)) pendingScroll = undefined;
    // A target that never binds (a typo in the story) must not hang the screenshot run.
    if (frames > 120) {
      pendingInput.length = 0;
      pendingScroll = undefined;
    }
    if (pendingInput.length === 0 && !pendingScroll && !settled) {
      settled = true;
      describe();
    }
  };
  void present(stage, options).then(() => {
    loaded = true;
    describe();
  });

  let last = performance.now();
  r.setAnimationLoop(() => {
    if (!root.isConnected) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    r.setPixelRatio(ratio);
    r.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    stage.step(dt, rect.width * ratio, rect.height * ratio);
    if (loaded && !settled) applyPending();
    experience.update();
    r.render(stage.scene, camera);
    frames++;
  });

  window.__specsStory = {
    id: options.id,
    get settled() {
      return settled;
    },
    get lifecycle() {
      return stage.lifecycle;
    },
    get codes() {
      return stage.diagnostics.map((d) => d.code);
    },
    get panels() {
      const view = experience.view;
      return [
        ...(view.loading.visible ? ["loading"] : []),
        ...(view.notice ? ["notice"] : []),
        ...(view.errorPanel ? ["error"] : []),
        ...(view.permissionPanel ? ["permission"] : []),
      ];
    },
    get frames() {
      return frames;
    },
  };

  teardown = () => {
    r.setAnimationLoop(null);
    experience.controller.dispose();
    stage.dispose();
    teardown = null;
  };
  return root;
}

/** Loads the scene, or with `holdSources` presents it while those requests stay open. */
async function present(stage: PreviewStage, options: MountOptions): Promise<void> {
  const held = new Set(options.holdSources ?? []);
  if (held.size === 0) {
    await stage.load(options.scene, options.id);
    return;
  }
  const input = readPreviewInput(options.scene, options.id);
  const doc = input.scene as { nodes?: readonly { source?: string }[] };
  const nodes = (doc.nodes ?? []).filter((n) => n.source === undefined || !held.has(n.source));
  await stage.assets.preload({ ...doc, nodes });
  const store = stage.assets;
  const load = store.loadAsset.bind(store);
  store.loadAsset = (kind, source) => (held.has(source) ? new Promise(() => undefined) : load(kind, source));
  stage.controller.present(input.scene);
}

/** A story that mounts one scene; `description` shows in the Docs panel. */
export function sceneStory(description: string, options: Omit<MountOptions, "args">): { parameters: object; render: (args: SceneArgs) => HTMLElement } {
  return {
    parameters: { docs: { description: { story: description } } },
    render: (args) => mountScene({ fov: 30, ...options, args }),
  };
}
