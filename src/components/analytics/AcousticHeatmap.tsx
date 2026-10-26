import { useState, useEffect } from 'react';
import { AcousticStats } from '../../types/api_types.js';
import { PieChart, RefreshCw } from 'lucide-react';

interface AcousticHeatmapProps {
  deviceId: number;
}

export const AcousticHeatmap: React.FC<AcousticHeatmapProps> = ({ deviceId }) => {
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '24h'>('1h');
  const [stats, setStats] = useState<AcousticStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/devices/${deviceId}/stats?timeframe=${timeframe}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [deviceId, timeframe]);

  const bins = stats?.angularBins36 || new Array(36).fill(0);
  const maxBin = Math.max(...bins, 1);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-wide">Acoustic Heatmap & Angular Rose</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            {(['15m', '1h', '24h'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  timeframe === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Total Sound Events</span>
          <div className="text-2xl font-mono font-bold text-white mt-1">{stats?.eventCount ?? 0}</div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Average Sound Level</span>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
            {stats?.avgSplDb ? `${stats.avgSplDb} dB` : '--'}
          </div>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Peak Sound Pressure</span>
          <div className="text-2xl font-mono font-bold text-rose-400 mt-1">
            {stats?.peakSplDb ? `${stats.peakSplDb} dB` : '--'}
          </div>
        </div>
      </div>

      {/* 36-Bin Angular Rose Distribution (Bar Representation) */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 font-mono mb-2">
          <span>-180° (Back)</span>
          <span>-90° (Left)</span>
          <span className="text-emerald-400 font-bold">0° (Front)</span>
          <span>+90° (Right)</span>
          <span>+180° (Back)</span>
        </div>

        <div className="flex items-end gap-1 h-32 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
          {bins.map((val, idx) => {
            const angle = -180 + idx * 10;
            const heightPercent = (val / maxBin) * 100;
            const isFront = Math.abs(angle) <= 20;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col justify-end items-center h-full group relative"
              >
                <div
                  className={`w-full rounded-t transition-all duration-300 ${
                    val === 0
                      ? 'bg-transparent'
                      : isFront
                      ? 'bg-emerald-500 hover:bg-emerald-400'
                      : 'bg-indigo-500 hover:bg-indigo-400'
                  }`}
                  style={{ height: `${Math.max(val > 0 ? 8 : 0, heightPercent)}%` }}
                />
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                  <div className="bg-slate-800 border border-slate-700 text-[10px] text-white px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono">
                    {angle}° to {angle + 10}°: {val} events
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
