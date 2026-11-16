import { useState, useEffect, useCallback } from 'react';
import { DeviceCalibration, DeviceConfigSsePayload } from '../types/api_types.js';
import { ApiError, apiRequestJson } from '../services/api_client.js';

export function useDeviceConfig(
  deviceId: number,
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
      const data = await apiRequestJson<DeviceCalibration>(`/api/v1/devices/${deviceId}/config`, {
        fallbackError: 'Failed to load device configuration.',
      });
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load device configuration.');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

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
      const updated = await apiRequestJson<DeviceCalibration>(`/api/v1/devices/${deviceId}/config`, {
        method: 'PUT',
        body: JSON.stringify(partial),
        fallbackError: 'Failed to update device configuration.',
      });
      setConfig(updated);
      setSuccessMsg('Configuration saved! ESP32 will synchronize on next poll (<=60s).');
      setTimeout(() => setSuccessMsg(null), 5000);
      return true;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError('Administrator privileges required to update calibration.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update device configuration.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const calibrateZeroAngle = async (sampleCount = 20) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequestJson<{ newOffset: number; samplesUsed: number }>(
        `/api/v1/devices/${deviceId}/calibrate/zero-angle`,
        {
          method: 'POST',
          body: JSON.stringify({ sample_count: sampleCount }),
          fallbackError: 'Zero-angle calibration failed.',
        }
      );
      await fetchConfig();
      setSuccessMsg(`Zero-angle calibrated: offset adjusted to ${result.newOffset}° (${result.samplesUsed} samples)`);
      setTimeout(() => setSuccessMsg(null), 5000);
      return result;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError('Administrator privileges required to trigger zero-angle trim.');
      } else {
        setError(err instanceof Error ? err.message : 'Zero-angle calibration failed.');
      }
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
