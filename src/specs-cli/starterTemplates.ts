/**
 * Files `viro-specs init` writes. Each template is plain text with the few
 * values that vary per app filled in by {@linkcode renderStarterFiles}.
 */

/** Values the templates need. */
export interface StarterTemplateInput {
  /** npm package name of the app. */
  readonly appName: string;
  /** Human name shown by Expo and in the README. */
  readonly displayName: string;
  /** Lens Studio project path relative to the app root, with `/` separators. */
  readonly lensProject: string;
  /** `dependencies` of the app's package.json. */
  readonly dependencies: Readonly<Record<string, string>>;
  /** `devDependencies` of the app's package.json. */
  readonly devDependencies: Readonly<Record<string, string>>;
}

/** One file of the starter, by path relative to the app root. */
export interface StarterFile {
  readonly path: string;
  readonly content: string;
}

/** Scene entry the compiler reads, relative to the app root. */
export const STARTER_ENTRY = "src/HelloScene.tsx";

const HELLO_SCENE = `import * as React from "react";
import {
  PanelButton,
  PanelText,
  SpatialPanel,
  ViroSpecsScene,
  type ViroSpecsSceneTransport,
  type ViroSpecsSourceResolver,
} from "@reactvision/react-viro";

export type HelloSceneProps = {
  transport: ViroSpecsSceneTransport;
  sourceResolver?: ViroSpecsSourceResolver;
  onNext?: () => void;
};

/**
 * One scene for both targets. On a phone, ViroSpecsScene renders these
 * children with ViroCore. For SPECS, \`viro-specs-compile\` reads this file and
 * writes the scene the Lens host presents.
 *
 * Every element has a viroTag: it is the node ID, the Lens SceneObject name
 * (\`viro:<viroTag>\`), and \`--strict\` requires it. Positions are meters.
 */
export function HelloScene({ transport, sourceResolver, onNext }: HelloSceneProps) {
  return (
    <ViroSpecsScene transport={transport} sourceResolver={sourceResolver}>
      <SpatialPanel viroTag="hello-root" position={[0, 0, -1.5]} width={0.53} height={0.5}>
        <PanelText viroTag="hello-title" role="title" text="Hello, Specs" position={[0, 0.2, 0.005]} />
        <PanelText
          viroTag="hello-body"
          role="body"
          tone="muted"
          text="Edit src/HelloScene.tsx, then run npm run lens:host."
          position={[0, 0.07, 0.005]}
          width={0.46}
          height={0.15}
          maxLines={3}
        />
        <PanelButton viroTag="hello-next" label="Next" position={[0.13, -0.19, 0.005]} onPress={() => onNext?.()} />
      </SpatialPanel>
    </ViroSpecsScene>
  );
}
`;

const PHONE_TRANSPORT = `import type { ViroSpecsSceneTransport } from "@reactvision/react-viro";

/**
 * The phone app renders HelloScene with ViroCore, so ViroSpecsScene never
 * calls this transport there. It is called only in a SPECS build
 * (\`__VIRO_SPECS_BUILD__\`), where it must deliver scene documents to the
 * Lens. Replace it when you add a phone-to-Lens link; a Lens built with
 * \`npm run lens:host\` runs standalone and does not need one.
 */
export const phoneTransport: ViroSpecsSceneTransport = {
  applyScene() {},
};
`;

const APP = `import * as React from "react";
import { ViroARScene, ViroARSceneNavigator } from "@reactvision/react-viro";
import { HelloScene } from "./src/HelloScene";
import { phoneTransport } from "./src/phoneTransport";

function HelloARScene() {
  return (
    <ViroARScene>
      <HelloScene transport={phoneTransport} />
    </ViroARScene>
  );
}

export default function App() {
  return <ViroARSceneNavigator initialScene={{ scene: HelloARScene }} style={{ flex: 1 }} />;
}
`;

const INDEX = `import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
`;

const LENS_SCRIPT = `#!/usr/bin/env node
// Runs viro-specs against the Lens Studio project named in package.json
// ("viroSpecs.lensProject"), so the path lives in one place.
//
//   node scripts/lens.mjs sync|doctor|host|watch|setup [extra viro-specs args]
//
// setup drives Lens Studio through its MCP server (LENS_STUDIO_MCP_URL and
// LENS_STUDIO_MCP_TOKEN, or LENS_STUDIO_MCP_CONFIG naming an MCP config file):
// it saves a Spectacles project into the Lens folder when there is none,
// installs the packages, syncs the runtime, compiles the host, wires the
// components and runs Preview.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const settings = manifest.viroSpecs ?? {};
if (typeof settings.lensProject !== "string" || typeof settings.entry !== "string") {
  console.error('package.json needs "viroSpecs": { "lensProject": "<path>", "entry": "<scene file>" }.');
  process.exit(1);
}
const lensProject = path.resolve(root, settings.lensProject);
const entry = path.resolve(root, settings.entry);
const generated = path.join(lensProject, "Assets", "ViroSpecs", "generated");

const commands = {
  sync: ["sync", "--project", lensProject],
  doctor: ["doctor", "--project", lensProject],
  host: ["watch", "--once", "--strict", "--entry", entry, "--out-dir", generated, "--format", "lens-ts"],
  watch: ["watch", "--strict", "--entry", entry, "--out-dir", generated, "--format", "lens-ts,scene-json"],
};
const command = process.argv[2];
if (command !== "setup" && !Object.hasOwn(commands, command ?? "")) {
  console.error("Usage: node scripts/lens.mjs sync|doctor|host|watch|setup [args]");
  process.exit(1);
}

// doctor checks a real Lens Studio project. The lens/ folder init creates
// holds only Assets/ViroSpecs until one is saved there or configured.
const isLensProject = existsSync(lensProject) && readdirSync(lensProject).some((name) => name.endsWith(".esproj"));
if (command === "doctor" && !isLensProject) {
  console.error(
    settings.lensProject + " is not a Lens Studio project yet (no .esproj file). Create a Spectacles project in Lens Studio 5.22+, " +
      'save it, set "viroSpecs.lensProject" in package.json to its folder, then run npm run lens:sync and npm run lens:host.'
  );
  process.exit(1);
}

let cli;
try {
  cli = createRequire(path.join(root, "package.json")).resolve("@reactvision/react-viro/bin/viro-specs.cjs");
} catch {
  console.error("@reactvision/react-viro is not installed. Run npm install first.");
  process.exit(1);
}
const run = (args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: "inherit" }).status ?? 1;
if (command === "setup") {
  // Lens Studio side first (project, packages, runtime), then the host
  // compiles into it, then the components are wired and Preview runs.
  const setup = ["setup", "--project", lensProject, "--evidence", path.join(root, "build", "lens-setup")];
  const steps = [
    [...setup, ...(isLensProject ? [] : ["--create"]), "--steps", "preflight,packages,sync", ...process.argv.slice(3)],
    commands.host,
    [...setup, "--steps", "recompile,materials,wire,device,preview", ...process.argv.slice(3)],
  ];
  for (const args of steps) {
    const status = run(args);
    if (status !== 0) process.exit(status);
  }
  process.exit(0);
}
process.exit(run([...commands[command], ...process.argv.slice(3)]));
`;

const GITIGNORE = `node_modules/
build/
.expo/
ios/
android/
*.tgz
`;

function packageJson(input: StarterTemplateInput): string {
  return (
    JSON.stringify(
      {
        name: input.appName,
        version: "0.1.0",
        private: true,
        main: "index.ts",
        scripts: {
          start: "expo start",
          typecheck: "tsc --noEmit",
          "specs:check": `viro-specs-compile --entry ${STARTER_ENTRY} --out build/hello.manifest.json --strict`,
          "specs:preview": `viro-specs-compile --entry ${STARTER_ENTRY} --out build/hello.scene.json --format scene-json --strict`,
          "lens:sync": "node scripts/lens.mjs sync",
          "lens:doctor": "node scripts/lens.mjs doctor",
          "lens:host": "node scripts/lens.mjs host",
          "lens:watch": "node scripts/lens.mjs watch",
          "lens:setup": "node scripts/lens.mjs setup",
        },
        viroSpecs: { lensProject: input.lensProject, entry: STARTER_ENTRY },
        dependencies: input.dependencies,
        devDependencies: input.devDependencies,
      },
      null,
      2
    ) + "\n"
  );
}

function appJson(input: StarterTemplateInput): string {
  return (
    JSON.stringify(
      {
        expo: {
          name: input.displayName,
          slug: input.appName,
          version: "0.1.0",
          plugins: ["@reactvision/react-viro"],
        },
      },
      null,
      2
    ) + "\n"
  );
}

const TSCONFIG =
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        customConditions: ["react-native"],
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      // The Lens project holds Lens Studio scripts, which this app does not compile.
      include: ["App.tsx", "index.ts", "src"],
    },
    null,
    2
  ) + "\n";

function readme(input: StarterTemplateInput): string {
  const lens = input.lensProject;
  return `# ${input.displayName}

A Viro app with one scene, \`${STARTER_ENTRY}\`, that runs on a phone through
ViroCore and on SPECS through a Lens Studio project at \`${lens}/\`.
Generated by \`viro-specs init\`.

## Files

| Path | What it is |
| --- | --- |
| \`${STARTER_ENTRY}\` | The scene. Edit this. |
| \`App.tsx\`, \`index.ts\`, \`app.json\` | Expo entry for the phone app. It renders the scene inside \`ViroARSceneNavigator\`. |
| \`src/phoneTransport.ts\` | The transport \`ViroSpecsScene\` takes. Unused on a phone. |
| \`${lens}/Assets/ViroSpecs/lens/\` | Lens runtime copied from \`@viro-external/specs\` by \`npm run lens:sync\`. Do not edit; a later sync keeps edited files but stops updating them. |
| \`${lens}/Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts\` | The scene compiled for the Lens by \`npm run lens:host\`. |
| \`scripts/lens.mjs\` | Runs \`viro-specs\` against the Lens project named in \`package.json\` under \`viroSpecs.lensProject\`. |

## Check the scene

\`\`\`bash
npm run specs:check     # compile with --strict; exit 0 means no errors and no warnings
npm run specs:preview   # build/hello.scene.json for the web preview
npm run typecheck
\`\`\`

A finding prints as \`file:line:col severity CODE: message\`. Codes are listed
in the react-viro docs, \`docs/specs-error-reference.md\`.

## Run it in Lens Studio

1. Open Lens Studio 5.22+ and turn on its MCP server (AI Assistant > AI
   Model Context Protocol > Configure Server). Export the URL and key as
   \`LENS_STUDIO_MCP_URL\` and \`LENS_STUDIO_MCP_TOKEN\`, or point
   \`LENS_STUDIO_MCP_CONFIG\` at an MCP config file with a \`lens-studio\`
   server.
2. \`npm run lens:setup\`. When \`${lens}/\` has no \`.esproj\` yet it saves
   a new Spectacles project there; then it installs the Asset Library
   packages, syncs the runtime, compiles \`${STARTER_ENTRY}\`, wires
   \`ViroSpecsAssetRegistry\`, \`ViroSpecsSceneControllerHost\`,
   \`ViroGeneratedSceneHost\` and the experience layer, sets Preview to a
   SPECS device and refreshes it. It exits 1 on any compile error or
   \`VS5xxx\` error, and saves a capture to \`build/lens-setup/preview.png\`.
3. After that, \`npm run lens:host\` (or \`npm run lens:watch\`) updates the
   scene, and \`npm run lens:doctor\` names anything missing or too old.

## Run it on a phone

The phone app needs a development build because Viro is native code:

\`\`\`bash
npx expo prebuild
npx expo run:ios     # or run:android
\`\`\`
`;
}

/** Every file of the starter app, in a stable order. */
export function renderStarterFiles(input: StarterTemplateInput): readonly StarterFile[] {
  return [
    { path: "package.json", content: packageJson(input) },
    { path: "app.json", content: appJson(input) },
    { path: "tsconfig.json", content: TSCONFIG },
    { path: ".gitignore", content: GITIGNORE },
    { path: "README.md", content: readme(input) },
    { path: "index.ts", content: INDEX },
    { path: "App.tsx", content: APP },
    { path: STARTER_ENTRY, content: HELLO_SCENE },
    { path: "src/phoneTransport.ts", content: PHONE_TRANSPORT },
    { path: "scripts/lens.mjs", content: LENS_SCRIPT },
  ];
}
