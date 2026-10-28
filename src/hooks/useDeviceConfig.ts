import { useState, useEffect, useCallback } from 'react';
import { DeviceCalibration } from '../types/api_types.js';

export function useDeviceConfig(deviceId: number, token?: string | null) {
  const [config, setConfig] = useState<DeviceCalibration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/devices/${deviceId}/config`);
      if (!res.ok) {
        throw new Error(`Failed to load config (HTTP ${res.status})`);
      }
      const data = await res.json();
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = async (partial: Partial<DeviceCalibration>) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/v1/devices/${deviceId}/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(partial),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          throw new Error('Administrator privileges required to update calibration.');
        }
        throw new Error(body.error?.message || `Failed to update config (HTTP ${res.status})`);
      }

      const updated = await res.json();
      setConfig(updated);
      setSuccessMsg('Configuration saved! ESP32 will synchronize on next poll (<=60s).');
      setTimeout(() => setSuccessMsg(null), 5000);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const calibrateZeroAngle = async (sampleCount = 20) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/v1/devices/${deviceId}/calibrate/zero-angle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sample_count: sampleCount }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Administrator privileges required to trigger zero-angle trim.');
        }
        throw new Error('Zero-angle calibration failed');
      }

      const result = await res.json();
      await fetchConfig(); // Refresh
      setSuccessMsg(`Zero-angle calibrated: offset adjusted to ${result.newOffset}° (${result.samplesUsed} samples)`);
      setTimeout(() => setSuccessMsg(null), 5000);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    config,
    loading,
    error,
    successMsg,
    refreshConfig: fetchConfig,
    updateConfig,
    calibrateZeroAngle,
  };
}

export default useDeviceConfig;
