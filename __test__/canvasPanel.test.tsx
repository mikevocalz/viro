/**
 * @jest-environment jsdom
 *
 * CanvasPanel contract tests. The nitro module is mocked at the
 * `requireNitroCanvas` seam so the surface/material/producer lifecycle and
 * frame-clock ownership can be verified without a native runtime.
 */
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

type FakeSurface = {
  id: number;
  width: number;
  height: number;
  route?: string;
  markDirty: jest.Mock;
  dispose: jest.Mock;
};

const createdSurfaces: FakeSurface[] = [];
const createdMaterials: Record<string, unknown>[] = [];
const deletedMaterials: string[][] = [];

jest.mock("react-native", () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: "active",
  },
  NativeModules: {},
  requireNativeComponent: jest.fn(() => "VRTNative"),
  findNodeHandle: jest.fn(() => 1),
}));

const createdProducers: {
  attach: jest.Mock;
  renderFrame: jest.Mock;
  setActive: jest.Mock;
  dispose: jest.Mock;
  runtime: unknown;
}[] = [];
const runtimeQueue: unknown[] = [];

jest.mock("../components/CanvasPanel/nitroCanvas", () => ({
  requireNitroCanvas: () => ({
    createCanvasSurface: (options: Record<string, unknown>) => {
      const surface: FakeSurface = {
        id: createdSurfaces.length + 1,
        width: options.width as number,
        height: options.height as number,
        route: options.androidRoute as string | undefined,
        markDirty: jest.fn(),
        dispose: jest.fn(),
      };
      createdSurfaces.push(surface);
      return surface;
    },
    canvasSource: (surface: FakeSurface) => ({
      canvasSource: surface.id,
      width: surface.width,
      height: surface.height,
    }),
    createRiveCanvasRuntime: jest.fn(async () => runtimeQueue.shift() ?? {}),
    RiveProducer: class {
      runtime: unknown = null;
      private init_: { createRuntime(s: unknown): Promise<unknown> };
      attach = jest.fn(async (_surface: unknown) => {
        this.runtime = await this.init_.createRuntime(_surface);
      });
      renderFrame = jest.fn();
      setActive = jest.fn();
      dispose = jest.fn();
      managesOwnFrames = true;
      constructor(init: { createRuntime(s: unknown): Promise<unknown> }) {
        this.init_ = init;
        createdProducers.push(this);
      }
    },
  }),
}));

jest.mock("../components/Material/ViroMaterials", () => ({
  ViroMaterials: {
    createMaterials: (materials: Record<string, unknown>) =>
      createdMaterials.push(materials),
    deleteMaterials: (names: string[]) => deletedMaterials.push(names),
  },
}));

import { canvasCorners, useCanvasPanel } from "../components/CanvasPanel/useCanvasPanel";
import {
  applyBindings,
  bindingFingerprint,
  ViroRivePanel,
  type ViroRivePanelProps,
} from "../components/ViroRivePanel";

function makeProducer(overrides: Record<string, unknown> = {}) {
  return {
    attach: jest.fn(async () => {}),
    renderFrame: jest.fn(),
    setActive: jest.fn(),
    dispose: jest.fn(),
    ...overrides,
  };
}

function mountHarness(opts: Parameters<typeof useCanvasPanel>[0]) {
  const seen: (ReturnType<typeof useCanvasPanel> | null)[] = [];
  function Harness() {
    seen.push(useCanvasPanel(opts));
    return null;
  }
  const container = document.createElement("div");
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(<Harness />);
  });
  return {
    container,
    seen,
    unmount: () => act(() => root?.unmount()),
    flush: () =>
      act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      }),
  };
}

beforeEach(() => {
  createdSurfaces.length = 0;
  createdMaterials.length = 0;
  deletedMaterials.length = 0;
  createdProducers.length = 0;
  runtimeQueue.length = 0;
});

describe("useCanvasPanel lifecycle", () => {
  it("creates a surface with the requested route and registers its canvas material", async () => {
    const producer = makeProducer();
    const onReady = jest.fn();
    const harness = mountHarness({
      producerFactory: () => producer,
      resolution: { width: 960, height: 640 },
      androidRoute: "surface-texture",
      onReady,
    });
    await harness.flush();

    expect(createdSurfaces).toHaveLength(1);
    expect(createdSurfaces[0]).toMatchObject({
      width: 960,
      height: 640,
      route: "surface-texture",
    });
    expect(createdMaterials).toHaveLength(1);
    const [materials] = createdMaterials;
    const materialName = Object.keys(materials)[0]!;
    expect(materials[materialName]).toMatchObject({
      diffuseTexture: { canvasSource: 1, width: 960, height: 640 },
      lightingModel: "Constant",
    });
    expect(producer.attach).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
    harness.unmount();
    expect(producer.dispose).toHaveBeenCalledTimes(1);
    expect(createdSurfaces[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(deletedMaterials).toEqual([[materialName]]);
  });

  it("does not tick a producer that manages its own frames", async () => {
    const producer = makeProducer({ managesOwnFrames: true });
    const harness = mountHarness({
      producerFactory: () => producer,
      resolution: { width: 64, height: 64 },
      onReady: () => {},
    });
    await harness.flush();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(producer.setActive).toHaveBeenCalledWith(true);
    expect(producer.renderFrame).not.toHaveBeenCalled();
    harness.unmount();
  });

  it("passes blendMode PremultiplyAlpha through to the canvas material", async () => {
    const harness = mountHarness({
      producerFactory: () => makeProducer(),
      resolution: { width: 64, height: 64 },
      blendMode: "PremultiplyAlpha",
    });
    await harness.flush();
    const [materials] = createdMaterials;
    const materialName = Object.keys(materials!)[0]!;
    expect(materials![materialName]).toMatchObject({ blendMode: "PremultiplyAlpha" });
    harness.unmount();
  });

  it("leaves blendMode unset when none is requested", async () => {
    const harness = mountHarness({
      producerFactory: () => makeProducer(),
      resolution: { width: 64, height: 64 },
    });
    await harness.flush();
    const [materials] = createdMaterials;
    const materialName = Object.keys(materials!)[0]!;
    expect(materials![materialName]).not.toHaveProperty("blendMode");
    harness.unmount();
  });

  it("autoTick=false leaves the producer attached but inactive", async () => {
    const producer = makeProducer();
    const harness = mountHarness({
      producerFactory: () => producer,
      resolution: { width: 64, height: 64 },
      autoTick: false,
      onReady: () => {},
    });
    await harness.flush();
    expect(producer.setActive).toHaveBeenCalledWith(false);
    expect(producer.renderFrame).not.toHaveBeenCalled();
    harness.unmount();
  });

  it("disposes a producer whose attach settles after unmount", async () => {
    let resolveAttach: (() => void) | null = null;
    const producer = makeProducer({
      attach: jest.fn(
        () => new Promise<void>((resolve) => (resolveAttach = resolve)),
      ),
    });
    const harness = mountHarness({
      producerFactory: () => producer,
      resolution: { width: 64, height: 64 },
    });
    harness.unmount();
    await act(async () => {
      resolveAttach?.();
      await Promise.resolve();
    });
    expect(producer.dispose).toHaveBeenCalledTimes(1);
    expect(createdSurfaces[0]!.dispose).toHaveBeenCalledTimes(1);
  });

  it("releases producer, surface, and material when attach rejects", async () => {
    const onError = jest.fn();
    const producer = makeProducer({
      attach: jest.fn(async () => {
        throw new Error("surface attach failed");
      }),
    });
    const harness = mountHarness({
      producerFactory: () => producer,
      resolution: { width: 64, height: 64 },
      onError,
    });
    await harness.flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0].message).toContain("surface attach failed");
    expect(producer.dispose).toHaveBeenCalledTimes(1);
    expect(createdSurfaces[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(deletedMaterials).toHaveLength(1);
    expect(producer.renderFrame).not.toHaveBeenCalled();
    harness.unmount();
    // Unmount after a failed attach must not dispose twice.
    expect(producer.dispose).toHaveBeenCalledTimes(1);
    expect(createdSurfaces[0]!.dispose).toHaveBeenCalledTimes(1);
  });

  it("an onReady throw reports the error but keeps the attached resource", async () => {
    const onError = jest.fn();
    const producer = makeProducer();
    const harness = mountHarness({
      producerFactory: () => producer,
      resolution: { width: 64, height: 64 },
      onReady: () => {
        throw new Error("consumer callback failed");
      },
      onError,
    });
    await harness.flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0].message).toContain("consumer callback failed");
    // The producer attached successfully; only the consumer callback failed.
    expect(producer.dispose).not.toHaveBeenCalled();
    harness.unmount();
    expect(producer.dispose).toHaveBeenCalledTimes(1);
  });

  it("reports producer construction failure through onError", async () => {
    const onError = jest.fn();
    const harness = mountHarness({
      producerFactory: () => {
        throw new Error("missing riv bytes");
      },
      resolution: { width: 64, height: 64 },
      onError,
    });
    await harness.flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0].message).toContain("missing riv bytes");
    expect(createdSurfaces[0]!.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("useCanvasPanel corner radius", () => {
  it("adds cornerRadius and the panel size in meters to the canvasSource value", async () => {
    const harness = mountHarness({
      producerFactory: () => makeProducer(),
      resolution: { width: 2496, height: 1560 },
      blendMode: "PremultiplyAlpha",
      cornerRadius: 0.021,
      panelSize: { width: 0.6, height: 0.375 },
    });
    await harness.flush();
    const [materials] = createdMaterials;
    const materialName = Object.keys(materials!)[0]!;
    expect(materials![materialName]).toMatchObject({
      blendMode: "PremultiplyAlpha",
      diffuseTexture: {
        canvasSource: 1, width: 2496, height: 1560,
        cornerRadius: 0.021, panelWidth: 0.6, panelHeight: 0.375,
      },
    });
    harness.unmount();
  });

  it("leaves the canvasSource value untouched without a radius", async () => {
    const harness = mountHarness({
      producerFactory: () => makeProducer(),
      resolution: { width: 64, height: 64 },
      panelSize: { width: 1, height: 1 },
    });
    await harness.flush();
    const [materials] = createdMaterials;
    const materialName = Object.keys(materials!)[0]!;
    expect((materials![materialName] as { diffuseTexture: object }).diffuseTexture)
      .toEqual({ canvasSource: 1, width: 64, height: 64 });
    harness.unmount();
  });

  it("reports a radius without a panel size before creating a surface", async () => {
    const onError = jest.fn();
    const harness = mountHarness({
      producerFactory: () => makeProducer(),
      resolution: { width: 64, height: 64 },
      cornerRadius: 0.02,
      onError,
    });
    await harness.flush();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("panelSize"),
    }));
    expect(createdSurfaces).toHaveLength(0);
    expect(createdMaterials).toHaveLength(0);
    harness.unmount();
  });

  it("rejects a negative radius", () => {
    expect(() => canvasCorners(-1, 1, 1)).toThrow("cornerRadius");
    expect(() => canvasCorners(Number.NaN, 1, 1)).toThrow("cornerRadius");
    expect(canvasCorners(0)).toBeNull();
  });
});

describe("ViroRivePanel runtime replacement", () => {
  function mountPanel() {
    const container = document.createElement("div");
    const root = createRoot(container);
    const render = (props: ViroRivePanelProps) =>
      act(() => {
        root.render(<ViroRivePanel {...props} />);
      });
    const flush = () =>
      act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    return {
      render,
      flush,
      unmount: () => act(() => root.unmount()),
    };
  }

  it("rounds the panel with cornerRadius using width and height as the panel size", async () => {
    runtimeQueue.push({ artboardWidth: 100, artboardHeight: 100 });
    const panel = mountPanel();
    panel.render({
      width: 0.6,
      height: 0.375,
      cornerRadius: 0.021,
      blendMode: "PremultiplyAlpha",
      source: { rivBytes: new ArrayBuffer(8), fit: "contain" },
    });
    await panel.flush();
    const [materials] = createdMaterials;
    const materialName = Object.keys(materials!)[0]!;
    expect(materials![materialName]).toMatchObject({
      blendMode: "PremultiplyAlpha",
      diffuseTexture: { cornerRadius: 0.021, panelWidth: 0.6, panelHeight: 0.375 },
    });
    panel.unmount();
  });

  it("reapplies bindings to the new runtime after a source swap", async () => {
    const runtimeA = {
      setString: jest.fn(),
      setBoolean: jest.fn(),
      artboardWidth: 100,
      artboardHeight: 100,
    };
    const runtimeB = {
      setString: jest.fn(),
      setBoolean: jest.fn(),
      artboardWidth: 100,
      artboardHeight: 100,
    };
    runtimeQueue.push(runtimeA, runtimeB);

    const panel = mountPanel();
    const bindings = { title: "hello", enabled: true };
    const sourceA = { rivBytes: new ArrayBuffer(8), fit: "contain" as const };
    const sourceB = { rivBytes: new ArrayBuffer(16), fit: "contain" as const };

    panel.render({
      width: 1,
      height: 1,
      source: sourceA,
      bindings,
    });
    await panel.flush();

    expect(runtimeA.setString).toHaveBeenCalledWith("title", "hello");
    expect(runtimeA.setBoolean).toHaveBeenCalledWith("enabled", true);

    // Swap the source: the producer and its runtime are replaced.
    panel.render({
      width: 1,
      height: 1,
      source: sourceB,
      bindings,
    });
    await panel.flush();

    expect(createdProducers.length).toBeGreaterThanOrEqual(2);
    // Runtime B must receive the same bindings even though their values did
    // not change — it is a different native runtime.
    expect(runtimeB.setString).toHaveBeenCalledWith("title", "hello");
    expect(runtimeB.setBoolean).toHaveBeenCalledWith("enabled", true);

    panel.unmount();
  });
});

describe("ViroRivePanel bindings", () => {
  it("fingerprints primitives and typed bindings distinctly", () => {
    expect(bindingFingerprint("a")).toBe("string:a");
    expect(bindingFingerprint(1)).toBe("number:1");
    expect(bindingFingerprint(false)).toBe("boolean:false");
    expect(bindingFingerprint({ kind: "enum", value: "on" })).toBe("enum:on");
    expect(bindingFingerprint({ kind: "color", value: 255 })).toBe("color:255");
    expect(bindingFingerprint({ kind: "trigger", serial: 2 })).toBe("trigger:2");
    expect(bindingFingerprint({ kind: "trigger", serial: 3 })).not.toBe(
      bindingFingerprint({ kind: "trigger", serial: 2 }),
    );
  });

  it("dispatches each binding kind once per changed value", () => {
    const panel = {
      setString: jest.fn(),
      setNumber: jest.fn(),
      setBoolean: jest.fn(),
      setEnum: jest.fn(),
      setColor: jest.fn(),
      fireTrigger: jest.fn(),
    };
    const applied = new Map<string, string>();
    const bindings = {
      title: "hello",
      progress: 0.5,
      enabled: true,
      mode: { kind: "enum", value: "night" } as const,
      tint: { kind: "color", value: 0xff00ff } as const,
      fire: { kind: "trigger", serial: 1 } as const,
    };
    applyBindings(panel as never, bindings, applied);
    expect(panel.setString).toHaveBeenCalledWith("title", "hello");
    expect(panel.setNumber).toHaveBeenCalledWith("progress", 0.5);
    expect(panel.setBoolean).toHaveBeenCalledWith("enabled", true);
    expect(panel.setEnum).toHaveBeenCalledWith("mode", "night");
    expect(panel.setColor).toHaveBeenCalledWith("tint", 0xff00ff);
    expect(panel.fireTrigger).toHaveBeenCalledWith("fire");

    // Same values again: nothing re-applies.
    applyBindings(panel as never, bindings, applied);
    expect(panel.setString).toHaveBeenCalledTimes(1);
    expect(panel.fireTrigger).toHaveBeenCalledTimes(1);

    // A trigger refires only when its serial changes.
    applyBindings(
      panel as never,
      { ...bindings, fire: { kind: "trigger", serial: 2 } },
      applied,
    );
    expect(panel.fireTrigger).toHaveBeenCalledTimes(2);
    expect(panel.setString).toHaveBeenCalledTimes(1);
  });
});
