import React, { useState, useEffect } from 'react';
import { DeviceCalibration } from '../../types/api_types.js';
import { Sliders, RefreshCw, Crosshair, CheckCircle2, AlertCircle, Save } from 'lucide-react';

interface CalibrationPanelProps {
  config: DeviceCalibration | null;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  onUpdate: (partial: Partial<DeviceCalibration>) => Promise<boolean>;
  onCalibrateZeroAngle: (sampleCount: number) => Promise<any>;
}

export const CalibrationPanel: React.FC<CalibrationPanelProps> = ({
  config,
  loading,
  error,
  successMsg,
  onUpdate,
  onCalibrateZeroAngle,
}) => {
  const [micDistMm, setMicDistMm] = useState(82);
  const [angleOffsetDeg, setAngleOffsetDeg] = useState(0.0);
  const [splThresholdDb, setSplThresholdDb] = useState(55.0);
  const [dbSplOffset, setDbSplOffset] = useState(96.5);
  const [corrThreshold, setCorrThreshold] = useState(0.40);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);
  const [snrMarginDb, setSnrMarginDb] = useState(8.0);
  const [sampleRate, setSampleRate] = useState(44100);
  const [calibratingZero, setCalibratingZero] = useState(false);

  useEffect(() => {
    if (config) {
      setMicDistMm(Math.round(config.microphone_distance_m * 1000));
      setAngleOffsetDeg(config.angle_offset_deg);
      setSplThresholdDb(config.sound_level_threshold_db);
      setDbSplOffset(config.db_spl_offset);
      setCorrThreshold(config.correlation_threshold);
      setAdaptiveEnabled(config.adaptive_threshold_enabled);
      setSnrMarginDb(config.snr_margin_db);
      setSampleRate(config.sample_rate);
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdate({
      microphone_distance_m: micDistMm / 1000.0,
      angle_offset_deg: angleOffsetDeg,
      sound_level_threshold_db: splThresholdDb,
      db_spl_offset: dbSplOffset,
      correlation_threshold: corrThreshold,
      adaptive_threshold_enabled: adaptiveEnabled,
      snr_margin_db: snrMarginDb,
      sample_rate: sampleRate,
    });
  };

  const handleZeroAngleClick = async () => {
    setCalibratingZero(true);
    await onCalibrateZeroAngle(25);
    setCalibratingZero(false);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">Remote DSP & Array Calibration</h2>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Device ID: #{config?.device_id ?? 1}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Microphone Spacing */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Array Side Spacing (d)</span>
              <span className="font-mono text-emerald-400">{micDistMm} mm</span>
            </div>
            <input
              type="range"
              min="20"
              max="110"
              value={micDistMm}
              onChange={(e) => setMicDistMm(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Hardware distance between microphone pairs</span>
          </div>

          {/* Rotational Angle Trim */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Rotational Zero Trim (ϕ offset)</span>
              <span className="font-mono text-emerald-400">{angleOffsetDeg > 0 ? '+' : ''}{angleOffsetDeg.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="0.5"
              value={angleOffsetDeg}
              onChange={(e) => setAngleOffsetDeg(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Calibrates mounting orientation offset</span>
          </div>

          {/* Sound Level Threshold */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Trigger SPL Threshold</span>
              <span className="font-mono text-emerald-400">{splThresholdDb.toFixed(1)} dB SPL</span>
            </div>
            <input
              type="range"
              min="40"
              max="90"
              step="1"
              value={splThresholdDb}
              onChange={(e) => setSplThresholdDb(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Minimum sound pressure level to trigger DOA</span>
          </div>

          {/* Correlation Threshold */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>GCC-PHAT Correlation Threshold</span>
              <span className="font-mono text-emerald-400">{corrThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.90"
              step="0.05"
              value={corrThreshold}
              onChange={(e) => setCorrThreshold(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Peak confidence cutoff for WLS solver</span>
          </div>

          {/* SNR Margin */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Adaptive SNR Margin</span>
              <span className="font-mono text-emerald-400">{snrMarginDb.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="2"
              max="25"
              step="0.5"
              value={snrMarginDb}
              onChange={(e) => setSnrMarginDb(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Required margin above estimated ambient noise floor</span>
          </div>

          {/* Audio Sample Rate */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Audio Sample Rate (I2S DMA)
            </label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(parseInt(e.target.value, 10))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
            >
              <option value={44100}>44,100 Hz (Standard Acoustic Bandwidth)</option>
              <option value={48000}>48,000 Hz (Professional Audio Clock)</option>
            </select>
            <span className="text-[10px] text-slate-500">Reinitializes on-chip I2S sampler in place</span>
          </div>
        </div>

        {/* Adaptive Threshold Checkbox */}
        <div className="flex items-center gap-2 p-3 bg-slate-950/40 rounded-lg border border-slate-800">
          <input
            type="checkbox"
            id="adaptive"
            checked={adaptiveEnabled}
            onChange={(e) => setAdaptiveEnabled(e.target.checked)}
            className="w-4 h-4 accent-emerald-500 rounded bg-slate-800 border-slate-700 cursor-pointer"
          />
          <label htmlFor="adaptive" className="text-xs text-slate-200 cursor-pointer font-medium">
            Enable Dynamic Noise Floor Tracking (Adapts threshold to room acoustics)
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleZeroAngleClick}
            disabled={calibratingZero || loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
          >
            {calibratingZero ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Crosshair className="w-4 h-4 text-emerald-400" />
            )}
            <span>1-Click Zero-Angle Calibration</span>
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-950 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration to Server</span>
          </button>
        </div>
      </form>
    </div>
  );
};
