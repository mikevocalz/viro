import * as React from "react";
import {
  compileViroSpecsChildren,
  dispatchViroSpecsInteraction,
  type ViroSpecsCompiledScene,
  type ViroSpecsInteractionEvent,
  type ViroSpecsPortablePolyline,
  type ViroSpecsSceneSnapshot,
  type ViroSpecsSourceResolver,
} from "./ViroSpecsCompiler";
import { isViroSpecsRuntime } from "./ViroSpecsRuntime";

export type ViroSpecsSceneTransport = {
  applyScene(scene: ViroSpecsSceneSnapshot): Promise<void> | void;
  presentPolyline?(polyline: ViroSpecsPortablePolyline): Promise<void> | void;
  clearPolylines?(): Promise<void> | void;
  onInteraction?(
    listener: (event: ViroSpecsInteractionEvent) => void
  ): () => void;
};

export type ViroSpecsSceneProps = {
  children?: React.ReactNode;
  transport: ViroSpecsSceneTransport;
  sourceResolver?: ViroSpecsSourceResolver;
  onDiagnostic?: (message: string) => void;
  renderNativeFallback?: boolean;
};

function emptyCompiled(): ViroSpecsCompiledScene {
  return {
    scene: { version: 1, nodes: [] },
    polylines: [],
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

        await transport.applyScene(compiled.scene);
        if (revisionRef.current !== revision) return;

        await transport.clearPolylines?.();
        if (revisionRef.current !== revision) return;

        for (const polyline of compiled.polylines) {
          await transport.presentPolyline?.(polyline);
          if (revisionRef.current !== revision) return;
        }
      })
      .catch((error) => {
        onDiagnostic?.(
          "Specs scene transport failed: " +
            (error instanceof Error ? error.message : String(error))
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

  if (specsRuntime) return null;
  if (!renderNativeFallback) return null;
  return React.createElement(React.Fragment, null, children);
}
