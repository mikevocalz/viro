# ADR-0002: Structured Specs diagnostics

**Status:** Proposed (branch `feat/specs-production`, awaiting review)
**Date:** 2026-10-28
**Deciders:** Mike Allen

## Context

Before this change, both Specs compilers reported problems as English strings.

- The runtime compiler pushed strings such as `"Unsupported Specs JSX child ViroBox"`
  into `diagnostics: string[]`, and `ViroSpecsScene` passed each one to
  `onDiagnostic(message: string)`. It applied the scene anyway.
- The static compiler pushed strings such as `"ViroText bad requires static text."`
  and printed them with `console.error`. It had no file, line or column, and it
  refused to write output on any diagnostic at all, so there was no way to
  tell a dropped style hint from a broken scene.
- Several failures had no message: unsupported components and spread props
  vanished in the static compiler, `defaultSourceResolver` threw out of
  render, and duplicate `viroTag`s were never checked.

Tooling (CI annotations, editors, the Lens-side diagnostics panel planned in
WS3) cannot act on strings, and two compilers wording the same problem
differently is drift by construction.

## Decision

1. One type, `ViroSpecsDiagnostic { code, severity, nodeId?, file?, line?,
   col?, fieldPath?, message, hint }`, used by every producer: both
   compilers, manifest validation, lowering and the runtime transport.
2. One catalog, `VIRO_SPECS_DIAGNOSTICS` in
   `components/Specs/core/diagnosticCodes.ts`, keyed by code. Each entry fixes
   the severity and supplies a title and a default hint. Producers write the
   message and may replace the hint; they cannot change the severity.
3. Code ranges by stage: `VS1xxx` manifest and protocol validation, `VS2xxx`
   static source analysis, `VS3xxx` compile semantics shared by both compilers
   and the transport, `VS4xxx` capability errors. Codes are append-only.
4. Three severities with fixed consequences. `error` blocks output and
   `applyScene`; `warning` lets output through and fails `--strict`; `info`
   never blocks.
5. `fieldPath` is a JSON Pointer into the manifest, so a finding from
   validation points at the exact field in a hand-written file.
6. `docs/specs-diagnostics.md` lists every code. A test fails when the catalog
   and the page disagree in either direction.
7. The static compiler loads the catalog from the same TypeScript source as the
   runtime, compiled to CommonJS in `bin/specs-core/`
   (`npm run build:specs-core`), so neither compiler can invent a code.

## Options considered

### A: Plain objects from a typed catalog (chosen)

| Dimension | Assessment |
| --- | --- |
| Complexity | Low. One file of data, one factory. |
| Serialization | Native JSON; crosses the RN/Lens transport and CLI stderr unchanged. |
| Drift | One source for both compilers; docs checked by a test. |
| Team familiarity | Same shape as TypeScript, ESLint and Babel diagnostics. |

### B: `Error` subclasses per code

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium. A class hierarchy for what is mostly data. |
| Serialization | Prototypes do not survive JSON or the Lens bridge; would need a second plain shape anyway. |
| Drift | Same as A. |

The api-design guidance prefers real `Error` objects for failures, with an
exception for values serialized across a boundary that cannot keep
prototypes. Diagnostics are data that cross two such boundaries (CLI stderr
and the Lens transport), and most are not failures of the call that returns
them. Option A fits the exception.

### C: Keep strings, add a code prefix (`"VS2004: ..."`)

Cheapest, and it keeps every consumer parsing text. Rejected.

## Trade-off analysis

Fixed severity per code is the main constraint. A producer cannot, for
example, downgrade `VS3001` to a warning for one scene. That is deliberate:
"never substitutes" is only enforceable if a code means the same thing
everywhere. When a case needs a different severity, it gets a new code.

Treating every pre-existing static-compiler message as `error` keeps the old
refuse-on-anything behavior for those cases. New findings that describe loss
rather than misrepresentation (`VS3002` ignored prop, `VS3009` non-hex color,
`VS3012` ordinal ID, `VS1002` v1 input, `VS1015` field not on the wire) are
warnings. A scene that hits only those was accepted silently before; it is
still accepted by default, now with a warning, and `--strict` rejects it.
No scene that failed before passes now.

## Consequences

- Easier: CI annotations from `--diagnostics-format json`; a Lens diagnostics
  panel (WS3) that switches on `code`; tests that assert codes instead of
  substrings.
- Harder: every new limitation needs a catalog entry, a doc heading and a test
  before it ships. That is the point of the pack's rule that a new limitation
  gets a code and a doc line in the same commit.
- Breaking: `onDiagnostic` and `ViroSpecsCompiledScene.diagnostics` changed
  type. `formatViroSpecsDiagnostic` gives callers a string.
- Revisit: when the Lens host gains its own diagnostics channel (WS3), host
  codes need a range. `VS5xxx` is free for that.

## Action items

1. [x] Catalog, type, factory, formatter; both compilers converted.
2. [x] `docs/specs-diagnostics.md` with the catalog/doc agreement test.
3. [x] `--strict` and `--diagnostics-format json` in `viro-specs-compile`.
4. [ ] WS2: move the static compiler to TypeScript so it imports the catalog directly instead of the compiled copy.
5. [ ] WS3: Lens-side diagnostics channel uses the same type.
