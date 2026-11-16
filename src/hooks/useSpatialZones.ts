import { useState, useEffect, useCallback } from 'react';
import { SpatialZone, ZonesConfigSsePayload } from '../types/api_types';
import { extractApiErrorMessage, formatClientError } from '../services/error_messages.js';

export const DEFAULT_SPATIAL_ZONES: SpatialZone[] = [
  { name: 'Podium / Stage', min_angle_deg: -30.0, max_angle_deg: 30.0, color: '#10b981', alert_threshold_db: 75.0 },
  { name: 'Audience Left', min_angle_deg: -90.0, max_angle_deg: -30.0, color: '#818cf8', alert_threshold_db: 75.0 },
  { name: 'Audience Right', min_angle_deg: 30.0, max_angle_deg: 90.0, color: '#38bdf8', alert_threshold_db: 75.0 },
  { name: 'Rear Gallery', min_angle_deg: 150.0, max_angle_deg: 180.0, color: '#f59e0b', alert_threshold_db: 75.0 },
];

export function useSpatialZones(
  deviceId: number,
  token?: string | null,
  latestZonesConfig?: ZonesConfigSsePayload | null
) {
  const [zones, setZones] = useState<SpatialZone[]>(DEFAULT_SPATIAL_ZONES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/v1/devices/${deviceId}/zones`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        const message = await extractApiErrorMessage(res, 'Failed to load spatial zones.');
        throw new Error(message);
      }
      const data: SpatialZone[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setZones(data);
      } else {
        setZones(DEFAULT_SPATIAL_ZONES);
      }
    } catch (err) {
      const message = formatClientError(err, 'Failed to load spatial zones.');
      console.warn('[useSpatialZones] Falling back to default zones:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [deviceId, token]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  useEffect(() => {
    if (latestZonesConfig && latestZonesConfig.deviceId === deviceId && Array.isArray(latestZonesConfig.zones)) {
      setZones(latestZonesConfig.zones);
      setError(null);
    }
  }, [latestZonesConfig, deviceId]);

  const saveZones = async (newZones: SpatialZone[]): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/v1/devices/${deviceId}/zones`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(newZones),
      });

      if (!res.ok) {
        const msg = await extractApiErrorMessage(res, 'Failed to update spatial zones.');
        setError(msg);
        return { success: false, error: msg };
      }

      const data = await res.json();
      if (data.zones && Array.isArray(data.zones)) {
        setZones(data.zones);
      } else {
        setZones(newZones);
      }
      return { success: true };
    } catch (err) {
      const msg = formatClientError(err, 'Failed to save spatial zones.');
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  return {
    zones,
    loading,
    error,
    clearError,
    reloadZones: fetchZones,
    saveZones,
  };
}

export default useSpatialZones;
