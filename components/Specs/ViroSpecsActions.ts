import {
  checkSpecsActionPayload,
  type ViroSpecsActionDeclaration,
  type ViroSpecsActionPayload,
  type ViroSpecsActionPayloads,
  type ViroSpecsActionSet,
  type ViroSpecsActionSpec,
  type ViroSpecsActionTriggerEvent,
} from "./core/actions";
import { createViroSpecsDiagnostic, type ViroSpecsDiagnostic } from "./core/diagnostic";
import type { ViroSpecsManifestV2 } from "./core/manifest";

/**
 * A typed action raised by a trigger on the Lens, or resolved on the phone
 * from an interaction. Delivered by a transport's `onAction` or by
 * {@linkcode resolveSpecsTriggers}.
 *
 * @see {@linkcode createSpecsActionDispatcher}
 */
export type ViroSpecsActionEvent = {
  readonly actionId: string;
  readonly payload: ViroSpecsActionPayload;
  /** Node whose trigger fired. Absent for app-dispatched actions. */
  readonly nodeId?: string;
  readonly on?: ViroSpecsActionTriggerEvent;
  /** Revision of the Lens scene the wearer interacted with, when the Lens resolved the trigger. */
  readonly sceneRevision?: number;
  readonly timestampMs?: number;
};

/**
 * Checks actions against their declarations and hands them to handlers.
 * Created by {@linkcode createSpecsActionDispatcher} or
 * {@linkcode bindSpecsActionsToStore}.
 */
export interface ViroSpecsActionDispatcher {
  /** Declarations this dispatcher accepts. Pass them to `ViroSpecsScene`'s `actions` prop. */
  readonly declarations: readonly ViroSpecsActionDeclaration[];
  /**
   * Checks `event` and runs its handler. Returns false when the action was
   * dropped: undeclared (`VS1017`), ill-typed (`VS1018`) or unhandled
   * (`VS3024`). A handler that throws is not caught.
   */
  dispatch(event: ViroSpecsActionEvent): boolean;
}

/** Options shared by the dispatcher factories. */
export type ViroSpecsActionDispatcherOptions = {
  /** Receives VS1017, VS1018 and VS3024 when an action is dropped. */
  readonly onDiagnostic?: (diagnostic: ViroSpecsDiagnostic) => void;
};

/** Handler per action ID, typed by the action set. */
export type ViroSpecsActionHandlers<T extends ViroSpecsActionSpec> = {
  readonly [K in keyof T & string]?: (payload: ViroSpecsActionPayloads<T>[K], event: ViroSpecsActionEvent) => void;
};

/**
 * Builds a dispatcher over plain handlers. Use it when app state lives
 * somewhere other than a store with `getState`/`setState`.
 *
 * @example
 * const dispatcher = createSpecsActionDispatcher(LAB_ACTIONS, {
 *   "exhibit.open": ({ exhibitId }) => navigation.navigate("Exhibit", { exhibitId }),
 * });
 */
export function createSpecsActionDispatcher<T extends ViroSpecsActionSpec>(
  actions: ViroSpecsActionSet<T>,
  handlers: ViroSpecsActionHandlers<T>,
  options: ViroSpecsActionDispatcherOptions = {}
): ViroSpecsActionDispatcher {
  return buildDispatcher(actions.declarations, eraseCheckedPayloadTypes<AnyHandler>(handlers), options);
}

/**
 * Drops the per-action payload types of a handler table. Sound because
 * dispatch calls a handler only after checkSpecsActionPayload accepted the
 * payload against the same declaration the types were inferred from.
 */
function eraseCheckedPayloadTypes<F>(table: object): Readonly<Record<string, F | undefined>> {
  return table as Readonly<Record<string, F | undefined>>;
}

type AnyHandler = (payload: ViroSpecsActionPayload, event: ViroSpecsActionEvent) => void;

function buildDispatcher(
  declarations: readonly ViroSpecsActionDeclaration[],
  table: Readonly<Record<string, AnyHandler | undefined>>,
  options: ViroSpecsActionDispatcherOptions
): ViroSpecsActionDispatcher {
  const byId = new Map(declarations.map((d) => [d.id, d] as const));
  const report = (diagnostic: ViroSpecsDiagnostic): false => {
    options.onDiagnostic?.(diagnostic);
    return false;
  };
  return {
    declarations,
    dispatch(event) {
      const declaration = byId.get(event.actionId);
      const details = event.nodeId !== undefined ? { nodeId: event.nodeId } : {};
      if (!declaration) {
        return report(createViroSpecsDiagnostic("VS1017", "Action " + JSON.stringify(event.actionId) + " is not declared; it was dropped.", details));
      }
      const problems = checkSpecsActionPayload(declaration, event.payload);
      if (problems.length > 0) {
        for (const problem of problems) {
          report(createViroSpecsDiagnostic("VS1018", event.actionId + ": " + problem.message, { ...details, fieldPath: "/payload" + problem.path }));
        }
        return false;
      }
      const handler = table[event.actionId];
      if (!handler) {
        return report(createViroSpecsDiagnostic("VS3024", "Action " + event.actionId + " has no handler; it was dropped.", details));
      }
      handler(event.payload, event);
      return true;
    },
  };
}

/**
 * The part of a store {@linkcode bindSpecsActionsToStore} uses. A Zustand
 * `StoreApi` (from `create` or `createStore`) satisfies it; so does any
 * store with the same two methods.
 */
export interface ViroSpecsStateStore<S> {
  getState(): S;
  /** Replaces the whole state. Zustand: `setState(next, true)`. */
  setState(next: S, replace: true): void;
}

/** Pure reducer per action ID, typed by the action set. Return the input state for no change. */
export type ViroSpecsActionReducers<S, T extends ViroSpecsActionSpec> = {
  readonly [K in keyof T & string]: (state: S, payload: ViroSpecsActionPayloads<T>[K], event: ViroSpecsActionEvent) => S;
};

/**
 * Binds actions to a store: each accepted action runs its reducer on the
 * current state and replaces the state when the reducer returns a new
 * object. React components that read the store re-render, `ViroSpecsScene`
 * recompiles, and the Lens patches or navigates.
 *
 * Reducers are pure, the same shape as Lens handlers in
 * `ViroSpecsActionRegistry`, so one reducer module can serve both.
 *
 * @example
 * const useLab = create<LabState>(() => INITIAL_LAB_STATE);
 * const dispatcher = bindSpecsActionsToStore(useLab, LAB_ACTIONS, {
 *   "exhibit.open": (s, { exhibitId }) => ({ ...s, route: "details", selectedId: exhibitId }),
 *   "settings.set-units": (s, { units }) => ({ ...s, units }),
 *   "nav.back": (s) => ({ ...s, route: "list" }),
 * });
 * <ViroSpecsScene transport={transport} actions={dispatcher.declarations} onAction={dispatcher.dispatch} />
 */
export function bindSpecsActionsToStore<S, T extends ViroSpecsActionSpec>(
  store: ViroSpecsStateStore<S>,
  actions: ViroSpecsActionSet<T>,
  reducers: ViroSpecsActionReducers<S, T>,
  options: ViroSpecsActionDispatcherOptions = {}
): ViroSpecsActionDispatcher {
  const table = eraseCheckedPayloadTypes<(state: S, payload: ViroSpecsActionPayload, event: ViroSpecsActionEvent) => S>(reducers);
  const handlers: Record<string, AnyHandler> = {};
  for (const declaration of actions.declarations) {
    const reducer = table[declaration.id];
    if (!reducer) continue;
    handlers[declaration.id] = (payload, event) => {
      const current = store.getState();
      const next = reducer(current, payload, event);
      if (next !== current) store.setState(next, true);
    };
  }
  return buildDispatcher(actions.declarations, handlers, options);
}

/**
 * Resolves the triggers an interaction fires against `manifest`, for
 * transports that deliver interactions but not actions. Pass the manifest
 * that was on the Lens when the interaction happened, not a newer one.
 */
export function resolveSpecsTriggers(
  manifest: ViroSpecsManifestV2,
  nodeId: string,
  phase: string
): ViroSpecsActionEvent[] {
  const on: ViroSpecsActionTriggerEvent | undefined =
    phase === "select-end" ? "select" : phase === "hover-enter" ? "hover-enter" : phase === "hover-exit" ? "hover-exit" : undefined;
  if (on === undefined) return [];
  const interaction = manifest.interactions.find((i) => i.nodeId === nodeId);
  return (interaction?.triggers ?? [])
    .filter((trigger) => trigger.on === on)
    .map((trigger) => ({ actionId: trigger.actionId, payload: trigger.payload ?? {}, nodeId, on }));
}
