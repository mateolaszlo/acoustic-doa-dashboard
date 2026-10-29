import { useState, useEffect, useRef, useCallback } from 'react';
import { MeasurementBatchPayload, MeasurementEvent } from '../types/api_types.js';

interface UseSSEStreamOptions {
  deviceId: number;
  maxBufferLength?: number;
}

export function useSSEStream({ deviceId, maxBufferLength = 100 }: UseSSEStreamOptions) {
  const [connected, setConnected] = useState(false);
  const [latestBatch, setLatestBatch] = useState<MeasurementBatchPayload | null>(null);
  const [recentEvents, setRecentEvents] = useState<MeasurementEvent[]>([]);
  const [clockSource, setClockSource] = useState<string>('UNKNOWN');
  const [crcVerified, setCrcVerified] = useState(false);
  const [totalEventCount, setTotalEventCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);

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

        setRecentEvents((prev) => {
          const combined = [...batch.records, ...prev];
          return combined.slice(0, maxBufferLength);
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
  }, [deviceId, maxBufferLength]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return {
    connected,
    latestBatch,
    recentEvents,
    clockSource,
    crcVerified,
    totalEventCount,
    reconnect: connect,
  };
}
