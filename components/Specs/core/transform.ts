import type { ViroSpecsQuat, ViroSpecsVec3 } from "./manifest";

/**
 * World transform of an element while a compiler walks the tree: position in
 * meters, rotation as a unit quaternion `[x, y, z, w]`, unitless scale.
 *
 * Both compilers build this the same way through
 * {@linkcode composeSpecsTransform}, which is what keeps polyline points and
 * nested transforms identical between them.
 */
export interface ViroSpecsTransform {
  readonly position: ViroSpecsVec3;
  readonly rotation: ViroSpecsQuat;
  readonly scale: ViroSpecsVec3;
}

/**
 * Local transform props as authored on a Viro element. `rotation` is Euler
 * degrees, as in Viro JSX. Absent fields are identity.
 */
export interface ViroSpecsLocalTransform {
  readonly position?: ViroSpecsVec3;
  readonly rotation?: ViroSpecsVec3;
  readonly scale?: ViroSpecsVec3;
}

/** The scene root transform. */
export const VIRO_SPECS_IDENTITY_TRANSFORM: ViroSpecsTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

/** True for an array of exactly three finite numbers. */
export function isSpecsVec3(value: unknown): value is ViroSpecsVec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

/**
 * Converts Viro Euler degrees `[x, y, z]` to a unit quaternion `[x, y, z, w]`.
 *
 * The order matches ViroCore's `VROQuaternion::set(x, y, z)`: X is applied
 * first, then Y, then Z (three.js Euler order `"ZYX"`). The golden fixtures
 * under `__test__/fixtures/specs/compiler/` pin it.
 */
export function eulerDegreesToSpecsQuaternion(rotation: ViroSpecsVec3): ViroSpecsQuat {
  const x = (rotation[0] * Math.PI) / 180;
  const y = (rotation[1] * Math.PI) / 180;
  const z = (rotation[2] * Math.PI) / 180;
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

/** Hamilton product `a * b`: rotation `b` first, then `a`. */
export function multiplySpecsQuaternions(a: ViroSpecsQuat, b: ViroSpecsQuat): ViroSpecsQuat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Rotates `point` by the unit quaternion `rotation`. */
export function rotateSpecsPoint(rotation: ViroSpecsQuat, point: ViroSpecsVec3): ViroSpecsVec3 {
  const [qx, qy, qz, qw] = rotation;
  const [x, y, z] = point;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

/**
 * World transform of a child: the parent's scale, then rotation, then
 * translation applied to the child's local transform.
 */
export function composeSpecsTransform(
  parent: ViroSpecsTransform,
  local: ViroSpecsLocalTransform
): ViroSpecsTransform {
  const localPosition = local.position ?? VIRO_SPECS_IDENTITY_TRANSFORM.position;
  const localScale = local.scale ?? VIRO_SPECS_IDENTITY_TRANSFORM.scale;
  const localRotation =
    local.rotation !== undefined
      ? eulerDegreesToSpecsQuaternion(local.rotation)
      : VIRO_SPECS_IDENTITY_TRANSFORM.rotation;

  const rotatedLocal = rotateSpecsPoint(parent.rotation, [
    localPosition[0] * parent.scale[0],
    localPosition[1] * parent.scale[1],
    localPosition[2] * parent.scale[2],
  ]);

  return {
    position: [
      parent.position[0] + rotatedLocal[0],
      parent.position[1] + rotatedLocal[1],
      parent.position[2] + rotatedLocal[2],
    ],
    rotation: multiplySpecsQuaternions(parent.rotation, localRotation),
    scale: [
      parent.scale[0] * localScale[0],
      parent.scale[1] * localScale[1],
      parent.scale[2] * localScale[2],
    ],
  };
}

/** Maps a point in an element's local space to world space. */
export function transformSpecsPoint(
  transform: ViroSpecsTransform,
  point: ViroSpecsVec3
): ViroSpecsVec3 {
  const rotated = rotateSpecsPoint(transform.rotation, [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2],
  ]);
  return [
    transform.position[0] + rotated[0],
    transform.position[1] + rotated[1],
    transform.position[2] + rotated[2],
  ];
}

/**
 * World-space radius of a polyline: half its `thickness`, scaled by the
 * largest absolute world scale axis. Meters in, meters out; the Lens host
 * converts to centimeters.
 */
export function specsPolylineRadiusMeters(
  thicknessMeters: number,
  transform: ViroSpecsTransform
): number {
  return (
    (thicknessMeters / 2) *
    Math.max(
      Math.abs(transform.scale[0]),
      Math.abs(transform.scale[1]),
      Math.abs(transform.scale[2])
    )
  );
}
