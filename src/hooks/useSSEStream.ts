import { useState, useEffect, useRef, useCallback } from 'react';
import { MeasurementBatchPayload, MeasurementEvent, AcousticTrack } from '../types/api_types.js';

interface UseSSEStreamOptions {
  deviceId: number;
  maxBufferLength?: number;
}

export function useSSEStream({ deviceId, maxBufferLength = 500 }: UseSSEStreamOptions) {
  const [connected, setConnected] = useState(false);
  const [latestBatch, setLatestBatch] = useState<MeasurementBatchPayload | null>(null);
  const [recentEvents, setRecentEvents] = useState<MeasurementEvent[]>([]);
  const [activeTracks, setActiveTracks] = useState<AcousticTrack[]>([]);
  const [bufferLimit, setBufferLimit] = useState<number>(maxBufferLength);
  const [clockSource, setClockSource] = useState<string>('UNKNOWN');
  const [crcVerified, setCrcVerified] = useState(false);
  const [totalEventCount, setTotalEventCount] = useState(0);
  const [globalEventCount, setGlobalEventCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial global all-time count from database
  useEffect(() => {
    fetch(`/api/v1/devices/${deviceId}/count`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.total === 'number') {
          setGlobalEventCount(data.total);
        }
      })
      .catch((err) => console.warn('[SSE] Failed to load global count:', err));
  }, [deviceId]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = `/api/v1/devices/${deviceId}/stream`;
    console.log(`[SSE] Connecting to ${sseUrl}...`);

    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      console.log(`[SSE] Connected to device ${deviceId} stream`);
      setConnected(true);
    });

    es.addEventListener('measurement_batch', (event) => {
      try {
        const batch: MeasurementBatchPayload = JSON.parse(event.data);
        setLatestBatch(batch);
        setClockSource(batch.clockSource);
        if (batch.crcVerified !== undefined) {
          setCrcVerified(Boolean(batch.crcVerified));
        }
        setTotalEventCount((c) => c + batch.records.length);
        setGlobalEventCount((g) => g + batch.records.length);

        if (batch.activeTracks && Array.isArray(batch.activeTracks)) {
          setActiveTracks(batch.activeTracks);
        }

        // Group batch records by timestampMs (each distinct timestamp is an FFT frame;
        // multiple records with the same timestamp are simultaneous CLEAN detections: Primary -> Secondary -> Tertiary).
        // Reverse frame order so newest frame is first, but preserve Primary -> Secondary -> Tertiary
        // order within identical timestamp frames.
        const frames: MeasurementEvent[][] = [];
        for (const record of batch.records) {
          if (frames.length > 0 && frames[frames.length - 1][0].timestampMs === record.timestampMs) {
            frames[frames.length - 1].push(record);
          } else {
            frames.push([record]);
          }
        }
        const orderedBatchRecords = frames.reverse().flat();

        setRecentEvents((prev) => {
          const combined = [...orderedBatchRecords, ...prev];
          return combined.slice(0, bufferLimit);
        });
      } catch (err) {
        console.error('[SSE] Failed to parse measurement batch:', err);
      }
    });

    es.addEventListener('heartbeat', () => {
      setConnected(true);
    });

    es.onerror = () => {
      console.warn('[SSE] Connection lost, retrying automatically...');
      setConnected(false);
    };
  }, [deviceId, bufferLimit]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  // Client-side active track status updates (transition to COASTING or expire if telemetry pauses)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTracks((prev) => {
        if (prev.length === 0) return prev;
        const now = Date.now();
        let changed = false;
        const next: AcousticTrack[] = [];
        for (const t of prev) {
          const silenceMs = now - t.lastUpdatedMs;
          if (silenceMs > 2500) {
            changed = true;
            continue; // Expired
          }
          if (silenceMs >= 150 && t.state === 'ACTIVE') {
            changed = true;
            next.push({ ...t, state: 'COASTING' });
          } else {
            next.push(t);
          }
        }
        return changed ? next : prev;
      });
    }, 400);

    return () => clearInterval(timer);
  }, []);

  const clearEvents = useCallback(() => {
    setRecentEvents([]);
    setActiveTracks([]);
  }, []);

  return {
    connected,
    latestBatch,
    recentEvents,
    activeTracks,
    bufferLimit,
    setBufferLimit,
    clockSource,
    crcVerified,
    totalEventCount,
    globalEventCount,
    clearEvents,
    reconnect: connect,
  };
}
