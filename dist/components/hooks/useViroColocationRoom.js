/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroColocationRoom
 */
"use strict";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cloudAnchorFrameSource, metaSpatialAnchorFrameSource, visionOSSharedSpaceFrameSource, } from "../AR/ViroFrameSource";
import { createColocationRoom, formatJoinCode, lookupColocationRoom, } from "../AR/ViroColocationRooms";
/**
 * Turn a frame into a room others can join, or a code into the room and the
 * frame source that goes with it.
 *
 * ```tsx
 * // The device that scanned the space
 * const host = useViroColocationRoom({ apiKey, projectId,
 *   host: { frameKind: "cloud_anchor", cloudAnchorId } });
 * // <Text>{host.displayCode}</Text>
 *
 * // Everyone else
 * const guest = useViroColocationRoom({ apiKey, projectId, joinCode: typed });
 * // <ViroSharedFrame source={guest.frameSource} ... />
 * ```
 *
 * One request, before the session starts. The frame acquisition that follows it
 * takes 12 to 30 seconds on phones, so this is not the slow part.
 */
export function useViroColocationRoom(options) {
    const { apiKey, projectId, endpoint, headers, host, joinCode, enabled = true, } = options;
    const [status, setStatus] = useState("idle");
    const [room, setRoom] = useState(null);
    const [error, setError] = useState();
    const [attempt, setAttempt] = useState(0);
    // Creating a room is not idempotent, so a re-render must never start a second
    // one. This is what an effect that can run twice needs instead of a guard on
    // the request itself.
    const inFlight = useRef(null);
    // Read when the request goes out, not a dependency: a token refresh would
    // restart the effect and drop an in-flight create's result, which the guard
    // above then never requests again. Headers first arriving do restart it.
    const headersRef = useRef(headers);
    headersRef.current = headers;
    const hasHeaders = headers !== undefined;
    const hostKey = host
        ? [
            host.frameKind,
            "cloudAnchorId" in host ? host.cloudAnchorId : "",
            "frameRef" in host ? host.frameRef : "",
        ].join("|")
        : "";
    const target = joinCode
        ? `join:${joinCode}`
        : hostKey
            ? `host:${hostKey}`
            : "";
    useEffect(() => {
        if (!enabled || !target)
            return;
        if (inFlight.current === target && status !== "failed")
            return;
        let cancelled = false;
        inFlight.current = target;
        setStatus("working");
        setError(undefined);
        const run = async () => {
            const config = {
                apiKey,
                projectId,
                endpoint,
                headers: headersRef.current,
            };
            const result = joinCode
                ? await lookupColocationRoom(config, joinCode)
                : await createColocationRoom(config, host);
            if (cancelled)
                return;
            if (!result.success) {
                setError(result.error);
                setStatus("failed");
                return;
            }
            setRoom(result.room);
            setStatus("ready");
        };
        run();
        return () => {
            cancelled = true;
        };
        // `status` is deliberately absent: it changes inside the effect, and the
        // retry path goes through `attempt` instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey, projectId, endpoint, hasHeaders, target, enabled, attempt]);
    const frameSource = useMemo(() => {
        if (!room)
            return null;
        return frameSourceFor(room, Boolean(host));
    }, [room, host]);
    const retry = useCallback(() => {
        inFlight.current = null;
        setAttempt((n) => n + 1);
    }, []);
    return {
        status,
        room,
        roomId: room?.roomId ?? null,
        displayCode: room?.joinCode ? formatJoinCode(room.joinCode) : null,
        frameSource,
        error,
        retry,
    };
}
/**
 * The room says how its devices align, so a joiner never has to be told which
 * source to use. A Meta group is the one that differs by side: the device that
 * made the room publishes the frame, everyone else recovers it.
 */
function frameSourceFor(room, isHost) {
    switch (room.frameKind) {
        case "cloud_anchor":
            return room.cloudAnchorId
                ? cloudAnchorFrameSource(room.cloudAnchorId)
                : null;
        case "meta_group":
            return room.frameRef
                ? metaSpatialAnchorFrameSource(room.frameRef, isHost ? "create" : "join")
                : null;
        case "visionos_space":
            return visionOSSharedSpaceFrameSource(room.roomId);
        default:
            // A room the relay created by saving state: it has a room id and nothing
            // that says how its devices found each other.
            return null;
    }
}
