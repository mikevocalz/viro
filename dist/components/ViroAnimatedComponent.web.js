/**
 * Web implementation of ViroAnimatedComponent (deprecated). Injects its
 * `animation` into its single child via the child's `animation` prop — the
 * modern per-component animation path. Prefer setting `animation` directly on
 * the component.
 */
import * as React from "react";
export function ViroAnimatedComponent(props) {
    const child = React.Children.only(props.children);
    return React.cloneElement(child, {
        animation: {
            name: props.animation,
            run: props.run !== false,
            loop: props.loop ?? false,
            delay: props.delay,
            onStart: props.onStart,
            onFinish: props.onFinish,
        },
    });
}
