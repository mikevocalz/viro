export type DeferredRelease = {
    /** Call first thing in the mount effect. */
    cancel: () => void;
    /** Call from the mount effect's cleanup. */
    schedule: (release: () => void) => void;
};
export declare function useDeferredRelease(): DeferredRelease;
