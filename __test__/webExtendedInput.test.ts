/**
 * Web drag, pinch and scroll depend on three WASM bindings that
 * @reactvision/viro-web-renderer 1.0.1 does not have. Two things keep that
 * from being a silent no-op: the renderer this repo ships under web/renderer
 * must actually contain them, and a scene running on an older binary must say
 * so instead of accepting the props and doing nothing.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  missingWebInput,
  warnIfWebInputUnavailable,
} from "../components/Web/viroExtendedInput";

const RENDERER_DIR = join(__dirname, "..", "web", "renderer");
const NEW_EXPORTS = ["viroOnPinch", "viroOnScroll", "viroSetNodeDragConfig"];

const fakeRenderer = (exports: string[]) =>
  ({
    wasmModule: Object.fromEntries(exports.map((name) => [name, () => {}])),
  }) as never;

describe("vendored web renderer", () => {
  const manifest = JSON.parse(
    readFileSync(join(RENDERER_DIR, "build.json"), "utf8"),
  ) as { sha256: Record<string, string>; virocore: { buildId: string } };

  test("the files match the hashes recorded in build.json", () => {
    for (const [name, want] of Object.entries(manifest.sha256)) {
      const got = createHash("sha256")
        .update(readFileSync(join(RENDERER_DIR, name)))
        .digest("hex");
      expect({ name, got }).toEqual({ name, got: want });
    }
  });

  test("the binary registers the drag, pinch and scroll bindings", () => {
    // Embind registers functions by name at runtime, so the names sit in the
    // .wasm data segment, not in the glue JS.
    const wasm = readFileSync(join(RENDERER_DIR, "viro-web.wasm")).toString("latin1");
    for (const name of NEW_EXPORTS) {
      expect({ name, present: wasm.includes(name) }).toEqual({ name, present: true });
    }
  });

  test("the binary carries the build id build.json names", () => {
    const wasm = readFileSync(join(RENDERER_DIR, "viro-web.wasm")).toString("latin1");
    expect(wasm.includes(manifest.virocore.buildId)).toBe(true);
  });
});

describe("missingWebInput", () => {
  test("a 1.0.1-style module is missing all three", () => {
    const renderer = fakeRenderer(["viroOnTouch", "viroSetEventCallback"]);
    expect(missingWebInput(renderer, ["drag", "pinch", "scroll"])).toEqual([
      "drag",
      "pinch",
      "scroll",
    ]);
  });

  test("a current module is missing none", () => {
    const renderer = fakeRenderer(NEW_EXPORTS);
    expect(missingWebInput(renderer, ["drag", "pinch", "scroll"])).toEqual([]);
  });
});

describe("warnIfWebInputUnavailable", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test("warns once per renderer, naming the missing bindings", () => {
    const renderer = fakeRenderer(["viroOnTouch"]);
    expect(warnIfWebInputUnavailable(renderer, ["drag"])).toBe(true);
    expect(warnIfWebInputUnavailable(renderer, ["pinch"])).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("viroSetNodeDragConfig");
    expect(warn.mock.calls[0][0]).toContain("assetBaseUrl");
  });

  test("stays quiet when the renderer has the bindings", () => {
    expect(warnIfWebInputUnavailable(fakeRenderer(NEW_EXPORTS), ["drag", "pinch", "scroll"])).toBe(
      false,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  test("stays quiet when no node asked for extended input", () => {
    expect(warnIfWebInputUnavailable(fakeRenderer([]), [])).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
