/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroReplicatedState
 */
"use strict";
import { useEffect, useMemo, useRef, useState } from "react";
import { ViroReplicationClient, } from "../AR/ViroReplication";
/**
 * Replicated room state, ordered and conflict-resolved by the server.
 *
 * ```tsx
 * const { entities, claim, set, isMine } = useViroReplicatedState({
 *   roomId: cloudAnchorId, apiKey, projectId,
 *   enabled: frameReady,
 * });
 *
 * // Grab it, then move it — while held, nobody else can.
 * claim('cube');
 * if (isMine('cube')) set('cube', { position: [0, 0, -1] }, { optimistic: true });
 * ```
 *
 * Positions stored here are **location-frame** coordinates, same as the
 * channel: world coordinates are per-session and mean nothing to a peer.
 */
export function useViroReplicatedState(options) {
    const { roomId, apiKey, projectId, endpoint, headers, enabled = true, onReject, } = options;
    const client = useMemo(() => new ViroReplicationClient(), []);
    const [, force] = useState(0);
    // Kept in a ref so changing the handler does not tear down the connection.
    const rejectRef = useRef(onReject);
    rejectRef.current = onReject;
    // Same for the header provider, which the client calls again on every
    // reconnect anyway.
    const headersRef = useRef(headers);
    headersRef.current = headers;
    const hasHeaders = headers !== undefined;
    useEffect(() => {
        client.onReject = (r) => rejectRef.current?.(r);
        const unsubscribe = client.subscribe(() => force((n) => n + 1));
        if (enabled && roomId) {
            client.connect({
                roomId,
                apiKey,
                projectId,
                endpoint,
                headers: hasHeaders ? () => headersRef.current?.() ?? {} : undefined,
            });
        }
        return () => {
            unsubscribe();
            client.onReject = undefined;
            client.disconnect();
        };
    }, [client, roomId, apiKey, projectId, endpoint, hasHeaders, enabled]);
    return {
        state: client.state,
        localPeerId: client.localPeerId,
        entities: client.getEntities(),
        byId: (id) => client.get(id),
        error: client.error,
        claim: (id, opts) => client.claim(id, opts),
        release: (id) => client.release(id),
        set: (id, fields, opts) => client.set(id, fields, opts),
        remove: (id, opts) => client.delete(id, opts),
        clear: () => client.clear(),
        isMine: (id) => {
            const e = client.get(id);
            return !!e && e.owner !== null && e.owner === client.localPeerId;
        },
    };
}
