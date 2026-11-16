import { useState, useEffect, useCallback } from 'react';
import { DeviceCalibration, DeviceConfigSsePayload } from '../types/api_types.js';
import { extractApiErrorMessage, formatClientError } from '../services/error_messages.js';

export function useDeviceConfig(
  deviceId: number,
  token?: string | null,
  latestDeviceConfig?: DeviceConfigSsePayload | null
) {
  const [config, setConfig] = useState<DeviceCalibration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/v1/devices/${deviceId}/config`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) {
        const message = await extractApiErrorMessage(res, 'Failed to load device configuration.');
        throw new Error(message);
      }
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError(formatClientError(err, 'Failed to load device configuration.'));
    } finally {
      setLoading(false);
    }
  }, [deviceId, token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (latestDeviceConfig && latestDeviceConfig.deviceId === deviceId && latestDeviceConfig.calibration) {
      setConfig(latestDeviceConfig.calibration);
    }
  }, [latestDeviceConfig, deviceId]);

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
        credentials: 'include',
        headers,
        body: JSON.stringify(partial),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Administrator privileges required to update calibration.');
        }
        const message = await extractApiErrorMessage(res, 'Failed to update device configuration.');
        throw new Error(message);
      }

      const updated = await res.json();
      setConfig(updated);
      setSuccessMsg('Configuration saved! ESP32 will synchronize on next poll (<=60s).');
      setTimeout(() => setSuccessMsg(null), 5000);
      return true;
    } catch (err) {
      setError(formatClientError(err, 'Failed to update device configuration.'));
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
        credentials: 'include',
        headers,
        body: JSON.stringify({ sample_count: sampleCount }),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('Administrator privileges required to trigger zero-angle trim.');
        }
        const message = await extractApiErrorMessage(res, 'Zero-angle calibration failed.');
        throw new Error(message);
      }

      const result = await res.json();
      await fetchConfig(); // Refresh
      setSuccessMsg(`Zero-angle calibrated: offset adjusted to ${result.newOffset}° (${result.samplesUsed} samples)`);
      setTimeout(() => setSuccessMsg(null), 5000);
      return result;
    } catch (err) {
      setError(formatClientError(err, 'Zero-angle calibration failed.'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    config,
    loading,
    error,
    clearError,
    successMsg,
    refreshConfig: fetchConfig,
    updateConfig,
    calibrateZeroAngle,
  };
}

export default useDeviceConfig;
