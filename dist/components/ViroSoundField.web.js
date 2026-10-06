/**
 * Web implementation of ViroSoundField — ambient/background audio. Native uses
 * ambisonic playback; on web it plays as non-positional stereo audio (same as
 * ViroSound). `rotation` (ambisonic orientation) has no web equivalent yet.
 */
import { ViroSound } from "./ViroSound.web";
export function ViroSoundField(props) {
    return ViroSound(props);
}
