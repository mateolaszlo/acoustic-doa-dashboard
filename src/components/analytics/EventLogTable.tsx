import React, { useState } from 'react';
import { MeasurementEvent } from '../../types/api_types.js';
import { List, Download, Filter, Pause, Play, Trash2, Volume2, Database } from 'lucide-react';
import { getSplColor, getDirectionBadge } from '../../services/radar_math.js';

interface EventLogTableProps {
  events: MeasurementEvent[];
  totalStreamCount?: number;
  bufferLimit?: number;
  onSetBufferLimit?: (limit: number) => void;
  onClearEvents?: () => void;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({
  events,
  totalStreamCount,
  bufferLimit = 500,
  onSetBufferLimit,
  onClearEvents,
}) => {
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
    const headers = [
      'Timestamp_ms',
      'Time_ISO',
      'Track_ID',
      'Track_Slot',
      'Angle_deg',
      'Smoothed_Angle_deg',
      'Direction',
      'Delay_us',
      'Sound_Level_dB',
      'Confidence',
    ];
    const rows = filteredEvents.map((e) => [
      e.timestampMs,
      new Date(e.timestampMs).toISOString(),
      e.trackId !== undefined ? e.trackId : '',
      e.trackSlot !== undefined ? e.trackSlot : '',
      e.angleDeg,
      e.smoothedAngleDeg !== undefined ? e.smoothedAngleDeg.toFixed(1) : '',
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
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-lg shrink-0">
            <List className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-white tracking-wide whitespace-nowrap">
              LIVE MEASUREMENT TELEMETRY LOG
            </h2>
            <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2.5 py-0.5 rounded-full border border-slate-700 whitespace-nowrap">
              {filteredEvents.length} events
            </span>
            {totalStreamCount !== undefined && totalStreamCount > events.length && (
              <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                ({totalStreamCount.toLocaleString()} total stream)
              </span>
            )}
            {isPaused && (
              <span className="text-[10px] bg-amber-950/80 border border-amber-800 text-amber-300 px-2 py-0.5 rounded font-mono font-bold animate-pulse whitespace-nowrap">
                AUTOSCROLL PAUSED
              </span>
            )}
          </div>
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
            <span className="whitespace-nowrap">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Buffer Capacity Selector */}
          {onSetBufferLimit && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Database className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="whitespace-nowrap">Buffer:</span>
              <select
                value={bufferLimit}
                onChange={(e) => onSetBufferLimit(parseInt(e.target.value, 10))}
                className="bg-transparent text-emerald-400 font-mono font-bold focus:outline-none cursor-pointer"
                title="Maximum number of recent events kept in browser memory ring buffer"
              >
                <option value={100} className="bg-slate-900">100</option>
                <option value={250} className="bg-slate-900">250</option>
                <option value={500} className="bg-slate-900">500</option>
                <option value={1000} className="bg-slate-900">1000</option>
              </select>
            </div>
          )}

          {/* Min Confidence Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <Filter className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="whitespace-nowrap">Conf:</span>
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
            <Volume2 className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="whitespace-nowrap">SPL:</span>
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
            <span className="whitespace-nowrap">Export CSV</span>
          </button>

          {/* Clear Log Button */}
          {onClearEvents && (
            <button
              onClick={onClearEvents}
              disabled={events.length === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 hover:border-rose-800 text-xs font-semibold rounded-lg border border-slate-700 transition disabled:opacity-40"
              title="Clear active in-memory event buffer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-lg border border-slate-800">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-950 text-slate-400 font-mono uppercase sticky top-0 z-10 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-4 font-medium whitespace-nowrap">Timestamp</th>
              <th className="py-2.5 px-3 font-medium whitespace-nowrap">Track</th>
              <th className="py-2.5 px-4 font-medium whitespace-nowrap">Azimuth Angle</th>
              <th className="py-2.5 px-4 font-medium whitespace-nowrap">Cardinal Sector</th>
              <th className="py-2.5 px-4 font-medium whitespace-nowrap">Time Delay (&Delta;t)</th>
              <th className="py-2.5 px-4 font-medium whitespace-nowrap">Sound Pressure</th>
              <th className="py-2.5 px-4 font-medium whitespace-nowrap">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                  No acoustic events captured matching current filters.
                </td>
              </tr>
            ) : (
              filteredEvents.map((evt, idx) => {
                const splColor = getSplColor(evt.soundLevelDb);
                const badge = getDirectionBadge(evt.angleDeg);

                return (
                  <tr key={`${evt.timestampMs}-${idx}`} className="hover:bg-slate-800/40 transition">
                    <td className="py-2 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(evt.timestampMs).toLocaleTimeString()}
                      <span className="text-[10px] text-slate-500 ml-1">
                        .{String(evt.timestampMs % 1000).padStart(3, '0')}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {evt.trackId !== undefined ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            evt.trackSlot === 0
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : evt.trackSlot === 1
                              ? 'bg-indigo-950 text-indigo-400 border-indigo-800'
                              : 'bg-sky-950 text-sky-400 border-sky-800'
                          }`}
                        >
                          Track #{evt.trackId}
                          {evt.trackState === 'COASTING' && (
                            <span className="text-[9px] text-amber-400 font-semibold">[COAST]</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono">--</span>
                      )}
                    </td>
                    <td className="py-2 px-4 font-bold text-white whitespace-nowrap tabular-nums">
                      {evt.angleDeg > 0 ? `+${evt.angleDeg.toFixed(1)}` : evt.angleDeg.toFixed(1)}°
                      {evt.smoothedAngleDeg !== undefined && (
                        <span className="text-[10px] font-normal text-slate-400 ml-1.5" title="Kalman Filter Smoothed Azimuth">
                          ({evt.smoothedAngleDeg > 0 ? `+${evt.smoothedAngleDeg.toFixed(1)}` : evt.smoothedAngleDeg.toFixed(1)}°)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badge.badgeClass}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-slate-400 whitespace-nowrap tabular-nums">
                      {evt.delayUs > 0 ? `+${evt.delayUs.toFixed(1)}` : evt.delayUs.toFixed(1)} &mu;s
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-bold"
                        style={{
                          backgroundColor: `${splColor}20`,
                          color: splColor,
                          border: `1px solid ${splColor}40`,
                        }}
                      >
                        {evt.soundLevelDb.toFixed(1)} dB SPL
                      </span>
                    </td>
                    <td className="py-2 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.round(evt.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {Math.round(evt.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/80 gap-2">
        <span>
          Showing {filteredEvents.length} of {events.length} buffered events
          {totalStreamCount !== undefined ? ` (${totalStreamCount.toLocaleString()} total received)` : ''}
        </span>
        <span className="text-[11px] font-mono text-slate-500">
          WLS Solver Quad-MEMS Spatial Deconvolution
        </span>
      </div>
    </div>
  );
};

export default EventLogTable;
