import React from 'react';
import { MeasurementEvent } from '../../types/api_types.js';
import { Volume2, Navigation, Activity, Clock, ShieldCheck } from 'lucide-react';
import { getDirectionLabel } from '../../services/radar_math.js';

interface TelemetryGaugesProps {
  latestEvent?: MeasurementEvent;
  clockSource: string;
  crcVerified?: boolean;
  connected: boolean;
}

export const TelemetryGauges: React.FC<TelemetryGaugesProps> = ({
  latestEvent,
  clockSource,
  crcVerified,
  connected,
}) => {
  const angle = latestEvent?.angleDeg ?? 0.0;
  const spl = latestEvent?.soundLevelDb ?? 0.0;
  const confidence = latestEvent?.confidence ?? 0.0;
  const delay = latestEvent?.delayUs ?? 0.0;

  const directionLabel = latestEvent ? getDirectionLabel(angle) : 'IDLE';

  let splColorClass = 'text-emerald-400';
  let splBarClass = 'bg-emerald-500';
  if (spl >= 75) {
    splColorClass = 'text-rose-500';
    splBarClass = 'bg-rose-500';
  } else if (spl >= 60) {
    splColorClass = 'text-amber-400';
    splBarClass = 'bg-amber-400';
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Azimuth Angle */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
          <span>DIRECTION (DOA)</span>
          <Navigation className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="my-2">
          <div className="text-3xl font-mono font-bold tracking-tight text-white">
            {latestEvent ? `${angle > 0 ? '+' : ''}${angle.toFixed(1)}°` : '--.-°'}
          </div>
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mt-0.5">
            {latestEvent ? directionLabel : 'IDLE'}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          Baseline Delay: {latestEvent ? `${delay.toFixed(1)} µs` : '-- µs'}
        </div>
      </div>

      {/* Sound Level (dB SPL) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
          <span>SOUND LEVEL (SPL)</span>
          <Volume2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="my-2">
          <div className={`text-3xl font-mono font-bold tracking-tight ${splColorClass}`}>
            {latestEvent ? `${spl.toFixed(1)}` : '--.-'}
            <span className="text-sm font-normal text-slate-400 ml-1">dB SPL</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${splBarClass}`}
              style={{ width: `${Math.min(100, Math.max(0, ((spl - 40) / 60) * 100))}%` }}
            />
          </div>
        </div>
        <div className="text-[11px] text-slate-500">
          Threshold: 55.0 dB SPL
        </div>
      </div>

      {/* Confidence */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
          <span>CORRELATION WLS</span>
          <Activity className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="my-2">
          <div className="text-3xl font-mono font-bold tracking-tight text-white">
            {latestEvent ? `${(confidence * 100).toFixed(0)}%` : '--%'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {confidence >= 0.8 ? 'High Confidence' : confidence >= 0.5 ? 'Moderate' : 'Low / Diffuse'}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          6-Pair Array WLS
        </div>
      </div>

      {/* Sync & Connectivity */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
          <span>TIME & SYNC</span>
          <Clock className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="my-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-base font-bold text-white tracking-wide">
              {connected ? 'LIVE STREAM' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-300 mt-1">
            {clockSource === 'SNTP_UTC'
              ? 'UTC (NTP Lock)'
              : clockSource === 'SERVER_UTC'
              ? 'UTC (Server Est)'
              : clockSource === 'MONOTONIC_UPTIME'
              ? 'Monotonic Uptime'
              : 'Sync Pending'}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>{crcVerified ? 'IEEE 802.3 CRC32 Validated' : 'HTTPS / SSE Verified'}</span>
        </div>
      </div>
    </div>
  );
};
