import { NativeModules } from "react-native";
// RCT_EXPORT_MODULE() in newer RN (0.76+) keeps the "Module" suffix in NativeModules.
const native = (NativeModules.VRTStreamingAudioModule ?? NativeModules.VRTStreamingAudio);
function noop(..._args) { }
/**
 * StreamingAudioManager — imperative API for streaming PCM audio.
 *
 * Typical TTS flow:
 *   StreamingAudioManager.create('tts');
 *   StreamingAudioManager.beginStreaming('tts', 24000, 1);
 *   StreamingAudioManager.play('tts');
 *   // on each TTS audio chunk:
 *   StreamingAudioManager.pushSamples('tts', base64FloatPCM);
 *   // when done:
 *   StreamingAudioManager.destroy('tts');
 */
export const StreamingAudioManager = {
    create: native
        ? (id) => native.create(id)
        : noop,
    beginStreaming: native
        ? (id, sampleRate, channels) => native.beginStreaming(id, sampleRate, channels)
        : noop,
    play: native
        ? (id) => native.play(id)
        : noop,
    pause: native
        ? (id) => native.pause(id)
        : noop,
    setVolume: native
        ? (id, volume) => native.setVolume(id, volume)
        : noop,
    setMuted: native
        ? (id, muted) => native.setMuted(id, muted)
        : noop,
    pushSamples: native
        ? (id, base64) => native.pushSamples(id, base64)
        : noop,
    destroy: native
        ? (id) => native.destroy(id)
        : noop,
};
