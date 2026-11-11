import { describe, it, expect } from 'vitest';
import {
  wrapAngle180,
  shortestAngleDiff,
  stepCameraPan,
  resolveSpatialZone,
  computeCameraFovPoints,
} from '../src/services/camera_ptz_math.js';
import { SpatialZone } from '../src/types/api_types.js';

describe('Camera PTZ Math & Spatial Geometry', () => {
  it('wraps angles properly to [-180, 180)', () => {
    expect(wrapAngle180(0)).toBe(0);
    expect(wrapAngle180(180)).toBe(180);
    expect(wrapAngle180(190)).toBe(-170);
    expect(wrapAngle180(-190)).toBe(170);
    expect(wrapAngle180(360)).toBe(0);
  });

  it('computes shortest angular difference across discontinuity', () => {
    expect(shortestAngleDiff(10, 0)).toBe(10);
    expect(shortestAngleDiff(-10, 0)).toBe(-10);
    // Across +-180 boundary
    expect(shortestAngleDiff(-170, 170)).toBe(20);
    expect(shortestAngleDiff(170, -170)).toBe(-20);
  });

  it('steps camera pan towards target with critically-damped spring and velocity cap', () => {
    // Current at 0, target at 40, dt = 0.1s
    const step1 = stepCameraPan(0, 40, 0.1, 35.0, 3.5);
    // Expected desiredStep: 40 * 3.5 * 0.1 = 14
    // Clamped by maxStep: 35.0 * 0.1 = 3.5
    expect(step1).toBeCloseTo(3.5, 2);

    // Target is close (diff < 0.2), snaps to target
    const snapped = stepCameraPan(39.9, 40, 0.1, 35.0, 3.5);
    expect(snapped).toBe(40);

    // Null target holds position
    const held = stepCameraPan(15, null, 0.1);
    expect(held).toBe(15);
  });

  it('resolves spatial zones correctly', () => {
    const testZones: SpatialZone[] = [
      { name: 'Podium', min_angle_deg: -30, max_angle_deg: 30, color: '#10b981' },
      { name: 'Audience Left', min_angle_deg: -90, max_angle_deg: -30, color: '#818cf8' },
      { name: 'Audience Right', min_angle_deg: 30, max_angle_deg: 90, color: '#38bdf8' },
    ];

    expect(resolveSpatialZone(0, testZones)?.name).toBe('Podium');
    expect(resolveSpatialZone(-15, testZones)?.name).toBe('Podium');
    expect(resolveSpatialZone(-60, testZones)?.name).toBe('Audience Left');
    expect(resolveSpatialZone(45, testZones)?.name).toBe('Audience Right');
    expect(resolveSpatialZone(160, testZones)).toBeNull();
  });

  it('computes 60-degree FOV camera frustum coordinates', () => {
    const fov = computeCameraFovPoints(100, 200, 0, 60, 150);
    expect(fov.arcPoints.length).toBeGreaterThan(0);
    // At pan = 0, camera points straight up (-Y axis)
    // Center of arc should have x near 100 and y near 200 - 150 = 50
    const midIdx = Math.floor(fov.arcPoints.length / 2);
    expect(fov.arcPoints[midIdx].x).toBeCloseTo(100, 1);
    expect(fov.arcPoints[midIdx].y).toBeCloseTo(50, 1);
  });
});
