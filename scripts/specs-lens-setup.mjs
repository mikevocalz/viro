#!/usr/bin/env node
// Sets up and checks a Viro Specs Lens project through the Lens Studio MCP
// server, so nobody wires the Inspector by hand.
//
//   node scripts/specs-lens-setup.mjs [options]
//
// Options:
//   --project <dir>      Lens project (default examples/specs-platform-lab/lens)
//   --entry <tsx>        Viro scene to compile (default examples/specs-platform-lab/SpecsPlatformLab.tsx)
//   --specs <dir>        @viro-external/specs package directory, for doctor/sync
//                        (default $VIRO_SPECS_PACKAGE, then ../viro-external/packages/specs)
//   --steps <a,b,...>    subset of: preflight,packages,sync,compile,recompile,
//                        wire,chattool,preview,leaf (default: all, in that order)
//   --evidence <dir>     where logs and captures go (default docs/evidence/specs/lens/run-<timestamp>)
//   --create             save the project Lens Studio has open into --project first
//   --replace-packages   remove existing package copies (for example the 4.0.0
//                        line) before installing the pinned versions
//
// Lens Studio must be running with its MCP server enabled (AI Assistant > AI
// Model Context Protocol > Configure Server). The URL and bearer key come from
// ~/.claude.json or LENS_STUDIO_MCP_URL / LENS_STUDIO_MCP_TOKEN.
//
// Evidence labels follow the Specs production pack: this script can reach
// lens-compiled (recompile) and preview-validated (LEAF in Preview). It never
// produces hardware-validated evidence.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LensStudioMcp } from "./specs-lens/mcp-client.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALL_STEPS = ["preflight", "packages", "sync", "compile", "recompile", "wire", "chattool", "preview", "leaf"];

// Asset Library names, pinned versions, and the directory names the Viro Lens
// runtime imports.
//
// Pinned to the 2.x line on purpose. The 4.0.0 Asset Library packages renamed
// SIK to InteractionKit.lspkg, and UIKit, SurfacePlacement, VolumetricLine,
// NavigationKit and Leaf 4.0.0 all import "InteractionKit.lspkg/...", while
// the @viro-external/specs runtime imports "SpectaclesInteractionKit.lspkg/...".
// No directory name satisfies both. The 2.x packages all use the
// SpectaclesInteractionKit name and ship no editor plugins.
const PACKAGES = [
  { search: "SpectaclesInteractionKit", assetName: "SpectaclesInteractionKit", version: "2.0.0" },
  { search: "SpectaclesUIKit", assetName: "SpectaclesUIKit", version: "2.0.0" },
  { search: "Surface Placement", assetName: "SurfacePlacement", version: "2.0.0" },
  { search: "Volumetric Line", assetName: "VolumetricLine", version: "2.0.0" },
  { search: "Navigation Kit", assetName: "SpecsNavigationKit", version: "2.0.0" },
  { search: "Leaf", assetName: "Leaf", version: "2.0.2" },
];

const versionOf = (resource) => `${resource.version.major}.${resource.version.minor}.${resource.version.patch}`;

// True when an installed package imports the 4.0.0 InteractionKit name.
function importsRenamedSik(file) {
  const listing = spawnSync("unzip", ["-p", file, "*.ts"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return /"InteractionKit\.lspkg\//.test(listing.stdout ?? "");
}

const SCENARIOS = [
  { id: "viro_lab_render", expect: "succeeded" },
  { id: "viro_lab_select", expect: "succeeded" },
  { id: "viro_lab_drag", expect: "succeeded" },
  { id: "viro_lab_navigate", expect: "succeeded" },
  // Proves the suite reports failures. It must fail.
  { id: "viro_lab_deliberate_failure", expect: "failed" },
];

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--create") options.create = true;
    else if (arg === "--replace-packages") options.replacePackages = true;
    else if (arg.startsWith("--")) options[arg.slice(2)] = argv[++i];
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const project = path.resolve(options.project ?? path.join(repo, "examples/specs-platform-lab/lens"));
const entry = path.resolve(options.entry ?? path.join(repo, "examples/specs-platform-lab/SpecsPlatformLab.tsx"));
const specs = path.resolve(
  options.specs ?? process.env.VIRO_SPECS_PACKAGE ?? path.join(repo, "../viro-external/packages/specs")
);
const steps = options.steps ? options.steps.split(",") : ALL_STEPS;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidence = path.resolve(options.evidence ?? path.join(repo, "docs/evidence/specs/lens", `run-${stamp}`));
mkdirSync(evidence, { recursive: true });

const report = { startedAt: new Date().toISOString(), project: path.relative(repo, project), steps: {} };

function redact(text) {
  return String(text).split(repo).join("<repo>").split(process.env.HOME ?? "\u0000").join("~");
}

function save(name, content) {
  writeFileSync(path.join(evidence, name), typeof content === "string" ? redact(content) : redact(JSON.stringify(content, null, 2)));
}

function runNode(label, args, cwd = repo) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  save(`${label}.log`, `${result.stdout}${result.stderr}\nexit=${result.status}\n`);
  if (result.status !== 0) throw new Error(`${label} exited ${result.status}: ${redact(result.stderr || result.stdout).slice(-800)}`);
  return result.stdout;
}

function esproj() {
  const file = existsSync(project) ? (readdirSync(project).find((name) => name.endsWith(".esproj")) ?? null) : null;
  return file ? path.join(project, file) : path.join(project, `${path.basename(project)}.esproj`);
}

const setClientEnabled =
  "const m = pluginSystem.findInterface(Editor.Model.IModel) as any;" +
  "const o = m.project.scene.rootSceneObjects.find((x: any) => x.name === 'LeafScenarioClient');" +
  "if (!o) throw new Error('LeafScenarioClient is not in the scene; run the wire step.');" +
  "o.enabled = args.enabled; return o.enabled;";

const mcp = await new LensStudioMcp().connect();
const tools = (await mcp.listTools()).map((tool) => tool.name);

async function editorFile(file, args) {
  const result = await mcp.call("ExecuteEditorCode", { path: path.join(repo, file), args, timeoutMs: 600000 });
  const data = result.data;
  if (typeof data !== "object" || data.status !== "Execution Succeeded") {
    throw new Error(`${file}: ${JSON.stringify(typeof data === "object" ? data.errors ?? data.error ?? data : data).slice(0, 1500)}`);
  }
  return data.returnValue;
}

const handlers = {
  async preflight() {
    const open = await mcp.editor(
      "const m = pluginSystem.findInterface(Editor.Model.IModel) as any; " +
        "return { file: String(m.project.projectFile), target: String(m.project.targetPlatform) };"
    );
    if (options.create) {
      mkdirSync(project, { recursive: true });
      await mcp.editor(
        "const m = pluginSystem.findInterface(Editor.Model.IModel) as any; " +
          "m.project.targetPlatform = Editor.TargetPlatform.Spectacles; m.project.saveTo(new Editor.Path(args.file)); return true;",
        { file: esproj() }
      );
    } else if (path.resolve(open.file) !== esproj()) {
      throw new Error(`Lens Studio has ${open.file} open; expected ${esproj()}. Open it, or pass --create.`);
    }
    const missing = ["ExecuteEditorCode", "InstallLensStudioPackage", "RecompileTypeScriptTool", "RunAndCollectLogsTool"].filter(
      (name) => !tools.includes(name)
    );
    if (missing.length) throw new Error(`Lens Studio MCP lacks ${missing.join(", ")}`);
    return { open: redact(open.file), tools: tools.length };
  },

  async packages() {
    const installed = [];
    const renamed = [];
    if (options.replacePackages) {
      // Remove the 4.0.0 line (and the Icons/Motion packages UIKit 4.0.0 pulled
      // in) through the asset manager so Lens Studio drops their metadata too.
      const names = [...PACKAGES.map((p) => p.assetName), "Icons", "Motion"];
      const removed = await mcp.editor(
        "const m = pluginSystem.findInterface(Editor.Model.IModel) as any; const am = m.project.assetManager;" +
          "const out: string[] = [];" +
          "for (const name of args.names) {" +
          "  const file = 'Packages/' + name + '.lspkg';" +
          "  const asset = am.assets.find((a: any) => { try { return String(a.fileMeta?.sourcePath) === file; } catch { return false; } });" +
          "  if (asset) { am.remove(asset); out.push(name); }" +
          "}" +
          "return out;",
        { names }
      );
      installed.push(`removed: ${removed.join(", ") || "none"}`);
    }
    for (const pkg of PACKAGES) {
      const file = path.join(project, "Packages", `${pkg.assetName}.lspkg`);
      if (existsSync(file)) {
        if (pkg.assetName !== "SpectaclesInteractionKit" && importsRenamedSik(file)) renamed.push(pkg.assetName);
        installed.push(`${pkg.assetName}: present`);
        continue;
      }
      const search = await mcp.call("SearchLensStudioAssetLibrary", { keywordFilter: [pkg.search], onlyMostRecent: false });
      const asset = (search.data.assets ?? []).find(
        (a) => a.type === "AssetPackage" && a.name.replace(/\s/g, "") === pkg.search.replace(/\s/g, "")
      );
      const resource = asset?.resources.find((r) => versionOf(r) === pkg.version);
      if (!resource) throw new Error(`Asset Library has no ${pkg.search} ${pkg.version}`);
      await mcp.call("InstallLensStudioPackage", { packageUri: resource.uri, assetName: pkg.assetName });
      installed.push(`${pkg.assetName}: installed ${pkg.version}`);
    }
    if (renamed.length) {
      throw new Error(
        `${renamed.join(", ")} import InteractionKit.lspkg (the 4.0.0 package line), which the Viro runtime cannot use. ` +
          "Remove those packages from the project and rerun to install the pinned 2.x versions."
      );
    }
    return installed;
  },

  async sync() {
    if (!existsSync(path.join(specs, "scripts/sync-lens-runtime.mjs"))) {
      throw new Error(`@viro-external/specs not found at ${specs}; pass --specs.`);
    }
    // No --clean: it would delete the runtime's .meta files and break every
    // scene reference to those scripts.
    runNode("sync", [path.join(specs, "scripts/sync-lens-runtime.mjs"), "--project", project]);
    runNode("doctor", [path.join(specs, "scripts/doctor-lens-project.mjs"), "--project", project]);
    return "synced; doctor passed";
  },

  async compile() {
    const out = path.join(project, "Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts");
    const started = Date.now();
    runNode("compile-lens-ts", [path.join(repo, "bin/viro-specs.cjs"), "compile", "--entry", entry, "--out", out, "--format", "lens-ts"]);
    runNode("compile-json", [
      path.join(repo, "bin/viro-specs.cjs"),
      "compile",
      "--entry",
      entry,
      "--out",
      path.join(evidence, "manifest.json"),
      "--format",
      "json",
    ]);
    return { ms: Date.now() - started };
  },

  async recompile() {
    const result = await mcp.call("RecompileTypeScriptTool", {});
    save("recompile.json", result.data);
    if (result.data.status !== "succeeded") {
      throw new Error(`TypeScript recompile failed: ${JSON.stringify(result.data.errors ?? result.data).slice(0, 2000)}`);
    }
    return "lens-compiled";
  },

  async wire() {
    const manifest = JSON.parse(readFileSync(path.join(evidence, "manifest.json"), "utf8"));
    const modelIds = manifest.scene.nodes.filter((node) => node.kind === "model").map((node) => node.source);
    const result = await editorFile("scripts/specs-lens/editor/wire-generated-host.ts", {
      modelIds,
      // Compiled source IDs are repo-relative paths.
      modelGlb: modelIds.length ? path.join(repo, modelIds[0]) : undefined,
    });
    save("wire.json", result);
    return result;
  },

  async chattool() {
    const dir = path.join(repo, "scripts/specs-lens/chattool");
    const local = path.join(project, "viro-specs.local.json");
    if (existsSync(specs) && !existsSync(local)) {
      writeFileSync(local, JSON.stringify({ specsPackage: specs, node: process.execPath }, null, 2) + "\n");
    }
    const loaded = await mcp.editor(
      "const dir = new Editor.Path(args.dir);" +
        "try { pluginSystem.loadDirectory(dir); } catch (e: any) { if (!String(e?.message ?? e).includes('already been loaded')) throw e; }" +
        "const ChatTool = await import('LensStudio:ChatTool');" +
        "const registry = pluginSystem.findInterface(ChatTool.IChatToolRegistry) as any;" +
        "return registry.tools.map((d: any) => String(d.id)).filter((id: string) => id.includes('viro'));",
      { dir }
    );
    const listed = (await mcp.listTools()).map((tool) => tool.name).filter((name) => /viro/i.test(name));
    const doctor = listed.length ? await mcp.call(listed[0], { command: "doctor" }) : null;
    save("chattool.json", { registry: loaded, mcpTools: listed, doctor: doctor?.data });
    return { registry: loaded, mcpTools: listed, doctorOk: doctor ? !doctor.isError : null };
  },

  async preview() {
    const logs = await mcp.call("RunAndCollectLogsTool", { mode: "refresh", settleMaxMs: 6000, settleQuietMs: 1500 });
    save("preview-logs.json", logs.data);
    const capture = await mcp.call("CaptureRuntimeViewTool", { center: { x: 0, y: 0, z: -150 }, distance: 120, viewAngle: "front", detail: "high" });
    capture.images.forEach((image, index) =>
      writeFileSync(path.join(evidence, `runtime-view${index ? "-" + index : ""}.png`), Buffer.from(image.data, "base64"))
    );
    const errors = logs.data.errors ?? [];
    return { errors: errors.length, prints: (logs.data.prints ?? []).length, firstActivityAtMs: logs.data.firstActivityAtMs };
  },

  async leaf() {
    const leafTools = (await mcp.listTools()).filter((tool) => /leaf/i.test(tool.name));
    save("leaf-tools.json", leafTools.map((tool) => ({ name: tool.name, description: tool.description, input: tool.inputSchema })));
    const byRole = (pattern) => leafTools.find((tool) => pattern.test(tool.name))?.name;
    const open = byRole(/open|panel/i);
    const list = byRole(/list/i);
    const run = byRole(/run|start|execute/i);
    const results = [];
    if (list && run) {
      if (open) await mcp.call(open, {});
      const listed = await mcp.call(list, {});
      save("leaf-list.json", listed.data);
      // Serial on purpose: each run resets the Lens and aborts a run in flight.
      for (const scenario of SCENARIOS) {
        const outcome = await mcp.call(run, { scenarioId: scenario.id });
        const status = outcome.data?.status ?? (outcome.isError ? "error" : "unknown");
        results.push({ id: scenario.id, runner: "leaf-panel", status, raw: outcome.data });
      }
    } else {
      // No LEAF MCP tools (the [ChatTool] LEAF Plugin is missing or failed to
      // load). Run the same scenarios through LEAF's DefaultScenarioManager
      // from the ViroLabScenarioClient component and read its result lines.
      await mcp.editor(setClientEnabled, { enabled: true });
      try {
        await mcp.call("RecompileTypeScriptTool", {});
        const logs = await mcp.call("RunAndCollectLogsTool", {
          mode: "refresh",
          settleMinMs: 8000,
          settleMaxMs: 90000,
          settleQuietMs: 6000,
          timeoutMs: 20000,
        });
        save("leaf-client-logs.json", logs.data);
        const lines = [...(logs.data.prints ?? []), logs.data.tail ?? ""].join("\n");
        for (const match of lines.matchAll(/VIRO_LAB_LEAF_RESULT (\{.*?\})(?=\s|$)/g)) {
          const parsed = JSON.parse(match[1]);
          if (!results.some((r) => r.id === parsed.id)) results.push({ ...parsed, runner: "scenario-client" });
        }
        if (!lines.includes("VIRO_LAB_LEAF_DONE")) results.push({ id: "<run>", runner: "scenario-client", status: "did-not-finish" });
      } finally {
        await mcp.editor(setClientEnabled, { enabled: false });
      }
    }
    for (const result of results) {
      const scenario = SCENARIOS.find((s) => s.id === result.id);
      result.expected = scenario?.expect ?? "succeeded";
      result.asExpected = result.status === result.expected;
    }
    for (const scenario of SCENARIOS) {
      if (!results.some((r) => r.id === scenario.id)) {
        results.push({ id: scenario.id, status: "no-result", expected: scenario.expect, asExpected: false });
      }
    }
    save("leaf-results.json", results);
    const unexpected = results.filter((r) => !r.asExpected);
    if (unexpected.length) throw new Error(`LEAF outcomes differ from expectations: ${unexpected.map((r) => `${r.id}=${r.status}`).join(", ")}`);
    return results.map((r) => `${r.id}: ${r.status}`);
  },
};

let failed = false;
for (const step of steps) {
  const handler = handlers[step];
  if (!handler) throw new Error(`Unknown step ${step}; choose from ${ALL_STEPS.join(", ")}`);
  const started = Date.now();
  try {
    const result = await handler();
    report.steps[step] = { ok: true, ms: Date.now() - started, result };
    console.log(`✓ ${step}`, typeof result === "string" ? result : JSON.stringify(result));
  } catch (error) {
    report.steps[step] = { ok: false, ms: Date.now() - started, error: redact(error.message) };
    console.error(`✗ ${step}: ${redact(error.message)}`);
    failed = true;
    break;
  }
}
report.finishedAt = new Date().toISOString();
save("report.json", report);
console.log(`Evidence: ${path.relative(repo, evidence)}`);
process.exit(failed ? 1 : 0);
