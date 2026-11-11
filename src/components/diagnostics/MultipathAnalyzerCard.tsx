import React from 'react';
import { AcousticTrack, MeasurementEvent } from '../../types/api_types';
import { analyzeMultipath } from '../../services/reverb_analyzer';
import { Waves, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface MultipathAnalyzerCardProps {
  activeTracks?: AcousticTrack[];
  latestEvents?: MeasurementEvent[];
}

export const MultipathAnalyzerCard: React.FC<MultipathAnalyzerCardProps> = ({
  activeTracks = [],
  latestEvents = [],
}) => {
  const metrics = analyzeMultipath(activeTracks, latestEvents);

  const getBadge = () => {
    switch (metrics.reverbState) {
      case 'DRY':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/80">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>DRY / ANECHOIC (&gt;12 dB)</span>
          </span>
        );
      case 'CONTROLLED':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-700/80">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>CONTROLLED ROOM (6-12 dB)</span>
          </span>
        );
      case 'REVERBERANT':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-700/80 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>HIGH REVERBERATION (&lt;6 dB)</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Waves className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-200 text-sm">Multipath & Reverberation Analyzer</h3>
          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded">
            CLEAN DECONVOLUTION
          </span>
        </div>
        {getBadge()}
      </div>

      {/* DRR Gauge & Energy Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* DRR Meter */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Direct-to-Reverberant Ratio (DRR)</span>
          <div className="flex items-baseline space-x-2 my-1">
            <span
              className={`text-2xl font-bold font-mono ${
                metrics.drrDb >= 12
                  ? 'text-emerald-400'
                  : metrics.drrDb >= 6
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {metrics.drrDb > 0 ? `+${metrics.drrDb}` : metrics.drrDb}
            </span>
            <span className="text-xs font-mono text-slate-400">dB</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                metrics.drrDb >= 12
                  ? 'bg-emerald-400'
                  : metrics.drrDb >= 6
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
              style={{
                width: `${Math.min(100, Math.max(5, (metrics.drrDb / 24) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Direct Path SPL */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Primary Direct Path SPL</span>
          <div className="flex items-baseline space-x-1 my-1">
            <span className="text-2xl font-bold font-mono text-emerald-300">
              {metrics.directSplDb > 0 ? metrics.directSplDb : '--'}
            </span>
            <span className="text-xs font-mono text-slate-400">dB SPL</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Dominant wavefront peak</span>
        </div>

        {/* Reverb Energy SPL */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Secondary Multipath Energy</span>
          <div className="flex items-baseline space-x-1 my-1">
            <span className="text-2xl font-bold font-mono text-indigo-300">
              {metrics.reverbSplDb > 0 ? metrics.reverbSplDb : '--'}
            </span>
            <span className="text-xs font-mono text-slate-400">dB SPL</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Integrated secondary reflection</span>
        </div>
      </div>

      {/* Multipath Reflections Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
          <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
            <tr>
              <th className="py-2 px-3">Arrival Component</th>
              <th className="py-2 px-3">Azimuth (θ)</th>
              <th className="py-2 px-3">Delay (Δt)</th>
              <th className="py-2 px-3">Level (SPL)</th>
              <th className="py-2 px-3">Relative ΔdB</th>
              <th className="py-2 px-3">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 font-mono text-slate-300">
            {/* Primary Direct Arrival */}
            <tr className="bg-emerald-950/20 text-emerald-300 font-medium">
              <td className="py-2 px-3">Direct Sound (Primary)</td>
              <td className="py-2 px-3">{metrics.directSplDb > 0 ? 'Direct Path' : '--'}</td>
              <td className="py-2 px-3">0.0 µs (Ref)</td>
              <td className="py-2 px-3">{metrics.directSplDb} dB</td>
              <td className="py-2 px-3">0.0 dB</td>
              <td className="py-2 px-3">1.00</td>
            </tr>

            {/* Secondary Reflections */}
            {metrics.reflections.length > 0 ? (
              metrics.reflections.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-2 px-3 text-indigo-300">Secondary Peak #{idx + 1} (Slot {r.slotId})</td>
                  <td className="py-2 px-3">{Math.round(r.angleDeg)}° (Δ{Math.round(r.deltaAngleDeg)}°)</td>
                  <td className="py-2 px-3">{r.delayUs} µs</td>
                  <td className="py-2 px-3">{Math.round(r.soundLevelDb * 10) / 10} dB</td>
                  <td className="py-2 px-3 text-amber-400">
                    {r.relativeSplDb > 0 ? `+${Math.round(r.relativeSplDb * 10) / 10}` : Math.round(r.relativeSplDb * 10) / 10} dB
                  </td>
                  <td className="py-2 px-3">{(r.confidence * 100).toFixed(0)}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-3 px-3 text-center text-slate-500 font-sans">
                  No secondary multipath reflections detected above deconvolution noise floor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MultipathAnalyzerCard;
