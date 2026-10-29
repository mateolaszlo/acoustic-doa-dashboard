/**
 * Polar coordinate mathematics and color mapping for acoustic DOA radar
 */

export function polarToCanvas(
  angleDeg: number,
  radius: number,
  centerX: number,
  centerY: number
): { x: number; y: number } {
  // 0 deg is UP (North / Front), +90 deg is RIGHT (East), -90 deg is LEFT (West)
  const rad = (angleDeg * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.sin(rad),
    y: centerY - radius * Math.cos(rad),
  };
}

export function normalizeAngle(angleDeg: number): number {
  let a = angleDeg;
  while (a > 180.0) a -= 360.0;
  while (a < -180.0) a += 360.0;
  return a;
}

export function getSplColor(soundLevelDb: number, alpha = 1.0): string {
  if (soundLevelDb >= 75.0) {
    return `rgba(255, 51, 102, ${alpha})`; // Red / Loud
  } else if (soundLevelDb >= 60.0) {
    return `rgba(255, 187, 0, ${alpha})`; // Amber / Speech
  } else {
    return `rgba(0, 255, 102, ${alpha})`; // Green / Ambient
  }
}

export function getDirectionLabel(angleDeg: number): string {
  const angle = normalizeAngle(angleDeg);
  if (Math.abs(angle) <= 15) return 'FRONT';
  if (angle > 15 && angle < 75) return 'FRONT-RIGHT';
  if (angle >= 75 && angle <= 105) return 'RIGHT';
  if (angle > 105 && angle < 165) return 'BACK-RIGHT';
  if (Math.abs(angle) >= 165) return 'BACK';
  if (angle < -15 && angle > -75) return 'FRONT-LEFT';
  if (angle <= -75 && angle >= -105) return 'LEFT';
  return 'BACK-LEFT';
}

export function getDirectionBadge(angleDeg: number): { label: string; badgeClass: string } {
  const label = getDirectionLabel(angleDeg);
  if (label === 'FRONT') {
    return { label, badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
  } else if (label.includes('RIGHT')) {
    return { label, badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800' };
  } else if (label.includes('LEFT')) {
    return { label, badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-800' };
  } else {
    return { label, badgeClass: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
}
