import { useState, useEffect, useCallback } from 'react';
import { SpatialZone, ZonesConfigSsePayload } from '../types/api_types';
import { apiRequestJson } from '../services/api_client.js';

export const DEFAULT_SPATIAL_ZONES: SpatialZone[] = [
  { name: 'Podium / Stage', min_angle_deg: -30.0, max_angle_deg: 30.0, color: '#10b981', alert_threshold_db: 75.0 },
  { name: 'Audience Left', min_angle_deg: -90.0, max_angle_deg: -30.0, color: '#818cf8', alert_threshold_db: 75.0 },
  { name: 'Audience Right', min_angle_deg: 30.0, max_angle_deg: 90.0, color: '#38bdf8', alert_threshold_db: 75.0 },
  { name: 'Rear Gallery', min_angle_deg: 150.0, max_angle_deg: 180.0, color: '#f59e0b', alert_threshold_db: 75.0 },
];

export function useSpatialZones(
  deviceId: number,
  latestZonesConfig?: ZonesConfigSsePayload | null
) {
  const [zones, setZones] = useState<SpatialZone[]>(DEFAULT_SPATIAL_ZONES);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchZones = useCallback(async () => {
    setError(null);
    try {
      const data = await apiRequestJson<SpatialZone[]>(`/api/v1/devices/${deviceId}/zones`, {
        fallbackError: 'Failed to load spatial zones.',
      });
      setZones(Array.isArray(data) && data.length > 0 ? data : DEFAULT_SPATIAL_ZONES);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load spatial zones.';
      console.warn('[useSpatialZones] Falling back to default zones:', message);
      setError(message);
    }
  }, [deviceId]);

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
    setError(null);
    try {
      const data = await apiRequestJson<{ zones?: SpatialZone[] }>(`/api/v1/devices/${deviceId}/zones`, {
        method: 'PUT',
        body: JSON.stringify(newZones),
        fallbackError: 'Failed to update spatial zones.',
      });
      setZones(data?.zones && Array.isArray(data.zones) ? data.zones : newZones);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save spatial zones.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  return {
    zones,
    error,
    clearError,
    reloadZones: fetchZones,
    saveZones,
  };
}
