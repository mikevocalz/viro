#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

// Manifest types, validation, diagnostics and compile rules shared with the
// runtime compiler. Built from components/Specs/core by `npm run build:specs-core`.
function loadCore() {
  try {
    return require("./specs-core/index.js");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      console.error(
        "viro-specs-compile: bin/specs-core is missing. Run `npm run build:specs-core` in the react-viro package."
      );
      process.exit(1);
    }
    throw error;
  }
}
const core = loadCore();

const UNRESOLVED = Symbol("unresolved");

function parseArgs(argv) {
  const result = { format: "json", strict: false, diagnosticsFormat: "text" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--entry") result.entry = argv[++i];
    else if (arg === "--manifest") result.manifest = argv[++i];
    else if (arg === "--out") result.out = argv[++i];
    else if (arg === "--format") result.format = argv[++i];
    else if (arg === "--strict") result.strict = true;
    else if (arg === "--diagnostics-format") result.diagnosticsFormat = argv[++i];
    else result.unknown = arg;
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

/**
 * Reads every attribute. Spread attributes are returned separately because
 * the static compiler cannot see their contents (VS2013).
 */
function propsOf(opening, bindings) {
  const props = {};
  const unresolved = new Set();
  const present = new Set();
  const locations = new Map();
  const spreads = [];

  for (const item of opening.attributes) {
    if (item.type === "JSXSpreadAttribute") {
      spreads.push(item);
      continue;
    }
    if (item.type !== "JSXAttribute" || item.name.type !== "JSXIdentifier") {
      continue;
    }
    const name = item.name.name;
    present.add(name);
    locations.set(name, item);
    const read = attributeValue(opening, name, bindings);
    if (read.unresolved) unresolved.add(name);
    props[name] = read.value;
  }

  return { props, unresolved, present, locations, spreads };
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
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") {
    return nameOf(node.object) + "." + node.property.name;
  }
  if (node.type === "JSXNamespacedName") {
    return node.namespace.name + ":" + node.name.name;
  }
  return "anonymous";
}

/**
 * Asset ID for a static source. `require()` paths are resolved against the
 * entry file and written relative to `baseDir` with forward slashes.
 */
function sourceId(source, entryDir, baseDir) {
  if (typeof source === "string") return source;
  if (source && typeof source === "object" && typeof source.uri === "string") {
    return source.uri;
  }
  if (source && typeof source === "object" && typeof source.__require === "string") {
    return path.normalize(
      path.relative(baseDir, path.resolve(entryDir, source.__require))
    );
  }
  return undefined;
}

function animationBase(property, props) {
  const position = isFiniteVec3(props.position) ? props.position : [0, 0, 0];
  const scale = isFiniteVec3(props.scale) ? props.scale : [1, 1, 1];
  const rotation = isFiniteVec3(props.rotation) ? props.rotation : [0, 0, 0];

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
      if (value !== UNRESOLVED && value && typeof value === "object" && !Array.isArray(value)) {
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

const TEXT_STYLE_KEYS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "color",
  "textAlign",
  "textAlignVertical",
];
const FONT_WEIGHTS = ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"];

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Compiles one entry file.
 *
 * Returns `{ manifest, scene, diagnostics }`: the manifest v2 document, the
 * scene protocol 1 snapshot lowered from it, and coded diagnostics with
 * file, line and column. `options.baseDir` (default: the working directory)
 * anchors relative paths in the output.
 */
function compile(sourceText, entryPath, options = {}) {
  const baseDir = options.baseDir ?? process.cwd();
  const file = path.relative(baseDir, entryPath).split(path.sep).join("/");
  const diagnostics = [];
  const nodeLocations = new Map();

  const at = (node) =>
    node && node.loc
      ? { file, line: node.loc.start.line, col: node.loc.start.column + 1 }
      : { file };
  const report = (code, message, node, nodeId) =>
    diagnostics.push(
      core.createViroSpecsDiagnostic(code, message, {
        ...at(node),
        ...(nodeId !== undefined ? { nodeId } : {}),
      })
    );

  let ast;
  try {
    ast = parser.parse(sourceText, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
  } catch (error) {
    diagnostics.push(
      core.createViroSpecsDiagnostic("VS2015", error.message, {
        file,
        ...(error.loc ? { line: error.loc.line, col: error.loc.column + 1 } : {}),
      })
    );
    return { manifest: undefined, scene: undefined, diagnostics };
  }

  const bindings = collectBindings(ast);
  const registeredAnimations = collectRegisteredAnimations(ast, bindings);
  const nodes = [];
  const polylines = [];
  const lights = [];
  const interactions = [];
  const animations = [];
  const elementStack = [];
  let ordinal = 0;
  let specsDepth = 0;
  let specsRoots = 0;
  let sceneRoute;
  let sceneActions;

  const enter = (pathRef) => {
    const opening = pathRef.node.openingElement;
    const name = nameOf(opening.name);
    const parentEntry = elementStack.at(-1);
    const inheritedTransform = parentEntry?.transform ?? IDENTITY;
    const inheritedDynamic = elementStack.some((entry) => entry.dynamic);
    const insideUnsupported = elementStack.some((entry) => entry.unsupported);

    if (name === "ViroSpecsScene") {
      specsDepth += 1;
      specsRoots += 1;
      const scene = propsOf(opening, bindings);
      for (const prop of ["route", "actions"]) {
        if (scene.present.has(prop) && scene.unresolved.has(prop)) {
          report("VS2014", "ViroSpecsScene " + prop + " cannot be resolved statically.", scene.locations.get(prop));
        }
      }
      if (typeof scene.props.route === "string") sceneRoute = scene.props.route;
      else if (scene.present.has("route") && !scene.unresolved.has("route")) {
        report("VS1004", "ViroSpecsScene route must be a non-empty string.", scene.locations.get("route"));
      }
      if (scene.present.has("actions") && !scene.unresolved.has("actions")) {
        // defineSpecsActions(...) is a call and stays unresolved; a static
        // array of declarations is read as is.
        const value = scene.props.actions;
        sceneActions = Array.isArray(value) ? value : value && Array.isArray(value.declarations) ? value.declarations : undefined;
        if (!sceneActions) report("VS1004", "ViroSpecsScene actions must be an array of action declarations.", scene.locations.get("actions"));
      }
      elementStack.push({ name, id: null, transform: IDENTITY, dynamic: isConditionalPath(pathRef) });
      return;
    }

    if (specsDepth === 0 || insideUnsupported) {
      elementStack.push({ name, id: null, transform: inheritedTransform, dynamic: false, unsupported: insideUnsupported });
      return;
    }

    const classification = core.classifySpecsComponent(name);
    const { props, unresolved, present, locations, spreads } = propsOf(opening, bindings);
    const explicitId = typeof props.viroTag === "string" ? props.viroTag : undefined;

    if (classification.kind !== "supported") {
      diagnostics.push(
        core.unsupportedComponentDiagnostic(name, {
          ...at(opening),
          ...(explicitId !== undefined ? { nodeId: explicitId } : {}),
        })
      );
      elementStack.push({ name, id: null, transform: inheritedTransform, dynamic: false, unsupported: true });
      return;
    }

    if (inheritedDynamic || isConditionalPath(pathRef)) {
      report(
        "VS2003",
        name + " is inside dynamic or conditional JSX. Specs scenes must be statically decidable.",
        opening,
        explicitId
      );
      elementStack.push({ name, id: null, transform: inheritedTransform, dynamic: true });
      return;
    }

    const target = classification.target;
    const id = explicitId ?? "viro-specs-" + ordinal++;
    nodeLocations.set(id, opening);
    if (explicitId === undefined) {
      report("VS3012", name + " was given ordinal ID " + id + ".", opening, id);
    }
    for (const spread of spreads) {
      report("VS2013", name + " " + id + " has a spread attribute; its props were not compiled.", spread, id);
    }
    diagnostics.push(
      ...core.checkSpecsProps(name, [...present], (prop) => ({
        ...at(locations.get(prop)),
        nodeId: id,
      }))
    );

    for (const transformName of ["position", "rotation", "scale"]) {
      if (
        present.has(transformName) &&
        (unresolved.has(transformName) || !isFiniteVec3(props[transformName]))
      ) {
        report(
          "VS2004",
          name + " " + id + " " + transformName + " is not a static finite [x, y, z].",
          locations.get(transformName),
          id
        );
      }
    }
    if (present.has("visible") && (unresolved.has("visible") || typeof props.visible !== "boolean")) {
      report("VS2005", name + " " + id + " visible is not a static boolean.", locations.get("visible"), id);
    }

    const parentNode = [...elementStack].reverse().find((entry) => entry.id) ?? null;
    const parentId = parentNode?.id ?? undefined;
    const worldTransform = composeTransform(parentNode?.transform ?? IDENTITY, props);

    const staticValue = (prop) => {
      if (!present.has(prop)) return undefined;
      if (unresolved.has(prop)) {
        report("VS2014", name + " " + id + " " + prop + " cannot be resolved statically.", locations.get(prop), id);
        return undefined;
      }
      return props[prop];
    };

    if (target.category === "light") {
      const color = staticValue("color");
      const normalized = color === undefined ? undefined : core.normalizeSpecsColor(color);
      if (color !== undefined && normalized === undefined) {
        report("VS3009", name + " " + id + " color " + String(color) + " is not hex; it was left out.", locations.get("color"), id);
      }
      const intensity = staticValue("intensity");
      const light = {
        id,
        type: target.type,
        ...(parentId ? { parentId } : {}),
        ...(normalized ? { color: normalized } : {}),
        ...(typeof intensity === "number" ? { intensity } : {}),
      };
      if (target.type === "directional" || target.type === "spot") {
        const direction = staticValue("direction");
        light.direction = isFiniteVec3(direction) ? direction : [0, 0, -1];
      }
      if (target.type === "omni" || target.type === "spot") {
        light.position = isFiniteVec3(props.position) ? props.position : [0, 0, 0];
      }
      if (target.type === "spot") {
        const inner = staticValue("innerAngle");
        const outer = staticValue("outerAngle");
        if (typeof inner === "number") light.innerAngle = inner;
        if (typeof outer === "number") light.outerAngle = outer;
      }
      lights.push(light);
      elementStack.push({ name, id: null, transform: worldTransform, dynamic: false });
      return;
    }

    let materialId;
    if (present.has("materials")) {
      if (unresolved.has("materials")) {
        report("VS2008", name + " " + id + " materials cannot be resolved statically.", locations.get("materials"), id);
      } else if (typeof props.materials === "string") {
        materialId = props.materials;
      } else if (Array.isArray(props.materials) && typeof props.materials[0] === "string") {
        materialId = props.materials[0];
      } else {
        report("VS2008", name + " " + id + " materials is not a string or string array.", locations.get("materials"), id);
      }
    }

    let triggers = [];
    const specsAction = staticValue("specsAction");
    if (specsAction !== undefined) {
      const read = core.readSpecsActionProp(specsAction);
      for (const message of read.invalid) report("VS3014", name + " " + id + " " + message, locations.get("specsAction"), id);
      triggers = read.triggers;
    }
    const triggerEvents = core.specsTriggerEvents(triggers);
    const hasHover = present.has("onHover") || triggerEvents.includes("hover");
    const hasClick = present.has("onClick") || present.has("onClickState") || triggerEvents.includes("select");
    const hasDrag = present.has("onDrag");
    if (hasHover || hasClick || hasDrag) {
      interactions.push({
        nodeId: id,
        interactable: true,
        manipulation: hasDrag,
        events: [...(hasHover ? ["hover"] : []), ...(hasClick ? ["select"] : []), ...(hasDrag ? ["drag"] : [])],
        ...(triggers.length > 0 ? { triggers } : {}),
      });
    }

    if (target.category === "polyline") {
      if (
        unresolved.has("points") ||
        !Array.isArray(props.points) ||
        props.points.length < 2 ||
        !props.points.every(isFiniteVec3)
      ) {
        report("VS2006", "ViroPolyline " + id + " needs at least two static finite [x, y, z] points.", locations.get("points") ?? opening, id);
      } else {
        let thickness = 0.01;
        if (present.has("thickness")) {
          if (unresolved.has("thickness") || !isPositiveNumber(props.thickness)) {
            report("VS2007", "ViroPolyline " + id + " thickness is not a positive static number.", locations.get("thickness"), id);
          } else {
            thickness = props.thickness;
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
          points: props.points.map((point) => transformPoint(worldTransform, point)),
          radiusMeters: (thickness / 2) * maxScale,
          ...(materialId ? { materialId } : {}),
        });
      }
      elementStack.push({ name, id: null, transform: worldTransform, dynamic: false });
      return;
    }

    const kind = target.kind;
    const opacity = staticValue("opacity");
    const node = {
      id,
      kind,
      ...(parentId ? { parentId } : {}),
      ...(isFiniteVec3(props.position) ? { position: props.position } : {}),
      ...(isFiniteVec3(props.rotation) ? { rotation: quaternionFromEuler(props.rotation) } : {}),
      ...(isFiniteVec3(props.scale) ? { scale: props.scale } : {}),
      ...(typeof props.visible === "boolean" ? { visible: props.visible } : {}),
      ...(typeof opacity === "number" ? { opacity } : {}),
      ...(materialId ? { materialId } : {}),
    };
    if (kind === "group") {
      // Shape is checked by validation (VS1004) on the finished manifest.
      const scroll = staticValue("specsScroll");
      if (scroll !== undefined) node.scroll = scroll;
    }
    let complete = true;

    if (kind === "text") {
      if (unresolved.has("text") || typeof props.text !== "string") {
        report("VS2009", "ViroText " + id + " text is not a static string.", locations.get("text") ?? opening, id);
        complete = false;
      } else {
        node.text = props.text;
      }
      const style = staticValue("style");
      if (style !== undefined) {
        if (!style || typeof style !== "object" || Array.isArray(style)) {
          report("VS2014", "ViroText " + id + " style is not a static object.", locations.get("style"), id);
        } else {
          const out = {};
          for (const [key, value] of Object.entries(style)) {
            if (!TEXT_STYLE_KEYS.includes(key)) {
              report("VS3002", "ViroText " + id + " style." + key + " is not carried to Specs.", locations.get("style"), id);
              continue;
            }
            if (key === "color") {
              const color = core.normalizeSpecsColor(value);
              if (color) out.color = color;
              else report("VS3009", "ViroText " + id + " style.color " + String(value) + " is not hex; it was left out.", locations.get("style"), id);
            } else if (key === "fontWeight") {
              const weight = typeof value === "number" ? String(value) : value;
              if (FONT_WEIGHTS.includes(weight)) out.fontWeight = weight;
              else report("VS3002", "ViroText " + id + " style.fontWeight " + String(value) + " is not carried to Specs.", locations.get("style"), id);
            } else if (key === "fontSize") {
              if (isPositiveNumber(value)) out.fontSize = value;
              else report("VS2014", "ViroText " + id + " style.fontSize is not a positive number.", locations.get("style"), id);
            } else {
              out[key] = value;
            }
          }
          if (Object.keys(out).length) node.style = out;
        }
      }
      const maxLines = staticValue("maxLines");
      if (typeof maxLines === "number") node.maxLines = maxLines;
    }

    if (kind === "text" || kind === "image") {
      const width = staticValue("width");
      const height = staticValue("height");
      if (isPositiveNumber(width) && isPositiveNumber(height)) {
        node.extents = { width, height };
      }
    }

    if (kind === "image" || kind === "model") {
      const resolved = unresolved.has("source")
        ? undefined
        : sourceId(props.source, path.dirname(entryPath), baseDir);
      if (!resolved) {
        report("VS2010", name + " " + id + " source is not static.", locations.get("source") ?? opening, id);
        complete = false;
      } else {
        node.source = resolved.split(path.sep).join("/");
      }
    }

    if (kind === "model") {
      const format = core.specsModelFormat(staticValue("type"));
      if (format === "vrx") {
        report("VS3013", "Viro3DObject " + id + " uses VRX.", locations.get("type"), id);
        complete = false;
      } else if (format) {
        node.format = format;
      }
    }

    const animationRead = attributeValue(opening, "animation", bindings);
    if (animationRead.present) {
      const animationAt = locations.get("animation");
      if (
        animationRead.unresolved ||
        !animationRead.value ||
        typeof animationRead.value !== "object" ||
        Array.isArray(animationRead.value)
      ) {
        report("VS2011", name + " " + id + " animation is not a static object.", animationAt, id);
      } else {
        const animationProp = animationRead.value;
        if (typeof animationProp.name !== "string" || typeof animationProp.run !== "boolean") {
          report("VS2012", name + " " + id + " animation needs static name and run.", animationAt, id);
        } else if (animationProp.run) {
          const registered = registeredAnimations[animationProp.name];
          if (!registered || Array.isArray(registered)) {
            report("VS3003", "Animation " + animationProp.name + " on " + id + " is not registered or is an animation chain.", animationAt, id);
          } else {
            const easing = core.normalizeSpecsEasing(registered.easing);
            if (!easing) {
              report("VS3006", "Animation " + animationProp.name + " uses easing " + String(registered.easing) + ", which Specs does not play.", animationAt, id);
            }
            const tracks = [];
            for (const [property, value] of Object.entries(registered.properties ?? {})) {
              if (value === undefined) continue;
              const trackTarget = core.specsAnimationTarget(property);
              if (!trackTarget) {
                report("VS3004", "Animation " + animationProp.name + " property " + property + " is not supported on Specs.", animationAt, id);
                continue;
              }
              const resolved = core.resolveSpecsAnimationValue(
                value,
                animationBase(property, props),
                property.startsWith("translate")
              );
              if (resolved === undefined) {
                report("VS3005", "Animation " + animationProp.name + " cannot resolve " + property + "=" + String(value) + ".", animationAt, id);
                continue;
              }
              tracks.push({ target: trackTarget, from: "current", to: resolved });
            }
            if (easing && tracks.length > 0) {
              animations.push({
                nodeId: id,
                name: animationProp.name,
                plan: {
                  engine: "AnimationPlayer",
                  backendPackage: "AnimationExamples",
                  durationSeconds: Number(registered.duration ?? 0) / 1000,
                  delaySeconds: (Number(registered.delay ?? 0) + Number(animationProp.delay ?? 0)) / 1000,
                  easing,
                  playbackMode: animationProp.loop ? "loop" : "single",
                  completionEvent: "viro-animation-complete:" + id + ":" + animationProp.name,
                  tracks,
                },
              });
            }
          }
        }
      }
    }

    if (complete) nodes.push(node);
    elementStack.push({ name, id: complete ? id : null, transform: worldTransform, dynamic: false });
  };

  traverse(ast, {
    JSXElement: {
      enter,
      exit(pathRef) {
        const name = nameOf(pathRef.node.openingElement.name);
        elementStack.pop();
        if (name === "ViroSpecsScene") specsDepth -= 1;
      },
    },
  });

  if (specsRoots === 0) {
    diagnostics.push(core.createViroSpecsDiagnostic("VS2001", "No <ViroSpecsScene> in " + file + ".", { file }));
  } else if (nodes.length === 0 && polylines.length === 0 && lights.length === 0) {
    diagnostics.push(core.createViroSpecsDiagnostic("VS2002", "<ViroSpecsScene> in " + file + " has no compiled content.", { file }));
  }

  const manifest = {
    $schema: core.VIRO_SPECS_MANIFEST_SCHEMA_ID,
    version: 2,
    generator: { name: "viro-specs-compile" },
    source: file,
    ...(sceneRoute !== undefined ? { route: sceneRoute } : {}),
    ...(sceneActions !== undefined && sceneActions.length > 0 ? { actions: sceneActions } : {}),
    nodes,
    polylines,
    lights,
    materials: [],
    interactions,
    animations,
  };

  // Semantic checks (duplicate IDs, references) run on the finished manifest.
  // Map their nodeId back to the element so the error points at source.
  const validation = core.validateSpecsManifestV2(manifest);
  for (const diagnostic of validation.diagnostics) {
    const element = diagnostic.nodeId !== undefined ? nodeLocations.get(diagnostic.nodeId) : undefined;
    diagnostics.push({ ...diagnostic, ...at(element) });
  }

  return { manifest, document: core.toSpecsSceneDocument(manifest), diagnostics };
}

function compileManifestFile(text, manifestPath, options = {}) {
  const baseDir = options.baseDir ?? process.cwd();
  const file = path.relative(baseDir, manifestPath).split(path.sep).join("/");
  const parsed = core.parseSpecsManifestJson(text, { file });
  if (!parsed.ok) {
    return { manifest: undefined, document: undefined, diagnostics: [...parsed.diagnostics] };
  }
  return {
    manifest: parsed.value,
    document: core.toSpecsSceneDocument(parsed.value),
    diagnostics: [...parsed.diagnostics],
  };
}

/**
 * Generated Lens Studio host: a thin orchestrator over
 * ViroSpecsSceneControllerHost from @viro-external/specs. The scene constant
 * is a scene protocol 2 document (toSpecsSceneDocument), so text style,
 * extents, maxLines, opacity, materials and lights reach the Lens.
 * Validation, staging, asset placeholders, interaction binding, animation
 * start and teardown are the controller's job; this file only presents the
 * document and forwards what the controller reports.
 */
function lensTs(result) {
  const scene = JSON.stringify(result.document, null, 2);

  return `import { ViroSpecsSceneControllerHost } from "../lens/ViroSpecsSceneControllerHost";
import type { ViroSpecsSceneDocumentV2 } from "../lens/ViroSpecsProtocol";

const GENERATED_SCENE: ViroSpecsSceneDocumentV2 = ${scene};

@component
export class ViroGeneratedSceneHost extends BaseScriptComponent {
  @input
  @hint("SceneObject hosting ViroSpecsSceneControllerHost")
  sceneHostObject: SceneObject;

  private host: ViroSpecsSceneControllerHost | null = null;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.restartGeneratedScene());
    this.createEvent("OnDestroyEvent").bind(() => this.stopGeneratedScene());
  }

  /** Presents the generated scene. Problems go to the Lens log as VS5xxx diagnostics; nothing throws. */
  restartGeneratedScene(): void {
    const host = this.sceneHostObject
      ? (this.sceneHostObject.getComponent(ViroSpecsSceneControllerHost.getTypeName()) as ViroSpecsSceneControllerHost | null)
      : null;
    if (!host) {
      print("[viro-specs-host] error: ViroGeneratedSceneHost needs ViroSpecsSceneControllerHost on sceneHostObject.");
      return;
    }
    this.host = host;
    host.present(GENERATED_SCENE);
  }

  stopGeneratedScene(): void {
    if (this.host && !isNull(this.host)) this.host.clear();
    this.host = null;
  }
}
`;
}

const USAGE = [
  "Usage:",
  "  viro-specs-compile --entry scene.tsx --out out.json [--format json|scene-json|lens-ts] [--strict] [--diagnostics-format text|json]",
  "  viro-specs-compile --manifest scene.json --out out.json [--format json|scene-json|lens-ts] [--strict] [--diagnostics-format text|json]",
  "",
  "--entry     compile Viro JSX",
  "--manifest  read a hand-written or older manifest (v1 or v2), validate it, and write it as v2",
  "--strict    fail on warnings as well as errors",
  "--format    json: manifest v2; scene-json: scene protocol 2 document for ViroSpecsSceneController; lens-ts: generated Lens host",
].join("\n");

/**
 * Exit status for a diagnostic set: 1 when any error, or any warning under
 * --strict; otherwise 0.
 */
function exitStatus(diagnostics, strict) {
  return diagnostics.some(
    (diagnostic) => diagnostic.severity === "error" || (strict && diagnostic.severity === "warning")
  )
    ? 1
    : 0;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.unknown || (!args.entry === !args.manifest) || !args.out) {
    if (args.unknown) console.error("Unknown argument " + args.unknown);
    console.error(USAGE);
    return 1;
  }
  if (!["json", "scene-json", "lens-ts"].includes(args.format)) {
    console.error("Unknown --format " + args.format + "\n" + USAGE);
    return 1;
  }
  if (!["text", "json"].includes(args.diagnosticsFormat)) {
    console.error("Unknown --diagnostics-format " + args.diagnosticsFormat + "\n" + USAGE);
    return 1;
  }

  const inputPath = path.resolve(args.entry ?? args.manifest);
  const output = path.resolve(args.out);
  const text = fs.readFileSync(inputPath, "utf8");
  const result = args.entry ? compile(text, inputPath) : compileManifestFile(text, inputPath);
  // Both Lens outputs use scene protocol 2, which carries every manifest
  // field, so nothing is lowered away and there is no VS1015 to report.
  const diagnostics = [...result.diagnostics];

  if (args.diagnosticsFormat === "json") {
    if (diagnostics.length) console.error(JSON.stringify(diagnostics, null, 2));
  } else {
    for (const diagnostic of diagnostics) {
      console.error("[viro-specs] " + core.formatViroSpecsDiagnostic(diagnostic));
    }
  }

  const status = result.manifest ? exitStatus(diagnostics, args.strict) : 1;
  if (status !== 0) {
    // In JSON mode stderr carries only the diagnostics array, for tooling.
    if (args.diagnosticsFormat === "json") return status;
    console.error(
      "[viro-specs] Refusing to write " +
        path.relative(process.cwd(), output) +
        (args.strict ? " (--strict: warnings are errors)." : ".")
    );
    return status;
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    args.format === "lens-ts"
      ? lensTs(result)
      : JSON.stringify(args.format === "scene-json" ? result.document : result.manifest, null, 2) + "\n"
  );
  console.log(
    args.format === "lens-ts"
      ? "Wrote generated Lens Studio host:"
      : args.format === "scene-json"
        ? "Wrote SPECS scene protocol 2 document:"
        : "Wrote SPECS manifest v2:",
    output
  );
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { compile, compileManifestFile, lensTs, exitStatus, main };
