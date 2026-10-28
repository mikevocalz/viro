import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { ViroLabDeliberateFailureScenario } from "./ViroLabDeliberateFailureScenario";
import { ViroLabDragScenario } from "./ViroLabDragScenario";
import { ViroLabNavigateScenario } from "./ViroLabNavigateScenario";
import { ViroLabRenderScenario } from "./ViroLabRenderScenario";
import { ViroLabSelectScenario } from "./ViroLabSelectScenario";

/** LEAF scenarios for the generated Platform Lab host. */
@component
export class ViroLabLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    { id: "viro_lab_render", typename: ViroLabRenderScenario.getTypeName() },
    { id: "viro_lab_select", typename: ViroLabSelectScenario.getTypeName() },
    { id: "viro_lab_drag", typename: ViroLabDragScenario.getTypeName() },
    { id: "viro_lab_navigate", typename: ViroLabNavigateScenario.getTypeName() },
    { id: "viro_lab_deliberate_failure", typename: ViroLabDeliberateFailureScenario.getTypeName() },
  ];
}
