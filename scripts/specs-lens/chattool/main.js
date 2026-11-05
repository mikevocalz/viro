// Viro Specs ChatTool for Lens Studio.
//
// Exposes `compile`, `doctor` and `sync` to Lens Studio's AI assistant and to
// any client of the Lens Studio MCP server, using the public
// `LensStudio:ChatTool` API (Lens Studio 5.24 editor.d.ts). Each command runs
// the same Node script the `viro-specs` CLI runs, so results match a terminal
// run exactly.
//
// Configuration comes from `viro-specs.json` in the Lens project root, with
// optional per-machine overrides in `viro-specs.local.json` (keep that one out
// of git). Relative paths resolve against the Lens project directory:
//
//   {
//     "viroRoot": "../../..",             // checkout or node_modules/@reactvision/react-viro
//     "entry": "../SpecsPlatformLab.tsx",  // scene compiled by `compile`
//     "generatedHost": "Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts",
//     "specsPackage": "/abs/path/to/@viro-external/specs",  // for doctor/sync
//     "node": "/opt/homebrew/bin/node"     // optional; PATH is searched otherwise
//   }
//
// Loading: `pluginSystem.loadDirectory(new Editor.Path("<this directory>"))`
// from ExecuteEditorCode (scripts/specs-lens-setup.mjs does this). Lens Studio
// asks once for the filesystem and subprocess permissions.
import { ChatTool, Descriptor, Result } from "LensStudio:ChatTool";
import * as fs from "LensStudio:FileSystem";
import * as Subprocess from "LensStudio:Subprocess";
import * as App from "LensStudio:App";

const COMMANDS = ["compile", "doctor", "sync"];
const TIMEOUT_MS = 120000;

function normalize(path) {
  const absolute = path.startsWith("/");
  const parts = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") parts.pop();
      else if (!absolute) parts.push("..");
    } else {
      parts.push(part);
    }
  }
  return (absolute ? "/" : "") + parts.join("/");
}

function resolveFrom(base, path) {
  return normalize(path.startsWith("/") ? path : base + "/" + path);
}

function readJson(path) {
  const file = new Editor.Path(path);
  if (!fs.exists(file)) return {};
  return JSON.parse(fs.readFile(file));
}

function findNode(configured) {
  const candidates = [];
  if (configured) candidates.push(configured);
  const pathVar = (App.env && (App.env.PATH || App.env.Path)) || "";
  for (const dir of pathVar.split(":")) if (dir) candidates.push(dir + "/node");
  candidates.push("/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node");
  return candidates.find((candidate) => fs.exists(new Editor.Path(candidate))) || null;
}

function decode(buffer) {
  if (!buffer) return "";
  return typeof buffer === "string" ? buffer : buffer.toString();
}

// Keep the reply small enough for a chat turn; the full output is on disk in
// the Lens Studio log when the user needs it.
function tail(text, limit = 6000) {
  return text.length > limit ? "…" + text.slice(text.length - limit) : text;
}

export class ViroSpecsChatTool extends ChatTool {
  static descriptor() {
    const d = new Descriptor();
    d.id = "com.reactvision.viro.specs.ChatTool";
    d.name = "viro-specs";
    d.description =
      "Viro Specs tooling for this Lens project. command=compile regenerates " +
      "ViroGeneratedSceneHost.ts from the Viro JSX entry (viro-specs compile --format lens-ts); " +
      "command=doctor checks Lens Studio version, Spectacles target, required packages and the synced runtime; " +
      "command=sync copies the @viro-external/specs Lens runtime into Assets/ViroSpecs/lens without --clean, " +
      "so existing .meta asset identities survive. Returns exitCode, stdout and stderr.";
    d.dependencies = [Editor.Model.IModel];
    d.schema = {
      type: "object",
      properties: {
        command: { type: "string", enum: COMMANDS, description: "compile | doctor | sync" },
        format: {
          type: "string",
          enum: ["lens-ts", "json"],
          description: "compile only. lens-ts (default) writes the generated host; json writes the portable manifest.",
        },
        out: {
          type: "string",
          description: "compile only. Output path, relative to the Lens project. Defaults to generatedHost from viro-specs.json.",
        },
      },
      required: ["command"],
    };
    return d;
  }

  constructor(pluginSystem, descriptor) {
    super(pluginSystem, descriptor);
  }

  async execute(parameters) {
    const result = new Result();
    try {
      result.data = this.run(parameters && parameters.data ? parameters.data : {});
      if (result.data.exitCode !== 0) {
        result.error = `viro-specs ${result.data.command} exited with ${result.data.exitCode}`;
      }
    } catch (error) {
      result.error = String(error && error.message ? error.message : error);
    }
    return result;
  }

  run(data) {
    const command = data.command;
    if (!COMMANDS.includes(command)) {
      throw new Error(`command must be one of ${COMMANDS.join(", ")}; got ${JSON.stringify(command)}`);
    }

    const model = this.pluginSystem.findInterface(Editor.Model.IModel);
    const projectDir = model.project.projectFile.parent.toString();
    const config = {
      ...readJson(projectDir + "/viro-specs.json"),
      ...readJson(projectDir + "/viro-specs.local.json"),
    };
    const node = findNode(config.node);
    if (!node) throw new Error("Node.js not found. Set \"node\" in viro-specs.local.json.");

    let args;
    let cwd = projectDir;
    if (command === "compile") {
      if (!config.viroRoot || !config.entry) {
        throw new Error("compile needs viroRoot and entry in viro-specs.json.");
      }
      const viroRoot = resolveFrom(projectDir, config.viroRoot);
      const format = data.format || "lens-ts";
      const defaultOut = format === "json" ? "viro-specs.manifest.json" : config.generatedHost;
      if (!data.out && !defaultOut) throw new Error("compile needs out or generatedHost.");
      cwd = viroRoot;
      args = [
        viroRoot + "/bin/viro-specs.cjs",
        "compile",
        "--entry",
        resolveFrom(projectDir, config.entry),
        "--out",
        resolveFrom(projectDir, data.out || defaultOut),
        "--format",
        format,
      ];
    } else {
      if (!config.specsPackage) {
        throw new Error(`${command} needs specsPackage (the @viro-external/specs directory) in viro-specs.json or viro-specs.local.json.`);
      }
      const specs = resolveFrom(projectDir, config.specsPackage);
      const script = command === "doctor" ? "doctor-lens-project.mjs" : "sync-lens-runtime.mjs";
      args = [specs + "/scripts/" + script, "--project", projectDir];
    }

    const spawned = Subprocess.spawnSync(node, args, { cwd: new Editor.Path(cwd), timeout: TIMEOUT_MS });
    return {
      command,
      exitCode: spawned.exitCode,
      stdout: tail(decode(spawned.stdout)),
      stderr: tail(decode(spawned.stderr)),
    };
  }
}
