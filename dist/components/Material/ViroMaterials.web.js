/**
 * Web implementation of ViroMaterials. Instead of pushing material definitions
 * to the native VRTMaterialManager, it stores them in the web material registry,
 * where node components resolve them by name and build materials via the C API.
 *
 * Supports diffuseColor, lightingModel, scalar properties, PBR textures,
 * shaderModifiers, updateShaderUniform, and deleteMaterials (parsed/dispatched
 * the same way as MaterialManager.java's native bridge — see
 * viroMaterialRegistry.ts).
 */
import { registerViroMaterials, updateMaterialShaderUniform, deleteViroMaterials } from "../Web/viroMaterialRegistry";
export class ViroMaterials {
    static createMaterials(materials) {
        registerViroMaterials(materials);
    }
    static deleteMaterials(materials) {
        deleteViroMaterials(materials);
    }
    static updateShaderUniform(materialName, uniformName, uniformType, value) {
        updateMaterialShaderUniform(materialName, uniformName, uniformType, value);
    }
}
