#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const UNRESOLVED = Symbol("unresolved");

function parseArgs(argv) {
  const result = { format: "json" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--entry") result.entry = argv[++i];
    else if (arg === "--out") result.out = argv[++i];
    else if (arg === "--format") result.format = argv[++i];
  }
  return result;
}

function collectBindings(ast) {
  const bindings = new Map();
  for (const statement of ast.program.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declaration of statement.declarations) {
      if (
        declaration.id.type === "Identifier" &&
        declaration.init
      ) {
        bindings.set(declaration.id.name, declaration.init);
      }
    }
  }
  return bindings;
}

function literal(node, bindings, resolving = new Set()) {
  if (!node) return UNRESOLVED;

  if (
    node.type === "StringLiteral" ||
    node.type === "NumericLiteral" ||
    node.type === "BooleanLiteral"
  ) {
    return node.value;
  }

  if (node.type === "NullLiteral") return null;

  if (node.type === "Identifier") {
    if (node.name === "undefined") return undefined;
    if (!bindings.has(node.name) || resolving.has(node.name)) {
      return UNRESOLVED;
    }
    const next = new Set(resolving);
    next.add(node.name);
    return literal(bindings.get(node.name), bindings, next);
  }

  if (node.type === "ArrayExpression") {
    const values = [];
    for (const element of node.elements) {
      if (!element) return UNRESOLVED;
      const value = literal(element, bindings, resolving);
      if (value === UNRESOLVED) return UNRESOLVED;
      values.push(value);
    }
    return values;
  }

  if (node.type === "ObjectExpression") {
    const out = {};
    for (const prop of node.properties) {
      if (prop.type !== "ObjectProperty") return UNRESOLVED;
      const key =
        prop.key.type === "Identifier"
          ? prop.key.name
          : prop.key.type === "StringLiteral"
            ? prop.key.value
            : undefined;
      if (!key) return UNRESOLVED;
      const value = literal(prop.value, bindings, resolving);
      if (value === UNRESOLVED) return UNRESOLVED;
      out[key] = value;
    }
    return out;
  }

  if (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "require" &&
    node.arguments.length === 1 &&
    node.arguments[0].type === "StringLiteral"
  ) {
    return { __require: node.arguments[0].value };
  }

  if (
    node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument.type === "NumericLiteral"
  ) {
    return -node.argument.value;
  }

  return UNRESOLVED;
}

function attribute(opening, name) {
  return opening.attributes.find(
    (item) =>
      item.type === "JSXAttribute" &&
      item.name.type === "JSXIdentifier" &&
      item.name.name === name
  );
}

function attributeValue(opening, name, bindings) {
  const item = attribute(opening, name);
  if (!item) return { present: false, value: undefined };
  if (!item.value) return { present: true, value: true };
  if (item.value.type === "StringLiteral") {
    return { present: true, value: item.value.value };
  }
  if (item.value.type === "JSXExpressionContainer") {
    const value = literal(item.value.expression, bindings);
    return {
      present: true,
      value: value === UNRESOLVED ? undefined : value,
      unresolved: value === UNRESOLVED,
    };
  }
  return { present: true, value: undefined, unresolved: true };
}

function propsOf(opening, bindings) {
  const props = {};
  const unresolved = new Set();
  const present = new Set();

  for (const item of opening.attributes) {
    if (
      item.type !== "JSXAttribute" ||
      item.name.type !== "JSXIdentifier"
    ) {
      continue;
    }
    const name = item.name.name;
    present.add(name);
    const read = attributeValue(opening, name, bindings);
    if (read.unresolved) unresolved.add(name);
    props[name] = read.value;
  }

  return { props, unresolved, present };
}

function isFiniteVec3(value) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function quaternionFromEuler(rotation) {
  if (!isFiniteVec3(rotation)) return undefined;
  const [x, y, z] = rotation.map((value) => value * Math.PI / 180);
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

function multiplyQuat(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function rotatePoint(rotation, point) {
  const [qx, qy, qz, qw] = rotation;
  const [x, y, z] = point;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

const IDENTITY = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function composeTransform(parent, props) {
  const localPosition = isFiniteVec3(props.position)
    ? props.position
    : [0, 0, 0];
  const localScale = isFiniteVec3(props.scale)
    ? props.scale
    : [1, 1, 1];
  const localRotation =
    quaternionFromEuler(props.rotation) ?? [0, 0, 0, 1];

  const scaledLocal = [
    localPosition[0] * parent.scale[0],
    localPosition[1] * parent.scale[1],
    localPosition[2] * parent.scale[2],
  ];
  const rotatedLocal = rotatePoint(parent.rotation, scaledLocal);

  return {
    position: [
      parent.position[0] + rotatedLocal[0],
      parent.position[1] + rotatedLocal[1],
      parent.position[2] + rotatedLocal[2],
    ],
    rotation: multiplyQuat(parent.rotation, localRotation),
    scale: [
      parent.scale[0] * localScale[0],
      parent.scale[1] * localScale[1],
      parent.scale[2] * localScale[2],
    ],
  };
}

function transformPoint(transform, point) {
  const scaled = [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2],
  ];
  const rotated = rotatePoint(transform.rotation, scaled);
  return [
    transform.position[0] + rotated[0],
    transform.position[1] + rotated[1],
    transform.position[2] + rotated[2],
  ];
}

function nameOf(node) {
  return node.type === "JSXIdentifier" ? node.name : null;
}

function sourceId(source, entryDir) {
  if (typeof source === "string") return source;
  if (
    source &&
    typeof source === "object" &&
    typeof source.uri === "string"
  ) {
    return source.uri;
  }
  if (
    source &&
    typeof source === "object" &&
    typeof source.__require === "string"
  ) {
    return path.normalize(
      path.relative(process.cwd(), path.resolve(entryDir, source.__require))
    );
  }
  return undefined;
}

function resolveRelative(value, base, translate = false) {
  if (typeof value === "number") {
    return translate ? base + value : value;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const relative = /^([+\-*/])=(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (relative) {
    const operand = Number(relative[2]);
    switch (relative[1]) {
      case "+":
        return base + operand;
      case "-":
        return base - operand;
      case "*":
        return base * operand;
      case "/":
        return operand === 0 ? null : base / operand;
    }
  }

  const absolute = Number(trimmed);
  if (!Number.isFinite(absolute)) return null;
  return translate ? base + absolute : absolute;
}

function animationBase(property, props) {
  const position = isFiniteVec3(props.position)
    ? props.position
    : [0, 0, 0];
  const scale = isFiniteVec3(props.scale) ? props.scale : [1, 1, 1];
  const rotation = isFiniteVec3(props.rotation)
    ? props.rotation
    : [0, 0, 0];

  switch (property) {
    case "positionX":
    case "translateX":
      return position[0];
    case "positionY":
    case "translateY":
      return position[1];
    case "positionZ":
    case "translateZ":
      return position[2];
    case "scaleX":
      return scale[0];
    case "scaleY":
      return scale[1];
    case "scaleZ":
      return scale[2];
    case "rotateX":
      return rotation[0];
    case "rotateY":
      return rotation[1];
    case "rotateZ":
      return rotation[2];
    case "opacity":
      return typeof props.opacity === "number" ? props.opacity : 1;
    default:
      return 0;
  }
}

function normalizeEasing(easing) {
  switch (String(easing ?? "linear").toLowerCase()) {
    case "linear":
      return "linear";
    case "easein":
    case "ease-in":
      return "ease-in";
    case "easeout":
    case "ease-out":
      return "ease-out";
    case "easeineaseout":
    case "ease-in-out":
      return "ease-in-out";
    case "bounce":
      return null;
    default:
      return null;
  }
}

function collectRegisteredAnimations(ast, bindings) {
  const animations = {};

  traverse(ast, {
    CallExpression(pathRef) {
      const node = pathRef.node;
      if (
        node.callee.type !== "MemberExpression" ||
        node.callee.object.type !== "Identifier" ||
        node.callee.object.name !== "ViroAnimations" ||
        node.callee.property.type !== "Identifier" ||
        node.callee.property.name !== "registerAnimations" ||
        node.arguments.length !== 1
      ) {
        return;
      }

      const value = literal(node.arguments[0], bindings);
      if (
        value !== UNRESOLVED &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        Object.assign(animations, value);
      }
    },
  });

  return animations;
}

function isConditionalPath(pathRef) {
  let cursor = pathRef.parentPath;
  while (cursor) {
    if (cursor.isConditionalExpression() || cursor.isLogicalExpression()) {
      return true;
    }
    if (cursor.isCallExpression()) {
      return true;
    }
    if (cursor.isJSXElement()) {
      const name = nameOf(cursor.node.openingElement.name);
      if (name === "ViroSpecsScene") return false;
    }
    cursor = cursor.parentPath;
  }
  return false;
}

function compile(sourceText, entryPath) {
  const ast = parser.parse(sourceText, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const bindings = collectBindings(ast);
  const registeredAnimations = collectRegisteredAnimations(ast, bindings);
  const diagnostics = [];
  const nodes = [];
  const polylines = [];
  const interactions = [];
  const animations = [];
  const elementStack = [];
  let ordinal = 0;
  let specsDepth = 0;

  traverse(ast, {
    JSXElement: {
      enter(pathRef) {
        const opening = pathRef.node.openingElement;
        const name = nameOf(opening.name);

        if (name === "ViroSpecsScene") {
          specsDepth += 1;
          elementStack.push({
            name,
            id: null,
            transform: IDENTITY,
            dynamic: isConditionalPath(pathRef),
          });
          return;
        }

        if (specsDepth === 0) {
          elementStack.push({
            name,
            id: null,
            transform: IDENTITY,
            dynamic: false,
          });
          return;
        }

        const supported = new Set([
          "ViroNode",
          "ViroText",
          "ViroImage",
          "Viro3DObject",
          "ViroPolyline",
        ]);

        if (!supported.has(name)) {
          elementStack.push({
            name,
            id: null,
            transform:
              elementStack.at(-1)?.transform ?? IDENTITY,
            dynamic: elementStack.some((entry) => entry.dynamic),
          });
          return;
        }

        const dynamic =
          elementStack.some((entry) => entry.dynamic) ||
          isConditionalPath(pathRef);

        if (dynamic) {
          diagnostics.push(
            name +
              " appears inside dynamic/conditional JSX. SPECS production scenes must be statically decidable."
          );
          elementStack.push({
            name,
            id: null,
            transform:
              elementStack.at(-1)?.transform ?? IDENTITY,
            dynamic: true,
          });
          return;
        }

        const { props, unresolved, present } = propsOf(opening, bindings);
        const id =
          typeof props.viroTag === "string"
            ? props.viroTag
            : "viro-specs-" + ordinal++;

        for (const transformName of ["position", "rotation", "scale"]) {
          if (
            present.has(transformName) &&
            (unresolved.has(transformName) ||
              !isFiniteVec3(props[transformName]))
          ) {
            diagnostics.push(
              name +
                " " +
                id +
                " requires static finite " +
                transformName +
                "=[x,y,z]."
            );
          }
        }

        if (
          present.has("visible") &&
          (unresolved.has("visible") ||
            typeof props.visible !== "boolean")
        ) {
          diagnostics.push(
            name + " " + id + " requires a static boolean visible prop."
          );
        }

        const parentEntry =
          [...elementStack].reverse().find((entry) => entry.id) ?? null;
        const parentId = parentEntry?.id ?? undefined;
        const parentTransform = parentEntry?.transform ?? IDENTITY;
        const worldTransform = composeTransform(parentTransform, props);

        if (name === "ViroPolyline") {
          if (
            unresolved.has("points") ||
            !Array.isArray(props.points) ||
            props.points.length < 2 ||
            !props.points.every(isFiniteVec3)
          ) {
            diagnostics.push(
              "ViroPolyline " +
                id +
                " requires at least two static finite [x,y,z] points."
            );
          } else {
            let thickness = 0.01;
            if (present.has("thickness")) {
              if (
                unresolved.has("thickness") ||
                typeof props.thickness !== "number" ||
                !Number.isFinite(props.thickness) ||
                props.thickness <= 0
              ) {
                diagnostics.push(
                  "ViroPolyline " +
                    id +
                    " requires a positive static thickness."
                );
              } else {
                thickness = props.thickness;
              }
            }

            let materialId;
            if (present.has("materials")) {
              if (unresolved.has("materials")) {
                diagnostics.push(
                  "ViroPolyline " +
                    id +
                    " requires static material naming."
                );
              } else if (typeof props.materials === "string") {
                materialId = props.materials;
              } else if (
                Array.isArray(props.materials) &&
                typeof props.materials[0] === "string"
              ) {
                materialId = props.materials[0];
              } else {
                diagnostics.push(
                  "ViroPolyline " +
                    id +
                    " requires a static material string or string array."
                );
              }
            }

            const maxScale = Math.max(
              Math.abs(worldTransform.scale[0]),
              Math.abs(worldTransform.scale[1]),
              Math.abs(worldTransform.scale[2])
            );

            polylines.push({
              id,
              primitive: "volumetric-line",
              backendPackage: "VolumetricLine",
              points: props.points.map((point) =>
                transformPoint(worldTransform, point)
              ),
              radiusMeters: (thickness / 2) * maxScale,
              ...(materialId ? { materialId } : {}),
            });
          }

          elementStack.push({
            name,
            id: null,
            transform: worldTransform,
            dynamic: false,
          });
          return;
        }

        const kind =
          name === "ViroNode"
            ? "group"
            : name === "ViroText"
              ? "text"
              : name === "ViroImage"
                ? "image"
                : "model";

        const node = {
          id,
          kind,
          ...(parentId ? { parentId } : {}),
          ...(isFiniteVec3(props.position)
            ? { position: props.position }
            : {}),
          ...(isFiniteVec3(props.rotation)
            ? { rotation: quaternionFromEuler(props.rotation) }
            : {}),
          ...(isFiniteVec3(props.scale) ? { scale: props.scale } : {}),
          ...(typeof props.visible === "boolean"
            ? { visible: props.visible }
            : {}),
        };

        if (kind === "text") {
          if (
            unresolved.has("text") ||
            typeof props.text !== "string"
          ) {
            diagnostics.push(
              "ViroText " + id + " requires static text."
            );
          } else {
            node.text = props.text;
          }
        }

        if (kind === "image" || kind === "model") {
          if (unresolved.has("source")) {
            diagnostics.push(
              name + " " + id + " requires a static source."
            );
          } else {
            const resolved = sourceId(
              props.source,
              path.dirname(entryPath)
            );
            if (!resolved) {
              diagnostics.push(
                name + " " + id + " requires a static source."
              );
            } else {
              node.source = resolved;
            }
          }
        }

        const hasHover = present.has("onHover");
        const hasClick =
          present.has("onClick") || present.has("onClickState");
        const hasDrag = present.has("onDrag");

        if (hasHover || hasClick || hasDrag) {
          interactions.push({
            nodeId: id,
            interactable: true,
            manipulation: hasDrag,
            events: [
              ...(hasHover ? ["hover"] : []),
              ...(hasClick ? ["select"] : []),
              ...(hasDrag ? ["drag"] : []),
            ],
          });
        }

        const animationRead = attributeValue(
          opening,
          "animation",
          bindings
        );
        if (animationRead.present) {
          if (
            animationRead.unresolved ||
            !animationRead.value ||
            typeof animationRead.value !== "object" ||
            Array.isArray(animationRead.value)
          ) {
            diagnostics.push(
              name + " " + id + " requires a static animation object."
            );
          } else {
            const animationProp = animationRead.value;
            if (
              typeof animationProp.name !== "string" ||
              typeof animationProp.run !== "boolean"
            ) {
              diagnostics.push(
                name +
                  " " +
                  id +
                  " animation requires static name and run values."
              );
            } else if (animationProp.run) {
              const registered =
                registeredAnimations[animationProp.name];
              if (!registered || Array.isArray(registered)) {
                diagnostics.push(
                  "Animation " +
                    animationProp.name +
                    " is missing or is an animation chain."
                );
              } else {
                const easing = normalizeEasing(registered.easing);
                if (!easing) {
                  diagnostics.push(
                    "Animation " +
                      animationProp.name +
                      " uses unsupported easing " +
                      String(registered.easing) +
                      "; SPECS will not silently change it."
                  );
                }

                const tracks = [];
                const targetByProperty = {
                  positionX: "transform.position.x",
                  positionY: "transform.position.y",
                  positionZ: "transform.position.z",
                  translateX: "transform.position.x",
                  translateY: "transform.position.y",
                  translateZ: "transform.position.z",
                  scaleX: "transform.scale.x",
                  scaleY: "transform.scale.y",
                  scaleZ: "transform.scale.z",
                  rotateX: "transform.rotation.x",
                  rotateY: "transform.rotation.y",
                  rotateZ: "transform.rotation.z",
                  opacity: "material.opacity",
                };

                for (const [property, value] of Object.entries(
                  registered.properties ?? {}
                )) {
                  const target = targetByProperty[property];
                  if (!target) {
                    if (value !== undefined) {
                      diagnostics.push(
                        "Animation " +
                          animationProp.name +
                          " uses unsupported property " +
                          property +
                          "."
                      );
                    }
                    continue;
                  }

                  const resolved = resolveRelative(
                    value,
                    animationBase(property, props),
                    property.startsWith("translate")
                  );
                  if (resolved === null) {
                    diagnostics.push(
                      "Animation " +
                        animationProp.name +
                        " cannot resolve " +
                        property +
                        "=" +
                        String(value) +
                        "."
                    );
                    continue;
                  }

                  tracks.push({
                    target,
                    from: "current",
                    to: resolved,
                  });
                }

                if (easing && tracks.length > 0) {
                  animations.push({
                    nodeId: id,
                    name: animationProp.name,
                    plan: {
                      engine: "AnimationPlayer",
                      backendPackage: "AnimationExamples",
                      durationSeconds:
                        Number(registered.duration ?? 0) / 1000,
                      delaySeconds:
                        (Number(registered.delay ?? 0) +
                          Number(animationProp.delay ?? 0)) /
                        1000,
                      easing,
                      playbackMode: animationProp.loop
                        ? "loop"
                        : "single",
                      completionEvent:
                        "viro-animation-complete:" +
                        id +
                        ":" +
                        animationProp.name,
                      tracks,
                    },
                  });
                }
              }
            }
          }
        }

        nodes.push(node);
        elementStack.push({
          name,
          id,
          transform: worldTransform,
          dynamic: false,
        });
      },

      exit(pathRef) {
        const name = nameOf(pathRef.node.openingElement.name);
        elementStack.pop();
        if (name === "ViroSpecsScene") specsDepth -= 1;
      },
    },
  });

  return {
    version: 1,
    source: path.relative(process.cwd(), entryPath),
    scene: { version: 1, nodes },
    polylines,
    interactions,
    animations,
    diagnostics,
  };
}


function lensTs(result) {
  const scene = JSON.stringify(result.scene, null, 2);
  const polylines = JSON.stringify(result.polylines, null, 2);
  const interactions = JSON.stringify(result.interactions, null, 2);
  const animations = JSON.stringify(result.animations, null, 2);

  return `import { ViroSpecsAnimationHost } from "../lens/ViroSpecsAnimationHost";
import { ViroSpecsInteractionHost } from "../lens/ViroSpecsInteractionHost";
import { ViroSpecsNavigationHost } from "../lens/ViroSpecsNavigationHost";
import { ViroSpecsRuntimeHost } from "../lens/ViroSpecsRuntimeHost";

const GENERATED_SCENE: any = ${scene};
const GENERATED_POLYLINES: any[] = ${polylines};
const GENERATED_INTERACTIONS: any[] = ${interactions};
const GENERATED_ANIMATIONS: any[] = ${animations};

@component
export class ViroGeneratedSceneHost extends BaseScriptComponent {
  @input runtimeHostObject: SceneObject;
  @input interactionHostObject: SceneObject;
  @input animationHostObject: SceneObject;
  @input navigationHostObject: SceneObject;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.startGeneratedScene());
  }

  private startGeneratedScene(): void {
    const runtime = this.runtimeHostObject.getComponent(
      ViroSpecsRuntimeHost.getTypeName()
    ) as ViroSpecsRuntimeHost | null;
    const interaction = this.interactionHostObject.getComponent(
      ViroSpecsInteractionHost.getTypeName()
    ) as ViroSpecsInteractionHost | null;
    const animation = this.animationHostObject.getComponent(
      ViroSpecsAnimationHost.getTypeName()
    ) as ViroSpecsAnimationHost | null;
    const navigation = this.navigationHostObject.getComponent(
      ViroSpecsNavigationHost.getTypeName()
    ) as ViroSpecsNavigationHost | null;

    if (!runtime) {
      throw new Error("Generated Viro scene requires ViroSpecsRuntimeHost.");
    }

    runtime.applySceneSnapshot(GENERATED_SCENE);

    if (interaction) {
      for (const item of GENERATED_INTERACTIONS) {
        interaction.setInteractable(item.nodeId, true);
        if (item.manipulation) {
          interaction.setManipulationEnabled(item.nodeId, true);
        }
      }
    }

    if (animation) {
      for (const item of GENERATED_ANIMATIONS) {
        animation.play(item.nodeId, item.plan);
      }
    }

    if (navigation) {
      for (const line of GENERATED_POLYLINES) {
        navigation.presentPolyline(line);
      }
    }
  }
}
`;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.entry || !args.out) {
    console.error(
      "Usage: viro-specs-compile --entry scene.tsx --out output --format json|lens-ts"
    );
    process.exit(1);
  }

  if (!["json", "lens-ts"].includes(args.format)) {
    console.error("Unknown --format " + args.format);
    process.exit(1);
  }

  const entry = path.resolve(args.entry);
  const output = path.resolve(args.out);
  const result = compile(fs.readFileSync(entry, "utf8"), entry);

  if (result.diagnostics.length) {
    for (const diagnostic of result.diagnostics) {
      console.error("[viro-specs]", diagnostic);
    }
    console.error(
      "[viro-specs] Refusing to emit an incomplete production scene."
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    args.format === "lens-ts"
      ? lensTs(result)
      : JSON.stringify(result, null, 2) + "\n"
  );
  console.log(
    args.format === "lens-ts"
      ? "Wrote generated Lens Studio host:"
      : "Wrote SPECS manifest:",
    output
  );
}

module.exports = { compile, lensTs };
