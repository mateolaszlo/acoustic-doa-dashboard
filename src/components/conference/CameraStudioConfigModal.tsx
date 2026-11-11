import React from 'react';
import { VirtualCamera, CameraDirectorConfig } from '../../types/api_types';
import { X, Camera, Sliders, Zap, RotateCcw } from 'lucide-react';

interface CameraStudioConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: VirtualCamera[];
  config: CameraDirectorConfig;
  onUpdateCamera: (id: string, partial: Partial<VirtualCamera>) => void;
  onUpdateConfig: (partial: Partial<CameraDirectorConfig>) => void;
  onResetDefaults: () => void;
  onSetCameraCount?: (count: number) => void;
}

export const CameraStudioConfigModal: React.FC<CameraStudioConfigModalProps> = ({
  isOpen,
  onClose,
  cameras,
  config,
  onUpdateCamera,
  onUpdateConfig,
  onResetDefaults,
  onSetCameraCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 text-base">
              Multi-Camera Studio &amp; Director Setup
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs">
          {/* Section 1: Global Director & Schmitt-Trigger Parameters */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Automated Switching &amp; Hysteresis Engine</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                SCHMITT TRIGGER
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Slew Speed */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Pan Slew Speed:</span>
                  <span className="font-mono text-slate-200">{config.slewSpeedDegPerSec}°/s</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={240}
                  step={10}
                  value={config.slewSpeedDegPerSec}
                  onChange={(e) => onUpdateConfig({ slewSpeedDegPerSec: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">
                  Robotic pan inertia cap (90°–150°/s recommended for conference).
                </span>
              </div>

              {/* Instant Cut vs Smooth Slew */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Shot Transition Style:</span>
                  <span className="font-mono text-slate-200">
                    {config.instantCut ? 'Broadcast Instant Cut' : 'Smooth Pan Slew'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => onUpdateConfig({ instantCut: false })}
                    className={`px-3 py-1.5 rounded font-medium transition ${
                      !config.instantCut
                        ? 'bg-emerald-600 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Smooth Slew
                  </button>
                  <button
                    onClick={() => onUpdateConfig({ instantCut: true })}
                    className={`px-3 py-1.5 rounded font-medium flex items-center space-x-1 transition ${
                      config.instantCut
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Instant Cut</span>
                  </button>
                </div>
              </div>

              {/* Minimum Shot Hold Time */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Shot Hold Time (Debounce):</span>
                  <span className="font-mono text-slate-200">
                    {(config.holdTimeMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={4000}
                  step={200}
                  value={config.holdTimeMs}
                  onChange={(e) => onUpdateConfig({ holdTimeMs: Number(e.target.value) })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">
                  Prevents frantic camera cuts during quick conversational back-and-forth.
                </span>
              </div>

              {/* Schmitt Trigger Score Margin */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Schmitt Switching Margin:</span>
                  <span className="font-mono text-slate-200">+{config.hysteresisMarginPercent}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={40}
                  step={5}
                  value={config.hysteresisMarginPercent}
                  onChange={(e) => onUpdateConfig({ hysteresisMarginPercent: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block">
                  New camera score must exceed active camera score by this margin to switch.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Virtual Cameras Deployment */}
          <div className="space-y-3">
            {/* Camera Count Rig Selector */}
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-semibold text-slate-200 block text-xs">
                  Active Camera Rig Configuration
                </span>
                <span className="text-[11px] text-slate-400">
                  Select available cameras for live tracking and switching.
                </span>
              </div>
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 space-x-1 shrink-0">
                {[
                  { count: 1, label: '1 Camera', tag: '1-CAMERA' },
                  { count: 2, label: '2 Cameras', tag: '2-CAMERAS' },
                  { count: 3, label: '3 Cameras', tag: '3-CAMERAS' },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => onSetCameraCount?.(opt.count)}
                    className={`px-2.5 py-1.5 rounded text-xs transition flex items-center space-x-1.5 ${
                      cameras.length === opt.count
                        ? 'bg-emerald-600 text-slate-950 font-bold shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 font-medium'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        cameras.length === opt.count
                          ? 'bg-emerald-800/40 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {opt.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold text-slate-200 text-xs">
                Configured Studio Cameras ({cameras.length === 1 ? '1 Camera Active' : `${cameras.length} Cameras Active`})
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
                {cameras.length === 1 ? '1-CAMERA READY' : `${cameras.length}-CAMERAS READY`}
              </span>
            </div>

            <div className="space-y-3">
              {cameras.map((cam) => (
                <div
                  key={cam.id}
                  className={`p-3.5 rounded-lg border transition ${
                    cam.isLive
                      ? 'bg-slate-950 border-emerald-500/80 shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cam.color }}
                      />
                      <input
                        type="text"
                        value={cam.name}
                        onChange={(e) => onUpdateCamera(cam.id, { name: e.target.value })}
                        className="font-medium text-slate-200 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none px-1"
                      />
                    </div>

                    <div className="flex items-center space-x-2 font-mono text-[10px]">
                      {cam.isLive ? (
                        <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                          ON AIR • LIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          STANDBY
                        </span>
                      )}
                      <span className="text-slate-500 uppercase">Role: {cam.role}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Position X */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Room X Position:</span>
                        <span className="font-mono text-slate-300">{Math.round(cam.xRatio * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        value={cam.xRatio}
                        onChange={(e) => onUpdateCamera(cam.id, { xRatio: Number(e.target.value) })}
                        className="w-full accent-slate-400 cursor-pointer"
                      />
                    </div>

                    {/* Position Y */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Room Y Position:</span>
                        <span className="font-mono text-slate-300">{Math.round(cam.yRatio * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        value={cam.yRatio}
                        onChange={(e) => onUpdateCamera(cam.id, { yRatio: Number(e.target.value) })}
                        className="w-full accent-slate-400 cursor-pointer"
                      />
                    </div>

                    {/* Resting Pan Angle */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Resting Azimuth:</span>
                        <span className="font-mono text-slate-300">{cam.restingPanDeg}°</span>
                      </div>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={5}
                        value={cam.restingPanDeg}
                        onChange={(e) => onUpdateCamera(cam.id, { restingPanDeg: Number(e.target.value) })}
                        className="w-full accent-slate-400 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800">
          <button
            onClick={onResetDefaults}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Factory Positions</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraStudioConfigModal;
