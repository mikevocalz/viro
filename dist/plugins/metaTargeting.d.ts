export type MetaVrGlassesAndroidOptions = {
    metaVrGlassesCompatible?: boolean;
    metaDefaultDeviceTargets?: string;
};
export declare function resolveMetaDefaultDeviceTargets(options?: MetaVrGlassesAndroidOptions): string | undefined;
export declare function assertMetaVrGlassesXrMode(xrModes: readonly string[], options?: MetaVrGlassesAndroidOptions): void;
