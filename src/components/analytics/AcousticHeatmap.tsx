import { useState, useEffect } from 'react';
import { AcousticStats } from '../../types/api_types.js';
import { PieChart, BarChart3, RefreshCw, Compass } from 'lucide-react';

interface AcousticHeatmapProps {
  deviceId: number;
}

export const AcousticHeatmap: React.FC<AcousticHeatmapProps> = ({ deviceId }) => {
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '24h' | '7d'>('1h');
  const [viewMode, setViewMode] = useState<'rose' | 'spectrum'>('rose');
  const [stats, setStats] = useState<AcousticStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredBin, setHoveredBin] = useState<{ index: number; angle: number; count: number } | null>(null);

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
  const totalEvents = stats?.eventCount || bins.reduce((a, b) => a + b, 0);

  // Geometry for 360° Circular Polar Radiation Rose
  const cx = 160;
  const cy = 160;
  const maxR = 125;
  const minR = 24;

  const polarToSvg = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180.0;
    return {
      x: cx + r * Math.sin(rad),
      y: cy - r * Math.cos(rad),
    };
  };

  const getWedgePath = (startDeg: number, endDeg: number, outerR: number) => {
    const p1 = polarToSvg(startDeg, minR);
    const p2 = polarToSvg(startDeg, outerR);
    const p3 = polarToSvg(endDeg, outerR);
    const p4 = polarToSvg(endDeg, minR);
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${outerR} ${outerR} 0 0 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${minR} ${minR} 0 0 0 ${p1.x} ${p1.y} Z`;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              ACOUSTIC RADIATION ROSE & DENSITY
            </h2>
            <p className="text-xs text-slate-400">
              36-bin angular spatial histogram of sound source distribution
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('rose')}
              title="Circular Polar Rose"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'rose' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Polar Rose</span>
            </button>
            <button
              onClick={() => setViewMode('spectrum')}
              title="Linear Spectrum Bins"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'spectrum' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Histogram</span>
            </button>
          </div>

          {/* Timeframe Presets */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            {(['15m', '1h', '24h', '7d'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2 py-1 rounded-md font-medium font-mono transition ${
                  timeframe === t ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
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

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Accumulated Events</span>
          <div className="text-2xl font-mono font-bold text-white mt-1">{stats?.eventCount ?? 0}</div>
          <span className="text-[10px] text-slate-500 font-mono">Timeframe: last {timeframe}</span>
        </div>
        <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Average Sound Level</span>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
            {stats?.avgSplDb ? `${stats.avgSplDb} dB` : '--'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Calibrated RMS SPL</span>
        </div>
        <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Peak Sound Pressure</span>
          <div className="text-2xl font-mono font-bold text-rose-400 mt-1">
            {stats?.peakSplDb ? `${stats.peakSplDb} dB` : '--'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Impulse maximum detected</span>
        </div>
      </div>

      {/* Mode A: Circular Polar Radiation Rose (True Acoustic Heatmap) */}
      {viewMode === 'rose' && (
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <div className="relative">
            <svg width="320" height="320" viewBox="0 0 320 320" className="overflow-visible">
              {/* Concentric Guide Rings */}
              {[0.25, 0.5, 0.75, 1.0].map((step, idx) => (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={minR + (maxR - minR) * step}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray={step < 1 ? '3 3' : undefined}
                />
              ))}

              {/* Crosshair Axes */}
              <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#1e293b" strokeWidth="1" />
              <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#1e293b" strokeWidth="1" />

              {/* 36 Angular Sectors / Radiation Wedges */}
              {bins.map((count, idx) => {
                const startAngle = -180 + idx * 10;
                const endAngle = startAngle + 10;
                const countRatio = count / maxBin;
                const wedgeR = minR + (maxR - minR) * (count > 0 ? Math.max(0.12, countRatio) : 0);
                const pathData = getWedgePath(startAngle, endAngle, wedgeR);

                let fillColor = 'rgba(30, 41, 59, 0.3)';
                if (count > 0) {
                  if (countRatio > 0.65) fillColor = 'rgba(244, 63, 94, 0.85)'; // Red / Hotspot
                  else if (countRatio > 0.3) fillColor = 'rgba(245, 158, 11, 0.85)'; // Amber / Active
                  else fillColor = 'rgba(16, 185, 129, 0.8)'; // Green / Ambient
                }

                return (
                  <path
                    key={idx}
                    d={pathData}
                    fill={fillColor}
                    stroke={count > 0 ? '#0f172a' : '#1e293b'}
                    strokeWidth="0.8"
                    className="cursor-pointer transition-colors duration-150 hover:brightness-125"
                    onMouseEnter={() => setHoveredBin({ index: idx, angle: startAngle, count })}
                    onMouseLeave={() => setHoveredBin(null)}
                  />
                );
              })}

              {/* Center Core Hub */}
              <circle cx={cx} cy={cy} r={minR - 4} fill="#0a0f1a" stroke="#10b981" strokeWidth="1.5" />
              <text cx={cx} cy={cy + 3} textAnchor="middle" fill="#10b981" fontSize="9" fontFamily="monospace">
                DOA
              </text>

              {/* Cardinal Compass Labels */}
              <text cx={cx} cy={cy - maxR - 8} textAnchor="middle" fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">
                0° FRONT
              </text>
              <text cx={cx + maxR + 12} cy={cy + 3} textAnchor="start" fill="#64748b" fontSize="9" fontFamily="monospace">
                +90° R
              </text>
              <text cx={cx} cy={cy + maxR + 14} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
                ±180° BACK
              </text>
              <text cx={cx - maxR - 12} cy={cy + 3} textAnchor="end" fill="#64748b" fontSize="9" fontFamily="monospace">
                -90° L
              </text>
            </svg>
          </div>

          {/* Interactive Inspection Card */}
          <div className="flex-1 space-y-3">
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                Sector Inspection
              </span>
              {hoveredBin ? (
                <div className="mt-1 space-y-1">
                  <div className="text-sm font-bold text-white font-mono">
                    Azimuth: {hoveredBin.angle > 0 ? `+${hoveredBin.angle}°` : `${hoveredBin.angle}°`} to{' '}
                    {hoveredBin.angle + 10 > 0 ? `+${hoveredBin.angle + 10}°` : `${hoveredBin.angle + 10}°`}
                  </div>
                  <div className="text-xs text-emerald-400 font-mono">
                    Events: {hoveredBin.count} (
                    {totalEvents > 0 ? `${((hoveredBin.count / totalEvents) * 100).toFixed(1)}%` : '0%'})
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  Hover over any 10° radiation sector on the polar rose to view density details.
                </p>
              )}
            </div>

            <div className="text-xs font-mono text-slate-400 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
                <span>Dominant Direction (&gt;65% peak density)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
                <span>Active Angle (30%–65% density)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                <span>Ambient Activity (&lt;30% density)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode B: Linear Spectrum Histogram */}
      {viewMode === 'spectrum' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400 font-mono">
            <span>-180° (Back)</span>
            <span>-90° (Left)</span>
            <span className="text-emerald-400 font-bold">0° (Front)</span>
            <span>+90° (Right)</span>
            <span>+180° (Back)</span>
          </div>

          <div className="flex items-end gap-1 h-36 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            {bins.map((val, idx) => {
              const angle = -180 + idx * 10;
              const heightPercent = (val / maxBin) * 100;
              const isFront = Math.abs(angle) <= 20;

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col justify-end items-center h-full group relative cursor-pointer"
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
      )}
    </div>
  );
};

export default AcousticHeatmap;
