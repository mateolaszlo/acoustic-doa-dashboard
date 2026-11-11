/**
 * Camera PTZ (Pan-Tilt-Zoom) Simulation & Geometrical Spatial Math
 *
 * Implements smooth critically-damped pan inertia and optical FOV cone geometry
 * for the Meeting Director canvas.
 */

import { SpatialZone } from '../types/api_types';

/**
 * Normalizes an angle into [-180, 180) degrees.
 */
export function wrapAngle180(deg: number): number {
  let angle = deg % 360;
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;
  return angle;
}

/**
 * Returns the shortest angular difference from current to target in [-180, 180) degrees.
 */
export function shortestAngleDiff(targetDeg: number, currentDeg: number): number {
  return wrapAngle180(targetDeg - currentDeg);
}

/**
 * Advances the simulated PTZ camera pan angle smoothly toward targetDeg.
 * Uses a critically-damped spring slew model with a maximum angular velocity cap (e.g. 35 deg/s).
 *
 * @param currentPanDeg Current camera azimuth in degrees
 * @param targetPanDeg Target speaker azimuth in degrees (or null if idle)
 * @param dtSec Elapsed time in seconds since previous frame
 * @param maxSlewDegPerSec Maximum slewing speed cap (default 35 deg/s)
 * @param springDamping Responsiveness coefficient (default 3.5)
 * @returns Updated camera azimuth in degrees
 */
export function stepCameraPan(
  currentPanDeg: number,
  targetPanDeg: number | null,
  dtSec: number,
  maxSlewDegPerSec: number = 35.0,
  springDamping: number = 3.5
): number {
  if (targetPanDeg === null || isNaN(targetPanDeg)) {
    // When idle, camera holds position with slight settling
    return currentPanDeg;
  }

  const delta = shortestAngleDiff(targetPanDeg, currentPanDeg);
  if (Math.abs(delta) < 0.2) {
    return targetPanDeg;
  }

  // Spring acceleration toward target, clamped by max slew velocity
  const desiredStep = delta * springDamping * dtSec;
  const maxStep = maxSlewDegPerSec * dtSec;
  const clampedStep = Math.sign(desiredStep) * Math.min(Math.abs(desiredStep), maxStep);

  return wrapAngle180(currentPanDeg + clampedStep);
}

/**
 * Resolves which spatial room zone an acoustic arrival belongs to.
 */
export function resolveSpatialZone(angleDeg: number, zones: SpatialZone[]): SpatialZone | null {
  if (!zones || zones.length === 0) return null;
  const norm = wrapAngle180(angleDeg);

  for (const zone of zones) {
    if (norm >= zone.min_angle_deg && norm <= zone.max_angle_deg) {
      return zone;
    }
  }
  return null;
}

/**
 * Computes polygon coordinates for rendering a camera FOV optical cone in 2D canvas coordinates.
 * Room convention: 0 deg = forward (up / -Y), +90 deg = right (+X), -90 deg = left (-X), +-180 deg = rear (+Y).
 */
export function computeCameraFovPoints(
  cameraX: number,
  cameraY: number,
  panDeg: number,
  fovDeg: number = 60.0,
  rangeRadiusPx: number = 260.0
): { leftX: number; leftY: number; rightX: number; rightY: number; arcPoints: { x: number; y: number }[] } {
  const halfFov = fovDeg / 2.0;
  const leftAngleRad = ((panDeg - halfFov - 90) * Math.PI) / 180.0;
  const rightAngleRad = ((panDeg + halfFov - 90) * Math.PI) / 180.0;

  const leftX = cameraX + Math.cos(leftAngleRad) * rangeRadiusPx;
  const leftY = cameraY + Math.sin(leftAngleRad) * rangeRadiusPx;
  const rightX = cameraX + Math.cos(rightAngleRad) * rangeRadiusPx;
  const rightY = cameraY + Math.sin(rightAngleRad) * rangeRadiusPx;

  // Arc interpolation points
  const arcPoints: { x: number; y: number }[] = [];
  const segments = 16;
  const stepRad = (rightAngleRad - leftAngleRad) / segments;

  for (let i = 0; i <= segments; i++) {
    const angle = leftAngleRad + i * stepRad;
    arcPoints.push({
      x: cameraX + Math.cos(angle) * rangeRadiusPx,
      y: cameraY + Math.sin(angle) * rangeRadiusPx,
    });
  }

  return { leftX, leftY, rightX, rightY, arcPoints };
}
