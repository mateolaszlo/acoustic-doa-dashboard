/**
 * Multipath & Room Reverberation Analyzer
 *
 * Contrasts primary direct sound arrivals against secondary CLEAN deconvolution peaks
 * to compute live Direct-to-Reverberant Ratio (DRR in dB) and multipath reflections.
 */

import { MeasurementEvent, AcousticTrack, MultipathMetrics, MultipathReflection } from '../types/api_types';
import { shortestAngleDiff } from './camera_ptz_math';

/**
 * Computes live room acoustic multipath and DRR metrics from active tracks and recent events.
 */
export function analyzeMultipath(
  activeTracks: AcousticTrack[] = [],
  recentEvents: MeasurementEvent[] = []
): MultipathMetrics {
  // Identify primary direct arrival (Slot 0 or track with highest confidence)
  const primaryTrack = activeTracks.find((t) => t.trackSlot === 0 && t.state === 'ACTIVE')
    || activeTracks.find((t) => t.state === 'ACTIVE');

  // Secondary reflections (Slot 1 or other active/coasting tracks)
  const secondaryTracks = activeTracks.filter(
    (t) => t !== primaryTrack && (t.state === 'ACTIVE' || t.state === 'COASTING')
  );

  // Fallback to recent events if no multi-target tracks available
  let directSplDb = 0;
  let directAngleDeg = 0;

  if (primaryTrack) {
    directSplDb = primaryTrack.soundLevelDb;
    directAngleDeg = primaryTrack.angleDeg;
  } else if (recentEvents.length > 0) {
    const latest = recentEvents[recentEvents.length - 1];
    directSplDb = latest.soundLevelDb;
    directAngleDeg = latest.angleDeg;
  }

  const reflections: MultipathReflection[] = [];
  let reverbEnergySum = 0;

  // Process secondary tracks as potential reflections
  for (const track of secondaryTracks) {
    const deltaAngle = Math.abs(shortestAngleDiff(track.angleDeg, directAngleDeg));
    const relativeSpl = track.soundLevelDb - directSplDb;
    const energy = Math.pow(10, track.soundLevelDb / 10);
    reverbEnergySum += energy;

    reflections.push({
      slotId: track.trackSlot,
      angleDeg: track.angleDeg,
      delayUs: Math.round((Math.sin((track.angleDeg * Math.PI) / 180) * 0.042 / 343) * 1e6),
      soundLevelDb: track.soundLevelDb,
      confidence: track.confidence,
      deltaAngleDeg: deltaAngle,
      relativeSplDb: relativeSpl,
    });
  }

  // If no secondary tracks exist, inspect recent events with secondary slotId (slot 1)
  if (reflections.length === 0 && recentEvents.length > 1) {
    const now = Date.now();
    const secondaryEvents = recentEvents.filter(
      (e) => (e.slotId === 1 || e.trackSlot === 1) && (now - e.timestampMs < 3000)
    );

    if (secondaryEvents.length > 0) {
      const latestSec = secondaryEvents[secondaryEvents.length - 1];
      const deltaAngle = Math.abs(shortestAngleDiff(latestSec.angleDeg, directAngleDeg));
      const relativeSpl = latestSec.soundLevelDb - directSplDb;
      const energy = Math.pow(10, latestSec.soundLevelDb / 10);
      reverbEnergySum += energy;

      reflections.push({
        slotId: 1,
        angleDeg: latestSec.angleDeg,
        delayUs: latestSec.delayUs,
        soundLevelDb: latestSec.soundLevelDb,
        confidence: latestSec.confidence,
        deltaAngleDeg: deltaAngle,
        relativeSplDb: relativeSpl,
      });
    }
  }

  // Direct acoustic energy
  const directEnergy = directSplDb > 0 ? Math.pow(10, directSplDb / 10) : 0.001;

  let drrDb: number;
  if (reverbEnergySum <= 0) {
    drrDb = 24.0; // Ideal dry / anechoic baseline
  } else {
    drrDb = Math.round(10 * Math.log10(Math.max(1e-4, directEnergy / reverbEnergySum)) * 10) / 10;
  }

  // Reverb state classification
  let reverbState: 'DRY' | 'CONTROLLED' | 'REVERBERANT';
  if (drrDb >= 12.0) {
    reverbState = 'DRY';
  } else if (drrDb >= 6.0) {
    reverbState = 'CONTROLLED';
  } else {
    reverbState = 'REVERBERANT';
  }

  return {
    directSplDb: Math.round(directSplDb * 10) / 10,
    reverbSplDb: reverbEnergySum > 0 ? Math.round(10 * Math.log10(reverbEnergySum) * 10) / 10 : 0,
    drrDb,
    reverbState,
    reflections,
  };
}
