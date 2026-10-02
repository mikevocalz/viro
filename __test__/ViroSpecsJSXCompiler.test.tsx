import * as React from "react";
import {
  ViroARScene,
  Viro3DObject,
  ViroNode,
  ViroPolyline,
  ViroText,
  compileViroSpecsJSX,
  dispatchViroSpecsInteraction,
  viroEulerDegreesToQuaternion,
} from "../index";

describe("Viro Specs JSX compiler", () => {
  test("matches ViroCore Euler composition for mixed-axis rotation", () => {
    const quaternion = viroEulerDegreesToQuaternion([30, 45, 60]);
    expect(quaternion[0]).toBeCloseTo(0.0222600267, 8);
    expect(quaternion[1]).toBeCloseTo(0.4396797395, 8);
    expect(quaternion[2]).toBeCloseTo(0.3604234057, 8);
    expect(quaternion[3]).toBeCloseTo(0.8223631719, 8);
  });

  test("compiles a Viro JSX tree into portable nodes", () => {
    const onClick = jest.fn();
    const tree = (
      <ViroARScene>
        <ViroNode viroTag="root" position={[0, 0, -1.5]} rotation={[0, 90, 0]}>
          <ViroText viroTag="title" text="Hello Specs" onClick={onClick} />
          <Viro3DObject
            viroTag="model"
            type="GLB"
            source={{ uri: "models/tutor.glb" }}
          />
          <ViroPolyline
            viroTag="route"
            points={[
              [0, 0, 0],
              [1, 0, 0],
              [1, 0, -1],
            ]}
            position={[0.1, 0.2, 0.3]}
            rotation={[0, 45, 0]}
            scale={[2, 1, 2]}
            thickness={0.04}
            onClick={onClick}
          />
        </ViroNode>
      </ViroARScene>
    );

    const result = compileViroSpecsJSX(tree);

    expect(result.scene.nodes.map((node) => node.id)).toEqual([
      "root",
      "title",
      "model",
    ]);
    expect(result.scene.nodes[0].position).toEqual([0, 0, -1.5]);
    expect(result.scene.nodes[0].rotation).toEqual(
      viroEulerDegreesToQuaternion([0, 90, 0])
    );
    expect(result.polylines[0]).toMatchObject({
      id: "route",
      parentId: "root",
      position: [0.1, 0.2, 0.3],
      scale: [2, 1, 2],
      widthMeters: 0.04,
    });
    expect(result.polylines[0].rotation).toEqual(
      viroEulerDegreesToQuaternion([0, 45, 0])
    );

    dispatchViroSpecsInteraction(result, {
      source: "pinch",
      phase: "select-end",
      targetId: "title",
      position: [0, 0, -1.5],
    });
    expect(onClick).toHaveBeenCalledTimes(1);

    dispatchViroSpecsInteraction(result, {
      source: "pinch",
      phase: "select-end",
      targetId: "route",
      position: [0, 0, -1.5],
    });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  test("scopes repeated React keys by ancestry", () => {
    const tree = (
      <ViroARScene>
        <ViroNode viroTag="left">
          <ViroText key="label" text="Left" />
        </ViroNode>
        <ViroNode viroTag="right">
          <ViroText key="label" text="Right" />
        </ViroNode>
      </ViroARScene>
    );

    const ids = compileViroSpecsJSX(tree).scene.nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("dispatches hover-move with the current position", () => {
    const onHover = jest.fn();
    const result = compileViroSpecsJSX(
      <ViroText viroTag="hover" text="Hover" onHover={onHover} />
    );

    dispatchViroSpecsInteraction(result, {
      source: "hand",
      phase: "hover-move",
      targetId: "hover",
      position: [1, 2, 3],
    });

    expect(onHover).toHaveBeenCalledWith(true, [1, 2, 3], 0);
  });
});
