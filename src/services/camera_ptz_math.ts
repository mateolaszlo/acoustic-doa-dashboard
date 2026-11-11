/**
 * Camera PTZ (Pan-Tilt-Zoom) Simulation & Geometrical Spatial Math
 *
 * Implements true trigonometric parallax bearing calculation,
 * multi-camera candidate scoring, and critically-damped pan inertia.
 */

import { SpatialZone, VirtualCamera, CameraDirectorConfig, RoomLayoutConfig, CustomChair } from '../types/api_types';

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
    assignedTargetSlot: null,
    isLockedOnSubject: false,
    lastTargetPos: null,
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
    assignedTargetSlot: null,
    isLockedOnSubject: false,
    lastTargetPos: null,
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
    assignedTargetSlot: null,
    isLockedOnSubject: false,
    lastTargetPos: null,
  },
];

export const DEFAULT_DIRECTOR_CONFIG: CameraDirectorConfig = {
  slewSpeedDegPerSec: 120.0,
  instantCut: false,
  holdTimeMs: 1800,
  confirmTimeMs: 350,
  hysteresisMarginPercent: 20,
};

export const DEFAULT_ROOM_LAYOUT: RoomLayoutConfig = {
  tableShape: 'oval',
  tableWidthRatio: 0.52,
  tableHeightRatio: 0.32,
  seatCount: 8,
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
 * Computes default symmetrical chair positions around the conference table
 * for a given room layout configuration and room dimensions.
 */
export function computeDefaultChairs(
  layout: RoomLayoutConfig,
  roomWidth: number,
  roomHeight: number
): CustomChair[] {
  const centerX = roomWidth / 2;
  const centerY = roomHeight / 2 + 10;
  const tableW = roomWidth * layout.tableWidthRatio;
  const tableH = roomHeight * layout.tableHeightRatio;
  const tableX = centerX - tableW / 2;
  const tableY = centerY - tableH / 2;
  const totalSeats = Math.max(2, layout.seatCount || 8);
  const chairs: CustomChair[] = [];

  if (layout.tableShape === 'round') {
    const r = Math.min(tableW, tableH) * 0.48;
    for (let i = 0; i < totalSeats; i++) {
      const ang = (i / totalSeats) * Math.PI * 2 - Math.PI / 2;
      const px = centerX + Math.cos(ang) * (r + 14);
      const py = centerY + Math.sin(ang) * (r + 14);
      chairs.push({
        id: `chair-${i}`,
        xRatio: Math.max(0.04, Math.min(0.96, px / roomWidth)),
        yRatio: Math.max(0.04, Math.min(0.96, py / roomHeight)),
      });
    }
    return chairs;
  }

  if (layout.tableShape === 'ushape') {
    const sideSeats = Math.max(1, Math.floor(totalSeats * 0.35));
    const bottomSeats = Math.max(1, totalSeats - sideSeats * 2);
    let idCounter = 0;

    // Left wing
    for (let i = 0; i < sideSeats; i++) {
      const cy = tableY + 24 + (i / Math.max(1, sideSeats - 1)) * (tableH - 48);
      chairs.push({
        id: `chair-${idCounter++}`,
        xRatio: (tableX - 14) / roomWidth,
        yRatio: cy / roomHeight,
      });
    }
    // Right wing
    for (let i = 0; i < sideSeats; i++) {
      const cy = tableY + 24 + (i / Math.max(1, sideSeats - 1)) * (tableH - 48);
      chairs.push({
        id: `chair-${idCounter++}`,
        xRatio: (tableX + tableW + 14) / roomWidth,
        yRatio: cy / roomHeight,
      });
    }
    // Bottom wing
    for (let i = 0; i < bottomSeats; i++) {
      const cx = tableX + 32 + (i / Math.max(1, bottomSeats - 1)) * (tableW - 64);
      chairs.push({
        id: `chair-${idCounter++}`,
        xRatio: cx / roomWidth,
        yRatio: (tableY + tableH + 14) / roomHeight,
      });
    }
    return chairs;
  }

  if (layout.tableShape === 'hollow_square') {
    if (totalSeats <= 4) {
      const defaultPositions = [
        { x: centerX, y: tableY - 14 }, // North
        { x: tableX + tableW + 14, y: centerY }, // East
        { x: centerX, y: tableY + tableH + 14 }, // South
        { x: tableX - 14, y: centerY }, // West
      ];
      for (let i = 0; i < totalSeats; i++) {
        chairs.push({
          id: `chair-${i}`,
          xRatio: defaultPositions[i].x / roomWidth,
          yRatio: defaultPositions[i].y / roomHeight,
        });
      }
      return chairs;
    }

    const perSide = Math.max(1, Math.floor(totalSeats / 4));
    let idCounter = 0;
    // North edge
    for (let i = 0; i < perSide; i++) {
      const t = perSide > 1 ? i / (perSide - 1) : 0.5;
      const cx = tableX + 32 + t * (tableW - 64);
      chairs.push({ id: `chair-${idCounter++}`, xRatio: cx / roomWidth, yRatio: (tableY - 14) / roomHeight });
    }
    // East edge
    for (let i = 0; i < perSide; i++) {
      const t = perSide > 1 ? i / (perSide - 1) : 0.5;
      const cy = tableY + 32 + t * (tableH - 64);
      chairs.push({ id: `chair-${idCounter++}`, xRatio: (tableX + tableW + 14) / roomWidth, yRatio: cy / roomHeight });
    }
    // South edge
    for (let i = 0; i < perSide; i++) {
      const t = perSide > 1 ? i / (perSide - 1) : 0.5;
      const cx = tableX + 32 + t * (tableW - 64);
      chairs.push({ id: `chair-${idCounter++}`, xRatio: cx / roomWidth, yRatio: (tableY + tableH + 14) / roomHeight });
    }
    // West edge
    for (let i = 0; i < perSide; i++) {
      const t = perSide > 1 ? i / (perSide - 1) : 0.5;
      const cy = tableY + 32 + t * (tableH - 64);
      chairs.push({ id: `chair-${idCounter++}`, xRatio: (tableX - 14) / roomWidth, yRatio: cy / roomHeight });
    }
    return chairs;
  }

  // Oval / Default
  if (totalSeats === 2) {
    chairs.push({
      id: 'chair-0',
      xRatio: centerX / roomWidth,
      yRatio: (tableY - 14) / roomHeight,
    });
    chairs.push({
      id: 'chair-1',
      xRatio: centerX / roomWidth,
      yRatio: (tableY + tableH + 14) / roomHeight,
    });
    return chairs;
  }

  if (totalSeats <= 4) {
    const pts = [
      { x: centerX, y: tableY - 14 }, // North
      { x: tableX + tableW + 14, y: centerY }, // East
      { x: centerX, y: tableY + tableH + 14 }, // South
      { x: tableX - 14, y: centerY }, // West
    ];
    for (let i = 0; i < totalSeats; i++) {
      chairs.push({
        id: `chair-${i}`,
        xRatio: pts[i].x / roomWidth,
        yRatio: pts[i].y / roomHeight,
      });
    }
    return chairs;
  }

  // totalSeats > 4 for Oval
  chairs.push({
    id: 'chair-0',
    xRatio: (tableX - 14) / roomWidth,
    yRatio: centerY / roomHeight,
  });
  chairs.push({
    id: 'chair-1',
    xRatio: (tableX + tableW + 14) / roomWidth,
    yRatio: centerY / roomHeight,
  });

  const remaining = totalSeats - 2;
  const perSide = Math.floor(remaining / 2);
  let idCount = 2;
  for (let i = 0; i < perSide; i++) {
    const t = perSide > 1 ? i / (perSide - 1) : 0.5;
    const cx = tableX + 36 + t * (tableW - 72);
    chairs.push({
      id: `chair-${idCount++}`,
      xRatio: cx / roomWidth,
      yRatio: (tableY - 14) / roomHeight,
    });
    chairs.push({
      id: `chair-${idCount++}`,
      xRatio: cx / roomWidth,
      yRatio: (tableY + tableH + 14) / roomHeight,
    });
  }

  return chairs;
}

/**
 * Computes shape-aware 2D world coordinates for a speaker seated at angleDeg
 * relative to the conference table geometry and room dimensions.
 * Resolves the issue where speakers in U-shape, oval, or rectangular tables
 * were floating inside empty room space.
 */
export function calculateTablePerimeterPos(
  centerX: number,
  centerY: number,
  angleDeg: number,
  layout: RoomLayoutConfig,
  roomWidth: number,
  roomHeight: number
): { x: number; y: number } {
  const normAngle = wrapAngle180(angleDeg);
  const rad = (normAngle * Math.PI) / 180.0;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  const tableW = roomWidth * layout.tableWidthRatio;
  const tableH = roomHeight * layout.tableHeightRatio;
  const halfW = tableW / 2;
  const halfH = tableH / 2;

  // 1. If custom chairs exist, snap to chair coordinate if within 25°
  if (layout.customChairs && layout.customChairs.length > 0) {
    let closestChair: CustomChair | null = null;
    let minDiff = 25.0;

    for (const chair of layout.customChairs) {
      const chairPxX = chair.xRatio * roomWidth;
      const chairPxY = chair.yRatio * roomHeight;
      const dx = chairPxX - centerX;
      const dy = chairPxY - centerY;
      const chairAngle = wrapAngle180((Math.atan2(dx, -dy) * 180) / Math.PI);
      const diff = Math.abs(shortestAngleDiff(normAngle, chairAngle));
      if (diff < minDiff) {
        minDiff = diff;
        closestChair = chair;
      }
    }

    if (closestChair) {
      return {
        x: closestChair.xRatio * roomWidth,
        y: closestChair.yRatio * roomHeight,
      };
    }
  }

  // 2. Round Table: circular boundary
  if (layout.tableShape === 'round') {
    const r = Math.min(halfW, halfH) * 0.95;
    return {
      x: centerX + r * sin,
      y: centerY - r * cos,
    };
  }

  // 3. U-Shape Table: outer and inner desk arms
  if (layout.tableShape === 'ushape') {
    const deskThick = Math.max(34, Math.min(tableW * 0.22, tableH * 0.32));
    const leftDeskCenterX = centerX - halfW + deskThick / 2;
    const rightDeskCenterX = centerX + halfW - deskThick / 2;
    const bottomDeskCenterY = centerY + halfH - deskThick / 2;

    // North presenter / podium zone (-40° to +40°)
    if (Math.abs(normAngle) <= 40) {
      const podiumDist = Math.max(halfH * 0.95, 60);
      return {
        x: centerX + podiumDist * sin * 0.7,
        y: centerY - podiumDist,
      };
    }

    // West wing: Left desk arm (-140° to -40°)
    if (normAngle > -140 && normAngle < -40) {
      const t = (normAngle - (-40)) / (-140 - (-40)); // 0 at top, 1 at bottom
      const y = centerY - halfH + 20 + t * (tableH - 40);
      return {
        x: leftDeskCenterX,
        y,
      };
    }

    // East wing: Right desk arm (+40° to +140°)
    if (normAngle >= 40 && normAngle <= 140) {
      const t = (normAngle - 40) / (140 - 40); // 0 at top, 1 at bottom
      const y = centerY - halfH + 20 + t * (tableH - 40);
      return {
        x: rightDeskCenterX,
        y,
      };
    }

    // South wing: Bottom desk arm (140° to 180° and -180° to -140°)
    let t = 0.5;
    if (normAngle > 0) {
      t = 0.5 + ((normAngle - 140) / 40) * 0.35;
    } else {
      t = 0.15 + ((normAngle - (-180)) / 40) * 0.35;
    }
    const x = centerX - halfW + t * tableW;
    return {
      x,
      y: bottomDeskCenterY,
    };
  }

  // 4. Exact Ray-Box Table Perimeter Intersection for Oval, Hollow Square, and Rectangular Tables
  // Resolves the issue where sound arrivals on short edges (East/West) were drawn too close to center
  const absSin = Math.abs(sin) || 0.0001;
  const absCos = Math.abs(cos) || 0.0001;
  const t = Math.min(halfW / absSin, halfH / absCos);

  return {
    x: centerX + t * sin * 0.95,
    y: centerY - t * cos * 0.95,
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
 * Supports standard sectors (min <= max) and circular wrap-around sectors
 * crossing the +-180° South boundary (min > max, e.g. 135° to -135°).
 */
export function resolveSpatialZone(angleDeg: number, zones: SpatialZone[]): SpatialZone | null {
  if (!zones || zones.length === 0) return null;
  const norm = wrapAngle180(angleDeg);

  for (const zone of zones) {
    if (zone.min_angle_deg <= zone.max_angle_deg) {
      if (norm >= zone.min_angle_deg && norm <= zone.max_angle_deg) {
        return zone;
      }
    } else {
      // Circular wrap-around sector crossing +-180° South seam (e.g. 135° to -135°)
      if (norm >= zone.min_angle_deg || norm <= zone.max_angle_deg) {
        return zone;
      }
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
