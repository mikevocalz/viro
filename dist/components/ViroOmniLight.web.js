/** Web implementation of ViroOmniLight. */
import { ViroLightType } from "@reactvision/viro-web-renderer";
import { useViroLight } from "./Web/useViroLight";
export function ViroOmniLight(props) {
    useViroLight(ViroLightType.Omni, props);
    return null;
}
