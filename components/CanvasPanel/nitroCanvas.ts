/**
 * Lazy, optional access to `nitro-canvas-in-Vision`.
 *
 * Viro owns the small structural contract it consumes so clean clones, CI,
 * and package consumers can typecheck without a sibling checkout. The private
 * Nitro package is still loaded unchanged when one of the canvas panels mounts.
 */
export type CanvasBackingRoute = "ahb" | "surface-texture";
export type CanvasPointerPhase = "down" | "move" | "up";
export type RiveFit = "contain" | "cover" | "fill";

export interface CanvasSurface {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly route?: CanvasBackingRoute;
  markDirty(): void;
  submitFrame?(pixels: ArrayBuffer): void;
  resize?(width: number, height: number): void;
  dispatchInput?(phase: CanvasPointerPhase, uvX: number, uvY: number): void;
  getAHardwareBufferPointer?(): number;
  getIOSurfaceID?(): number;
  dispose(): void;
}

export interface CanvasProducer {
  attach(surface: CanvasSurface): Promise<void>;
  renderFrame(): void;
  resize?(width: number, height: number): void;
  onPointer?(phase: CanvasPointerPhase, x: number, y: number): void;
  setActive?(active: boolean): void;
  readonly managesOwnFrames?: boolean;
  dispose(): void;
}

export interface GLES3ProducerInit {
  three: any;
  setup(args: { renderer: any; width: number; height: number }):
    | Promise<{ render(dt: number): unknown; dispose?(): void }>
    | { render(dt: number): unknown; dispose?(): void };
  [key: string]: unknown;
}
export interface GLES3Producer extends CanvasProducer {}

export interface RivePanel {
  readonly artboardWidth: number;
  readonly artboardHeight: number;
  [key: string]: unknown;
}
export interface RiveCanvasOptions {
  fit?: RiveFit;
  [key: string]: unknown;
}
export interface RiveProducerInit {
  createRuntime(surface: CanvasSurface): Promise<any>;
  [key: string]: unknown;
}
export interface RiveProducer extends CanvasProducer {
  readonly runtime: any;
  onPointer(phase: CanvasPointerPhase, x: number, y: number): void;
}
export interface CanvasInViroInputOptions {
  [key: string]: any;
}
export interface CanvasInViroInputProps {
  dragPlane: {
    planePoint: [number, number, number];
    planeNormal: [number, number, number];
    [key: string]: unknown;
  };
  [key: string]: any;
}

export interface NitroCanvasModule {
  createCanvasSurface(options: {
    width: number;
    height: number;
    scale?: number;
    sRGB?: boolean;
    androidRoute?: CanvasBackingRoute;
  }): CanvasSurface;
  canvasSource(surface: CanvasSurface): unknown;
  GLES3Producer: new (init: GLES3ProducerInit) => GLES3Producer;
  RiveProducer: new (init: RiveProducerInit) => RiveProducer;
  createRiveCanvasRuntime(surface: CanvasSurface, options: RiveCanvasOptions): Promise<any>;
  artboardPointerSink(
    layout: {
      artboard: { width: number; height: number };
      surface: { width: number; height: number };
      fit: RiveFit;
    },
    dispatch: (event: { phase: CanvasPointerPhase; x: number; y: number }) => void
  ): (event: any) => void;
  useCanvasInViroInput(
    options: CanvasInViroInputOptions & {
      size: { width: number; height: number };
      onPointer: (event: any) => void;
    }
  ): CanvasInViroInputProps;
}

let cached: NitroCanvasModule | null = null;

export function requireNitroCanvas(): NitroCanvasModule {
  if (cached) return cached;
  try {
    cached = require("nitro-canvas-in-Vision") as NitroCanvasModule;
  } catch {
    throw new Error(
      "nitro-canvas-in-Vision is not installed. ViroGpuPanel, ViroThreeJSPanel " +
        "and ViroRivePanel need it; no other Viro component does."
    );
  }
  return cached;
}
