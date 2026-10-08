import { describe, expect, test } from "@jest/globals";
import {
  addQuestRenderModelEntries,
  RENDER_MODEL_FEATURE,
  RENDER_MODEL_PERMISSION,
} from "../plugins/util/questRenderModel";

type Manifest = Parameters<typeof addQuestRenderModelEntries>[0];

const names = (entries: Manifest["uses-permission"]) =>
  (entries ?? []).map((entry) => entry.$?.["android:name"]);

const freshManifest = (): Manifest => ({
  "uses-permission": [{ $: { "android:name": "android.permission.CAMERA" } }],
  "uses-feature": [],
});

describe("addQuestRenderModelEntries", () => {
  test("QUEST declares the permission and an optional feature", () => {
    const manifest = addQuestRenderModelEntries(freshManifest(), ["QUEST"], undefined);
    expect(names(manifest["uses-permission"])).toContain(RENDER_MODEL_PERMISSION);
    expect(manifest["uses-feature"]).toContainEqual({
      $: { "android:name": RENDER_MODEL_FEATURE, "android:required": "false" },
    });
  });

  test("QUEST combined with AR still declares them", () => {
    const manifest = addQuestRenderModelEntries(freshManifest(), ["AR", "QUEST"], true);
    expect(names(manifest["uses-permission"])).toContain(RENDER_MODEL_PERMISSION);
    expect(names(manifest["uses-feature"])).toContain(RENDER_MODEL_FEATURE);
  });

  test.each([[["PICO"]], [["AR"]], [["GVR"]], [[]]])(
    "xRMode %j without QUEST adds nothing",
    (modes) => {
      const manifest = addQuestRenderModelEntries(freshManifest(), modes, undefined);
      expect(manifest).toStrictEqual(freshManifest());
    }
  );

  test("renderModel: false opts out", () => {
    const manifest = addQuestRenderModelEntries(freshManifest(), ["QUEST"], false);
    expect(manifest).toStrictEqual(freshManifest());
  });

  test("running twice does not duplicate entries", () => {
    const manifest = freshManifest();
    addQuestRenderModelEntries(manifest, ["QUEST"], undefined);
    addQuestRenderModelEntries(manifest, ["QUEST"], undefined);
    expect(names(manifest["uses-permission"]).filter((n) => n === RENDER_MODEL_PERMISSION))
      .toHaveLength(1);
    expect(names(manifest["uses-feature"]).filter((n) => n === RENDER_MODEL_FEATURE))
      .toHaveLength(1);
  });

  test("creates the lists when the manifest has none", () => {
    const manifest = addQuestRenderModelEntries({}, ["QUEST"], undefined);
    expect(names(manifest["uses-permission"])).toEqual([RENDER_MODEL_PERMISSION]);
    expect(names(manifest["uses-feature"])).toEqual([RENDER_MODEL_FEATURE]);
  });
});
