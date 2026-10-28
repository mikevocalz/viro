import * as React from "react";
import {
  compileViroSpecsChildren,
  dispatchViroSpecsAnimationEvent,
  dispatchViroSpecsInteraction,
  type ViroSpecsAnimationEvent,
  type ViroSpecsAnimationPlan,
  type ViroSpecsCompiledScene,
  type ViroSpecsInteractionEvent,
  type ViroSpecsPortablePolyline,
  type ViroSpecsSceneSnapshot,
  type ViroSpecsSourceResolver,
} from "./ViroSpecsCompiler";
import { isViroSpecsRuntime } from "./ViroSpecsRuntime";
import {
  createViroSpecsDiagnostic,
  hasViroSpecsErrors,
  type ViroSpecsDiagnostic,
} from "./core/diagnostic";
import { validateSpecsSceneSnapshot } from "./core/validate";

export type ViroSpecsSceneTransport = {
  applyScene(scene: ViroSpecsSceneSnapshot): Promise<void> | void;
  presentPolyline?(polyline: ViroSpecsPortablePolyline): Promise<void> | void;
  clearPolylines?(): Promise<void> | void;
  playAnimation?(
    animation: Extract<ViroSpecsAnimationPlan, { action: "play" }>
  ): Promise<void> | void;
  stopAnimation?(nodeId: string, name: string): Promise<void> | void;
  onInteraction?(
    listener: (event: ViroSpecsInteractionEvent) => void
  ): () => void;
  onAnimationEvent?(
    listener: (event: ViroSpecsAnimationEvent) => void
  ): () => void;
};

export type ViroSpecsSceneProps = {
  children?: React.ReactNode;
  transport: ViroSpecsSceneTransport;
  sourceResolver?: ViroSpecsSourceResolver;
  /**
   * Receives every diagnostic from compilation, validation and the transport.
   * When any has severity `error`, the scene is not applied and the previous
   * scene stays on the Lens.
   */
  onDiagnostic?: (diagnostic: ViroSpecsDiagnostic) => void;
  renderNativeFallback?: boolean;
};

function emptyCompiled(): ViroSpecsCompiledScene {
  return {
    manifest: {
      version: 2,
      nodes: [],
      polylines: [],
      lights: [],
      materials: [],
      interactions: [],
      animations: [],
    },
    scene: { version: 1, nodes: [] },
    polylines: [],
    animations: [],
    callbacks: new Map(),
    diagnostics: [],
  };
}

/**
 * Compiles familiar Viro JSX into the portable scene consumed by the validated
 * SPECS 27 Lens backend. Outside Specs it renders the same children without
 * evaluating Specs-only asset resolution.
 *
 * Use viroTag for stable cross-renderer node IDs.
 */
export function ViroSpecsScene({
  children,
  transport,
  sourceResolver,
  onDiagnostic,
  renderNativeFallback = true,
}: ViroSpecsSceneProps): React.ReactElement | null {
  const specsRuntime = isViroSpecsRuntime();
  const compiled = React.useMemo(
    () =>
      specsRuntime
        ? compileViroSpecsChildren(children, sourceResolver)
        : emptyCompiled(),
    [children, sourceResolver, specsRuntime]
  );
  const callbacksRef = React.useRef(compiled.callbacks);
  callbacksRef.current = compiled.callbacks;

  const revisionRef = React.useRef(0);
  const queueRef = React.useRef<Promise<void>>(Promise.resolve());

  React.useEffect(() => {
    if (!specsRuntime) return;

    const revision = ++revisionRef.current;

    queueRef.current = queueRef.current
      .then(async () => {
        if (revisionRef.current !== revision) return;

        for (const diagnostic of compiled.diagnostics) {
          onDiagnostic?.(diagnostic);
        }
        if (hasViroSpecsErrors(compiled.diagnostics)) return;

        const gate = validateSpecsSceneSnapshot(compiled.scene);
        for (const diagnostic of gate.diagnostics) onDiagnostic?.(diagnostic);
        if (!gate.ok) return;

        await transport.applyScene(gate.value);
        if (revisionRef.current !== revision) return;

        await transport.clearPolylines?.();
        if (revisionRef.current !== revision) return;

        for (const polyline of compiled.polylines) {
          await transport.presentPolyline?.(polyline);
          if (revisionRef.current !== revision) return;
        }

        for (const animation of compiled.animations) {
          if (revisionRef.current !== revision) return;

          if (animation.action === "stop") {
            if (!transport.stopAnimation) {
              onDiagnostic?.(
                createViroSpecsDiagnostic(
                  "VS3010",
                  "Transport has no stopAnimation; cannot stop " +
                    animation.name +
                    " on " +
                    animation.nodeId +
                    ".",
                  { nodeId: animation.nodeId }
                )
              );
              continue;
            }
            await transport.stopAnimation(animation.nodeId, animation.name);
          } else {
            if (!transport.playAnimation) {
              onDiagnostic?.(
                createViroSpecsDiagnostic(
                  "VS3010",
                  "Transport has no playAnimation; cannot play " +
                    animation.name +
                    " on " +
                    animation.nodeId +
                    ".",
                  { nodeId: animation.nodeId }
                )
              );
              continue;
            }
            await transport.playAnimation(animation);
          }
        }
      })
      .catch((error: unknown) => {
        onDiagnostic?.(
          createViroSpecsDiagnostic(
            "VS3011",
            "Transport failed: " +
              (error instanceof Error ? error.message : String(error))
          )
        );
      });

    return () => {
      if (revisionRef.current === revision) {
        revisionRef.current += 1;
      }
    };
  }, [compiled, onDiagnostic, specsRuntime, transport]);

  React.useEffect(() => {
    if (!specsRuntime || !transport.onInteraction) return;
    return transport.onInteraction((event) =>
      dispatchViroSpecsInteraction(event, callbacksRef.current)
    );
  }, [specsRuntime, transport]);

  React.useEffect(() => {
    if (!specsRuntime || !transport.onAnimationEvent) return;
    return transport.onAnimationEvent((event) =>
      dispatchViroSpecsAnimationEvent(event, callbacksRef.current)
    );
  }, [specsRuntime, transport]);

  if (specsRuntime) return null;
  if (!renderNativeFallback) return null;
  return React.createElement(React.Fragment, null, children);
}
