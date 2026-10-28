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
import { ViroWs4HelloLoadingScenario } from "./ViroWs4HelloLoadingScenario";
import { ViroWs4HelloReadyScenario } from "./ViroWs4HelloReadyScenario";
import { ViroWs4HelloErrorScenario } from "./ViroWs4HelloErrorScenario";
import { ViroWs4HelloDegradedScenario } from "./ViroWs4HelloDegradedScenario";
import { ViroWs4PlacementTableScenario } from "./ViroWs4PlacementTableScenario";
import { ViroWs4PlacementCancelScenario } from "./ViroWs4PlacementCancelScenario";
import { ViroWs4PlacementDegradedScenario } from "./ViroWs4PlacementDegradedScenario";
import { ViroWs4PlacementErrorScenario } from "./ViroWs4PlacementErrorScenario";
import { ViroWs4ButtonStatesScenario } from "./ViroWs4ButtonStatesScenario";
import { ViroWs4MoveBandScenario } from "./ViroWs4MoveBandScenario";
import { ViroWs4GazeScenario } from "./ViroWs4GazeScenario";
import { ViroWs4NavigationScrollScenario } from "./ViroWs4NavigationScrollScenario";
import { ViroWs4NavigationImageErrorScenario } from "./ViroWs4NavigationImageErrorScenario";
import { ViroWs4SceneRejectionScenario } from "./ViroWs4SceneRejectionScenario";
import { ViroWs4PreferencesScenario } from "./ViroWs4PreferencesScenario";
import { WS4_PARAMETERS } from "./ViroLabExperienceSupport";

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
    // WS4 experience layer on the gallery scenes (ExperienceHost).
    { id: "viro_ws4_hello_loading", typename: ViroWs4HelloLoadingScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_hello_ready", typename: ViroWs4HelloReadyScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_hello_error", typename: ViroWs4HelloErrorScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_hello_degraded", typename: ViroWs4HelloDegradedScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_placement_table", typename: ViroWs4PlacementTableScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_placement_cancel", typename: ViroWs4PlacementCancelScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_placement_degraded", typename: ViroWs4PlacementDegradedScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_placement_error", typename: ViroWs4PlacementErrorScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_button_states", typename: ViroWs4ButtonStatesScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_move_band", typename: ViroWs4MoveBandScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_gaze", typename: ViroWs4GazeScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_navigation_scroll", typename: ViroWs4NavigationScrollScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_navigation_image_error", typename: ViroWs4NavigationImageErrorScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_scene_rejection", typename: ViroWs4SceneRejectionScenario.getTypeName(), parameters: WS4_PARAMETERS },
    { id: "viro_ws4_preferences", typename: ViroWs4PreferencesScenario.getTypeName(), parameters: WS4_PARAMETERS },
  ];
}
