import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { VIRO_SPECS_DIAGNOSTICS } from "../components/Specs/core/diagnosticCodes";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderErrorReference } = require("../scripts/specs-error-reference.cjs") as {
  renderErrorReference(catalog: typeof VIRO_SPECS_DIAGNOSTICS): string;
};

const repo = path.join(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(repo, file), "utf8");

describe("docs/specs-error-reference.md", () => {
  it("is the catalog rendered by scripts/specs-error-reference.cjs", () => {
    expect(read("docs/specs-error-reference.md")).toBe(renderErrorReference(VIRO_SPECS_DIAGNOSTICS));
  });

  describe("specs-error-reference.cjs --check", () => {
    // A copy of the repo layout the script reads, with a bin/specs-build
    // catalog that matches the committed page while the source does not:
    // the state a checkout is in after a code is added and the CLI is not
    // rebuilt. --check must go by the source.
    let tmp: string;
    const run = () =>
      spawnSync(process.execPath, [path.join(tmp, "scripts", "specs-error-reference.cjs"), "--check"], { encoding: "utf8" });
    const sourceFile = () => path.join(tmp, "components", "Specs", "core", "diagnosticCodes.ts");

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-error-ref-"));
      for (const file of ["scripts/specs-error-reference.cjs", "components/Specs/core/diagnosticCodes.ts", "docs/specs-error-reference.md"]) {
        fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
        fs.copyFileSync(path.join(repo, file), path.join(tmp, file));
      }
      const stale = path.join(tmp, "bin", "specs-build", "components", "Specs", "core", "diagnosticCodes.js");
      fs.mkdirSync(path.dirname(stale), { recursive: true });
      fs.writeFileSync(stale, "exports.VIRO_SPECS_DIAGNOSTICS = " + JSON.stringify(VIRO_SPECS_DIAGNOSTICS) + ";\n");
    });

    afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it("passes when the page matches the source", () => {
      const result = run();
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    });

    it("fails when the source has a code the page lacks, even though the stale build matches the page", () => {
      const source = fs.readFileSync(sourceFile(), "utf8");
      const anchor = source.indexOf('  VS1001: {');
      expect(anchor).toBeGreaterThan(0);
      fs.writeFileSync(
        sourceFile(),
        source.slice(0, anchor) + '  VS1999: { severity: "error", title: "Added after the last build", hint: "Rebuild." },\n' + source.slice(anchor)
      );
      const result = run();
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/specs-error-reference\.md is out of date/);
    });
  });

  it("lists every catalog code exactly once", () => {
    const doc = read("docs/specs-error-reference.md");
    for (const code of Object.keys(VIRO_SPECS_DIAGNOSTICS)) {
      expect([code, doc.split("| [" + code + "]").length - 1]).toEqual([code, 1]);
    }
  });
});

describe("release docs", () => {
  it("link only to docs that exist", () => {
    const docs = fs.readdirSync(path.join(repo, "docs")).filter((file) => /^specs.*\.md$/.test(file));
    for (const file of docs) {
      for (const match of read(path.join("docs", file)).matchAll(/\]\(((?!https?:|#)[^)#\s]+)(?:#[^)]*)?\)/g)) {
        const target = path.join(repo, "docs", match[1]);
        expect([file, match[1], fs.existsSync(target)]).toEqual([file, match[1], true]);
      }
    }
  });
});
