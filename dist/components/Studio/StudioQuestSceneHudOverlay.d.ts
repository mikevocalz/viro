import * as React from "react";
import { CameraPose } from "./domain/questHeadLockedTransform";
type Props = {
    /** Latest cached camera pose (throttled — see StudioARScene). Null before
     * the first onCameraTransformUpdate fires. */
    cameraPose: CameraPose | null;
    sceneName: string | null;
    /** Toggled by the Y button (StudioARScene's controller). */
    menuOpen: boolean;
    onCloseMenu: () => void;
};
/**
 * Quest has no 2D chrome: the host's is stuck in MainActivity, out of view once
 * VRActivity takes the display. This is the in-scene replacement. It is placed
 * in the room in front of the wearer when it appears and stays there, rather
 * than following the head:
 *
 * - the scene name, for a few seconds after the scene opens;
 * - a shared session's status and join code (unless the navigator's
 *   colocationIndicator is false), placed again whenever the status changes.
 *   It stays up while the session is being set up or has failed, and for a
 *   few seconds once it is live. When the host clears its colocation prop on
 *   failure, the reason shows for a few seconds and stays in the menu until
 *   the next session;
 * - the menu, which Y opens and closes: the same lines, the host's
 *   questMenuItems, and Exit. B and the left menu button exit as well.
 *
 * Closed, it sits below StudioQuestAlertOverlay's position (verticalOffsetM)
 * so an ALERT firing at the same time doesn't render on top of it; the open
 * menu is centred in view.
 */
export declare function StudioQuestSceneHudOverlay({ cameraPose, sceneName, menuOpen, onCloseMenu, }: Props): React.JSX.Element | null;
export {};
