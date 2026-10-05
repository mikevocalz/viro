/** Web implementation of ViroAmbientLight. */
import { ViroLightType } from "@reactvision/viro-web-renderer";
import { useViroLight } from "./Web/useViroLight";
export function ViroAmbientLight(props) {
    useViroLight(ViroLightType.Ambient, props);
    return null;
}
