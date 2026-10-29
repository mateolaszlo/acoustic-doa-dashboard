import React, { useState, useEffect } from 'react';
import { DeviceCalibration } from '../../types/api_types.js';
import { Sliders, RefreshCw, Crosshair, CheckCircle2, AlertCircle, Save, RotateCcw, Sparkles, BookmarkCheck } from 'lucide-react';

interface CalibrationPanelProps {
  config: DeviceCalibration | null;
  loading: boolean;
  error: string | null;
  successMsg: string | null;
  onUpdate: (partial: Partial<DeviceCalibration>) => Promise<boolean>;
  onCalibrateZeroAngle: (sampleCount: number) => Promise<any>;
}

interface PresetValues {
  splThresholdDb: number;
  dbSplOffset: number;
  corrThreshold: number;
  snrMarginDb: number;
  adaptiveEnabled: boolean;
  sampleRate: number;
}

const DEFAULT_PRESETS: Record<string, PresetValues> = {
  quiet: {
    splThresholdDb: 50.0,
    dbSplOffset: 96.5,
    corrThreshold: 0.35,
    snrMarginDb: 6.0,
    adaptiveEnabled: true,
    sampleRate: 44100,
  },
  noisy: {
    splThresholdDb: 68.0,
    dbSplOffset: 96.5,
    corrThreshold: 0.50,
    snrMarginDb: 12.0,
    adaptiveEnabled: true,
    sampleRate: 48000,
  },
  anechoic: {
    splThresholdDb: 45.0,
    dbSplOffset: 96.5,
    corrThreshold: 0.25,
    snrMarginDb: 4.0,
    adaptiveEnabled: false,
    sampleRate: 48000,
  },
  custom: {
    splThresholdDb: 55.0,
    dbSplOffset: 96.5,
    corrThreshold: 0.40,
    snrMarginDb: 8.0,
    adaptiveEnabled: true,
    sampleRate: 44100,
  },
};

const PRESET_STORAGE_KEY = 'acoustic_doa_calibration_presets';

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
  const [activePreset, setActivePreset] = useState<string>('custom');
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  // Load presets from localStorage or defaults
  const [presets, setPresets] = useState<Record<string, PresetValues>>(() => {
    try {
      const saved = localStorage.getItem(PRESET_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PRESETS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse saved presets, using defaults:', e);
    }
    return DEFAULT_PRESETS;
  });

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
    const result = await onCalibrateZeroAngle(25);
    if (result && result.newOffset !== undefined) {
      setAngleOffsetDeg(result.newOffset);
    }
    setCalibratingZero(false);
  };

  const handleResetTrimToZero = () => {
    setAngleOffsetDeg(0.0);
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
    setActivePreset('custom');
  };

  const applyPreset = (presetKey: string) => {
    const p = presets[presetKey];
    if (!p) return;
    setActivePreset(presetKey);
    setSplThresholdDb(p.splThresholdDb);
    setDbSplOffset(p.dbSplOffset);
    setCorrThreshold(p.corrThreshold);
    setSnrMarginDb(p.snrMarginDb);
    setAdaptiveEnabled(p.adaptiveEnabled);
    setSampleRate(p.sampleRate);
  };

  const saveCurrentToPreset = () => {
    const updated: PresetValues = {
      splThresholdDb,
      dbSplOffset,
      corrThreshold,
      snrMarginDb,
      adaptiveEnabled,
      sampleRate,
    };
    const nextPresets = {
      ...presets,
      [activePreset]: updated,
    };
    setPresets(nextPresets);
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(nextPresets));
      setPresetFeedback(`Profile "${activePreset.toUpperCase()}" saved successfully!`);
      setTimeout(() => setPresetFeedback(null), 3500);
    } catch (e) {
      console.error('Failed to save preset to localStorage:', e);
    }
  };

  const restoreFactoryPresets = () => {
    setPresets(DEFAULT_PRESETS);
    try {
      localStorage.removeItem(PRESET_STORAGE_KEY);
      setPresetFeedback('Factory presets restored.');
      setTimeout(() => setPresetFeedback(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // SVG Array Schematic Geometry calculation
  // ViewBox: 150x150, Center at (75, 75). Radius to edge is 75px.
  const svgCenter = 75;
  // Normalize mic distance 20mm..110mm to 16px..42px box half-size
  // Maximum diagonal at 42px is ~59.4px, fully within the 75px radius.
  const boxHalf = 16 + ((micDistMm - 20) / (110 - 20)) * 26;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-lg">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide whitespace-nowrap">
              HARDWARE & DSP ARRAY CALIBRATION
            </h2>
            <p className="text-xs text-slate-400">
              Manage acoustic thresholds, physical geometry, and zero-angle mounting trim
            </p>
          </div>
        </div>

        {/* Preset Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-1 shrink-0" />
            {(['quiet', 'noisy', 'anechoic', 'custom'] as const).map((pk) => (
              <button
                key={pk}
                type="button"
                onClick={() => applyPreset(pk)}
                className={`px-2.5 py-1 rounded capitalize font-medium transition ${
                  activePreset === pk
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
                title={`Load ${pk} profile settings`}
              >
                {pk}
              </button>
            ))}
          </div>

          {/* Save to Active Preset */}
          <button
            type="button"
            onClick={saveCurrentToPreset}
            title={`Save current values into "${activePreset.toUpperCase()}" profile`}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Save Preset</span>
          </button>

          {/* Factory Defaults Reset */}
          <button
            type="button"
            onClick={handleResetDefaults}
            title="Reset active form to factory hardware defaults"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Defaults</span>
          </button>
        </div>
      </div>

      {/* Preset Feedback Toast */}
      {presetFeedback && (
        <div className="p-2.5 bg-emerald-950/70 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{presetFeedback}</span>
          </div>
          <button
            type="button"
            onClick={restoreFactoryPresets}
            className="text-[10px] underline hover:text-white text-slate-400 ml-4"
          >
            Reset all presets to factory
          </button>
        </div>
      )}

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
          {/* Live SVG Schematic with Strict Fixed Width Container */}
          <div className="w-44 shrink-0 flex flex-col items-center justify-center select-none">
            <svg width="150" height="150" viewBox="0 0 150 150" className="overflow-hidden">
              {/* Outer compass rim */}
              <circle cx={svgCenter} cy={svgCenter} r="65" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={svgCenter} cy={svgCenter} r="45" fill="none" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="2 2" />

              {/* Cardinal North Reference Mark */}
              <line x1={svgCenter} y1={svgCenter - 65} x2={svgCenter} y2={svgCenter - 54} stroke="#10b981" strokeWidth="1.8" />
              <text x={svgCenter} y={svgCenter - 56} textAnchor="middle" fill="#10b981" fontSize="9" fontFamily="monospace" fontWeight="bold">
                0° FRONT
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
                  strokeWidth="1.5"
                />

                {/* Microphone Nodes: M0 (RB), M1 (RF), M2 (LF), M3 (LB) */}
                <circle cx={svgCenter + boxHalf} cy={svgCenter + boxHalf} r="3.5" fill="#f59e0b" />
                <circle cx={svgCenter + boxHalf} cy={svgCenter - boxHalf} r="3.5" fill="#10b981" />
                <circle cx={svgCenter - boxHalf} cy={svgCenter - boxHalf} r="3.5" fill="#818cf8" />
                <circle cx={svgCenter - boxHalf} cy={svgCenter + boxHalf} r="3.5" fill="#f43f5e" />

                {/* Array Orientation Arrow */}
                <line x1={svgCenter} y1={svgCenter} x2={svgCenter} y2={svgCenter - boxHalf - 7} stroke="#34d399" strokeWidth="1.6" />
                <polygon points={`${svgCenter},${svgCenter - boxHalf - 11} ${svgCenter - 3.5},${svgCenter - boxHalf - 6} ${svgCenter + 3.5},${svgCenter - boxHalf - 6}`} fill="#34d399" />
              </g>

              {/* Center Pivot */}
              <circle cx={svgCenter} cy={svgCenter} r="2.5" fill="#ffffff" />
            </svg>
            <div className="w-full text-center mt-1">
              <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap tabular-nums">
                {micDistMm}mm &bull; {angleOffsetDeg >= 0 ? '+' : ''}{angleOffsetDeg.toFixed(1)}°
              </span>
            </div>
          </div>

          {/* Core Geometric Sliders */}
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Microphone Spacing (d) */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                <span>Array Spacing (d)</span>
                <span className="font-mono text-emerald-400 font-bold tabular-nums">{micDistMm} mm</span>
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

            {/* Rotational Zero Trim with Quick 0° Button */}
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                <div className="flex items-center gap-1.5">
                  <span>Rotational Zero Trim (ϕ offset)</span>
                  <button
                    type="button"
                    onClick={handleResetTrimToZero}
                    title="Reset offset trim directly to 0.0°"
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 rounded text-[10px] font-mono font-bold transition"
                  >
                    Reset (0°)
                  </button>
                </div>
                <span className="font-mono text-emerald-400 font-bold tabular-nums min-w-[55px] text-right">
                  {angleOffsetDeg >= 0 ? '+' : ''}{angleOffsetDeg.toFixed(1)}°
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
              <span className="font-mono text-emerald-400 font-bold tabular-nums">{splThresholdDb.toFixed(1)} dB SPL</span>
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
              <span className="font-mono text-emerald-400 font-bold tabular-nums">{dbSplOffset.toFixed(1)} dB</span>
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
              <span className="font-mono text-emerald-400 font-bold tabular-nums">{corrThreshold.toFixed(2)}</span>
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
              <span className="font-mono text-emerald-400 font-bold tabular-nums">{snrMarginDb.toFixed(1)} dB</span>
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <button
              type="button"
              onClick={handleZeroAngleClick}
              disabled={calibratingZero || loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
              title="Acoustic Reference Alignment: Play a test tone directly in front (0°) and click. Computes circular mean of recent wavefronts to calibrate mounting error."
            >
              {calibratingZero ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <Crosshair className="w-4 h-4 text-emerald-400" />
              )}
              <span>Auto-Calibrate from 0° Front Source</span>
            </button>
            <span className="text-[10px] text-slate-500 hidden lg:inline max-w-xs">
              Play sound tone directly at 0° front to align acoustic axis
            </span>
          </div>

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
