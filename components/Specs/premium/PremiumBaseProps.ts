import type { Viro3DPoint } from "../../Types/ViroUtils";

/**
 * Props every premium Specs component shares. The Specs compilers read them
 * by name, so they mean the same thing on ViroCore and in the Lens.
 *
 * @see {@linkcode SpatialPanel}
 */
export interface PremiumBaseProps {
  /** Stable node ID. Required by `viro-specs-compile --strict`. */
  readonly viroTag?: string;
  /** Local position in meters. */
  readonly position?: Viro3DPoint;
  /** Local rotation, Euler degrees. */
  readonly rotation?: Viro3DPoint;
  readonly scale?: Viro3DPoint;
  readonly visible?: boolean;
  /** 0 to 1. */
  readonly opacity?: number;
  /**
   * Accessible name. Names the action or object ("Reset model"), not the
   * control type. Required on anything interactive (`VS3016`).
   */
  readonly label?: string;
}
