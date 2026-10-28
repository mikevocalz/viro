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
import type { ViroSpecsManifestV2, ViroSpecsSceneDocument } from "./core/manifest";
import type { ViroSpecsActionDeclaration } from "./core/actions";
import { resolveSpecsTriggers, type ViroSpecsActionEvent } from "./ViroSpecsActions";

export type ViroSpecsSceneTransport = {
  /** Scene protocol 1. Drops text style, extents, maxLines, opacity, materials and lights (`VS1015`). */
  applyScene(scene: ViroSpecsSceneSnapshot): Promise<void> | void;
  /**
   * Scene protocol 2, read by `ViroSpecsSceneController` in
   * `@viro-external/specs`. When present it is used instead of `applyScene`,
   * and the document carries polylines, interactions and animations, so the
   * per-item calls below are not made.
   */
  applySceneDocument?(document: ViroSpecsSceneDocument): Promise<void> | void;
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
  /**
   * Typed actions the Lens resolved from triggers
   * (`ViroSpecsSceneController.addOnActionListener`). The Lens drops actions
   * whose scene was retired before they ran, so these are never stale.
   * Without it, `ViroSpecsScene` resolves triggers from `onInteraction`
   * against the last scene the transport applied.
   */
  onAction?(listener: (event: ViroSpecsActionEvent) => void): () => void;
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
  /**
   * Actions the tree's `specsAction` triggers may fire, usually
   * `dispatcher.declarations`. Triggers naming anything else are `VS1017`.
   */
  actions?: readonly ViroSpecsActionDeclaration[];
  /** Route of this scene. A new route is navigation on the Lens; scroll positions of a route are restored when it returns. */
  route?: string;
  /** Receives every action, usually `dispatcher.dispatch` from `bindSpecsActionsToStore`. */
  onAction?: (event: ViroSpecsActionEvent) => void;
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
    document: {
      version: 2,
      nodes: [],
      polylines: [],
      lights: [],
      materials: [],
      interactions: [],
      animations: [],
    },
    scene: { version: 1, nodes: [] },
    loweringDiagnostics: [],
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
  actions,
  route,
  onAction,
}: ViroSpecsSceneProps): React.ReactElement | null {
  const specsRuntime = isViroSpecsRuntime();
  const compiled = React.useMemo(
    () =>
      specsRuntime
        ? compileViroSpecsChildren(children, sourceResolver, {
            ...(actions !== undefined ? { actions } : {}),
            ...(route !== undefined ? { route } : {}),
          })
        : emptyCompiled(),
    [children, sourceResolver, specsRuntime, actions, route]
  );
  const callbacksRef = React.useRef(compiled.callbacks);
  callbacksRef.current = compiled.callbacks;
  const onActionRef = React.useRef(onAction);
  onActionRef.current = onAction;
  // The manifest the transport last applied: what the wearer can see and
  // pinch. Triggers resolve against it, never against a newer render.
  const appliedRef = React.useRef<ViroSpecsManifestV2 | null>(null);

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

        if (transport.applySceneDocument) {
          await transport.applySceneDocument(compiled.document);
          if (revisionRef.current === revision) appliedRef.current = compiled.manifest;
          return;
        }

        // Protocol 1 fallback: report what the snapshot drops.
        for (const diagnostic of compiled.loweringDiagnostics) onDiagnostic?.(diagnostic);
        const gate = validateSpecsSceneSnapshot(compiled.scene);
        for (const diagnostic of gate.diagnostics) onDiagnostic?.(diagnostic);
        if (!gate.ok) return;

        await transport.applyScene(gate.value);
        if (revisionRef.current !== revision) return;
        appliedRef.current = compiled.manifest;

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
    const resolveTriggers = transport.onAction === undefined;
    return transport.onInteraction((event) => {
      dispatchViroSpecsInteraction(event, callbacksRef.current);
      const applied = appliedRef.current;
      if (!resolveTriggers || !applied || event.targetId === undefined) return;
      for (const action of resolveSpecsTriggers(applied, event.targetId, event.phase)) {
        onActionRef.current?.(action);
      }
    });
  }, [specsRuntime, transport]);

  React.useEffect(() => {
    if (!specsRuntime || !transport.onAction) return;
    return transport.onAction((event) => onActionRef.current?.(event));
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
