/**
 * Shared lifecycle hook for web node components. Creates a native node (and
 * optional geometry) via the C API, parents it under the enclosing node, applies
 * transform/material props, and tears down on unmount.
 *
 * The node handle is created in a lazy useState initializer so it exists on the
 * first render — children read it from context and parent themselves correctly
 * even though React runs child effects before parent effects.
 */
import { useState, useEffect, useRef } from "react";
import { ViroBillboardAxis, ViroEventAction, ViroClickState, } from "@reactvision/viro-web-renderer";
import { useViroScene, useViroParentNode, useViroRenderer } from "./ViroWebContext";
import { useDeferredRelease } from "./useDeferredRelease";
import { createMaterialFromRegistry } from "./viroMaterialRegistry";
import { useViroAnimation } from "./useViroAnimation";
import { applyPhysicsBody } from "./viroPhysicsBody";
import { configureWebDrag, installExtendedWebInput, warnIfWebInputUnavailable, } from "./viroExtendedInput";
const DEG2RAD = Math.PI / 180;
/**
 * The billboard axis a `transformBehaviors` list asks for, or null for none.
 *
 * The three names native recognises and no more: its bridges compare against
 * "billboard", "billboardX" and "billboardY" and ignore anything else, so a
 * "billboardZ" invented here would work in a browser and nowhere else.
 *
 * Last one wins, because a node carries one constraint.
 */
function billboardAxis(behaviors) {
    let axis = null;
    for (const raw of behaviors.split(",")) {
        switch (raw.trim().toLowerCase()) {
            case "billboard":
                axis = ViroBillboardAxis.All;
                break;
            case "billboardx":
                axis = ViroBillboardAxis.X;
                break;
            case "billboardy":
                axis = ViroBillboardAxis.Y;
                break;
        }
    }
    return axis;
}
export function useViroNode(props, createGeometry, 
// False until a loaded model's subtree exists. Gates the two things that need
// it: its embedded animations, and the shader-override merge. A node whose
// geometry this hook builds is ready on mount, hence the default.
contentReady = true, 
// When provided, the geometry is rebuilt whenever this key changes (e.g. text
// re-shapes). Omit for static geometry (box/sphere/surface) — built once.
geometryKey, 
// Factory for the underlying node (default `createNode`). Override for special
// node types, e.g. portal scenes (`createPortalScene`).
createNodeFn) {
    const scene = useViroScene();
    const renderer = useViroRenderer();
    const parent = useViroParentNode();
    const [node] = useState(() => createNodeFn ? createNodeFn(scene) : scene.createNode());
    const geometryRef = useRef(0);
    // Read from a ref wherever an effect must not re-run when a callback's
    // identity changes; declared here because the mount effect already needs it.
    const propsRef = useRef(props);
    propsRef.current = props;
    // Node lifecycle: attach to parent on mount; destroy node on unmount. The
    // destroy is deferred so StrictMode's remount re-attaches a live handle.
    const nodeRelease = useDeferredRelease();
    useEffect(() => {
        nodeRelease.cancel();
        scene.addChildNode(parent, node);
        propsRef.current.onNodeHandle?.(node);
        return () => {
            // Handed back before the handle is destroyed: a holder that reads it
            // afterwards is asking the renderer about freed memory.
            propsRef.current.onNodeHandle?.(0);
            scene.removeNodeFromParent(node);
            nodeRelease.schedule(() => scene.destroyNode(node));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Geometry lifecycle: (re)built on mount and whenever geometryKey changes.
    useEffect(() => {
        if (!createGeometry)
            return;
        const geo = createGeometry(scene);
        geometryRef.current = geo;
        scene.setNodeGeometry(node, geo);
        return () => {
            if (geometryRef.current === geo)
                geometryRef.current = 0;
            scene.destroyGeometry(geo);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geometryKey]);
    // Transform + visibility props.
    const [px, py, pz] = props.position ?? [0, 0, 0];
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = props.scale ?? [1, 1, 1];
    const opacity = props.opacity ?? 1;
    const visible = props.visible ?? true;
    useEffect(() => {
        scene.setNodePosition(node, px, py, pz);
        scene.setNodeRotation(node, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
        scene.setNodeScale(node, sx, sy, sz);
        scene.setNodeOpacity(node, opacity);
        scene.setNodeVisible(node, visible);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, px, py, pz, rx, ry, rz, sx, sy, sz, opacity, visible]);
    // Events: register handlers once, reading the latest props off the ref above,
    // so a changed callback identity does not re-subscribe.
    const hasClick = !!(props.onClick || props.onClickState);
    const hasHover = !!props.onHover;
    const hasScroll = !!props.onScroll;
    const hasDrag = !!props.onDrag && props.dragType !== "Gizmo";
    const hasPinch = !!props.onPinch;
    useEffect(() => {
        if (!hasClick && !hasHover && !hasScroll && !hasDrag && !hasPinch)
            return;
        installExtendedWebInput(renderer);
        const wanted = [];
        if (hasDrag)
            wanted.push("drag");
        if (hasPinch)
            wanted.push("pinch");
        if (hasScroll)
            wanted.push("scroll");
        warnIfWebInputUnavailable(renderer, wanted);
        renderer.setNodeEventHandlers(node, {
            onClick: (clickState, source, position) => {
                const p = propsRef.current;
                p.onClickState?.(clickState, position, source);
                if (clickState === ViroClickState.Clicked) {
                    p.onClick?.(position, source);
                }
            },
            onHover: (isHovering, source, position) => {
                propsRef.current.onHover?.(isHovering, position, source);
            },
            onScroll: (source, delta) => {
                propsRef.current.onScroll?.(delta, source);
            },
            onDrag: (source, position) => {
                propsRef.current.onDrag?.(position, source);
            },
            onPinch: (source, scaleFactor, pinchState) => {
                propsRef.current.onPinch?.(pinchState, scaleFactor, source);
            },
        });
        if (hasClick)
            scene.setNodeEventEnabled(node, ViroEventAction.Click, true);
        if (hasHover)
            scene.setNodeEventEnabled(node, ViroEventAction.Hover, true);
        if (hasScroll)
            scene.setNodeEventEnabled(node, 7, true);
        if (hasDrag)
            scene.setNodeEventEnabled(node, 8, true);
        if (hasPinch)
            scene.setNodeEventEnabled(node, 10, true);
        return () => renderer.clearNodeEventHandlers(node);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, hasClick, hasHover, hasScroll, hasDrag, hasPinch, renderer, scene]);
    // Drag config is applied on its own so a changed dragType or dragPlane
    // reaches the native solver; the handler effect above only reruns when a
    // handler is added or removed. The plane is keyed by value because callers
    // usually pass a fresh object literal each render.
    const dragType = props.dragType;
    const dragPlaneKey = props.dragPlane ? JSON.stringify(props.dragPlane) : "";
    useEffect(() => {
        if (!hasDrag)
            return;
        configureWebDrag(renderer, node, {
            dragType,
            dragPlane: propsRef.current.dragPlane,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, hasDrag, renderer, dragType, dragPlaneKey]);
    // Materials (first material applied to the geometry; MVP scope).
    const materialsKey = Array.isArray(props.materials)
        ? props.materials.join(",")
        : props.materials ?? "";
    useEffect(() => {
        const geo = geometryRef.current;
        if (!geo || !materialsKey)
            return;
        const firstName = materialsKey.split(",")[0];
        const material = createMaterialFromRegistry(scene, firstName);
        if (material) {
            scene.setGeometryMaterial(geo, material);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, materialsKey]);
    // Shader overrides. Separate from `materials` above because that one needs the
    // geometry handle this hook created, and a loaded model has none: its geometry
    // belongs to the loader and hangs off child nodes. So a Studio material_config,
    // which viroNodeFactory sends as `shaderOverrides`, only ever reaches a model
    // through here.
    //
    // Gated on `contentReady` so a model is merged after it loads rather than
    // against an empty subtree.
    const overrideKey = Array.isArray(props.shaderOverrides)
        ? props.shaderOverrides.join(",")
        : props.shaderOverrides ?? "";
    useEffect(() => {
        if (!overrideKey || !contentReady)
            return;
        // Each name re-merges from the materials the node drew before any override
        // and replaces them, so with several the last one wins. That is what the
        // native bridges do too, which is the point: the merge keeps the model's own
        // colours and textures on both surfaces.
        for (const name of overrideKey.split(",")) {
            const material = createMaterialFromRegistry(scene, name);
            if (material)
                scene.applyShaderOverride(node, material);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, overrideKey, contentReady]);
    // Rendering order, light masks and billboarding. All four are native node
    // props that had no web path at all: a scene lighting one object with one
    // light, or turning a label to face the user, did neither here.
    const renderingOrder = props.renderingOrder;
    const lightReceivingBitMask = props.lightReceivingBitMask;
    const shadowCastingBitMask = props.shadowCastingBitMask;
    useEffect(() => {
        if (renderingOrder !== undefined)
            scene.setNodeRenderingOrder(node, renderingOrder);
        // Recursive: a loaded model's geometry is on child nodes, so a mask set on
        // the handle alone would miss everything that actually draws.
        if (lightReceivingBitMask !== undefined) {
            scene.setNodeLightReceivingBitMask(node, lightReceivingBitMask, true);
        }
        if (shadowCastingBitMask !== undefined) {
            scene.setNodeShadowCastingBitMask(node, shadowCastingBitMask, true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, renderingOrder, lightReceivingBitMask, shadowCastingBitMask]);
    const behaviorsKey = Array.isArray(props.transformBehaviors)
        ? props.transformBehaviors.join(",")
        : props.transformBehaviors ?? "";
    useEffect(() => {
        scene.setNodeBillboard(node, billboardAxis(behaviorsKey));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, behaviorsKey]);
    // Physics. Keyed on the serialised body so a changed collider re-attaches and
    // an unchanged one does not: rebuilding a rigid body every render would reset
    // its velocity every frame and nothing would ever fall.
    const physicsKey = props.physicsBody ? JSON.stringify(props.physicsBody) : "";
    const viroTag = props.viroTag ?? "";
    useEffect(() => {
        applyPhysicsBody(scene, node, propsRef.current.physicsBody, viroTag);
        return () => scene.clearPhysicsBody(node);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, physicsKey, viroTag]);
    // Animation (declarative ViroAnimation or model animation).
    useViroAnimation(node, props.animation, { position: [px, py, pz], rotation: [rx, ry, rz], scale: [sx, sy, sz], opacity }, contentReady);
    return node;
}
