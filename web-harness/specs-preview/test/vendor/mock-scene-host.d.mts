// Types for the vendored mock-scene-host.mjs from @viro-external/specs
// scripts/support. Hand-written; only what the parity tests read.
import type { ViroSpecsHostScheduler, ViroSpecsSceneBackend } from "../../src/vendor/lens-core/ViroSpecsSceneBackend";
import type {
  ViroSpecsDocumentLight,
  ViroSpecsDocumentMaterial,
  ViroSpecsDocumentPolyline,
  ViroSpecsExtents,
  ViroSpecsScroll,
} from "../../src/vendor/lens-core/ViroSpecsProtocol";
import type { ViroSpecsBackendText, ViroSpecsBackendTransform } from "../../src/vendor/lens-core/ViroSpecsSceneBackend";

export interface MockMaterial {
  readonly owned?: true;
  readonly definition?: ViroSpecsDocumentMaterial;
  readonly borrowed?: string;
}

export interface MockHandle {
  readonly key: number;
  readonly id: string;
  readonly kind: string;
  parent: MockHandle | null;
  children: MockHandle[];
  alive: boolean;
  enabled: boolean;
  visible: boolean;
  state: {
    transform?: ViroSpecsBackendTransform;
    opacity?: number;
    text?: ViroSpecsBackendText;
    extents?: ViroSpecsExtents;
    scroll?: ViroSpecsScroll;
    scrollNormalized?: [number, number];
    asset?: unknown;
    placeholder?: ViroSpecsExtents;
    material?: MockMaterial | null;
    light?: ViroSpecsDocumentLight;
    line?: ViroSpecsDocumentPolyline;
  };
}

export class ManualScheduler implements ViroSpecsHostScheduler {
  nextFrame(callback: () => void): () => void;
  after(seconds: number, callback: () => void): () => void;
  nowMs(): number;
  readonly queued: number;
  tick(ms?: number): void;
  drain(limit?: number): void;
}

export class MockBackend implements ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial> {
  calls: { call: string; id: string | undefined }[];
  images: Map<string, unknown>;
  models: Map<string, unknown>;
  registeredMaterials: Map<string, MockMaterial>;
  fonts: Set<string>;
  bindings: { handle: MockHandle; active: boolean }[];
  animations: { handle: MockHandle; active: boolean }[];
  liveNodes(): MockHandle[];
  liveRoots(): MockHandle[];
  createSceneRoot: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["createSceneRoot"];
  setEnabled: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setEnabled"];
  createNode: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["createNode"];
  setParent: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setParent"];
  destroy: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["destroy"];
  setTransform: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setTransform"];
  setVisible: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setVisible"];
  setOpacity: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setOpacity"];
  setText: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setText"];
  setExtents: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setExtents"];
  setScroll: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setScroll"];
  setAsset: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setAsset"];
  showPlaceholder: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["showPlaceholder"];
  clearPlaceholder: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["clearPlaceholder"];
  setMaterial: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["setMaterial"];
  loadAsset: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["loadAsset"];
  resolveMaterial: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["resolveMaterial"];
  createMaterial: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["createMaterial"];
  disposeMaterial: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["disposeMaterial"];
  hasFont: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["hasFont"];
  createLight: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["createLight"];
  createPolyline: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["createPolyline"];
  bindInteraction: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["bindInteraction"];
  playAnimation: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["playAnimation"];
  captureUiState: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["captureUiState"];
  restoreUiState: ViroSpecsSceneBackend<MockHandle, unknown, MockMaterial>["restoreUiState"];
}
