import * as fs from "node:fs";
import * as path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import {
  VIRO_SPECS_DIAGNOSTICS,
  type ViroSpecsDiagnosticCode,
} from "../components/Specs/core/diagnosticCodes";
import { toSpecsSceneSnapshot } from "../components/Specs/core/lower";
import type {
  ViroSpecsManifestV1,
  ViroSpecsWireSceneSnapshot,
} from "../components/Specs/core/manifest";
import { migrateSpecsManifest } from "../components/Specs/core/migrate";
import { parseSpecsManifest, parseSpecsManifestJson } from "../components/Specs/core/parse";
import {
  validateSpecsManifestV2,
  validateSpecsSceneSnapshot,
} from "../components/Specs/core/validate";

const root = path.join(__dirname, "..");
const fixtures = path.join(__dirname, "fixtures", "specs");
const schema: unknown = JSON.parse(
  fs.readFileSync(path.join(root, "schemas", "viro-specs-manifest.v2.json"), "utf8")
);

const ajv = new Ajv2020({ strict: true, allErrors: true });
const schemaValidate = ajv.compile(schema as object);

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listJson(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(dir, name));
}

type InvalidFixture = {
  description: string;
  expectSchemaValid: boolean;
  expectCodes: ViroSpecsDiagnosticCode[];
  manifest: unknown;
};

const validFiles = listJson(path.join(fixtures, "manifest-v2", "valid"));
const invalidFiles = listJson(path.join(fixtures, "manifest-v2", "invalid"));
const v1Files = listJson(path.join(fixtures, "manifest-v1"));

describe("viro-specs-manifest.v2.json", () => {
  it("has fixtures to check", () => {
    expect(validFiles.length).toBeGreaterThanOrEqual(3);
    expect(invalidFiles.length).toBeGreaterThanOrEqual(15);
    expect(v1Files.length).toBeGreaterThanOrEqual(1);
  });

  it.each(validFiles.map((file) => [path.basename(file), file]))(
    "accepts valid fixture %s, and so does validateSpecsManifestV2",
    (_name, file) => {
      const manifest = readJson(file);
      expect(schemaValidate(manifest) ? [] : schemaValidate.errors).toEqual([]);
      const result = validateSpecsManifestV2(manifest);
      expect(result.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
      expect(result.ok).toBe(true);
    }
  );

  it.each(invalidFiles.map((file) => [path.basename(file), file]))(
    "invalid fixture %s: schema verdict and validator codes match the expectation",
    (_name, file) => {
      const fixture = readJson(file) as InvalidFixture;
      expect(schemaValidate(fixture.manifest)).toBe(fixture.expectSchemaValid);

      const result = parseSpecsManifest(fixture.manifest);
      expect(result.ok).toBe(false);
      const codes = result.diagnostics.map((d) => d.code);
      for (const code of fixture.expectCodes) expect(codes).toContain(code);
      for (const diagnostic of result.diagnostics) {
        expect(diagnostic.fieldPath).toEqual(expect.any(String));
        expect(VIRO_SPECS_DIAGNOSTICS[diagnostic.code].severity).toBe(diagnostic.severity);
      }
    }
  );

  it("structural codes appear only when the schema also rejects", () => {
    const structural: readonly ViroSpecsDiagnosticCode[] = [
      "VS1001",
      "VS1003",
      "VS1004",
      "VS1005",
      "VS1006",
      "VS1012",
    ];
    for (const file of [...validFiles, ...invalidFiles]) {
      const raw = readJson(file);
      const manifest =
        typeof raw === "object" && raw !== null && "manifest" in raw
          ? (raw as InvalidFixture).manifest
          : raw;
      const hasStructural = parseSpecsManifest(manifest).diagnostics.some((d) =>
        structural.includes(d.code)
      );
      expect([path.basename(file), hasStructural]).toEqual([
        path.basename(file),
        !schemaValidate(manifest),
      ]);
    }
  });
});

describe("manifest v1 migration", () => {
  it.each(v1Files.map((file) => [path.basename(file), file]))(
    "%s migrates, validates against the v2 schema, and round-trips to the same wire payloads",
    (_name, file) => {
      const v1 = readJson(file) as ViroSpecsManifestV1;
      const parsed = parseSpecsManifest(v1, { file: path.basename(file) });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.diagnostics.map((d) => [d.code, d.severity])).toEqual([["VS1002", "warning"]]);
      expect(schemaValidate(parsed.value) ? [] : schemaValidate.errors).toEqual([]);

      const lowered = toSpecsSceneSnapshot(parsed.value);
      expect(lowered.snapshot).toEqual(v1.scene);
      expect(parsed.value.polylines).toEqual(v1.polylines ?? []);
      expect(parsed.value.interactions).toEqual(v1.interactions ?? []);
      expect(parsed.value.animations).toEqual(v1.animations ?? []);
      expect(parsed.value.source).toBe(v1.source);

      const rebuilt: ViroSpecsManifestV1 = {
        version: 1,
        source: parsed.value.source,
        scene: lowered.snapshot,
        polylines: parsed.value.polylines,
        interactions: parsed.value.interactions,
        animations: parsed.value.animations,
        diagnostics: [],
      };
      expect(rebuilt).toEqual(v1);

      expect(migrateSpecsManifest(v1)).toEqual(parsed.value);
    }
  );

  it("accepts a bare scene protocol 1 snapshot as v1", () => {
    const snapshot: ViroSpecsWireSceneSnapshot = {
      version: 1,
      nodes: [
        { id: "root", kind: "group" },
        { id: "label", kind: "text", parentId: "root", text: "Hi" },
      ],
    };
    const parsed = parseSpecsManifest(snapshot);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.nodes).toEqual(snapshot.nodes);
    expect(toSpecsSceneSnapshot(parsed.value).snapshot).toEqual(snapshot);
  });

  it("reports a v1 image without source as a v2 error, not a crash", () => {
    const parsed = parseSpecsManifest({ version: 1, nodes: [{ id: "img", kind: "image" }] });
    expect(parsed.ok).toBe(false);
    expect(parsed.diagnostics.map((d) => d.code)).toEqual(["VS1002", "VS1005"]);
    expect(parsed.diagnostics[1]).toMatchObject({ nodeId: "img", fieldPath: "/nodes/0/source" });
  });
});

describe("entry points", () => {
  it("parseSpecsManifestJson reports a syntax error as VS1000 with the file", () => {
    const result = parseSpecsManifestJson("{ nope", { file: "scene.json" });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: "VS1000", severity: "error", file: "scene.json" });
  });

  it("parseSpecsManifest rejects non-objects with VS1001", () => {
    for (const input of [null, 3, "scene", []]) {
      expect(parseSpecsManifest(input).diagnostics[0].code).toBe("VS1001");
    }
  });

  it("validateSpecsSceneSnapshot enforces protocol version 1 and wire node kinds", () => {
    expect(validateSpecsSceneSnapshot({ version: 2, nodes: [] }).diagnostics[0].code).toBe("VS1014");
    const video = validateSpecsSceneSnapshot({
      version: 1,
      nodes: [{ id: "v", kind: "video", source: "clip.mp4" }],
    });
    expect(video.ok).toBe(false);
    expect(video.diagnostics.map((d) => d.code)).toContain("VS1012");
    const dup = validateSpecsSceneSnapshot({
      version: 1,
      nodes: [
        { id: "a", kind: "group" },
        { id: "a", kind: "group" },
      ],
    });
    expect(dup.diagnostics.map((d) => d.code)).toEqual(["VS1007"]);
    const extra = validateSpecsSceneSnapshot({
      version: 1,
      nodes: [{ id: "a", kind: "text", text: "x", style: { fontSize: 3 } }],
    });
    expect(extra.diagnostics.map((d) => d.code)).toEqual(["VS1006"]);
  });

  it("lowering reports every field the wire cannot carry", () => {
    const fixture = readJson(path.join(fixtures, "manifest-v2", "valid", "all-fields.json"));
    const parsed = parseSpecsManifest(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const lowered = toSpecsSceneSnapshot(parsed.value);
    expect(validateSpecsSceneSnapshot(lowered.snapshot).ok).toBe(true);
    const dropped = lowered.diagnostics.map((d) => d.fieldPath);
    expect(dropped).toEqual(
      expect.arrayContaining([
        "/nodes/1/extents",
        "/nodes/1/materialId",
        "/nodes/1/opacity",
        "/nodes/2/style",
        "/nodes/2/maxLines",
        "/lights/0",
        "/lights/3",
      ])
    );
    expect(lowered.diagnostics.every((d) => d.code === "VS1015" && d.severity === "warning")).toBe(true);
    expect(dropped).not.toContain("/nodes/4/format");
  });
});

describe("docs/specs-diagnostics.md", () => {
  const doc = fs.readFileSync(path.join(root, "docs", "specs-diagnostics.md"), "utf8");

  it("documents every code in the catalog with its severity", () => {
    for (const [code, definition] of Object.entries(VIRO_SPECS_DIAGNOSTICS)) {
      const heading = new RegExp("^### " + code + " . " + definition.severity + "$", "m");
      expect([code, heading.test(doc)]).toEqual([code, true]);
    }
  });

  it("mentions no code that the catalog lacks", () => {
    const mentioned = new Set(doc.match(/VS\d{4}/g) ?? []);
    for (const code of mentioned) {
      expect([code, code in VIRO_SPECS_DIAGNOSTICS]).toEqual([code, true]);
    }
  });
});
