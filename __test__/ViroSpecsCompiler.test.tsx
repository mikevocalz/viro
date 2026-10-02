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
