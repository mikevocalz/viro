const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { compile, lensTs } = require("../bin/viro-specs-compile.cjs");
const { VIRO_SPECS_DIAGNOSTICS } = require("../bin/specs-build/components/Specs/core/index.js");

const repo = path.join(__dirname, "..");
const cli = path.join(repo, "bin", "viro-specs-compile.cjs");
let checks = 0;

function codes(result) {
  return result.diagnostics.map((d) => d.code);
}

/** Every diagnostic is a catalogued object, never a string. */
function assertCoded(result, label) {
  for (const diagnostic of result.diagnostics) {
    assert.equal(typeof diagnostic, "object", label + ": diagnostic is not an object");
    assert.ok(diagnostic.code in VIRO_SPECS_DIAGNOSTICS, label + ": unknown code " + diagnostic.code);
    assert.equal(diagnostic.severity, VIRO_SPECS_DIAGNOSTICS[diagnostic.code].severity, label);
    assert.equal(typeof diagnostic.message, "string", label);
    assert.equal(typeof diagnostic.hint, "string", label);
    assert.equal(typeof diagnostic.file, "string", label + ": " + diagnostic.code + " has no file");
  }
}

function scene(body, prelude = "") {
  return compile(
    prelude + "\nexport function Scene() { return <ViroSpecsScene>" + body + "</ViroSpecsScene>; }",
    path.join(repo, "fixtures", "scene.tsx"),
    { baseDir: repo }
  );
}

function expectCode(result, code, label) {
  checks += 1;
  assertCoded(result, label);
  assert.ok(codes(result).includes(code), label + ": expected " + code + ", got " + JSON.stringify(codes(result)));
  return result.diagnostics.find((d) => d.code === code);
}

// --- Original regression, now on manifest v2 -------------------------------

const source = `
  const MODEL = require("./model.glb");

  ViroAnimations.registerAnimations({
    pulse: {
      properties: {
        scaleX: "*=1.2",
        opacity: 0.5,
        rotateY: "+=45"
      },
      duration: 500,
      easing: "EaseInEaseOut"
    }
  });

  export function Scene() {
    return (
      <ViroSpecsScene transport={transport}>
        <ViroNode viroTag="root" position={[0, 0, -1.5]} rotation={[0, 90, 0]}>
          <ViroText
            viroTag="title"
            text="Hello Specs"
            animation={{ name: "pulse", run: true, loop: false }}
          />
          <Viro3DObject
            viroTag="model"
            source={MODEL}
            type="GLB"
            onClick={() => {}}
            onDrag={() => {}}
          />
          <ViroPolyline
            viroTag="route"
            points={[[-0.3,0,0],[0,0.2,0],[0.3,0,0]]}
            thickness={0.008}
            materials="route"
          />
        </ViroNode>
      </ViroSpecsScene>
    );
  }
`;

// A real project on disk: the asset must exist, and IDs are relative to the
// nearest package.json, not the working directory.
const project = fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-project-"));
fs.writeFileSync(path.join(project, "package.json"), "{}");
fs.mkdirSync(path.join(project, "fixtures"));
fs.writeFileSync(path.join(project, "fixtures", "model.glb"), "glTF");
const result = compile(source, path.join(project, "fixtures", "scene.tsx"), { cwd: project });
const manifest = result.manifest;

assert.deepEqual(result.diagnostics.filter((d) => d.severity !== "info"), []);
assert.equal(manifest.version, 2);
assert.deepEqual(manifest.nodes.map((node) => node.id), ["root", "title", "model"]);
assert.deepEqual(manifest.nodes[0].position, [0, 0, -1.5]);
assert.ok(Math.abs(manifest.nodes[0].rotation[1] - Math.SQRT1_2) < 1e-9);
assert.equal(manifest.nodes[2].source, "fixtures/model.glb");
assert.equal(manifest.nodes[2].format, "glb");
assert.deepEqual(result.scene.nodes.map((node) => node.id), ["root", "title", "model"]);
assert.equal(result.scene.version, 1);

assert.equal(manifest.polylines.length, 1);
assert.equal(manifest.polylines[0].radiusMeters, 0.004);
assert.ok(manifest.polylines[0].points.every((point) => point[2] < -1.1 && point[2] > -1.9));

assert.deepEqual(manifest.interactions[0], {
  nodeId: "model",
  interactable: true,
  manipulation: true,
  events: ["select", "drag"],
});

assert.equal(manifest.animations.length, 1);
assert.equal(manifest.animations[0].nodeId, "title");
assert.equal(manifest.animations[0].plan.engine, "AnimationPlayer");
assert.equal(manifest.animations[0].plan.durationSeconds, 0.5);
assert.equal(manifest.animations[0].plan.easing, "ease-in-out");
assert.deepEqual(
  manifest.animations[0].plan.tracks.map((track) => [track.target, track.to]),
  [
    ["transform.scale.x", 1.2],
    ["material.opacity", 0.5],
    ["transform.rotation.y", 45],
  ]
);
checks += 1;

// The material comes from the Lens registry, so it is info, never an error.
assert.deepEqual(
  result.diagnostics.map((d) => [d.code, d.severity, d.nodeId, d.line]),
  [["VS1011", "info", "route", source.split("\n").findIndex((line) => line.includes("<ViroPolyline")) + 1]]
);

const generated = lensTs(result);
for (const pattern of [
  /class ViroGeneratedSceneHost/,
  /runtime\.applySceneSnapshot/,
  /interaction\.setInteractable/,
  /interaction\.setManipulationEnabled/,
  /animation\.play/,
  /navigation\.presentPolyline/,
  /OnDestroyEvent/,
  /interaction\.remove/,
  /animation\.stop/,
  /navigation\.clearRoute/,
  /runtime\.clear/,
]) {
  assert.match(generated, pattern);
}
checks += 1;

// --- Static-analysis diagnostics carry codes and source positions ---------

const conditionalSource = `export function Scene({enabled}) {
     return <ViroSpecsScene>{enabled && <ViroText viroTag="bad" text="bad" />}</ViroSpecsScene>;
   }`;
const conditional = compile(conditionalSource, "/tmp/conditional.tsx");
// A runtime condition compiles every branch hidden and warns (VS2016) at the condition.
const dynamic = expectCode(conditional, "VS2016", "conditional");
assert.equal(dynamic.severity, "warning");
assert.deepEqual(
  [dynamic.line, dynamic.col],
  [2, conditionalSource.split("\n")[1].indexOf("enabled &&") + 1]
);
assert.match(dynamic.message, /`enabled`/);
assert.deepEqual(conditional.manifest.nodes, [{ id: "bad", kind: "text", visible: false, text: "bad" }]);

// Calls other than .map() still cannot be expanded.
const call = compile(
  `export function Scene() { return <ViroSpecsScene>{renderItems()}</ViroSpecsScene>; }`,
  "/tmp/call.tsx"
);
assert.match(expectCode(call, "VS2003", "call").message, /renderItems\(\)/);

const unresolvedArray = compile(
  `export function Scene({x}) {
     return <ViroSpecsScene><ViroNode viroTag="bad" position={[x, 0, -1]} /></ViroSpecsScene>;
   }`,
  "/tmp/unresolved.tsx"
);
const transform = expectCode(unresolvedArray, "VS2004", "unresolved transform");
assert.equal(transform.line, 2);

const bounce = compile(
  `
  ViroAnimations.registerAnimations({
    bounce: { properties: { scaleX: 2 }, duration: 300, easing: "Bounce" }
  });
  export function Scene() {
    return <ViroSpecsScene><ViroText viroTag="bad" text="x" animation={{name:"bounce",run:true}} /></ViroSpecsScene>;
  }`,
  "/tmp/bounce.tsx"
);
assert.match(expectCode(bounce, "VS3006", "bounce").message, /Bounce/);
assert.equal(bounce.manifest.animations.length, 0);

expectCode(compile('<ViroARScene><ViroText text="Native only" /></ViroARScene>', "/tmp/u.tsx"), "VS2001", "no root");
expectCode(compile("<ViroSpecsScene />", "/tmp/u.tsx"), "VS2002", "empty root");
expectCode(compile("export const = ;", "/tmp/broken.tsx"), "VS2015", "syntax error");

// Spread props used to vanish silently.
const spread = expectCode(
  scene('<ViroText viroTag="t" text="x" {...extra} />'),
  "VS2013",
  "spread"
);
assert.equal(spread.severity, "error");

// Unknown components used to vanish silently, and their children were
// compiled as if the component were a transparent group.
const box = scene('<ViroBox viroTag="box" position={[0, 1, 0]}><ViroText viroTag="inside" text="x" /></ViroBox>');
assert.equal(expectCode(box, "VS3001", "unsupported component").nodeId, "box");
assert.deepEqual(box.manifest.nodes, []);

// Duplicate explicit IDs, with the position of the second element.
const duplicate = scene('<ViroNode viroTag="a" />\n<ViroText viroTag="a" text="x" />');
const dup = expectCode(duplicate, "VS1007", "duplicate id");
assert.deepEqual([dup.nodeId, dup.line], ["a", 3]);

// Missing viroTag is a warning, so --strict can require stable IDs.
assert.equal(expectCode(scene('<ViroText text="x" />'), "VS3012", "ordinal id").severity, "warning");

// Props the manifest does not carry.
assert.equal(
  expectCode(scene('<ViroText viroTag="t" text="x" extrusionDepth={2} />'), "VS3002", "ignored prop").severity,
  "warning"
);

// Capability errors: never compiled into a stand-in node.
for (const [jsx, code] of [
  ['<ViroPortalScene viroTag="p" />', "VS4001"],
  ['<ViroPortal viroTag="p" />', "VS4001"],
  ['<ViroNode viroTag="n" physicsBody={{ type: "Dynamic", mass: 1 }} />', "VS4002"],
  ['<ViroNode viroTag="n" onCollision={() => {}} />', "VS4002"],
  ['<ViroRivePanel viroTag="r" />', "VS4003"],
  ['<ViroVideo viroTag="v" source={{ uri: "clip.mp4" }} />', "VS4004"],
  ['<Viro360Video viroTag="v" />', "VS4004"],
  ['<ViroSound viroTag="s" />', "VS4005"],
  ['<ViroSpatialSound viroTag="s" />', "VS4005"],
  ['<ViroCameraTexture viroTag="c" />', "VS4006"],
  ['<ViroGpuPanel viroTag="g" />', "VS4007"],
  ['<ViroThreeJSPanel viroTag="g" />', "VS4007"],
  ['<ViroGeometry viroTag="g" />', "VS4007"],
]) {
  const compiled = scene(jsx);
  const capability = expectCode(compiled, code, jsx);
  assert.equal(capability.severity, "error", jsx);
  assert.ok(!compiled.manifest.nodes.some((node) => node.id === capability.nodeId && node.kind !== "group"), jsx);
}

assert.equal(
  expectCode(scene('<Viro3DObject viroTag="m" source="m.vrx" type="VRX" />'), "VS3013", "vrx").severity,
  "error"
);

// Lights and text style reach the manifest.
const styled = scene(
  '<ViroAmbientLight viroTag="amb" color="#fff" intensity={300} />' +
    '<ViroText viroTag="t" text="x" width={0.5} height={0.1} maxLines={2} style={{ fontSize: 24, color: "#ff0000", textAlign: "center", fontWeight: 600 }} />'
);
assert.deepEqual(styled.diagnostics.filter((d) => d.severity !== "info"), []);
assert.deepEqual(styled.manifest.lights, [{ id: "amb", type: "ambient", color: "#ffffff", intensity: 300 }]);
assert.deepEqual(styled.manifest.nodes[0], {
  id: "t",
  kind: "text",
  text: "x",
  style: { fontSize: 24, color: "#ff0000", textAlign: "center", fontWeight: "600" },
  maxLines: 2,
  extents: { width: 0.5, height: 0.1 },
});
expectCode(scene('<ViroText viroTag="t" text="x" style={{ color: "white" }} />'), "VS3009", "named color");
checks += 1;

// --- CLI: exit codes, --strict, --manifest, structured output -------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "viro-specs-"));
function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8" });
}

const lab = path.join(repo, "examples", "specs-platform-lab", "SpecsPlatformLab.tsx");
const golden = path.join(repo, "__test__", "fixtures", "specs", "manifest-v2", "valid", "platform-lab.json");
const labOut = path.join(tmp, "lab.json");
let cliResult = run(["--entry", lab, "--out", labOut]);
assert.equal(cliResult.status, 0, cliResult.stderr);
assert.equal(fs.readFileSync(labOut, "utf8"), fs.readFileSync(golden, "utf8"), "Platform Lab manifest drifted from the golden");

// The Platform Lab is clean under --strict in both formats.
cliResult = run(["--entry", lab, "--out", path.join(tmp, "lab.ts"), "--format", "lens-ts", "--strict"]);
assert.equal(cliResult.status, 0, cliResult.stderr);
assert.equal(cliResult.stderr, "");
assert.equal(run(["--entry", lab, "--out", path.join(tmp, "lab-strict.json"), "--strict"]).status, 0);

// A light is kept in the manifest but not sent to the Lens runtime: lens-ts
// warns (VS1015), the JSON manifest does not, and --strict refuses the host.
const lit = path.join(tmp, "lit.tsx");
fs.writeFileSync(lit, 'export const S = () => <ViroSpecsScene>\n  <ViroAmbientLight viroTag="amb" />\n  <ViroNode viroTag="n" />\n</ViroSpecsScene>;\n');
cliResult = run(["--entry", lit, "--out", path.join(tmp, "lit.ts"), "--format", "lens-ts"]);
assert.equal(cliResult.status, 0, cliResult.stderr);
assert.match(cliResult.stderr, /warning VS1015 \[\/lights\/0\]/);
assert.equal(run(["--entry", lit, "--out", path.join(tmp, "lit.json"), "--strict"]).status, 0);
cliResult = run(["--entry", lit, "--out", path.join(tmp, "strict.ts"), "--format", "lens-ts", "--strict"]);
assert.equal(cliResult.status, 1);
assert.ok(!fs.existsSync(path.join(tmp, "strict.ts")));

// Errors block output and print file:line:col.
const bad = path.join(tmp, "bad.tsx");
fs.writeFileSync(bad, 'export const S = () => <ViroSpecsScene>\n  <ViroVideo viroTag="v" />\n</ViroSpecsScene>;\n');
cliResult = run(["--entry", bad, "--out", path.join(tmp, "bad.json")]);
assert.equal(cliResult.status, 1);
assert.match(cliResult.stderr, /bad\.tsx:2:3 error VS4004/);
assert.ok(!fs.existsSync(path.join(tmp, "bad.json")));

cliResult = run(["--entry", bad, "--out", path.join(tmp, "bad.json"), "--diagnostics-format", "json"]);
assert.equal(cliResult.status, 1);
const printed = JSON.parse(cliResult.stderr);
assert.equal(printed[0].code, "VS4004");
assert.equal(printed[0].line, 2);

// Raw JSON entry point: a v1 manifest is accepted, reported as deprecated, and written as v2.
const v1 = path.join(repo, "__test__", "fixtures", "specs", "manifest-v1", "platform-lab.v1.json");
const migratedOut = path.join(tmp, "migrated.json");
cliResult = run(["--manifest", v1, "--out", migratedOut]);
assert.equal(cliResult.status, 0, cliResult.stderr);
assert.match(cliResult.stderr, /warning VS1002/);
assert.equal(JSON.parse(fs.readFileSync(migratedOut, "utf8")).version, 2);
cliResult = run(["--manifest", v1, "--out", path.join(tmp, "m2.json"), "--strict"]);
assert.equal(cliResult.status, 1, "a deprecated v1 input fails --strict");

// The lens-ts host built from the migrated v1 manifest matches the one built from source.
cliResult = run(["--manifest", v1, "--out", path.join(tmp, "from-v1.ts"), "--format", "lens-ts"]);
assert.equal(cliResult.status, 0, cliResult.stderr);
assert.equal(
  fs.readFileSync(path.join(tmp, "from-v1.ts"), "utf8"),
  fs.readFileSync(path.join(tmp, "lab.ts"), "utf8")
);

// Invalid hand-written JSON is rejected at the entry point.
for (const name of fs.readdirSync(path.join(repo, "__test__", "fixtures", "specs", "manifest-v2", "invalid"))) {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(repo, "__test__", "fixtures", "specs", "manifest-v2", "invalid", name), "utf8")
  );
  const input = path.join(tmp, name);
  fs.writeFileSync(input, JSON.stringify(fixture.manifest));
  cliResult = run(["--manifest", input, "--out", path.join(tmp, "x-" + name)]);
  assert.equal(cliResult.status, 1, name);
  for (const code of fixture.expectCodes) assert.match(cliResult.stderr, new RegExp(code), name);
}
fs.writeFileSync(path.join(tmp, "syntax.json"), "{ nope");
cliResult = run(["--manifest", path.join(tmp, "syntax.json"), "--out", path.join(tmp, "y.json")]);
assert.equal(cliResult.status, 1);
assert.match(cliResult.stderr, /error VS1000/);

assert.equal(run(["--entry", lab]).status, 1, "missing --out is a usage error");
assert.equal(run(["--entry", lab, "--manifest", v1, "--out", labOut]).status, 1, "--entry and --manifest are exclusive");
checks += 1;

fs.rmSync(tmp, { recursive: true, force: true });
console.log("viro specs static compiler: PASS (" + checks + " check groups)");
