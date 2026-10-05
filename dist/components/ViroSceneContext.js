import * as React from "react";
export const ViroSceneContext = React.createContext({
    cameraDidMount: (camera) => {
        console.log("ViroSceneContext.cameraDidMount: " + camera);
    },
    cameraWillUnmount: (camera) => {
        console.log("ViroSceneContext.cameraWillUnmount: " + camera);
    },
    cameraDidUpdate: (camera, active) => {
        console.log("ViroSceneContext.cameraDidUpdate: " + camera + " active: " + active);
    },
});
