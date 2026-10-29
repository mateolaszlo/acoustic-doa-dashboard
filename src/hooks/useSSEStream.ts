import { useState, useEffect, useRef, useCallback } from 'react';
import { MeasurementBatchPayload, MeasurementEvent } from '../types/api_types.js';

interface UseSSEStreamOptions {
  deviceId: number;
  maxBufferLength?: number;
}

export function useSSEStream({ deviceId, maxBufferLength = 500 }: UseSSEStreamOptions) {
  const [connected, setConnected] = useState(false);
  const [latestBatch, setLatestBatch] = useState<MeasurementBatchPayload | null>(null);
  const [recentEvents, setRecentEvents] = useState<MeasurementEvent[]>([]);
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

        setRecentEvents((prev) => {
          const combined = [...batch.records, ...prev];
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

  const clearEvents = useCallback(() => {
    setRecentEvents([]);
  }, []);

  return {
    connected,
    latestBatch,
    recentEvents,
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
