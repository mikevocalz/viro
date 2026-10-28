#!/usr/bin/env node
// Captures the Platform Lab's WS4 gallery scenes and lifecycle states in
// Lens Studio Preview. Runs a viro_ws4_* LEAF scenario with hold_ms set, so
// the scenario pauses at each VIRO_WS4_HOLD marker, and captures the runtime
// view during each pause.
//
//   node scripts/specs-lens/capture-ws4.mjs --out <dir> [--scenarios a,b] [--hold-ms 12000] [--max-dim 1024]
//
// Evidence label: preview-validated at most. Nothing here runs on hardware.
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LensStudioMcp } from "./mcp-client.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const out = path.resolve(arg("--out", "docs/evidence/specs/lens/ws4-captures"));
const holdMs = Number(arg("--hold-ms", "12000"));
// Longest side of the Preview panel capture, pixels.
const maxDim = Number(arg("--max-dim", "1024"));
// Scenario -> holds it reaches, in order.
const PLAN = {
  viro_ws4_hello_loading: ["hello_loading"],
  viro_ws4_hello_ready: ["hello_ready_hover"],
  viro_ws4_hello_error: ["hello_error"],
  viro_ws4_hello_degraded: ["hello_degraded"],
  viro_ws4_placement_table: ["placement_reticle"],
  viro_ws4_placement_degraded: ["placement_degraded"],
  viro_ws4_button_states: ["interaction_buttons"],
  viro_ws4_navigation_scroll: ["navigation_top", "navigation_bottom", "navigation_detail", "navigation_back"],
  viro_ws4_scene_rejection: ["rejection_update", "rejection_first"],
  viro_ws4_preferences: ["preferences_ready", "preferences_loading"],
  viro_ws4_gaze: ["gaze_scroll_buttons"],
  viro_ws4_move_band: ["interaction_band"],
  viro_lab_actions_reference_flow: ["reference_list_top"],
  viro_ref_dashboard_ready: ["dashboard_ready"],
  viro_ref_model_ready: ["model_ready"],
  viro_ref_model_missing_asset: ["model_missing"],
  viro_ref_placement_confirm: ["placement_reticle", "placement_placed"],
};
const only = arg("--scenarios", null)?.split(",");
mkdirSync(out, { recursive: true });

const runner = await new LensStudioMcp().connect();
const capturer = await new LensStudioMcp().connect();
const logFile = (await capturer.call("RunAndCollectLogsTool", { mode: "tail", tailBytes: 1024 })).data.logFile;
const since = (offset) => readFileSync(logFile).subarray(offset).toString("utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];

for (const [scenario, holds] of Object.entries(PLAN)) {
  if (only && !only.includes(scenario)) continue;
  const offset = statSync(logFile).size;
  const run = runner.call("run_leaf_scenario", { scenarioId: scenario, onDevice: false, parameters: { hold_ms: String(holdMs) } }).catch((e) => ({ error: String(e) }));
  for (const hold of holds) {
    let seen = false;
    for (let i = 0; i < 120 && !seen; i++) {
      const log = since(offset);
      seen = log.includes("VIRO_WS4_HOLD " + hold + " ") || log.includes("VIRO_REF_HOLD " + hold + " ");
      if (!seen) await sleep(500);
    }
    if (!seen) {
      report.push({ scenario, hold, captured: false, reason: "hold marker not reached" });
      continue;
    }
    await sleep(800);
    // Reference-app holds share labels with the gallery's; keep their files apart.
    const name = scenario.startsWith("viro_ref_") ? "ref_" + hold : hold;
    const shots = [
      ["front", { center: { x: 0, y: 0, z: -140 }, distance: 150, viewAngle: "front", detail: "high" }],
    ];
    // The orthographic runtime capture does not apply ScrollWindow's
    // MaskingComponent; the Preview panel shows what the wearer sees.
    const panel = await capturer.call("CapturePanelScreenshotTool", { pluginId: "Snap.Plugin.Gui.PreviewPanel", maxDimension: maxDim });
    if (panel.images?.length) {
      writeFileSync(path.join(out, `${name}-preview.png`), Buffer.from(panel.images[0].data, "base64"));
      report.push({ scenario, hold, captured: true, file: `${name}-preview.png` });
    } else {
      report.push({ scenario, hold, captured: false, reason: "preview panel: " + (panel.text ?? "").slice(0, 300) });
    }
    for (const [suffix, args] of shots) {
      const capture = await capturer.call("CaptureRuntimeViewTool", { ...args, timeoutMs: 15000 });
      const file = path.join(out, `${name}-${suffix}.png`);
      if (capture.images?.length) {
        writeFileSync(file, Buffer.from(capture.images[0].data, "base64"));
        report.push({ scenario, hold, captured: true, file: path.basename(file) });
      } else {
        report.push({ scenario, hold, captured: false, reason: capture.text?.slice(0, 300) });
      }
    }
  }
  await run;
  const verdict = since(offset).split("\n").find((l) => l.includes("[" + scenario + "] PASSED") || l.includes("[" + scenario + "] FAILED"));
  report.push({ scenario, verdict: verdict ? verdict.replace(/^.*\[DefaultLeafScenarioManager\]\s*/, "") : "no manager line" });
  console.log(scenario, verdict ? (verdict.includes("PASSED") ? "PASSED" : "FAILED") : "?");
}
writeFileSync(path.join(out, "captures.json"), JSON.stringify(report, null, 2) + "\n");
console.log("Wrote", out);
