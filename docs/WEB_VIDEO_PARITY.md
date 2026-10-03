# Web video parity

The web video components now match the control surface expected by Viro's native video components closely enough for the premium `SpatialVideoPlayer` controller.

## Added

- imperative `seekToTime()` on flat, material/curved, and 360 video;
- `onUpdateTime(currentTime, totalTime)`;
- buffering start/end signals from HTMLMediaElement lifecycle;
- existing finish/error/mute/volume/loop/pause behavior retained;
- reusable WebGL source texture when the current WASM renderer supports it;
- byte/RGBA upload fallback for older renderer binaries.

## Premium panel impact

`@viro-external/media` already centralizes state in `SpatialVideoPlayer`. Once a web video ref is attached, replay, +/-10 second seek, posters/status and current-time display can share the same controller path as native.

## Memory/performance

The source-texture path avoids allocating a new RGBA texture every decoded frame. That reduces JS readback/allocation pressure and avoids retaining multiple transient texture buffers. Older binaries still work through the existing fallback.
