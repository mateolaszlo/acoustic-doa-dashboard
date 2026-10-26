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
