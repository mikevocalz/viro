// Runs the viro-specs ChatTool's command logic in Node with the LensStudio:*
// modules replaced by Node equivalents. This proves argument building, config
// resolution and exit-code handling; it does not prove Lens Studio loads the
// plugin (that needs the editor, see scripts/specs-lens-setup.mjs).
//
//   node --test scripts/specs-lens/chattool/main.nodetest.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const labProject = path.join(repo, "examples/specs-platform-lab/lens");

class EditorPath {
  constructor(value) {
    this.value = String(value);
  }
  get parent() {
    return new EditorPath(path.dirname(this.value));
  }
  toString() {
    return this.value;
  }
}

const stubs = `
const Editor = globalThis.__viroStub.Editor;
const { ChatTool, Descriptor, Result } = globalThis.__viroStub.ChatTool;
const fs = globalThis.__viroStub.fs;
const Subprocess = globalThis.__viroStub.Subprocess;
const App = globalThis.__viroStub.App;
`;

async function loadTool(projectFile) {
  globalThis.__viroStub = {
    Editor: { Path: EditorPath, Model: { IModel: "IModel" } },
    ChatTool: {
      ChatTool: class {
        constructor(pluginSystem) {
          this.pluginSystem = pluginSystem;
        }
      },
      Descriptor: class {},
      Result: class {},
    },
    fs: {
      exists: (p) => existsSync(String(p)),
      readFile: (p) => readFileSync(String(p), "utf8"),
    },
    Subprocess: {
      spawnSync: (command, args, options) => {
        const result = spawnSync(command, args, { cwd: String(options.cwd), timeout: options.timeout });
        return { exitCode: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
      },
    },
    App: { env: process.env },
  };
  const source = readFileSync(path.join(here, "main.js"), "utf8").replace(
    /^import .* from "LensStudio:.*";$/gm,
    ""
  );
  const dir = mkdtempSync(path.join(tmpdir(), "viro-chattool-"));
  const file = path.join(dir, "main.mjs");
  writeFileSync(file, stubs + source);
  const { ViroSpecsChatTool } = await import(pathToFileURL(file).href);
  const pluginSystem = {
    findInterface: () => ({ project: { projectFile: new EditorPath(projectFile) } }),
  };
  return { tool: new ViroSpecsChatTool(pluginSystem), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("descriptor exposes compile, doctor and sync", async () => {
  const { tool, cleanup } = await loadTool(path.join(labProject, "ViroSpecsPlatformLab.esproj"));
  try {
    const d = tool.constructor.descriptor();
    assert.equal(d.name, "viro-specs");
    assert.deepEqual(d.schema.properties.command.enum, ["compile", "doctor", "sync"]);
    assert.deepEqual(d.schema.required, ["command"]);
  } finally {
    cleanup();
  }
});

test("compile json writes the Platform Lab manifest through the real CLI", async () => {
  const { tool, cleanup } = await loadTool(path.join(labProject, "ViroSpecsPlatformLab.esproj"));
  const out = path.join(mkdtempSync(path.join(tmpdir(), "viro-out-")), "lab.json");
  try {
    const result = await tool.execute({ data: { command: "compile", format: "json", out } });
    assert.equal(result.error, undefined, result.data?.stderr);
    assert.equal(result.data.exitCode, 0);
    const manifest = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(manifest.version, 1);
    assert.equal(manifest.source, "examples/specs-platform-lab/SpecsPlatformLab.tsx");
    assert.deepEqual(
      manifest.scene.nodes.map((node) => node.id),
      ["platform-lab-root", "platform-lab-title", "platform-lab-model"]
    );
    assert.deepEqual(manifest.polylines.map((line) => line.id), ["platform-lab-route"]);
  } finally {
    cleanup();
  }
});

test("compile lens-ts output matches the committed generated host", async () => {
  const { tool, cleanup } = await loadTool(path.join(labProject, "ViroSpecsPlatformLab.esproj"));
  const out = path.join(mkdtempSync(path.join(tmpdir(), "viro-out-")), "host.ts");
  try {
    const result = await tool.execute({ data: { command: "compile", out } });
    assert.equal(result.data.exitCode, 0, result.data.stderr);
    assert.equal(
      readFileSync(out, "utf8"),
      readFileSync(path.join(labProject, "Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts"), "utf8")
    );
  } finally {
    cleanup();
  }
});

test("unknown command and missing specsPackage are reported, not thrown", async () => {
  const { tool, cleanup } = await loadTool(path.join(labProject, "ViroSpecsPlatformLab.esproj"));
  try {
    const bad = await tool.execute({ data: { command: "deploy" } });
    assert.match(bad.error, /command must be one of compile, doctor, sync/);
    if (!existsSync(path.join(labProject, "viro-specs.local.json"))) {
      const doctor = await tool.execute({ data: { command: "doctor" } });
      assert.match(doctor.error, /needs specsPackage/);
    }
  } finally {
    cleanup();
  }
});

test("doctor runs the @viro-external/specs script when specsPackage is set", { skip: !process.env.VIRO_SPECS_PACKAGE }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "viro-proj-"));
  writeFileSync(path.join(dir, "viro-specs.json"), JSON.stringify({ specsPackage: process.env.VIRO_SPECS_PACKAGE }));
  const { tool, cleanup } = await loadTool(path.join(dir, "Missing.esproj"));
  try {
    const result = await tool.execute({ data: { command: "doctor" } });
    // The temp folder is not a Lens project, so the doctor must fail loudly.
    assert.notEqual(result.data.exitCode, 0);
    assert.match(result.error, /exited with/);
  } finally {
    cleanup();
  }
});
