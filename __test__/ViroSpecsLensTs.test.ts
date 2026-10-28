import * as fs from "node:fs";
import * as path from "node:path";

import type { ViroSpecsDiagnostic } from "../components/Specs/core/diagnostic";
import type { ViroSpecsManifestV2 } from "../components/Specs/core/manifest";
import { compileSpecsEntry } from "../src/specs-cli/compile";
import { renderSpecsLensHost } from "../src/specs-cli/lensTs";

/**
 * lens-ts snapshot: the generated Lens host (`viro-specs-compile --format
 * lens-ts`) for every statically compilable example scene (SpecsActionsLab is runtime
 * only), byte for byte. A change to the host
 * template, the scene document encoding or an example shows up here as a
 * diff a reviewer can read.
 *
 * Regenerate with:
 *   UPDATE_SPECS_GOLDENS=1 npm run test:specs -- ViroSpecsLensTs
 */
const repo = path.join(__dirname, "..");
const goldenDir = path.join(__dirname, "fixtures", "specs", "lens-ts");
const update = process.env.UPDATE_SPECS_GOLDENS === "1";

const ENTRIES: readonly { readonly name: string; readonly file: string }[] = [
  { name: "platform-lab-hello", file: "examples/specs-platform-lab/SpecsPlatformLab.tsx" },
  { name: "platform-lab-placement", file: "examples/specs-platform-lab/PlacementScene.tsx" },
  { name: "platform-lab-interaction", file: "examples/specs-platform-lab/InteractionScene.tsx" },
  { name: "platform-lab-navigation", file: "examples/specs-platform-lab/NavigationScene.tsx" },
];

function errors(diagnostics: readonly ViroSpecsDiagnostic[]): string[] {
  return diagnostics.filter((d) => d.severity === "error").map((d) => d.code + " " + d.message);
}

describe.each(ENTRIES)("lens-ts host for $name", ({ name, file }) => {
  const entry = path.join(repo, file);
  const result = compileSpecsEntry(fs.readFileSync(entry, "utf8"), entry, { cwd: repo });

  it("compiles without errors", () => {
    expect(errors(result.diagnostics)).toEqual([]);
  });

  it("matches the checked-in generated host", () => {
    const actual = renderSpecsLensHost({ manifest: result.manifest as ViroSpecsManifestV2 });
    const target = path.join(goldenDir, name + ".lens.ts");
    if (update || !fs.existsSync(target)) {
      fs.mkdirSync(goldenDir, { recursive: true });
      fs.writeFileSync(target, actual);
      if (!update) throw new Error("Golden " + path.relative(repo, target) + " was missing and has been written. Review it and rerun.");
      return;
    }
    expect(actual).toBe(fs.readFileSync(target, "utf8"));
  });

  it("imports only the @viro-external/specs Lens runtime", () => {
    const actual = renderSpecsLensHost({ manifest: result.manifest as ViroSpecsManifestV2 });
    const imports = [...actual.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.every((specifier) => specifier.startsWith("../lens/"))).toBe(true);
  });
});
