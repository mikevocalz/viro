/**
 * One spatial panel for every canvas backend.
 *
 * ViroGpuPanel, ViroThreeJSPanel and ViroRivePanel were three files that, with
 * the backend name normalised away, differed by fourteen lines — a prop-shape
 * choice and a useRef that two of them had and one did not. Everything that
 * actually does the work already lived in one place: useCanvasPanel is generic
 * over `P extends CanvasProducer` and takes a producerFactory, and the native
 * module already models the backends as concrete producers behind that one
 * interface. This component is the panel those three were each re-deriving.
 *
 * The backend arrives as a factory rather than a discriminator. A union of
 * `{ backend: 'gpu', init: GpuProducerInit } | { backend: 'rive', ... }` would
 * push every backend's init type through this file and make adding a fourth an
 * edit here; a factory keeps each backend's init checked at the call site where
 * it is written, and this component never names a concrete producer at all.
 *
 * `import type` throughout is deliberate: type-only imports erase, so this file
 * contributes no runtime dependency on nitro-canvas-in-Vision. The presets that
 * construct a producer do, and they are where that cost belongs.
 */

import * as React from "react";
import type { CanvasProducer, CanvasSurface } from "nitro-canvas-in-Vision";
import { ViroNode } from "../ViroNode";
import { ViroQuad } from "../ViroQuad";
import { useCanvasPanel } from "./useCanvasPanel";

type Vec3 = [number, number, number];

/** Everything a canvas panel needs that is not the backend itself. */
export type ViroCanvasPanelSurfaceProps = {
  width: number;
  height: number;
  position?: Vec3;
  rotation?: Vec3;

  resolution?: { width: number; height: number };
  sRGB?: boolean;
  androidRoute?: "ahb" | "surface-texture";
  lightingModel?: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
  fallbackColor?: string;
  materialName?: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  autoTick?: boolean;
};

export type ViroCanvasPanelProps<P extends CanvasProducer> =
  ViroCanvasPanelSurfaceProps & {
    /**
     * Builds the backend. Called once on mount — the producer owns the
     * renderer, so swapping it mid-life means remounting, which is why this is
     * captured rather than tracked. Changing the identity of this function
     * alone does not rebuild the producer.
     */
    producerFactory: () => P;
  };

export type ViroCanvasPanelHandle<P extends CanvasProducer = CanvasProducer> = {
  surface: CanvasSurface | null;
  producer: P | null;
  materialName: string;
};

function ViroCanvasPanelInner<P extends CanvasProducer>(
  props: ViroCanvasPanelProps<P>,
  ref: React.Ref<ViroCanvasPanelHandle<P>>
): React.JSX.Element {
  const {
    producerFactory,
    width,
    height,
    position = [0, 1.45, -2.0],
    rotation,
    resolution = { width: 1024, height: 1024 },
    sRGB,
    androidRoute,
    lightingModel,
    fallbackColor,
    materialName,
    onReady,
    onError,
    autoTick,
  } = props;

  // The factory is captured on first mount. ViroThreeJSPanel did this and
  // ViroGpuPanel did not, so a parent that rebuilt its init object on every
  // render tore down and rebuilt the renderer each time on one panel and not
  // the other. One behaviour now, and it is the safe one.
  const factoryRef = React.useRef(producerFactory);

  const state = useCanvasPanel<P>({
    producerFactory: () => factoryRef.current(),
    resolution,
    sRGB,
    androidRoute,
    lightingModel,
    fallbackColor,
    materialName,
    onReady,
    onError,
    autoTick,
  });

  React.useImperativeHandle(
    ref,
    () => ({
      surface: state.surface,
      producer: state.producer,
      materialName: state.materialName,
    }),
    [state.surface, state.producer, state.materialName]
  );

  return (
    <ViroNode position={position} rotation={rotation}>
      <ViroQuad width={width} height={height} materials={[state.materialName]} />
    </ViroNode>
  );
}

// forwardRef erases the generic, so it is reapplied here. Without this cast a
// caller's handle comes back as CanvasProducer instead of their own producer.
export const ViroCanvasPanel = React.forwardRef(ViroCanvasPanelInner) as <
  P extends CanvasProducer
>(
  props: ViroCanvasPanelProps<P> & { ref?: React.Ref<ViroCanvasPanelHandle<P>> }
) => React.JSX.Element;
