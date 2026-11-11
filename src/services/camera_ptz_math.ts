/**
 * Camera PTZ (Pan-Tilt-Zoom) Simulation & Geometrical Spatial Math
 *
 * Implements true trigonometric parallax bearing calculation,
 * multi-camera candidate scoring, and critically-damped pan inertia.
 */

import { SpatialZone, VirtualCamera, CameraDirectorConfig } from '../types/api_types';

export const DEFAULT_VIRTUAL_CAMERAS: VirtualCamera[] = [
  {
    id: 'cam-front',
    name: 'Stage Front Cam',
    xRatio: 0.5,
    yRatio: 0.08,
    restingPanDeg: 180.0, // Looks South across the table at audience
    currentPanDeg: 180.0,
    targetPanDeg: 180.0,
    fovDeg: 60.0,
    color: '#10b981',
    isLive: true,
    role: 'front',
  },
  {
    id: 'cam-rear',
    name: 'Audience Rear Cam',
    xRatio: 0.5,
    yRatio: 0.92,
    restingPanDeg: 0.0, // Looks North at podium / presenter
    currentPanDeg: 0.0,
    targetPanDeg: 0.0,
    fovDeg: 60.0,
    color: '#38bdf8',
    isLive: false,
    role: 'rear',
  },
  {
    id: 'cam-side',
    name: 'Side Profile Cam',
    xRatio: 0.08,
    yRatio: 0.5,
    restingPanDeg: 90.0, // Looks East across table
    currentPanDeg: 90.0,
    targetPanDeg: 90.0,
    fovDeg: 60.0,
    color: '#818cf8',
    isLive: false,
    role: 'side',
  },
];

export const DEFAULT_DIRECTOR_CONFIG: CameraDirectorConfig = {
  slewSpeedDegPerSec: 120.0,
  instantCut: false,
  holdTimeMs: 1800,
  confirmTimeMs: 350,
  hysteresisMarginPercent: 20,
};

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
 * Computes 2D world coordinates for a sound source given mic array center and arrival azimuth.
 * Canvas convention: 0 deg = North (-Y), +90 deg = East (+X), -90 deg = West (-X), +-180 deg = South (+Y).
 */
export function calculateSpeakerWorldPos(
  arrayX: number,
  arrayY: number,
  angleDeg: number,
  radiusPx: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180.0;
  return {
    x: arrayX + radiusPx * Math.sin(rad),
    y: arrayY - radiusPx * Math.cos(rad),
  };
}

/**
 * Computes the exact camera bearing angle needed for a camera at (camX, camY)
 * to aim directly at a target at (targetX, targetY).
 *
 * Resolves coordinate parallax so cameras mounted on walls aim accurately at table seats.
 */
export function calculateCameraBearing(
  camX: number,
  camY: number,
  targetX: number,
  targetY: number
): number {
  const dx = targetX - camX;
  const dy = targetY - camY;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return 0.0;
  }

  // In our room convention where 0° is North (-Y) and +90° is East (+X):
  // dx is positive East, -dy is positive North
  const angleRad = Math.atan2(dx, -dy);
  return wrapAngle180((angleRad * 180.0) / Math.PI);
}

/**
 * Scores a camera's suitability for framing an active speaker.
 * Evaluates both face-to-lens perspective and optical distance.
 */
export function scoreCameraCandidate(
  cam: VirtualCamera,
  speakerPos: { x: number; y: number },
  speakerAngleDeg: number,
  roomWidth: number,
  roomHeight: number
): number {
  const camX = cam.xRatio * roomWidth;
  const camY = cam.yRatio * roomHeight;

  // 1. Distance score (closer cameras get higher resolution)
  const dist = Math.hypot(speakerPos.x - camX, speakerPos.y - camY);
  const maxDist = Math.hypot(roomWidth, roomHeight);
  const distScore = 40.0 * (1.0 - Math.min(1.0, dist / maxDist));

  // 2. Perspective / Facing score
  // Seated participants face towards table center / front screen.
  // Stage presenter faces South towards the audience.
  const normAngle = wrapAngle180(speakerAngleDeg);
  const isPodium = normAngle >= -35.0 && normAngle <= 35.0; // Podium area (North)
  let facingScore = 10.0;

  if (isPodium) {
    // Speaker is at Podium, facing South towards audience -> Rear camera sees their face directly
    if (cam.role === 'rear') facingScore = 60.0;
    else if (cam.role === 'side') facingScore = 30.0;
    else facingScore = 5.0; // Front cam is behind presenter
  } else {
    // Speaker is in the audience/table seats, facing North towards presenter/screen -> Front camera sees their face
    if (cam.role === 'front') facingScore = 60.0;
    else if (cam.role === 'side') facingScore = 35.0;
    else facingScore = 5.0; // Rear cam is behind audience
  }

  // Side camera bonus for cross-table conversational angles
  if (cam.role === 'side' && Math.abs(normAngle) > 60.0 && Math.abs(normAngle) < 140.0) {
    facingScore += 15.0;
  }

  return facingScore + distScore;
}

/**
 * Advances the simulated PTZ camera pan angle smoothly toward targetDeg.
 * Uses a critically-damped spring slew model with a maximum angular velocity cap (e.g. 120 deg/s).
 */
export function stepCameraPan(
  currentPanDeg: number,
  targetPanDeg: number | null,
  dtSec: number,
  maxSlewDegPerSec: number = 120.0,
  springDamping: number = 4.0
): number {
  if (targetPanDeg === null || isNaN(targetPanDeg)) {
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
