import { ViroMaterials } from "../../Material/ViroMaterials";
import { buildViroMaterialDefinition, parseMaterialConfig, studioMaterialName, } from "./materialConfig";
/**
 * Registers Viro materials for scene assets that have a valid `material_config`.
 * Call synchronously after fetching assets and before rendering AR nodes.
 */
export function registerStudioMaterialsForAssets(assets) {
    const materials = {};
    for (const asset of assets) {
        if (asset.asset_type_name !== "3D-MODEL")
            continue;
        if (asset.material_config == null)
            continue;
        const config = parseMaterialConfig(asset.material_config);
        if (!config)
            continue;
        materials[studioMaterialName(asset.id)] = buildViroMaterialDefinition(config);
    }
    if (Object.keys(materials).length === 0)
        return;
    try {
        ViroMaterials.createMaterials(materials);
    }
    catch (err) {
        console.error("[studioMaterials] ViroMaterials.createMaterials failed", err);
    }
}
