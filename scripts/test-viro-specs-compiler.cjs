const assert = require("node:assert/strict");
const path = require("node:path");
const { compile, lensTs } = require("../bin/viro-specs-compile.cjs");

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

const result = compile(
  source,
  path.join(process.cwd(), "fixtures", "scene.tsx")
);

assert.equal(result.diagnostics.length, 0);
assert.deepEqual(
  result.scene.nodes.map((node) => node.id),
  ["root", "title", "model"]
);
assert.deepEqual(result.scene.nodes[0].position, [0, 0, -1.5]);
assert.ok(
  Math.abs(result.scene.nodes[0].rotation[1] - Math.SQRT1_2) < 1e-9
);
assert.equal(
  result.scene.nodes[2].source,
  path.normalize("fixtures/model.glb")
);

assert.equal(result.polylines.length, 1);
assert.equal(result.polylines[0].radiusMeters, 0.004);
assert.ok(
  result.polylines[0].points.every(
    (point) => point[2] < -1.1 && point[2] > -1.9
  )
);

assert.deepEqual(result.interactions[0], {
  nodeId: "model",
  interactable: true,
  manipulation: true,
  events: ["select", "drag"],
});

assert.equal(result.animations.length, 1);
assert.equal(result.animations[0].nodeId, "title");
assert.equal(result.animations[0].plan.engine, "AnimationPlayer");
assert.equal(result.animations[0].plan.durationSeconds, 0.5);
assert.equal(result.animations[0].plan.easing, "ease-in-out");
assert.deepEqual(
  result.animations[0].plan.tracks.map((track) => [track.target, track.to]),
  [
    ["transform.scale.x", 1.2],
    ["material.opacity", 0.5],
    ["transform.rotation.y", 45],
  ]
);

const conditional = compile(
  `export function Scene({enabled}) {
     return <ViroSpecsScene>{enabled && <ViroText viroTag="bad" text="bad" />}</ViroSpecsScene>;
   }`,
  "/tmp/conditional.tsx"
);
assert.ok(
  conditional.diagnostics.some((line) =>
    line.includes("dynamic/conditional JSX")
  )
);
assert.equal(conditional.scene.nodes.length, 0);

const unresolvedArray = compile(
  `export function Scene({x}) {
     return <ViroSpecsScene><ViroNode viroTag="bad" position={[x, 0, -1]} /></ViroSpecsScene>;
   }`,
  "/tmp/unresolved.tsx"
);
assert.ok(
  unresolvedArray.diagnostics.some((line) =>
    line.includes("static finite position")
  )
);

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
assert.ok(
  bounce.diagnostics.some((line) =>
    line.includes("unsupported easing Bounce")
  )
);

console.log("viro specs static compiler: PASS");


const generated = lensTs(result);
assert.match(generated, /class ViroGeneratedSceneHost/);
assert.match(generated, /runtime\.applySceneSnapshot/);
assert.match(generated, /interaction\.setInteractable/);
assert.match(generated, /interaction\.setManipulationEnabled/);
assert.match(generated, /animation\.play/);
assert.match(generated, /navigation\.presentPolyline/);

for (const [source, expected] of [
  ['<ViroARScene><ViroText text="Native only" /></ViroARScene>', /No ViroSpecsScene/],
  ['<ViroSpecsScene />', /no supported static scene content/],
]) {
  assert.ok(compile(source, "/tmp/unsupported.tsx").diagnostics.some(d => expected.test(d)));
}
assert.match(generated, /OnDestroyEvent/);
assert.match(generated, /interaction\.resetTargets\(\)/);
// Only call methods the @viro-external/specs Lens hosts expose.
assert.doesNotMatch(generated, /interaction\.remove\(/);
assert.doesNotMatch(generated, /animation\.stop\(/);
assert.match(generated, /navigation\.clearRoute/);
assert.match(generated, /runtime\.clear/);
