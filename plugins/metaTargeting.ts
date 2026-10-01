export type MetaVrGlassesAndroidOptions = {
  metaVrGlassesCompatible?: boolean;
  metaDefaultDeviceTargets?: string;
};

export function resolveMetaDefaultDeviceTargets(
  options?: MetaVrGlassesAndroidOptions
): string | undefined {
  return (
    options?.metaDefaultDeviceTargets ??
    (options?.metaVrGlassesCompatible ? "quest3+" : undefined)
  );
}

export function assertMetaVrGlassesXrMode(
  xrModes: readonly string[],
  options?: MetaVrGlassesAndroidOptions
): void {
  if (options?.metaVrGlassesCompatible && !xrModes.includes("QUEST")) {
    throw new Error(
      '[Viro] android.metaVrGlassesCompatible requires android.xRMode to include "QUEST" ' +
        '(the existing Meta Horizon/OpenXR build path).'
    );
  }
}
