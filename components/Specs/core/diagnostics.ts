import {
  createViroSpecsDiagnostic,
  type ViroSpecsDiagnostic,
  type ViroSpecsDiagnosticDetails,
} from "./diagnostic";
import type { ViroSpecsDiagnosticCode } from "./diagnosticCodes";

/**
 * A finding from the shared compiler core, before it has a location.
 *
 * The core knows which element and which prop a problem is about but not where
 * that prop is in a file. Each compiler turns issues into
 * {@linkcode ViroSpecsDiagnostic}s with {@linkcode locateViroSpecsIssue}: the
 * static compiler adds file, line and column of `prop`; the runtime compiler
 * has no positions and adds only the node ID.
 */
export interface ViroSpecsIssue {
  readonly code: ViroSpecsDiagnosticCode;
  readonly message: string;
  /** Prop the issue is about, used to find its source position. */
  readonly prop?: string;
}

/**
 * Where an element came from. `detailsFor(prop)` returns the location of one
 * prop, or of the element when `prop` is undefined or not written on it.
 */
export interface ViroSpecsElementOrigin {
  readonly detailsFor: (prop: string | undefined) => ViroSpecsDiagnosticDetails;
}

/** An origin with no source positions, used by the runtime compiler. */
export const VIRO_SPECS_NO_ORIGIN: ViroSpecsElementOrigin = {
  detailsFor: () => ({}),
};

/** Turns a core issue into a diagnostic at the issue's prop. */
export function locateViroSpecsIssue(
  issue: ViroSpecsIssue,
  origin: ViroSpecsElementOrigin,
  nodeId: string | undefined
): ViroSpecsDiagnostic {
  const details = origin.detailsFor(issue.prop);
  return createViroSpecsDiagnostic(issue.code, issue.message, {
    ...details,
    ...(nodeId !== undefined ? { nodeId } : {}),
  });
}

/** `file:line:col` for a diagnostic's location, or `undefined` without a file. */
export function formatViroSpecsLocation(details: ViroSpecsDiagnosticDetails): string | undefined {
  if (details.file === undefined) return undefined;
  let text = details.file;
  if (details.line !== undefined) {
    text += ":" + details.line;
    if (details.col !== undefined) text += ":" + details.col;
  }
  return text;
}

/** Severity rank for sorting: errors first. */
const RANK = { error: 0, warning: 1, info: 2 } as const;

/**
 * Orders diagnostics by file, line and column, then severity, then code.
 * Diagnostics without a position keep their relative order after the
 * positioned ones. The sort is stable, so output is deterministic.
 */
export function sortViroSpecsDiagnostics(
  diagnostics: readonly ViroSpecsDiagnostic[]
): ViroSpecsDiagnostic[] {
  return diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .sort((a, b) => {
      const left = a.diagnostic;
      const right = b.diagnostic;
      const leftPositioned = left.line !== undefined ? 0 : 1;
      const rightPositioned = right.line !== undefined ? 0 : 1;
      if (leftPositioned !== rightPositioned) return leftPositioned - rightPositioned;
      if (leftPositioned === 0) {
        const file = (left.file ?? "").localeCompare(right.file ?? "");
        if (file !== 0) return file;
        if (left.line !== right.line) return (left.line ?? 0) - (right.line ?? 0);
        if (left.col !== right.col) return (left.col ?? 0) - (right.col ?? 0);
        const severity = RANK[left.severity] - RANK[right.severity];
        if (severity !== 0) return severity;
        const code = left.code.localeCompare(right.code);
        if (code !== 0) return code;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.diagnostic);
}

/** Exit status for a diagnostic set: 1 on any error, or on any warning under `strict`. */
export function viroSpecsExitStatus(
  diagnostics: readonly ViroSpecsDiagnostic[],
  strict: boolean
): 0 | 1 {
  return diagnostics.some(
    (diagnostic) => diagnostic.severity === "error" || (strict && diagnostic.severity === "warning")
  )
    ? 1
    : 0;
}
