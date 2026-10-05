/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroARCloudAnchor
 */
"use strict";
import * as React from "react";
import { cloudAnchorFrameSource } from "./ViroFrameSource";
import { ViroSharedFrame } from "./ViroSharedFrame";
/**
 * Renders its children in a resolved cloud anchor's location frame.
 *
 * Two devices that mount this with the same `cloudAnchorId` in the same
 * physical space put their children in the same real-world place, because both
 * frames are recovered from the same hosted map. A child at `[0, 0, -1]` is one
 * metre in front of the frame origin on every device — no coordinate maths in
 * app code.
 *
 * ```tsx
 * <ViroARCloudAnchor
 *   cloudAnchorId={id}
 *   arSceneNavigator={props.arSceneNavigator}
 *   onLocalized={(e) => setFrame(e.transform)}
 * >
 *   <ViroBox position={[0, 0, -1]} scale={[0.2, 0.2, 0.2]} />
 * </ViroARCloudAnchor>
 * ```
 *
 * This is `<ViroSharedFrame>` with the cloud-anchor source pre-selected. On a
 * headset, use the platform's own source instead — cloud anchors are
 * unsupported there and this reports `ErrorNotSupported` rather than failing
 * slowly. See `ViroFrameSource`.
 */
export class ViroARCloudAnchor extends React.Component {
    // Rebuilt only when the id changes: the source is compared by `key`, so a new
    // object every render would restart acquisition on each parent update.
    _source = cloudAnchorFrameSource(this.props.cloudAnchorId);
    _sourceId = this.props.cloudAnchorId;
    get source() {
        if (this._sourceId !== this.props.cloudAnchorId) {
            this._sourceId = this.props.cloudAnchorId;
            this._source = cloudAnchorFrameSource(this.props.cloudAnchorId);
        }
        return this._source;
    }
    render() {
        return (<ViroSharedFrame source={this.source} arSceneNavigator={this.props.arSceneNavigator} onLocalized={this.props.onLocalized} onLocalizeError={this.props.onLocalizeError} placeholder={this.props.placeholder}>
        {this.props.children}
      </ViroSharedFrame>);
    }
}
