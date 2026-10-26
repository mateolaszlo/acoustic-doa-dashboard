import { useState, useEffect, useCallback } from 'react';
import { DeviceCalibration } from '../types/api_types.js';

export function useDeviceConfig(deviceId: number) {
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
      const res = await fetch(`/api/v1/devices/${deviceId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
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
      const res = await fetch(`/api/v1/devices/${deviceId}/calibrate/zero-angle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_count: sampleCount }),
      });

      if (!res.ok) {
        throw new Error(`Zero-angle calibration failed`);
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
