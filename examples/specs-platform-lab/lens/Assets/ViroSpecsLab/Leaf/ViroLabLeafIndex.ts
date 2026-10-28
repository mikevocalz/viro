import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { ViroLabMissingAssetScenario } from "./ViroLabMissingAssetScenario";
import { ViroLabStateUpdateScenario } from "./ViroLabStateUpdateScenario";
import { ViroLabSceneReplacementScenario } from "./ViroLabSceneReplacementScenario";
import { ViroLabInteractionPhasesScenario } from "./ViroLabInteractionPhasesScenario";
import { ViroLabScrollWindowScenario } from "./ViroLabScrollWindowScenario";
import { ViroLabDeliberateFailureScenario } from "./ViroLabDeliberateFailureScenario";
import { ViroLabActionsNavigationDropScenario } from "./ViroLabActionsNavigationDropScenario";
import { ViroLabActionsReferenceFlowScenario } from "./ViroLabActionsReferenceFlowScenario";
import { ViroLabActionsUnknownActionScenario } from "./ViroLabActionsUnknownActionScenario";
import { ViroLabDragScenario } from "./ViroLabDragScenario";
import { ViroLabNavigateScenario } from "./ViroLabNavigateScenario";
import { ViroLabRenderScenario } from "./ViroLabRenderScenario";
import { ViroLabSelectIKScenario } from "./ViroLabSelectIKScenario";
import { ViroLabSelectScenario } from "./ViroLabSelectScenario";

/** LEAF scenarios for the generated Platform Lab host. */
@component
export class ViroLabLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    { id: "viro_lab_render", typename: ViroLabRenderScenario.getTypeName() },
    { id: "viro_lab_select", typename: ViroLabSelectScenario.getTypeName() },
    { id: "viro_lab_select_ik", typename: ViroLabSelectIKScenario.getTypeName() },
    { id: "viro_lab_drag", typename: ViroLabDragScenario.getTypeName() },
    { id: "viro_lab_navigate", typename: ViroLabNavigateScenario.getTypeName() },
    { id: "viro_lab_missing_asset", typename: ViroLabMissingAssetScenario.getTypeName() },
    { id: "viro_lab_state_update", typename: ViroLabStateUpdateScenario.getTypeName() },
    { id: "viro_lab_scene_replacement", typename: ViroLabSceneReplacementScenario.getTypeName() },
    { id: "viro_lab_interaction_phases", typename: ViroLabInteractionPhasesScenario.getTypeName() },
    { id: "viro_lab_scroll_window", typename: ViroLabScrollWindowScenario.getTypeName() },
    { id: "viro_lab_actions_reference_flow", typename: ViroLabActionsReferenceFlowScenario.getTypeName() },
    { id: "viro_lab_actions_navigation_drop", typename: ViroLabActionsNavigationDropScenario.getTypeName() },
    { id: "viro_lab_actions_unknown_action", typename: ViroLabActionsUnknownActionScenario.getTypeName() },
    { id: "viro_lab_deliberate_failure", typename: ViroLabDeliberateFailureScenario.getTypeName() },
  ];
}
