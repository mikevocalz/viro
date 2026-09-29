import type { Viro3DPoint } from "../Types/ViroUtils";
/** Quest and PICO share VRActivity, including its live native view tag. */
export declare function createXRNavigatorProxy(): {
    push: (scene: any) => void;
    replace: (scene: any) => void;
    jump: (scene: any) => void;
    pop: () => void;
    popN: (n: number) => void;
    recenterTracking: () => void;
    project: (point: Viro3DPoint) => Promise<Viro3DPoint>;
    unproject: (point: Viro3DPoint) => Promise<Viro3DPoint>;
};
