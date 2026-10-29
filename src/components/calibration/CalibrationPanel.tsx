import React, { useState, useEffect } from 'react';
import { DeviceCalibration } from '../../types/api_types.js';
import { Sliders, RefreshCw, Crosshair, CheckCircle2, AlertCircle, Save, RotateCcw, Sparkles } from 'lucide-react';

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

  const handleResetDefaults = () => {
    setMicDistMm(82);
    setAngleOffsetDeg(0.0);
    setSplThresholdDb(55.0);
    setDbSplOffset(96.5);
    setCorrThreshold(0.40);
    setAdaptiveEnabled(true);
    setSnrMarginDb(8.0);
    setSampleRate(44100);
  };

  const applyPreset = (preset: 'quiet' | 'noisy' | 'anechoic') => {
    if (preset === 'quiet') {
      setSplThresholdDb(50.0);
      setCorrThreshold(0.35);
      setSnrMarginDb(6.0);
      setAdaptiveEnabled(true);
    } else if (preset === 'noisy') {
      setSplThresholdDb(68.0);
      setCorrThreshold(0.50);
      setSnrMarginDb(12.0);
      setAdaptiveEnabled(true);
    } else if (preset === 'anechoic') {
      setSplThresholdDb(45.0);
      setCorrThreshold(0.25);
      setSnrMarginDb(4.0);
      setAdaptiveEnabled(false);
    }
  };

  // SVG Array Schematic Geometry calculation
  const svgCenter = 60;
  // Normalize mic distance 20mm..110mm to 20px..50px box half-size
  const boxHalf = 18 + ((micDistMm - 20) / (110 - 20)) * 26;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-lg">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              HARDWARE & DSP ARRAY CALIBRATION
            </h2>
            <p className="text-xs text-slate-400">
              Manage acoustic thresholds, physical geometry, and zero-angle mounting trim
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-1" />
            <button
              type="button"
              onClick={() => applyPreset('quiet')}
              className="px-2 py-0.5 rounded text-slate-300 hover:text-white transition"
              title="Optimized for quiet room / office"
            >
              Quiet
            </button>
            <button
              type="button"
              onClick={() => applyPreset('noisy')}
              className="px-2 py-0.5 rounded text-slate-300 hover:text-white transition"
              title="Optimized for workshop / industrial noise"
            >
              Noisy
            </button>
            <button
              type="button"
              onClick={() => applyPreset('anechoic')}
              className="px-2 py-0.5 rounded text-slate-300 hover:text-white transition"
              title="High sensitivity for anechoic lab"
            >
              Anechoic
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            title="Reset to factory hardware defaults"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Defaults</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Interactive Physical Array Visualizer & Sliders Grid */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col md:flex-row items-center gap-6">
          {/* Live SVG Schematic */}
          <div className="flex flex-col items-center shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120" className="overflow-visible">
              {/* Outer compass rim */}
              <circle cx={svgCenter} cy={svgCenter} r="54" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />
              
              {/* Front Arrow */}
              <line x1={svgCenter} y1={svgCenter - 54} x2={svgCenter} y2={svgCenter - 44} stroke="#10b981" strokeWidth="1.5" />
              <text x={svgCenter} y={svgCenter - 46} textAnchor="middle" fill="#10b981" fontSize="8" fontFamily="monospace">
                N
              </text>

              {/* Rotated Array Group */}
              <g transform={`rotate(${angleOffsetDeg} ${svgCenter} ${svgCenter})`}>
                {/* Array Square Frame */}
                <rect
                  x={svgCenter - boxHalf}
                  y={svgCenter - boxHalf}
                  width={boxHalf * 2}
                  height={boxHalf * 2}
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="#10b981"
                  strokeWidth="1.2"
                />

                {/* Microphone Nodes: M0 (RB), M1 (RF), M2 (LF), M3 (LB) */}
                <circle cx={svgCenter + boxHalf} cy={svgCenter + boxHalf} r="3.5" fill="#f59e0b" />
                <circle cx={svgCenter + boxHalf} cy={svgCenter - boxHalf} r="3.5" fill="#10b981" />
                <circle cx={svgCenter - boxHalf} cy={svgCenter - boxHalf} r="3.5" fill="#818cf8" />
                <circle cx={svgCenter - boxHalf} cy={svgCenter + boxHalf} r="3.5" fill="#f43f5e" />

                {/* Array Orientation Arrow */}
                <line x1={svgCenter} y1={svgCenter} x2={svgCenter} y2={svgCenter - boxHalf - 6} stroke="#34d399" strokeWidth="1.5" />
                <polygon points={`${svgCenter},${svgCenter - boxHalf - 9} ${svgCenter - 3},${svgCenter - boxHalf - 5} ${svgCenter + 3},${svgCenter - boxHalf - 5}`} fill="#34d399" />
              </g>

              {/* Center Pivot */}
              <circle cx={svgCenter} cy={svgCenter} r="2" fill="#ffffff" />
            </svg>
            <span className="text-[10px] font-mono text-slate-400 mt-1">
              Array Preview: {micDistMm}mm &bull; {angleOffsetDeg > 0 ? '+' : ''}{angleOffsetDeg.toFixed(1)}°
            </span>
          </div>

          {/* Core Geometric Sliders */}
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Microphone Spacing (d) */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Array Spacing (d)</span>
                <span className="font-mono text-emerald-400 font-bold">{micDistMm} mm</span>
              </div>
              <input
                type="range"
                min="20"
                max="110"
                value={micDistMm}
                onChange={(e) => setMicDistMm(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Square side length (hardware default: 82 mm)</span>
            </div>

            {/* Rotational Zero Trim */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Rotational Zero Trim (ϕ offset)</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {angleOffsetDeg > 0 ? '+' : ''}{angleOffsetDeg.toFixed(1)}°
                </span>
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
              <span className="text-[10px] text-slate-500">Compensates mounting azimuth alignment</span>
            </div>
          </div>
        </div>

        {/* Acoustic DSP Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sound Level Threshold */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Trigger Sound Threshold</span>
              <span className="font-mono text-emerald-400 font-bold">{splThresholdDb.toFixed(1)} dB SPL</span>
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
            <span className="text-[10px] text-slate-500">Minimum sound pressure level to trigger FFT pipeline</span>
          </div>

          {/* Microphone Sensitivity Offset (db_spl_offset) */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Sensitivity dB SPL Offset</span>
              <span className="font-mono text-emerald-400 font-bold">{dbSplOffset.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="-50"
              max="150"
              step="0.5"
              value={dbSplOffset}
              onChange={(e) => setDbSplOffset(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Calibrated via 94 dB / 1 kHz acoustic calibrator (default: 96.5 dB)</span>
          </div>

          {/* GCC-PHAT Correlation Cutoff */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>GCC-PHAT Correlation Cutoff</span>
              <span className="font-mono text-emerald-400 font-bold">{corrThreshold.toFixed(2)}</span>
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
            <span className="text-[10px] text-slate-500">Parabolic peak confidence cutoff for WLS solver</span>
          </div>

          {/* SNR Margin */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
              <span>Adaptive SNR Margin</span>
              <span className="font-mono text-emerald-400 font-bold">{snrMarginDb.toFixed(1)} dB</span>
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
            <span className="text-[10px] text-slate-500">Required signal margin above estimated ambient noise floor</span>
          </div>

          {/* Audio Sample Rate */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Dual-I2S Quad DMA Audio Sample Rate
            </label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(parseInt(e.target.value, 10))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono cursor-pointer"
            >
              <option value={44100}>44,100 Hz &bull; Standard Acoustic Bandwidth (Default)</option>
              <option value={48000}>48,000 Hz &bull; Professional Broadcast Audio Clock</option>
            </select>
            <span className="text-[10px] text-slate-500">Reinitializes I2S0/I2S1 peripheral clocks on the ESP32 in-place</span>
          </div>
        </div>

        {/* Adaptive Dynamic Threshold Toggle */}
        <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
          <input
            type="checkbox"
            id="adaptive"
            checked={adaptiveEnabled}
            onChange={(e) => setAdaptiveEnabled(e.target.checked)}
            className="w-4 h-4 accent-emerald-500 rounded bg-slate-800 border-slate-700 cursor-pointer"
          />
          <label htmlFor="adaptive" className="text-xs text-slate-200 cursor-pointer font-medium">
            Enable Dynamic Noise Floor Tracking (Continuous ambient RMS integration)
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleZeroAngleClick}
            disabled={calibratingZero || loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
          >
            {calibratingZero ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Crosshair className="w-4 h-4 text-emerald-400" />
            )}
            <span>1-Click Zero-Angle Calibration Trim</span>
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-950 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration to Server</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default CalibrationPanel;
