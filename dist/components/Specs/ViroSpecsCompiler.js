"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileViroSpecsChildren = compileViroSpecsChildren;
exports.dispatchViroSpecsInteraction = dispatchViroSpecsInteraction;
exports.dispatchViroSpecsAnimationEvent = dispatchViroSpecsAnimationEvent;
const React = __importStar(require("react"));
const ViroAnimations_1 = require("../Animation/ViroAnimations");
const Viro3DObject_1 = require("../Viro3DObject");
const ViroImage_1 = require("../ViroImage");
const ViroNode_1 = require("../ViroNode");
const ViroPolyline_1 = require("../ViroPolyline");
const ViroText_1 = require("../ViroText");
const IDENTITY = {
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
};
function degreesToQuaternion(rotation) {
    if (!rotation || rotation.length < 3)
        return undefined;
    const [x, y, z] = rotation.map((value) => (value * Math.PI) / 180);
    const cx = Math.cos(x / 2);
    const sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2);
    const sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2);
    const sz = Math.sin(z / 2);
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
function composeTransform(parent, props) {
    const localPosition = props.position ?? [0, 0, 0];
    const localScale = props.scale ?? [1, 1, 1];
    const localRotation = degreesToQuaternion(props.rotation) ?? [0, 0, 0, 1];
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
function nodeKind(type) {
    if (type === ViroNode_1.ViroNode)
        return "group";
    if (type === ViroText_1.ViroText)
        return "text";
    if (type === ViroImage_1.ViroImage)
        return "image";
    if (type === Viro3DObject_1.Viro3DObject)
        return "model";
    if (type === ViroPolyline_1.ViroPolyline)
        return "polyline";
    return null;
}
function defaultSourceResolver(source) {
    if (typeof source === "string")
        return source;
    if (typeof source === "number")
        return "react-native-asset:" + source;
    if (source &&
        typeof source === "object" &&
        "uri" in source &&
        typeof source.uri === "string") {
        return source.uri;
    }
    throw new Error("Specs source needs a stable string ID. Pass sourceResolver to ViroSpecsScene for bundled assets.");
}
function resolveRelative(value, base) {
    if (typeof value === "number")
        return value;
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
    return Number.isFinite(absolute) ? absolute : null;
}
function animationBase(property, props) {
    const position = (props.position ?? [0, 0, 0]);
    const scale = (props.scale ?? [1, 1, 1]);
    const rotation = (props.rotation ?? [0, 0, 0]);
    switch (property) {
        case "positionX":
            return position[0];
        case "positionY":
            return position[1];
        case "positionZ":
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
            return props.opacity ?? 1;
        default:
            return 0;
    }
}
function compileViroSpecsChildren(children, sourceResolver = defaultSourceResolver) {
    const nodes = [];
    const polylines = [];
    const animations = [];
    const callbacks = new Map();
    const diagnostics = [];
    let ordinal = 0;
    const visit = (child, parentId, parentTransform = IDENTITY) => {
        if (!React.isValidElement(child))
            return;
        const kind = nodeKind(child.type);
        if (!kind) {
            diagnostics.push("Unsupported Specs JSX child " +
                (typeof child.type === "string"
                    ? child.type
                    : child.type.name ?? "anonymous"));
            return;
        }
        const props = child.props;
        const id = props.viroTag ??
            (child.key != null ? String(child.key) : "viro-specs-" + ordinal++);
        const worldTransform = composeTransform(parentTransform, props);
        const callbackRecord = {};
        if (props.onHover)
            callbackRecord.onHover = props.onHover;
        if (props.onClick)
            callbackRecord.onClick = props.onClick;
        if (props.onDrag)
            callbackRecord.onDrag = props.onDrag;
        if (props.animation?.onStart) {
            callbackRecord.onAnimationStart = props.animation.onStart;
        }
        if (props.animation?.onFinish) {
            callbackRecord.onAnimationFinish = props.animation.onFinish;
        }
        if (Object.keys(callbackRecord).length)
            callbacks.set(id, callbackRecord);
        if (kind === "polyline") {
            const points = (props.points ?? []);
            polylines.push({
                id,
                points: points.map((point) => transformPoint(worldTransform, point)),
                radiusMeters: ((props.thickness ?? 0.01) / 2) *
                    Math.max(Math.abs(worldTransform.scale[0]), Math.abs(worldTransform.scale[1]), Math.abs(worldTransform.scale[2])),
                materialId: typeof props.materials === "string"
                    ? props.materials
                    : Array.isArray(props.materials)
                        ? props.materials[0]
                        : undefined,
            });
            return;
        }
        const node = {
            id,
            kind,
            ...(parentId ? { parentId } : {}),
            ...(props.position ? { position: props.position } : {}),
            ...(props.rotation
                ? { rotation: degreesToQuaternion(props.rotation) }
                : {}),
            ...(props.scale ? { scale: props.scale } : {}),
            ...(props.visible !== undefined ? { visible: props.visible } : {}),
        };
        if (kind === "text")
            node.text = props.text;
        if (kind === "image" && props.source !== undefined) {
            node.source = sourceResolver(props.source, "image");
        }
        if (kind === "model" && props.source !== undefined) {
            node.source = sourceResolver(props.source, "model");
        }
        nodes.push(node);
        if (props.animation?.name) {
            const animationName = String(props.animation.name);
            if (props.animation.run === false) {
                animations.push({
                    action: "stop",
                    nodeId: id,
                    name: animationName,
                });
            }
            else if (props.animation.run === true) {
                const registered = ViroAnimations_1.ViroAnimations.getRegisteredAnimation(animationName);
                if (!registered || Array.isArray(registered)) {
                    diagnostics.push("Specs animation " +
                        animationName +
                        " is missing or is an animation chain.");
                }
                else {
                    const resolvedProperties = {};
                    for (const [property, value] of Object.entries(registered.properties ?? {})) {
                        if (![
                            "positionX",
                            "positionY",
                            "positionZ",
                            "scaleX",
                            "scaleY",
                            "scaleZ",
                            "rotateX",
                            "rotateY",
                            "rotateZ",
                            "opacity",
                        ].includes(property)) {
                            if (value !== undefined) {
                                diagnostics.push("Specs animation " +
                                    animationName +
                                    " does not support property " +
                                    property +
                                    ".");
                            }
                            continue;
                        }
                        if (typeof value !== "number" && typeof value !== "string") {
                            continue;
                        }
                        const resolved = resolveRelative(value, animationBase(property, props));
                        if (resolved === null) {
                            diagnostics.push("Specs animation " +
                                animationName +
                                " could not resolve " +
                                property +
                                "=" +
                                String(value) +
                                ".");
                            continue;
                        }
                        resolvedProperties[property] = resolved;
                    }
                    if (Object.keys(resolvedProperties).length) {
                        animations.push({
                            action: "play",
                            nodeId: id,
                            name: animationName,
                            definition: {
                                properties: resolvedProperties,
                                durationMs: registered.duration,
                                delayMs: (registered.delay ?? 0) + (props.animation.delay ?? 0),
                                easing: registered.easing,
                                loop: Boolean(props.animation.loop),
                                completionEvent: "viro-animation-complete:" + id + ":" + animationName,
                            },
                        });
                    }
                }
            }
        }
        if (props.children) {
            React.Children.forEach(props.children, (nested) => visit(nested, id, worldTransform));
        }
    };
    React.Children.forEach(children, (child) => visit(child));
    return {
        scene: { version: 1, nodes },
        polylines,
        animations,
        callbacks,
        diagnostics,
    };
}
function dispatchViroSpecsInteraction(event, callbacks) {
    if (!event.targetId)
        return;
    const record = callbacks.get(event.targetId);
    if (!record)
        return;
    const position = event.position ?? [0, 0, 0];
    const source = 0;
    switch (event.phase) {
        case "hover-enter":
            record.onHover?.(true, position, source);
            break;
        case "hover-exit":
            record.onHover?.(false, position, source);
            break;
        case "select-end":
            record.onClick?.(position, source);
            break;
        case "drag":
            record.onDrag?.(position, source);
            break;
    }
}
function dispatchViroSpecsAnimationEvent(event, callbacks) {
    const record = callbacks.get(event.nodeId);
    if (!record)
        return;
    if (event.phase === "start") {
        record.onAnimationStart?.();
    }
    else {
        record.onAnimationFinish?.();
    }
}
