/** Web implementation of ViroSpotLight. */
import { ViroLightType } from "@reactvision/viro-web-renderer";
import { useViroLight } from "./Web/useViroLight";
export function ViroSpotLight(props) {
    useViroLight(ViroLightType.Spot, props);
    return null;
}
