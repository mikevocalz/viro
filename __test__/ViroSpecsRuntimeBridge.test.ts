jest.mock("react-native", () => ({
  NativeModules: {},
  processColor: (value: unknown) => value,
}));

import {
  compileRegisteredViroAnimationForSpecs,
  mountViroSpecsCompilation,
} from "../components/Spatial/ViroSpecsRuntimeBridge";
import { ViroAnimations } from "../components/Animation/ViroAnimations";

describe("Viro Specs runtime bridge", () => {
  test("compiles registered Viro animations without changing units", () => {
    ViroAnimations.registerAnimations({
      move: {
        duration: 500,
        delay: 50,
        easing: "ease-in-out",
        properties: {
          positionX: 1.25,
          scaleY: 2,
          rotateZ: 90,
          opacity: 0.5,
        },
      },
    });

    expect(compileRegisteredViroAnimationForSpecs("move")).toEqual(
      expect.objectContaining({
        engine: "AnimationPlayer",
        durationSeconds: 0.5,
        delaySeconds: 0.05,
        easing: "ease-in-out",
        tracks: expect.arrayContaining([
          { target: "transform.position.x", from: "current", to: 1.25 },
          { target: "transform.scale.y", from: "current", to: 2 },
          { target: "transform.rotation.z", from: "current", to: 90 },
          { target: "material.opacity", from: "current", to: 0.5 },
        ]),
      })
    );
  });

  test("mounts scene, routes interactions and sends polylines", async () => {
    const click = jest.fn();
    const scene = {
      version: 1 as const,
      nodes: [{ id: "button", kind: "group" as const }],
    };
    const compilation: any = {
      scene,
      polylines: [
        {
          id: "route",
          points: [[0, 0, 0], [1, 0, 0], [1, 1, 0]],
          widthMeters: 0.02,
        },
      ],
      bindings: [],
      diagnostics: [],
      handlers: new Map([["button", { onClick: click }]]),
      animations: [],
    };

    let interaction: ((event: any) => void) | undefined;
    const presentPolyline = jest.fn();
    const clearRoute = jest.fn();
    const clear = jest.fn();

    const mounted = await mountViroSpecsCompilation(compilation, {
      getCapabilities: () => ({
        "world-query": "supported",
        "volumetric-line": "supported",
      }),
      applyScene: jest.fn(),
      onInteraction(listener) {
        interaction = listener;
        return () => {
          interaction = undefined;
        };
      },
      navigation: {
        presentRoute: jest.fn(),
        presentPolyline,
        clearRoute,
      },
      clear,
    });

    expect(presentPolyline).toHaveBeenCalledWith(
      expect.objectContaining({
        radiusMeters: 0.01,
        points: compilation.polylines[0].points,
      })
    );

    interaction?.({
      source: "pinch",
      phase: "select-end",
      targetId: "button",
      position: [0, 0, -1],
    });
    expect(click).toHaveBeenCalled();

    await mounted.dispose();
    expect(clearRoute).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
  });
});
