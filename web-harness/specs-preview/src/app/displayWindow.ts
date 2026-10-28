/**
 * Size of the Specs display window drawn over the viewport. The camera is
 * wider than the display so the reviewer sees what falls outside it.
 *
 * Diagonal FOV 46 degrees is the published Spectacles (2024) figure; the
 * display aspect is taken as 1:1. Neither is confirmed for SPECS 27, so the
 * overlay is a framing aid, not a measurement.
 */
export const DISPLAY_DIAGONAL_FOV_DEG = 46;
export const DISPLAY_ASPECT = 1;

/** Pixel size of the display window for a viewport with vertical FOV `cameraFovDeg`. */
export function displayWindowPx(cameraFovDeg: number, viewportHeightPx: number): { width: number; height: number } {
  const halfDiag = Math.tan(((DISPLAY_DIAGONAL_FOV_DEG / 2) * Math.PI) / 180);
  const norm = Math.sqrt(1 + DISPLAY_ASPECT * DISPLAY_ASPECT);
  const halfW = (halfDiag * DISPLAY_ASPECT) / norm;
  const halfH = halfDiag / norm;
  const pxPerTan = viewportHeightPx / 2 / Math.tan(((cameraFovDeg / 2) * Math.PI) / 180);
  return { width: 2 * halfW * pxPerTan, height: 2 * halfH * pxPerTan };
}
