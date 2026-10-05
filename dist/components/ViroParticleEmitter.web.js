import { useEffect, useRef } from "react";
import { ViroParticleSpawnShape, } from "@reactvision/viro-web-renderer";
import { useViroNode } from "./Web/useViroNode";
import { useViroScene } from "./Web/ViroWebContext";
import { loadImageRGBA, resolveImageSource } from "./Web/viroImageLoader";
import { resolveParticleAppearance, } from "./Web/viroParticleAppearance";
function shapeEnum(shape) {
    switch ((shape ?? "").toLowerCase()) {
        case "box":
            return ViroParticleSpawnShape.Box;
        case "sphere":
            return ViroParticleSpawnShape.Sphere;
        default:
            return ViroParticleSpawnShape.Point;
    }
}
const asVec3 = (a) => [a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0];
const asPair = (a, d = 0) => [a?.[0] ?? d, a?.[1] ?? a?.[0] ?? d];
/**
 * The velocity range, from either shape it can arrive in.
 *
 * `initialRange` is what ViroParticleEmitter's own API takes, so it is what
 * every scene written against the native component sends. This read only
 * `min`/`max`, so those scenes resolved to [0, 0, 0] and their particles were
 * born and died on the emitter — no warning, and the emitter itself still drew,
 * so it looked like it worked. `initialRange` wins where both are present.
 *
 * A range with one entry is a fixed velocity, not a range from zero.
 */
export function velocityRange(velocity) {
    const range = velocity?.initialRange;
    if (range && range.length > 0) {
        const min = asVec3(range[0]);
        return [min, range.length > 1 ? asVec3(range[1]) : min];
    }
    const min = asVec3(velocity?.min);
    return [min, velocity?.max ? asVec3(velocity.max) : min];
}
export function ViroParticleEmitter(props) {
    const scene = useViroScene();
    const node = useViroNode(props);
    const url = resolveImageSource(props.image?.source);
    const texRef = useRef(0);
    const propsRef = useRef(props);
    propsRef.current = props;
    // Build the emitter once the sprite texture is ready.
    useEffect(() => {
        if (!node || !url)
            return;
        let cancelled = false;
        loadImageRGBA(url)
            .then((img) => {
            if (cancelled)
                return;
            const p = propsRef.current;
            const texture = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
            texRef.current = texture;
            const sb = p.spawnBehavior ?? {};
            const [velocityMin, velocityMax] = velocityRange(p.particlePhysics?.velocity);
            scene.createParticleEmitter(node, texture, {
                particleWidth: p.image?.width ?? 0.1,
                particleHeight: p.image?.height ?? 0.1,
                maxParticles: sb.maxParticles,
                emissionRatePerSecond: asPair(sb.emissionRatePerSecond, 10),
                particleLifetime: asPair(sb.particleLifetime, 2000),
                spawnShape: shapeEnum(sb.spawnVolume?.shape),
                spawnParams: asVec3(sb.spawnVolume?.params),
                velocityMin,
                velocityMax,
            });
            // After the emitter exists: acceleration is set on a live emitter, not
            // passed to the factory that creates it.
            const accel = p.particlePhysics?.acceleration;
            if (accel) {
                const [accelMin, accelMax] = velocityRange(accel);
                scene.setParticleAcceleration(node, accelMin, accelMax);
            }
            for (const call of resolveParticleAppearance(p.particleAppearance)) {
                scene.setParticleModifier(node, call.property, call.min, call.max, call.factor, call.intervals);
            }
            scene.setParticleEmitterRun(node, p.run !== false);
        })
            .catch(() => { });
        return () => {
            cancelled = true;
            if (texRef.current) {
                scene.destroyTexture(texRef.current);
                texRef.current = 0;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, url]);
    // A changed appearance, after the emitter exists. Keyed on the serialised prop
    // because it arrives as a fresh object literal on every render.
    const appearanceKey = props.particleAppearance
        ? JSON.stringify(props.particleAppearance)
        : "";
    useEffect(() => {
        if (!node || !appearanceKey)
            return;
        for (const call of resolveParticleAppearance(propsRef.current.particleAppearance)) {
            scene.setParticleModifier(node, call.property, call.min, call.max, call.factor, call.intervals);
        }
    }, [scene, node, appearanceKey]);
    // Run/pause toggling.
    useEffect(() => {
        if (node)
            scene.setParticleEmitterRun(node, props.run !== false);
    }, [scene, node, props.run]);
    return null;
}
