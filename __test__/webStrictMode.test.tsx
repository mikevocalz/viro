/**
 * @jest-environment jsdom
 *
 * React StrictMode mounts every component, unmounts it, and mounts it again
 * with the same DOM. The web navigators used to answer that with a second
 * WASM renderer on the same <canvas>, while the first one kept its render loop
 * running, and every node, light and portal frame was destroyed by the
 * simulated unmount and then re-attached as a freed handle. The canvas showed
 * an empty scene.
 *
 * The renderer here is a fake with the same surface the bridge uses. It tracks
 * which handles are destroyed and which render loops still run, which is what
 * decides whether a frame has anything in it.
 */
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

type FakeRenderer = ReturnType<typeof mockMakeRenderer>;

const mockCreated: FakeRenderer[] = [];

function mockMakeRenderer(canvas: HTMLCanvasElement) {
  let next = 2;
  const ROOT = 1;
  const destroyed = new Set<number>();
  const children = new Map<number, Set<number>>();
  const lights = new Map<number, Set<number>>();
  const errors: string[] = [];
  const attach = (map: Map<number, Set<number>>, parent: number, child: number, what: string) => {
    if (destroyed.has(child)) errors.push(`${what} ${child} attached after it was destroyed`);
    if (destroyed.has(parent)) errors.push(`${what} ${child} attached to destroyed parent ${parent}`);
    if (!map.has(parent)) map.set(parent, new Set());
    map.get(parent)!.add(child);
  };
  const detach = (child: number) => {
    for (const set of children.values()) set.delete(child);
  };
  const known: Record<string, (...args: any[]) => unknown> = {
    getRootNode: () => ROOT,
    addChildNode: (parent: number, child: number) => attach(children, parent, child, "node"),
    removeNodeFromParent: (child: number) => detach(child),
    destroyNode: (h: number) => {
      destroyed.add(h);
      detach(h);
    },
    addLightToNode: (parent: number, light: number) => attach(lights, parent, light, "light"),
    removeLightFromNode: (parent: number, light: number) => lights.get(parent)?.delete(light),
    destroyLight: (h: number) => destroyed.add(h),
    setPortalEntrance: (portal: number, frame: number) => attach(children, portal, frame, "frame"),
    getBuildId: () => "fake",
  };
  const scene = new Proxy(known, {
    get(target, name: string | symbol) {
      if (typeof name !== "string") return undefined;
      if (name in target) return target[name];
      if (name.startsWith("create")) return () => next++;
      return () => 0;
    },
  });
  const pauseMainLoop = jest.fn();
  const renderer = {
    scene,
    canvasElement: canvas,
    canvasSize: { width: 1, height: 1 },
    wasmModule: { pauseMainLoop } as Record<string, unknown>,
    dispose: jest.fn(),
    resize: jest.fn(),
    setNodeEventHandlers: jest.fn(),
    clearNodeEventHandlers: jest.fn(),
    setNodeAnimationHandlers: jest.fn(),
    clearNodeAnimationHandlers: jest.fn(),
    addAbortListener: jest.fn(() => () => {}),
    // What is drawn: the live subtree under the root.
    liveTree(): number[] {
      const out: number[] = [];
      const walk = (h: number) => {
        for (const c of children.get(h) ?? []) {
          if (destroyed.has(c)) continue;
          out.push(c);
          walk(c);
        }
      };
      walk(ROOT);
      return out;
    },
    liveLights(): number[] {
      return [...(lights.get(ROOT) ?? [])].filter((h) => !destroyed.has(h));
    },
    errors,
    loopRunning: () => pauseMainLoop.mock.calls.length === 0,
  };
  return renderer;
}

// The navigators send a usage ping on mount. Its native-side reader imports
// react-native, which this jsdom suite does not load, and the ping is not under
// test here.
jest.mock("../components/Utilities/ViroUsagePing", () => ({
  useViroUsagePing: () => {},
}));

jest.mock("@reactvision/viro-web-renderer", () => {
  const actual = jest.requireActual("@reactvision/viro-web-renderer");
  return {
    ...actual,
    ViroWebRenderer: {
      // Loading the WASM takes a while; StrictMode's unmount lands inside it.
      create: jest.fn(async ({ canvas }: { canvas: HTMLCanvasElement }) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        const r = mockMakeRenderer(canvas);
        mockCreated.push(r);
        return r;
      }),
    },
  };
});

import { Viro3DSceneNavigator } from "../components/Viro3DSceneNavigator.web";
import { ViroSceneNavigator } from "../components/ViroSceneNavigator.web";
import { ViroARSceneNavigator } from "../components/AR/ViroARSceneNavigator.web";
import { ViroScene } from "../components/ViroScene.web";
import { ViroBox } from "../components/ViroBox.web";
import { ViroNode } from "../components/ViroNode.web";
import { ViroAmbientLight } from "../components/ViroAmbientLight.web";
import { ViroWebRenderer } from "@reactvision/viro-web-renderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).ResizeObserver = class {
  observe() {}
  disconnect() {}
};

function Scene() {
  return (
    <ViroScene>
      <ViroAmbientLight color="#ffffff" />
      <ViroNode position={[0, 0, -1]}>
        <ViroBox position={[0, 0, -2]} />
      </ViroNode>
    </ViroScene>
  );
}

const NAVIGATORS: Array<[string, React.ComponentType<any>]> = [
  ["Viro3DSceneNavigator", Viro3DSceneNavigator],
  ["ViroSceneNavigator", ViroSceneNavigator],
  ["ViroARSceneNavigator", ViroARSceneNavigator],
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockCreated.length = 0;
  (ViroWebRenderer.create as jest.Mock).mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  container.remove();
});

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

describe.each(NAVIGATORS)("%s under React.StrictMode", (_name, Navigator) => {
  it("ends with one running renderer that draws the scene", async () => {
    await act(async () => {
      root.render(
        <React.StrictMode>
          <Navigator initialScene={{ scene: Scene }} />
        </React.StrictMode>,
      );
    });
    await settle();

    // One WASM module per canvas: the remount reuses the one still loading.
    expect(ViroWebRenderer.create).toHaveBeenCalledTimes(1);
    const running = mockCreated.filter((r) => r.loopRunning());
    expect(running).toHaveLength(1);
    const live = running[0];
    expect(live.errors).toEqual([]);
    // ViroNode + ViroBox under the root, and the ambient light on the root.
    expect(live.liveTree()).toHaveLength(2);
    expect(live.liveLights()).toHaveLength(1);

    await act(async () => root.unmount());
    await settle();
    expect(mockCreated.filter((r) => r.loopRunning())).toHaveLength(0);
    expect(mockCreated.every((r) => r.dispose.mock.calls.length > 0)).toBe(true);
  });
});

describe("without StrictMode", () => {
  it("a real unmount stops the render loop instead of leaving it drawing", async () => {
    await act(async () => {
      root.render(<Viro3DSceneNavigator initialScene={{ scene: Scene }} />);
    });
    await settle();
    expect(mockCreated).toHaveLength(1);
    expect(mockCreated[0].liveTree()).toHaveLength(2);

    await act(async () => root.unmount());
    await settle();
    expect(mockCreated[0].loopRunning()).toBe(false);
    expect(mockCreated[0].dispose).toHaveBeenCalled();
  });
});

describe("extended input listeners (#40)", () => {
  it("are removed from the canvas when the renderer is torn down", async () => {
    const { installExtendedWebInput } = jest.requireActual(
      "../components/Web/viroExtendedInput",
    );
    const { teardownViroWebRenderer } = jest.requireActual(
      "../components/Web/viroRendererHost",
    );
    const canvas = document.createElement("canvas");
    const live = new Map<string, Set<unknown>>();
    canvas.addEventListener = ((type: string, fn: unknown) => {
      if (!live.has(type)) live.set(type, new Set());
      live.get(type)!.add(fn);
    }) as never;
    canvas.removeEventListener = ((type: string, fn: unknown) => {
      live.get(type)?.delete(fn);
    }) as never;
    const renderer = mockMakeRenderer(canvas);
    const ownSet = renderer.setNodeEventHandlers;
    renderer.wasmModule = {
      ...renderer.wasmModule,
      viroSetEventCallback: () => {},
      viroOnTouch: () => {},
      viroOnScroll: () => {},
      viroOnPinch: () => {},
    };

    installExtendedWebInput(renderer);
    const count = () => [...live.values()].reduce((n, set) => n + set.size, 0);
    expect(count()).toBe(5); // wheel + four pointer listeners for pinch
    expect(renderer.setNodeEventHandlers).not.toBe(ownSet);

    teardownViroWebRenderer(renderer);
    expect(count()).toBe(0);
    expect(renderer.setNodeEventHandlers).toBe(ownSet);
    expect(renderer.wasmModule.pauseMainLoop).toHaveBeenCalled();
  });
});
