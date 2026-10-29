import { describe, it, expect } from 'vitest';
import {
  polarToCanvas,
  normalizeAngle,
  getSplColor,
  getDirectionLabel,
  getDirectionBadge,
} from '../src/services/radar_math.js';

describe('Radar Mathematical Model', () => {
  const centerX = 200;
  const centerY = 200;
  const radius = 100;

  it('maps 0 degrees (Front) directly UP along negative Y-axis', () => {
    const pos = polarToCanvas(0.0, radius, centerX, centerY);
    expect(pos.x).toBeCloseTo(centerX, 4);
    expect(pos.y).toBeCloseTo(centerY - radius, 4); // 200 - 100 = 100
  });

  it('maps +90 degrees (Right / East) directly RIGHT along positive X-axis', () => {
    const pos = polarToCanvas(90.0, radius, centerX, centerY);
    expect(pos.x).toBeCloseTo(centerX + radius, 4); // 200 + 100 = 300
    expect(pos.y).toBeCloseTo(centerY, 4);
  });

  it('maps ±180 degrees (Back / South) directly DOWN along positive Y-axis', () => {
    const pos = polarToCanvas(180.0, radius, centerX, centerY);
    expect(pos.x).toBeCloseTo(centerX, 4);
    expect(pos.y).toBeCloseTo(centerY + radius, 4); // 200 + 100 = 300
  });

  it('maps -90 degrees (Left / West) directly LEFT along negative X-axis', () => {
    const pos = polarToCanvas(-90.0, radius, centerX, centerY);
    expect(pos.x).toBeCloseTo(centerX - radius, 4); // 200 - 100 = 100
    expect(pos.y).toBeCloseTo(centerY, 4);
  });

  it('normalizes angles outside [-180, 180]', () => {
    expect(normalizeAngle(190.0)).toBeCloseTo(-170.0, 4);
    expect(normalizeAngle(-200.0)).toBeCloseTo(160.0, 4);
    expect(normalizeAngle(0.0)).toBe(0.0);
  });

  it('correctly maps SPL color thresholds', () => {
    expect(getSplColor(50.0)).toContain('0, 255, 102'); // Green (<60)
    expect(getSplColor(68.0)).toContain('255, 187, 0'); // Amber (60-75)
    expect(getSplColor(82.0)).toContain('255, 51, 102'); // Red (>75)
  });

  it('resolves cardinal directions from azimuth angle', () => {
    expect(getDirectionLabel(0)).toBe('FRONT');
    expect(getDirectionLabel(10)).toBe('FRONT');
    expect(getDirectionLabel(45)).toBe('FRONT-RIGHT');
    expect(getDirectionLabel(90)).toBe('RIGHT');
    expect(getDirectionLabel(135)).toBe('BACK-RIGHT');
    expect(getDirectionLabel(180)).toBe('BACK');
    expect(getDirectionLabel(-180)).toBe('BACK');
    expect(getDirectionLabel(-90)).toBe('LEFT');
    expect(getDirectionLabel(-45)).toBe('FRONT-LEFT');
    expect(getDirectionLabel(-135)).toBe('BACK-LEFT');
  });

  it('assigns themed badge classes for UI tables', () => {
    const front = getDirectionBadge(0);
    expect(front.label).toBe('FRONT');
    expect(front.badgeClass).toContain('emerald');

    const right = getDirectionBadge(90);
    expect(right.label).toBe('RIGHT');
    expect(right.badgeClass).toContain('amber');

    const left = getDirectionBadge(-90);
    expect(left.label).toBe('LEFT');
    expect(left.badgeClass).toContain('indigo');
  });
});
