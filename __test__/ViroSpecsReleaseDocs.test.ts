import * as fs from "node:fs";
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
