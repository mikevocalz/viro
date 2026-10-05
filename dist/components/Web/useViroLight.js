/**
 * Lifecycle hook for web light components. A light is a VROLight (not a node):
 * it's created via the C API, added to the enclosing node, updated as props
 * change, and removed on unmount.
 */
import { useState, useEffect } from "react";
import { useViroScene, useViroParentNode } from "./ViroWebContext";
import { parseColorToRGBA } from "./viroColor";
import { useDeferredRelease } from "./useDeferredRelease";
export function useViroLight(type, props) {
    const scene = useViroScene();
    const parent = useViroParentNode();
    const [light] = useState(() => scene.createLight(type));
    // Deferred destroy: StrictMode's remount re-adds this same handle.
    const lightRelease = useDeferredRelease();
    useEffect(() => {
        lightRelease.cancel();
        scene.addLightToNode(parent, light);
        return () => {
            scene.removeLightFromNode(parent, light);
            lightRelease.schedule(() => scene.destroyLight(light));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const { color, intensity, temperature, direction, position, attenuationStartDistance, attenuationEndDistance, innerAngle, outerAngle, castsShadow, influenceBitMask, shadowOpacity, shadowMapSize, shadowBias, shadowNearZ, shadowFarZ, shadowOrthographicSize, } = props;
    const dirKey = direction ? direction.join(",") : "";
    const posKey = position ? position.join(",") : "";
    useEffect(() => {
        if (color !== undefined) {
            const [r, g, b] = parseColorToRGBA(color);
            scene.setLightColor(light, r, g, b);
        }
        if (intensity !== undefined)
            scene.setLightIntensity(light, intensity);
        if (temperature !== undefined)
            scene.setLightTemperature(light, temperature);
        if (direction)
            scene.setLightDirection(light, direction[0], direction[1], direction[2]);
        if (position)
            scene.setLightPosition(light, position[0], position[1], position[2]);
        if (attenuationStartDistance !== undefined && attenuationEndDistance !== undefined) {
            scene.setLightAttenuation(light, attenuationStartDistance, attenuationEndDistance);
        }
        if (innerAngle !== undefined && outerAngle !== undefined) {
            scene.setLightSpotAngles(light, innerAngle, outerAngle);
        }
        if (castsShadow !== undefined)
            scene.setLightCastsShadow(light, castsShadow);
        if (influenceBitMask !== undefined)
            scene.setLightInfluenceBitMask(light, influenceBitMask);
        // Each left alone when absent, so an unset knob keeps VROLight's own default
        // rather than one this hook invented.
        if (shadowOpacity !== undefined)
            scene.setLightShadowOpacity(light, shadowOpacity);
        if (shadowMapSize !== undefined)
            scene.setLightShadowMapSize(light, shadowMapSize);
        if (shadowBias !== undefined)
            scene.setLightShadowBias(light, shadowBias);
        if (shadowNearZ !== undefined)
            scene.setLightShadowNearZ(light, shadowNearZ);
        if (shadowFarZ !== undefined)
            scene.setLightShadowFarZ(light, shadowFarZ);
        if (shadowOrthographicSize !== undefined) {
            scene.setLightShadowOrthographicSize(light, shadowOrthographicSize);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        light,
        color,
        intensity,
        temperature,
        dirKey,
        posKey,
        attenuationStartDistance,
        attenuationEndDistance,
        innerAngle,
        outerAngle,
        castsShadow,
        influenceBitMask,
        shadowOpacity,
        shadowMapSize,
        shadowBias,
        shadowNearZ,
        shadowFarZ,
        shadowOrthographicSize,
    ]);
    return light;
}
