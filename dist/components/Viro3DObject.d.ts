import * as React from "react";
import { ImageSourcePropType, NativeSyntheticEvent } from "react-native";
import { ViroErrorEvent, ViroLoadEndEvent, ViroLoadStartEvent } from "./Types/ViroEvents";
import { ViroBase } from "./ViroBase";
type Props = {
    type: "OBJ" | "VRX" | "GLTF" | "GLB";
    /**
     * The model file, which is required
     */
    source: ImageSourcePropType;
    /**
     * Additional resource files for various model formats
     */
    resources?: ImageSourcePropType[];
    /**
     * Sets morph target weights for GLB/GLTF models that contain morph targets (blend shapes).
     * Each entry pairs a target name (as exported from the model) with a blend weight in [0, 1].
     *
     * Example:
     *   morphTargets={[{ target: "Smile", weight: 0.8 }, { target: "Blink", weight: 1.0 }]}
     *
     * Use getMorphTargets() to discover the available target names at runtime.
     */
    morphTargets?: Array<{
        target?: string;
        weight?: number;
    }>;
    onLoadStart?: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    onLoadEnd?: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    onError?: (event: NativeSyntheticEvent<ViroErrorEvent>) => void;
};
/**
 * Viro3DObject is a component that is used to render 3D models in the scene.
 */
export declare class Viro3DObject extends ViroBase<Props> {
    render(): React.JSX.Element;
    _onLoadStart: (event: NativeSyntheticEvent<ViroLoadStartEvent>) => void;
    _onLoadEnd: (event: NativeSyntheticEvent<ViroLoadEndEvent>) => void;
    getBoundingBoxAsync: () => Promise<any>;
    getMorphTargets: () => Promise<any>;
    /**
     * Set several morph target weights in one native call. Positionally paired
     * arrays, fire-and-forget — built for driving a face at frame rate without a
     * React render or a Promise per frame.
     */
    setMorphTargetWeights: (names: string[], weights: number[]) => void;
    /**
     * The model's skeleton bone names, in skeleton order. Resolves to
     * `{ bones: string[] }`; empty for an unskinned model. Android only today.
     */
    getSkeletonBoneKeys: () => Promise<{
        bones: string[];
    }>;
    /**
     * The named bones' current world transforms, as `{ matrices: number[] }` —
     * 16 column-major floats per bone in request order. For a model that has not
     * been animated these are the rest poses: read them once, compose deltas
     * against them, and drive with setSkeletonBoneTransforms.
     */
    getSkeletonBoneTransforms: (names: string[]) => Promise<{
        matrices: number[];
    }>;
    /**
     * Set bone world transforms — 16 column-major floats per name — in one native
     * call. `recurse` carries each bone's descendants along with it, which is what
     * a procedural head turn or breath wants. Fire-and-forget, frame-rate safe.
     */
    setSkeletonBoneTransforms: (names: string[], matrices: number[], recurse: boolean) => void;
}
export {};
