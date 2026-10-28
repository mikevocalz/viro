import * as React from "react";

jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "android", constants: {} },
  Image: { resolveAssetSource: (source: unknown) => source },
  findNodeHandle: () => null,
  processColor: (value: unknown) => value,
  requireNativeComponent: () => () => null,
}));
import {
  compileViroSpecsChildren,
  dispatchViroSpecsInteraction,
} from "../components/Specs/ViroSpecsCompiler";
import { Viro3DObject } from "../components/Viro3DObject";
import { ViroAnimations } from "../components/Animation/ViroAnimations";
import { ViroNode } from "../components/ViroNode";
import { ViroPolyline } from "../components/ViroPolyline";
import { ViroText } from "../components/ViroText";

describe("Viro Specs JSX compiler", () => {
  beforeAll(() => {
    ViroAnimations.registerAnimations({
      specsTestMove: {
        properties: {
          positionX: 0.25,
          opacity: 0.6,
        },
        duration: 400,
        easing: "Linear",
      },
    });
  });

  it("compiles supported Viro JSX into the portable SPECS scene", () => {
    const tree = React.createElement(
      ViroNode,
      { viroTag: "root", position: [0, 0, -1.5], rotation: [0, 90, 0] },
      React.createElement(ViroText, {
        viroTag: "title",
        text: "Hello",
        animation: { name: "specsTestMove", run: true, loop: false },
      }),
      React.createElement(Viro3DObject, {
        viroTag: "model",
        source: { uri: "model-id" },
        type: "GLB",
      }),
      React.createElement(ViroPolyline, {
        viroTag: "route",
        points: [
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
        ],
        thickness: 0.008,
        materials: "route-line",
      })
    );

    const compiled = compileViroSpecsChildren(tree);

    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.scene.nodes.map((node) => node.id)).toEqual([
      "root",
      "title",
      "model",
    ]);
    expect(compiled.scene.nodes[1].parentId).toBe("root");
    expect(compiled.scene.nodes[2].source).toBe("model-id");

    const rootRotation = compiled.scene.nodes[0].rotation!;
    expect(rootRotation[1]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(rootRotation[3]).toBeCloseTo(Math.SQRT1_2, 5);

    expect(compiled.polylines[0]).toMatchObject({
      id: "route",
      radiusMeters: 0.004,
      materialId: "route-line",
    });
    const expectedRoute = [
      [0, 0, -1.5],
      [0, 0, -2.5],
      [0, 1, -2.5],
    ];
    expectedRoute.forEach((expected, pointIndex) => {
      expected.forEach((value, axis) => {
        expect(compiled.polylines[0].points[pointIndex][axis]).toBeCloseTo(
          value,
          5
        );
      });
    });

    expect(compiled.animations[0]).toMatchObject({
      nodeId: "title",
      definition: {
        properties: {
          positionX: 0.25,
          opacity: 0.6,
        },
        durationMs: 400,
        loop: false,
      },
    });
  });

  it("routes portable interactions back to Viro callbacks", () => {
    const onHover = jest.fn();
    const onClick = jest.fn();
    const onDrag = jest.fn();

    const compiled = compileViroSpecsChildren(
      React.createElement(Viro3DObject, {
        viroTag: "model",
        source: { uri: "model-id" },
        type: "GLB",
        onHover,
        onClick,
        onDrag,
      })
    );

    dispatchViroSpecsInteraction(
      {
        source: "hand",
        phase: "hover-enter",
        targetId: "model",
        position: [0, 0, -1],
      },
      compiled.callbacks
    );
    dispatchViroSpecsInteraction(
      {
        source: "pinch",
        phase: "select-end",
        targetId: "model",
        position: [0, 0, -1],
      },
      compiled.callbacks
    );
    dispatchViroSpecsInteraction(
      {
        source: "hand",
        phase: "drag",
        targetId: "model",
        position: [0.1, 0, -1],
      },
      compiled.callbacks
    );

    expect(onHover).toHaveBeenCalledWith(true, [0, 0, -1], 0);
    expect(onClick).toHaveBeenCalledWith([0, 0, -1], 0);
    expect(onDrag).toHaveBeenCalledWith([0.1, 0, -1], 0);
  });
});

describe("Viro Specs runtime compiler diagnostics", () => {
  const codesOf = (compiled: { diagnostics: readonly { code: string }[] }) =>
    compiled.diagnostics.map((diagnostic) => diagnostic.code);

  // Stand-ins named like the real components. The runtime compiler classifies
  // unsupported components by name, so these exercise the same path without
  // loading native modules.
  const named = (name: string) => {
    const component = () => null;
    Object.defineProperty(component, "name", { value: name });
    return component;
  };

  it("returns coded diagnostic objects and a schema-valid manifest", () => {
    const Ajv2020 = require("ajv/dist/2020").default;
    const schema = require("../schemas/viro-specs-manifest.v2.json");
    const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);

    const compiled = compileViroSpecsChildren(
      React.createElement(
        ViroNode,
        { viroTag: "root" },
        React.createElement(ViroText, {
          viroTag: "label",
          text: "Hi",
          width: 0.5,
          height: 0.1,
          style: { fontSize: 18, color: "#fff", textAlign: "center" },
        }),
        React.createElement(Viro3DObject, { viroTag: "m", source: { uri: "m.glb" }, type: "GLB" })
      )
    );
    expect(validate(compiled.manifest) ? [] : validate.errors).toEqual([]);
    expect(compiled.manifest.nodes[1]).toMatchObject({
      kind: "text",
      style: { fontSize: 18, color: "#ffffff", textAlign: "center" },
      extents: { width: 0.5, height: 0.1 },
    });
    // Scene protocol 2 carries style and extents, so compiling reports nothing.
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.document.nodes[1]).toEqual(compiled.manifest.nodes[1]);
    // The protocol 1 snapshot drops them; ViroSpecsScene reports these only
    // when a transport has no applySceneDocument.
    expect(compiled.loweringDiagnostics.map((d) => [d.code, d.severity, d.fieldPath])).toEqual([
      ["VS1015", "warning", "/nodes/1/style"],
      ["VS1015", "warning", "/nodes/1/extents"],
    ]);
    expect(compiled.scene.nodes[1]).toEqual({ id: "label", kind: "text", parentId: "root", text: "Hi" });
  });

  it.each([
    ["ViroPortalScene", "VS4001"],
    ["ViroRivePanel", "VS4003"],
    ["ViroVideo", "VS4004"],
    ["ViroSound", "VS4005"],
    ["ViroCameraTexture", "VS4006"],
    ["ViroThreeJSPanel", "VS4007"],
    ["ViroBox", "VS3001"],
  ])("%s is an error (%s) with no stand-in node", (name, code) => {
    const compiled = compileViroSpecsChildren(
      React.createElement(
        named(name),
        { viroTag: "x" },
        React.createElement(ViroText, { viroTag: "child", text: "hidden" })
      )
    );
    expect(codesOf(compiled)).toEqual([code]);
    expect(compiled.diagnostics[0]).toMatchObject({ severity: "error", nodeId: "x" });
    expect(compiled.manifest.nodes).toEqual([]);
    expect(compiled.scene.nodes).toEqual([]);
  });

  it("reports physics props as capability errors", () => {
    const compiled = compileViroSpecsChildren(
      React.createElement(ViroNode, { viroTag: "n", physicsBody: { type: "Dynamic", mass: 1 } })
    );
    expect(codesOf(compiled)).toEqual(["VS4002"]);
  });

  it("walks fragments instead of rejecting them", () => {
    const compiled = compileViroSpecsChildren(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ViroNode, { viroTag: "a" }),
        React.createElement(React.Fragment, null, React.createElement(ViroNode, { viroTag: "b" }))
      )
    );
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.manifest.nodes.map((node) => node.id)).toEqual(["a", "b"]);
  });

  it("reports duplicate IDs, missing viroTag, ignored props and unstable sources", () => {
    const compiled = compileViroSpecsChildren([
      React.createElement(ViroNode, { key: "1", viroTag: "dup" }),
      React.createElement(ViroNode, { key: "2", viroTag: "dup" }),
      React.createElement(ViroNode, { position: [0, 0, 0] }),
      React.createElement(ViroText, { viroTag: "t", text: "x", extrusionDepth: 2 }),
      React.createElement(Viro3DObject, { viroTag: "m", source: { nope: true }, type: "GLB" }),
    ]);
    expect(codesOf(compiled).sort()).toEqual(["VS1007", "VS3002", "VS3008", "VS3012"]);
    expect(compiled.diagnostics.find((d) => d.code === "VS1007")).toMatchObject({ nodeId: "dup" });
  });

  it("refuses easings Specs would substitute, and supports translate like the static compiler", () => {
    ViroAnimations.registerAnimations({
      specsBounce: { properties: { scaleX: 2 }, duration: 300, easing: "Bounce" },
      specsSlide: { properties: { translateX: 0.5 }, duration: 300, easing: "EaseOut" },
    });
    const bounce = compileViroSpecsChildren(
      React.createElement(ViroText, { viroTag: "a", text: "x", animation: { name: "specsBounce", run: true } })
    );
    expect(codesOf(bounce)).toEqual(["VS3006"]);
    expect(bounce.animations).toEqual([]);

    const slide = compileViroSpecsChildren(
      React.createElement(ViroText, {
        viroTag: "b",
        text: "x",
        position: [1, 0, 0],
        animation: { name: "specsSlide", run: true },
      })
    );
    expect(slide.diagnostics).toEqual([]);
    expect(slide.manifest.animations[0].plan.tracks).toEqual([
      { target: "transform.position.x", from: "current", to: 1.5 },
    ]);
  });
});
