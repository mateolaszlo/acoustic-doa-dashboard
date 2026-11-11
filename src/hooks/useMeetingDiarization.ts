import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AcousticTrack,
  MeasurementEvent,
  SpatialZone,
  SpeakerSessionStats,
  DiarizationTimelineSegment,
  ActiveSpeechBurst,
  MeetingSessionAnalytics,
} from '../types/api_types';
import { resolveSpatialZone } from '../services/camera_ptz_math';

const INITIAL_SPEAKER_0: SpeakerSessionStats = {
  slotId: 0,
  isActive: false,
  currentAngleDeg: null,
  currentZone: 'Unassigned',
  currentSplDb: 0,
  totalSpeakingTimeMs: 0,
  turnCount: 0,
  lastActiveMs: 0,
};

const INITIAL_SPEAKER_1: SpeakerSessionStats = {
  slotId: 1,
  isActive: false,
  currentAngleDeg: null,
  currentZone: 'Unassigned',
  currentSplDb: 0,
  totalSpeakingTimeMs: 0,
  turnCount: 0,
  lastActiveMs: 0,
};

const INITIAL_ANALYTICS: MeetingSessionAnalytics = {
  totalDurationMs: 0,
  speaker0TimeMs: 0,
  speaker1TimeMs: 0,
  crossTalkTimeMs: 0,
  silenceTimeMs: 0,
  speaker0Turns: 0,
  speaker1Turns: 0,
  crossTalkCount: 0,
};

export function useMeetingDiarization(
  activeTracks: AcousticTrack[] = [],
  latestEvent: MeasurementEvent | null = null,
  zones: SpatialZone[] = [],
  isStreaming: boolean = true
) {
  const [speaker0, setSpeaker0] = useState<SpeakerSessionStats>(INITIAL_SPEAKER_0);
  const [speaker1, setSpeaker1] = useState<SpeakerSessionStats>(INITIAL_SPEAKER_1);
  const [isCrossTalk, setIsCrossTalk] = useState(false);
  const [timeline, setTimeline] = useState<DiarizationTimelineSegment[]>([]);
  const [activeBursts, setActiveBursts] = useState<ActiveSpeechBurst[]>([]);
  const [analytics, setAnalytics] = useState<MeetingSessionAnalytics>(INITIAL_ANALYTICS);

  const activeTracksRef = useRef(activeTracks);
  activeTracksRef.current = activeTracks;

  const latestEventRef = useRef(latestEvent);
  latestEventRef.current = latestEvent;

  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  const prevActive0Ref = useRef(false);
  const prevActive1Ref = useRef(false);
  const prevCrossTalkRef = useRef(false);
  const lastTickTimeRef = useRef<number>(Date.now());
  const activeBurst0Ref = useRef<{ id: string; startMs: number; splSum: number; count: number; zone: string } | null>(null);
  const activeBurst1Ref = useRef<{ id: string; startMs: number; splSum: number; count: number; zone: string } | null>(null);

  const resetMeetingSession = useCallback(() => {
    setSpeaker0(INITIAL_SPEAKER_0);
    setSpeaker1(INITIAL_SPEAKER_1);
    setIsCrossTalk(false);
    setTimeline([]);
    setActiveBursts([]);
    setAnalytics(INITIAL_ANALYTICS);
    prevActive0Ref.current = false;
    prevActive1Ref.current = false;
    prevCrossTalkRef.current = false;
    lastTickTimeRef.current = Date.now();
    activeBurst0Ref.current = null;
    activeBurst1Ref.current = null;
  }, []);

  useEffect(() => {
    if (!isStreaming) return;

    lastTickTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(now - lastTickTimeRef.current, 500);
      lastTickTimeRef.current = now;

      const tracks = activeTracksRef.current;
      const event = latestEventRef.current;
      const currentZones = zonesRef.current;

      // Determine activity from tracks or recent event
      const track0 = tracks.find((t) => t.trackSlot === 0 && t.state === 'ACTIVE');
      const track1 = tracks.find((t) => t.trackSlot === 1 && t.state === 'ACTIVE');

      const recentSlot0Event = event && (event.slotId === 0 || event.trackSlot === 0)
        && (now - event.timestampMs < 1200) && event.soundLevelDb >= 50.0;

      const recentSlot1Event = event && (event.slotId === 1 || event.trackSlot === 1)
        && (now - event.timestampMs < 1200) && event.soundLevelDb >= 50.0;

      const active0 = Boolean(track0 || recentSlot0Event);
      const active1 = Boolean(track1 || recentSlot1Event);
      const crossTalk = active0 && active1;

      const angle0 = track0 ? track0.angleDeg : (recentSlot0Event ? event!.angleDeg : null);
      const spl0 = track0 ? track0.soundLevelDb : (recentSlot0Event ? event!.soundLevelDb : 0);
      const zone0 = angle0 !== null ? resolveSpatialZone(angle0, currentZones)?.name || 'General Area' : 'Idle';

      const angle1 = track1 ? track1.angleDeg : (recentSlot1Event ? event!.angleDeg : null);
      const spl1 = track1 ? track1.soundLevelDb : (recentSlot1Event ? event!.soundLevelDb : 0);
      const zone1 = angle1 !== null ? resolveSpatialZone(angle1, currentZones)?.name || 'General Area' : 'Idle';

      // Turn detection (rising edge of speech)
      const turn0Started = active0 && !prevActive0Ref.current;
      const turn1Started = active1 && !prevActive1Ref.current;
      const crossTalkStarted = crossTalk && !prevCrossTalkRef.current;

      prevActive0Ref.current = active0;
      prevActive1Ref.current = active1;
      prevCrossTalkRef.current = crossTalk;

      setSpeaker0((prev) => ({
        ...prev,
        isActive: active0,
        currentAngleDeg: angle0 !== null ? Math.round(angle0 * 10) / 10 : prev.currentAngleDeg,
        currentZone: active0 ? zone0 : (prev.isActive ? prev.currentZone : 'Idle'),
        currentSplDb: active0 ? Math.round(spl0 * 10) / 10 : 0,
        totalSpeakingTimeMs: active0 ? prev.totalSpeakingTimeMs + dt : prev.totalSpeakingTimeMs,
        turnCount: turn0Started ? prev.turnCount + 1 : prev.turnCount,
        lastActiveMs: active0 ? now : prev.lastActiveMs,
      }));

      setSpeaker1((prev) => ({
        ...prev,
        isActive: active1,
        currentAngleDeg: angle1 !== null ? Math.round(angle1 * 10) / 10 : prev.currentAngleDeg,
        currentZone: active1 ? zone1 : (prev.isActive ? prev.currentZone : 'Idle'),
        currentSplDb: active1 ? Math.round(spl1 * 10) / 10 : 0,
        totalSpeakingTimeMs: active1 ? prev.totalSpeakingTimeMs + dt : prev.totalSpeakingTimeMs,
        turnCount: turn1Started ? prev.turnCount + 1 : prev.turnCount,
        lastActiveMs: active1 ? now : prev.lastActiveMs,
      }));

      setIsCrossTalk(crossTalk);

      // Update analytics counters
      setAnalytics((prev) => ({
        totalDurationMs: prev.totalDurationMs + dt,
        speaker0TimeMs: active0 ? prev.speaker0TimeMs + dt : prev.speaker0TimeMs,
        speaker1TimeMs: active1 ? prev.speaker1TimeMs + dt : prev.speaker1TimeMs,
        crossTalkTimeMs: crossTalk ? prev.crossTalkTimeMs + dt : prev.crossTalkTimeMs,
        silenceTimeMs: (!active0 && !active1) ? prev.silenceTimeMs + dt : prev.silenceTimeMs,
        speaker0Turns: turn0Started ? prev.speaker0Turns + 1 : prev.speaker0Turns,
        speaker1Turns: turn1Started ? prev.speaker1Turns + 1 : prev.speaker1Turns,
        crossTalkCount: crossTalkStarted ? prev.crossTalkCount + 1 : prev.crossTalkCount,
      }));

      // Timeline segments accumulation
      const segmentsToAdd: DiarizationTimelineSegment[] = [];

      // Process Speaker 0 timeline burst
      if (active0) {
        if (!activeBurst0Ref.current) {
          activeBurst0Ref.current = {
            id: `s0-${now}`,
            startMs: now,
            splSum: spl0,
            count: 1,
            zone: zone0,
          };
        } else {
          activeBurst0Ref.current.splSum += spl0;
          activeBurst0Ref.current.count += 1;
        }
      } else if (activeBurst0Ref.current) {
        const b = activeBurst0Ref.current;
        const duration = now - b.startMs;
        if (duration >= 250) {
          segmentsToAdd.push({
            id: b.id,
            timestampMs: b.startMs,
            slotId: 0,
            durationMs: duration,
            zoneName: b.zone,
            avgSplDb: Math.round(b.splSum / Math.max(1, b.count)),
            isCrossTalk: crossTalk,
          });
        }
        activeBurst0Ref.current = null;
      }

      // Process Speaker 1 timeline burst
      if (active1) {
        if (!activeBurst1Ref.current) {
          activeBurst1Ref.current = {
            id: `s1-${now}`,
            startMs: now,
            splSum: spl1,
            count: 1,
            zone: zone1,
          };
        } else {
          activeBurst1Ref.current.splSum += spl1;
          activeBurst1Ref.current.count += 1;
        }
      } else if (activeBurst1Ref.current) {
        const b = activeBurst1Ref.current;
        const duration = now - b.startMs;
        if (duration >= 250) {
          segmentsToAdd.push({
            id: b.id,
            timestampMs: b.startMs,
            slotId: 1,
            durationMs: duration,
            zoneName: b.zone,
            avgSplDb: Math.round(b.splSum / Math.max(1, b.count)),
            isCrossTalk: crossTalk,
          });
        }
        activeBurst1Ref.current = null;
      }

      // Track ongoing active bursts in real-time
      const liveBursts: ActiveSpeechBurst[] = [];
      if (active0 && activeBurst0Ref.current) {
        liveBursts.push({
          slotId: 0,
          startMs: activeBurst0Ref.current.startMs,
          durationMs: now - activeBurst0Ref.current.startMs,
          zoneName: activeBurst0Ref.current.zone,
          avgSplDb: Math.round(activeBurst0Ref.current.splSum / Math.max(1, activeBurst0Ref.current.count)),
          isCrossTalk: crossTalk,
        });
      }
      if (active1 && activeBurst1Ref.current) {
        liveBursts.push({
          slotId: 1,
          startMs: activeBurst1Ref.current.startMs,
          durationMs: now - activeBurst1Ref.current.startMs,
          zoneName: activeBurst1Ref.current.zone,
          avgSplDb: Math.round(activeBurst1Ref.current.splSum / Math.max(1, activeBurst1Ref.current.count)),
          isCrossTalk: crossTalk,
        });
      }
      setActiveBursts(liveBursts);

      // Periodically clean timeline and append finished segments
      setTimeline((prev) => {
        const cutoff = now - 65000;
        const filtered = prev.filter((s) => s.timestampMs + s.durationMs > cutoff);
        if (segmentsToAdd.length > 0) {
          return [...filtered, ...segmentsToAdd].slice(-100);
        }
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isStreaming]);

  return {
    speaker0,
    speaker1,
    isCrossTalk,
    timeline,
    activeBursts,
    analytics,
    resetMeetingSession,
  };
}

export default useMeetingDiarization;
