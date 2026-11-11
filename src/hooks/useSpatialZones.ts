import { useState, useEffect, useCallback } from 'react';
import { SpatialZone } from '../types/api_types';

export const DEFAULT_SPATIAL_ZONES: SpatialZone[] = [
  { name: 'Podium / Stage', min_angle_deg: -30.0, max_angle_deg: 30.0, color: '#10b981', alert_threshold_db: 75.0 },
  { name: 'Audience Left', min_angle_deg: -90.0, max_angle_deg: -30.0, color: '#818cf8', alert_threshold_db: 75.0 },
  { name: 'Audience Right', min_angle_deg: 30.0, max_angle_deg: 90.0, color: '#38bdf8', alert_threshold_db: 75.0 },
  { name: 'Rear Gallery', min_angle_deg: 150.0, max_angle_deg: 180.0, color: '#f59e0b', alert_threshold_db: 75.0 },
];

export function useSpatialZones(deviceId: number, token?: string | null) {
  const [zones, setZones] = useState<SpatialZone[]>(DEFAULT_SPATIAL_ZONES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/devices/${deviceId}/zones`);
      if (!res.ok) {
        throw new Error(`Failed to load zones (HTTP ${res.status})`);
      }
      const data: SpatialZone[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setZones(data);
      } else {
        setZones(DEFAULT_SPATIAL_ZONES);
      }
    } catch (err: any) {
      console.warn('[useSpatialZones] Falling back to default zones:', err.message);
      // Keep default zones on network error
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

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
        headers,
        body: JSON.stringify(newZones),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error?.message || `Failed to update zones (HTTP ${res.status})`;
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
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    zones,
    loading,
    error,
    reloadZones: fetchZones,
    saveZones,
  };
}

export default useSpatialZones;
