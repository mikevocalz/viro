/** Web implementation of ViroDirectionalLight. */
import { ViroLightType } from "@reactvision/viro-web-renderer";
import { useViroLight } from "./Web/useViroLight";
export function ViroDirectionalLight(props) {
    useViroLight(ViroLightType.Directional, props);
    return null;
}
