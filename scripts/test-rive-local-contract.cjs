#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const root = path.resolve(__dirname, "..");
const failures = [];
const notes = [];
function read(file) {
  const full = path.resolve(root, file);
  if (!fs.existsSync(full)) { failures.push("missing " + file); return ""; }
  return fs.readFileSync(full, "utf8");
}
const panel = read("components/ViroRivePanel.tsx");
const canvas = read("components/CanvasPanel/nitroCanvas.ts");
for (const value of ["ViroRivePanel","RiveProducer","createRiveCanvasRuntime","artboardPointerSink","useCanvasInViroInput","ViroNode","ViroQuad"]) {
  if (!panel.includes(value) && !canvas.includes(value)) failures.push("Viro Rive path: missing " + value);
}
for (const value of ["WebView","captureRef","toDataURL",".png",".gif"]) {
  if (panel.includes(value)) failures.push("ViroRivePanel.tsx: forbidden fallback " + value);
}
if (panel.includes("requestAnimationFrame")) failures.push("ViroRivePanel.tsx: frame scheduling must stay in useCanvasPanel/native Rive runtime");

const externalRoot = process.env.VIRO_EXTERNAL_ROOT;
if (externalRoot) {
  const contract = path.join(externalRoot, "packages/xr-platform-contract/src/rive.ts");
  if (!fs.existsSync(contract)) failures.push("VIRO_EXTERNAL_ROOT: missing " + contract);
  else {
    const source = fs.readFileSync(contract, "utf8");
    for (const value of ["RiveSource","RiveFit","RiveSpatialDepthMode","RiveDragConfig","RiveInputKind","RivePointerPhase","RiveSpatialPointer","RiveSpatialSurfaceConfig","RiveSpatialSurfaceCapabilities","RiveSpatialSurfaceHandle","NativeRiveSpatialAdapter"]) {
      if (!source.includes(value)) failures.push("xr-contract/rive.ts: missing " + value);
    }
    for (const value of ["surface","extruded","occluding","embedded"]) if (!source.includes("\"" + value + "\"")) failures.push("xr-contract/rive.ts: missing depth mode " + value);
    notes.push("checked shared Rive contract: " + contract);
  }
} else notes.push("VIRO_EXTERNAL_ROOT not set; shared-contract check skipped");

function gitGrep(repo, pattern) {
  try { cp.execFileSync("git", ["grep","-n",pattern], { cwd: repo, stdio:["ignore","pipe","ignore"], encoding:"utf8" }); return true; }
  catch { return false; }
}
const virocoreRoot = process.env.VIROCORE_ROOT;
if (virocoreRoot) {
  if (!fs.existsSync(path.join(virocoreRoot, ".git"))) failures.push("VIROCORE_ROOT is not a git checkout: " + virocoreRoot);
  else if (!gitGrep(virocoreRoot, "VROExternalSurfaceTexture")) failures.push("virocore: VROExternalSurfaceTexture was not found");
  else notes.push("checked ViroCore external-surface bridge");
} else notes.push("VIROCORE_ROOT not set; ViroCore bridge check skipped");

if (failures.length) {
  console.error("\nRive/XR conformance audit FAILED\n");
  failures.forEach(x => console.error("- " + x));
  notes.forEach(x => console.error("- " + x));
  process.exit(1);
}
console.log("\nRive/XR conformance audit PASSED\n");
notes.forEach(x => console.log("- " + x));
console.log("- native Rive producer path is present");
console.log("- surface-local pointer mapping is present");
console.log("- Viro scene node + quad composition is present");
console.log("- no WebView/screenshot/PNG/GIF fallback is present");
console.log("\nNative device validation is still required.");