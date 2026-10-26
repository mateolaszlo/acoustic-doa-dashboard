import React, { useState } from 'react';
import { MeasurementEvent } from '../../types/api_types.js';
import { List, Download, Filter } from 'lucide-react';
import { getSplColor } from '../../services/radar_math.js';

interface EventLogTableProps {
  events: MeasurementEvent[];
}

export const EventLogTable: React.FC<EventLogTableProps> = ({ events }) => {
  const [minConf, setMinConf] = useState(0.0);

  const filteredEvents = events.filter((e) => e.confidence >= minConf);

  const downloadCsv = () => {
    if (events.length === 0) return;
    const headers = ['Timestamp_ms', 'Time_ISO', 'Angle_deg', 'Delay_us', 'Sound_Level_dB', 'Confidence'];
    const rows = events.map((e) => [
      e.timestampMs,
      new Date(e.timestampMs).toISOString(),
      e.angleDeg,
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
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <List className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">Live Measurement Event Log</h2>
          <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full border border-slate-700">
            {filteredEvents.length} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            <Filter className="w-3.5 h-3.5" />
            <span>Min Confidence:</span>
            <select
              value={minConf}
              onChange={(e) => setMinConf(parseFloat(e.target.value))}
              className="bg-transparent text-white font-mono focus:outline-none"
            >
              <option value={0.0} className="bg-slate-800">0%</option>
              <option value={0.5} className="bg-slate-800">50%</option>
              <option value={0.7} className="bg-slate-800">70%</option>
              <option value={0.85} className="bg-slate-800">85%</option>
            </select>
          </div>

          <button
            onClick={downloadCsv}
            disabled={events.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono">
              <th className="pb-2 font-medium">TIMESTAMP (UTC)</th>
              <th className="pb-2 font-medium">AZIMUTH (DOA)</th>
              <th className="pb-2 font-medium">BASELINE DELAY</th>
              <th className="pb-2 font-medium">SOUND LEVEL</th>
              <th className="pb-2 font-medium">CONFIDENCE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                  No acoustic events matching filter criteria
                </td>
              </tr>
            ) : (
              filteredEvents.map((e, idx) => {
                const splColor = getSplColor(e.soundLevelDb);
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-2 text-slate-400">
                      {new Date(e.timestampMs).toLocaleTimeString()}
                      <span className="text-[10px] text-slate-600 ml-1">
                        .{String(e.timestampMs % 1000).padStart(3, '0')}
                      </span>
                    </td>
                    <td className="py-2 font-bold text-white">
                      {e.angleDeg > 0 ? `+${e.angleDeg.toFixed(1)}°` : `${e.angleDeg.toFixed(1)}°`}
                    </td>
                    <td className="py-2 text-slate-300">
                      {e.delayUs.toFixed(1)} µs
                    </td>
                    <td className="py-2 font-semibold" style={{ color: splColor }}>
                      {e.soundLevelDb.toFixed(1)} dB SPL
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-400 h-full"
                            style={{ width: `${e.confidence * 100}%` }}
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
