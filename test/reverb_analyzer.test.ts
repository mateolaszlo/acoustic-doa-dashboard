import { describe, it, expect } from 'vitest';
import { analyzeMultipath } from '../src/services/reverb_analyzer.js';
import { AcousticTrack } from '../src/types/api_types.js';

describe('Multipath & Room Reverberation Analyzer', () => {
  it('returns DRY state when only single direct path exists', () => {
    const singleTrack: AcousticTrack[] = [
      {
        trackId: 1,
        trackSlot: 0,
        state: 'ACTIVE',
        angleDeg: 12.0,
        rawAngleDeg: 12.5,
        velocityDegPerSec: 0,
        soundLevelDb: 72.0,
        confidence: 0.95,
        hits: 10,
        lastUpdatedMs: Date.now(),
        ageMs: 1000,
      },
    ];

    const metrics = analyzeMultipath(singleTrack);
    expect(metrics.directSplDb).toBe(72.0);
    expect(metrics.reverbState).toBe('DRY');
    expect(metrics.drrDb).toBeGreaterThanOrEqual(12.0);
    expect(metrics.reflections.length).toBe(0);
  });

  it('computes secondary multipath reflection and classifies room acoustics', () => {
    const multiTracks: AcousticTrack[] = [
      {
        trackId: 1,
        trackSlot: 0,
        state: 'ACTIVE',
        angleDeg: 0.0,
        rawAngleDeg: 0.0,
        velocityDegPerSec: 0,
        soundLevelDb: 75.0,
        confidence: 0.95,
        hits: 20,
        lastUpdatedMs: Date.now(),
        ageMs: 2000,
      },
      {
        trackId: 2,
        trackSlot: 1,
        state: 'ACTIVE',
        angleDeg: 65.0,
        rawAngleDeg: 64.0,
        velocityDegPerSec: 0,
        soundLevelDb: 68.0, // Strong secondary reflection (within 7 dB)
        confidence: 0.70,
        hits: 8,
        lastUpdatedMs: Date.now(),
        ageMs: 1500,
      },
    ];

    const metrics = analyzeMultipath(multiTracks);
    expect(metrics.directSplDb).toBe(75.0);
    expect(metrics.reflections.length).toBe(1);
    expect(metrics.reflections[0].angleDeg).toBe(65.0);
    expect(metrics.reflections[0].relativeSplDb).toBeCloseTo(-7.0, 1);
    // 75 dB vs 68 dB -> DRR is ~7 dB, which is CONTROLLED
    expect(metrics.reverbState).toBe('CONTROLLED');
  });

  it('flags REVERBERANT when secondary arrival energy is nearly equal to direct arrival', () => {
    const multiTracks: AcousticTrack[] = [
      {
        trackId: 1,
        trackSlot: 0,
        state: 'ACTIVE',
        angleDeg: -10.0,
        rawAngleDeg: -10.0,
        velocityDegPerSec: 0,
        soundLevelDb: 70.0,
        confidence: 0.9,
        hits: 15,
        lastUpdatedMs: Date.now(),
        ageMs: 1000,
      },
      {
        trackId: 2,
        trackSlot: 1,
        state: 'ACTIVE',
        angleDeg: 80.0,
        rawAngleDeg: 80.0,
        velocityDegPerSec: 0,
        soundLevelDb: 68.0, // Only 2 dB weaker than direct -> DRR ~2 dB < 6 dB
        confidence: 0.85,
        hits: 12,
        lastUpdatedMs: Date.now(),
        ageMs: 1000,
      },
    ];

    const metrics = analyzeMultipath(multiTracks);
    expect(metrics.reverbState).toBe('REVERBERANT');
    expect(metrics.drrDb).toBeLessThan(6.0);
  });
});
