/**
 * Release a renderer handle on unmount, unless the same component mounts again
 * right away.
 *
 * Node, light and portal-frame handles are created once per component (in a
 * useState initializer) and attached in a mount effect. React StrictMode runs
 * that effect's cleanup and then the effect again on the same component
 * instance, so destroying the handle in the cleanup left the second run
 * attaching a freed handle: the scene graph kept an id the renderer no longer
 * drew. The cleanup schedules the destroy instead, and the effect cancels
 * whatever is pending when it runs.
 */
import { useRef } from "react";
export function useDeferredRelease() {
    const ref = useRef(null);
    if (ref.current === null) {
        let timer = null;
        ref.current = {
            cancel: () => {
                if (timer !== null) {
                    clearTimeout(timer);
                    timer = null;
                }
            },
            schedule: (release) => {
                if (timer !== null)
                    clearTimeout(timer);
                timer = setTimeout(() => {
                    timer = null;
                    release();
                }, 0);
            },
        };
    }
    return ref.current;
}
