import {
  VIRO_SPECS_DIAGNOSTICS,
  type ViroSpecsDiagnosticCode,
  type ViroSpecsDiagnosticSeverity,
} from "./diagnosticCodes";

/**
 * One finding from a Specs producer: the runtime compiler, the static
 * compiler, manifest validation or the runtime transport.
 *
 * Every field except `code`, `severity` and `message` is present only when the
 * producer knows it. The runtime compiler has no file positions; the static
 * compiler fills `file`, `line` and `col` for anything it can trace to source.
 *
 * @see {@linkcode VIRO_SPECS_DIAGNOSTICS} for every code.
 */
export interface ViroSpecsDiagnostic {
  /** Stable code, documented in `docs/specs-diagnostics.md`. */
  readonly code: ViroSpecsDiagnosticCode;
  /** Fixed per code. See {@linkcode ViroSpecsDiagnosticSeverity}. */
  readonly severity: ViroSpecsDiagnosticSeverity;
  /** ID of the node, polyline or light the finding is about. */
  readonly nodeId?: string;
  /** Source or manifest file, relative to the working directory. */
  readonly file?: string;
  /** 1-based line in `file`. */
  readonly line?: number;
  /** 1-based column in `file`. */
  readonly col?: number;
  /** JSON Pointer (RFC 6901) into the manifest, for example `/nodes/2/position`. */
  readonly fieldPath?: string;
  /** What is wrong, naming the element and value involved. */
  readonly message: string;
  /** How to fix it. */
  readonly hint: string;
}

/** Location and context fields a producer can attach to a diagnostic. */
export interface ViroSpecsDiagnosticDetails {
  readonly nodeId?: string;
  readonly file?: string;
  readonly line?: number;
  readonly col?: number;
  readonly fieldPath?: string;
  /** Replaces the catalog hint when the producer has a more specific fix. */
  readonly hint?: string;
}

/**
 * Builds a {@linkcode ViroSpecsDiagnostic}, taking the severity and default
 * hint from {@linkcode VIRO_SPECS_DIAGNOSTICS}.
 */
export function createViroSpecsDiagnostic(
  code: ViroSpecsDiagnosticCode,
  message: string,
  details: ViroSpecsDiagnosticDetails = {}
): ViroSpecsDiagnostic {
  const definition = VIRO_SPECS_DIAGNOSTICS[code];
  const diagnostic: {
    -readonly [K in keyof ViroSpecsDiagnostic]: ViroSpecsDiagnostic[K];
  } = {
    code,
    severity: definition.severity,
    message,
    hint: details.hint ?? definition.hint,
  };
  if (details.nodeId !== undefined) diagnostic.nodeId = details.nodeId;
  if (details.file !== undefined) diagnostic.file = details.file;
  if (details.line !== undefined) diagnostic.line = details.line;
  if (details.col !== undefined) diagnostic.col = details.col;
  if (details.fieldPath !== undefined) diagnostic.fieldPath = details.fieldPath;
  return diagnostic;
}

/** True when any diagnostic has severity `error`. */
export function hasViroSpecsErrors(
  diagnostics: readonly ViroSpecsDiagnostic[]
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

/**
 * Formats a diagnostic as one line in the `file:line:col severity CODE message`
 * shape compilers use, with the hint on a second line.
 */
export function formatViroSpecsDiagnostic(
  diagnostic: ViroSpecsDiagnostic
): string {
  let location = "";
  if (diagnostic.file !== undefined) {
    location = diagnostic.file;
    if (diagnostic.line !== undefined) {
      location += ":" + diagnostic.line;
      if (diagnostic.col !== undefined) location += ":" + diagnostic.col;
    }
    location += " ";
  }
  const target =
    diagnostic.fieldPath !== undefined ? " [" + diagnostic.fieldPath + "]" : "";
  return (
    location +
    diagnostic.severity +
    " " +
    diagnostic.code +
    target +
    ": " +
    diagnostic.message +
    "\n  hint: " +
    diagnostic.hint
  );
}
