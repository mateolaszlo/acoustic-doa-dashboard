import React, { useState } from 'react';
import { MeasurementEvent } from '../../types/api_types.js';
import { List, Download, Filter, Pause, Play, Trash2, Volume2 } from 'lucide-react';
import { getSplColor, getDirectionBadge } from '../../services/radar_math.js';

interface EventLogTableProps {
  events: MeasurementEvent[];
  onClearEvents?: () => void;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({ events, onClearEvents }) => {
  const [minConf, setMinConf] = useState(0.0);
  const [minSpl, setMinSpl] = useState(0.0);
  const [isPaused, setIsPaused] = useState(false);
  const [frozenEvents, setFrozenEvents] = useState<MeasurementEvent[]>([]);

  const handleTogglePause = () => {
    if (!isPaused) {
      setFrozenEvents([...events]);
      setIsPaused(true);
    } else {
      setIsPaused(false);
    }
  };

  const displayEvents = isPaused ? frozenEvents : events;
  const filteredEvents = displayEvents.filter(
    (e) => e.confidence >= minConf && e.soundLevelDb >= minSpl
  );

  const downloadCsv = () => {
    if (events.length === 0) return;
    const headers = ['Timestamp_ms', 'Time_ISO', 'Angle_deg', 'Direction', 'Delay_us', 'Sound_Level_dB', 'Confidence'];
    const rows = filteredEvents.map((e) => [
      e.timestampMs,
      new Date(e.timestampMs).toISOString(),
      e.angleDeg,
      getDirectionBadge(e.angleDeg).label,
      e.delayUs,
      e.soundLevelDb,
      e.confidence,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acoustic_doa_events_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header and Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <List className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white tracking-wide">
            LIVE MEASUREMENT TELEMETRY LOG
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full border border-slate-700">
            {filteredEvents.length} events
          </span>
          {isPaused && (
            <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-300 px-2 py-0.5 rounded font-mono font-bold animate-pulse">
              AUTOSCROLL PAUSED
            </span>
          )}
        </div>

        {/* Filters & Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pause / Resume Feed */}
          <button
            onClick={handleTogglePause}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              isPaused
                ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isPaused ? 'Resume live autoscroll feed' : 'Pause autoscroll to inspect rows'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Min Confidence Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <Filter className="w-3 h-3 text-slate-500" />
            <span>Conf:</span>
            <select
              value={minConf}
              onChange={(e) => setMinConf(parseFloat(e.target.value))}
              className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
            >
              <option value={0.0} className="bg-slate-900">&ge; 0%</option>
              <option value={0.5} className="bg-slate-900">&ge; 50%</option>
              <option value={0.7} className="bg-slate-900">&ge; 70%</option>
              <option value={0.85} className="bg-slate-900">&ge; 85%</option>
            </select>
          </div>

          {/* Sound Level Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <Volume2 className="w-3 h-3 text-slate-500" />
            <span>SPL:</span>
            <select
              value={minSpl}
              onChange={(e) => setMinSpl(parseFloat(e.target.value))}
              className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
            >
              <option value={0.0} className="bg-slate-900">All</option>
              <option value={55.0} className="bg-slate-900">&gt; 55 dB</option>
              <option value={70.0} className="bg-slate-900">&gt; 70 dB</option>
            </select>
          </div>

          {/* CSV Export */}
          <button
            onClick={downloadCsv}
            disabled={filteredEvents.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {/* Clear Log Button */}
          {onClearEvents && (
            <button
              onClick={onClearEvents}
              title="Clear current event log buffer"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono tracking-wider">
              <th className="pb-2.5 font-medium">TIMESTAMP (UTC)</th>
              <th className="pb-2.5 font-medium">DIRECTION</th>
              <th className="pb-2.5 font-medium">AZIMUTH (DOA)</th>
              <th className="pb-2.5 font-medium">BASELINE DELAY</th>
              <th className="pb-2.5 font-medium">SOUND PRESSURE</th>
              <th className="pb-2.5 font-medium">CORRELATION WLS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                  No acoustic events matching active filter criteria
                </td>
              </tr>
            ) : (
              filteredEvents.map((e, idx) => {
                const splColor = getSplColor(e.soundLevelDb);
                const dirBadge = getDirectionBadge(e.angleDeg);

                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 text-slate-400">
                      {new Date(e.timestampMs).toLocaleTimeString()}
                      <span className="text-[10px] text-slate-600 ml-1">
                        .{String(e.timestampMs % 1000).padStart(3, '0')}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${dirBadge.badgeClass}`}>
                        {dirBadge.label}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-white">
                      {e.angleDeg > 0 ? `+${e.angleDeg.toFixed(1)}°` : `${e.angleDeg.toFixed(1)}°`}
                    </td>
                    <td className="py-2.5 text-slate-300">
                      {e.delayUs.toFixed(1)} µs
                    </td>
                    <td className="py-2.5 font-semibold" style={{ color: splColor }}>
                      {e.soundLevelDb.toFixed(1)} dB SPL
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-400 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, e.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-slate-300">{(e.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EventLogTable;
