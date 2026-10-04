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

export type DeferredRelease = {
  /** Call first thing in the mount effect. */
  cancel: () => void;
  /** Call from the mount effect's cleanup. */
  schedule: (release: () => void) => void;
};

export function useDeferredRelease(): DeferredRelease {
  const ref = useRef<DeferredRelease | null>(null);
  if (ref.current === null) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    ref.current = {
      cancel: () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      schedule: (release) => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          release();
        }, 0);
      },
    };
  }
  return ref.current;
}
