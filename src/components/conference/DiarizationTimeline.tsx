import React from 'react';
import { DiarizationTimelineSegment, MeetingSessionAnalytics } from '../../types/api_types';
import { Download, Activity } from 'lucide-react';

interface DiarizationTimelineProps {
  timeline: DiarizationTimelineSegment[];
  analytics: MeetingSessionAnalytics;
}

export const DiarizationTimeline: React.FC<DiarizationTimelineProps> = ({
  timeline,
  analytics,
}) => {
  const now = Date.now();
  const windowMs = 60000; // 60 seconds sliding window

  const handleExportSummary = () => {
    const summaryData = {
      exportedAt: new Date().toISOString(),
      analytics,
      recentTimelineSegments: timeline,
    };
    const blob = new Blob([JSON.stringify(summaryData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_acoustic_summary_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h4 className="font-semibold text-slate-200 text-sm">Meeting Diarization Timeline</h4>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            Past 60s
          </span>
        </div>

        <button
          onClick={handleExportSummary}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Summary</span>
        </button>
      </div>

      {/* Gantt Timeline Lanes */}
      <div className="relative w-full bg-slate-950 border border-slate-800/80 rounded-lg p-3 overflow-hidden">
        {/* Lane 0: Speaker 1 */}
        <div className="flex items-center mb-2">
          <div className="w-20 flex-shrink-0 text-[11px] font-medium text-emerald-400 font-mono">
            Speaker 1
          </div>
          <div className="relative flex-grow h-7 bg-slate-900/80 rounded border border-slate-800 overflow-hidden">
            {timeline
              .filter((s) => s.slotId === 0)
              .map((s) => {
                const age = now - s.timestampMs;
                const leftPercent = Math.max(0, Math.min(100, 100 - (age / windowMs) * 100));
                const widthPercent = Math.max(1.5, Math.min(100, (s.durationMs / windowMs) * 100));

                return (
                  <div
                    key={s.id}
                    className={`absolute top-1 bottom-1 rounded transition-all ${
                      s.isCrossTalk
                        ? 'bg-rose-500/90 border border-rose-400'
                        : 'bg-emerald-500/90 border border-emerald-400/80'
                    }`}
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                    title={`Spk 1 • Zone: ${s.zoneName} • SPL: ${s.avgSplDb} dB • Duration: ${Math.round(s.durationMs / 100) / 10}s${s.isCrossTalk ? ' (Cross-Talk)' : ''}`}
                  />
                );
              })}
          </div>
        </div>

        {/* Lane 1: Speaker 2 */}
        <div className="flex items-center mb-3">
          <div className="w-20 flex-shrink-0 text-[11px] font-medium text-indigo-400 font-mono">
            Speaker 2
          </div>
          <div className="relative flex-grow h-7 bg-slate-900/80 rounded border border-slate-800 overflow-hidden">
            {timeline
              .filter((s) => s.slotId === 1)
              .map((s) => {
                const age = now - s.timestampMs;
                const leftPercent = Math.max(0, Math.min(100, 100 - (age / windowMs) * 100));
                const widthPercent = Math.max(1.5, Math.min(100, (s.durationMs / windowMs) * 100));

                return (
                  <div
                    key={s.id}
                    className={`absolute top-1 bottom-1 rounded transition-all ${
                      s.isCrossTalk
                        ? 'bg-rose-500/90 border border-rose-400'
                        : 'bg-indigo-500/90 border border-indigo-400/80'
                    }`}
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                    title={`Spk 2 • Zone: ${s.zoneName} • SPL: ${s.avgSplDb} dB • Duration: ${Math.round(s.durationMs / 100) / 10}s${s.isCrossTalk ? ' (Cross-Talk)' : ''}`}
                  />
                );
              })}
          </div>
        </div>

        {/* Timeline Time Ticks */}
        <div className="flex justify-between pl-20 pr-1 text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-1.5">
          <span>-60s</span>
          <span>-45s</span>
          <span>-30s</span>
          <span>-15s</span>
          <span className="text-emerald-400 font-semibold">Now</span>
        </div>
      </div>
    </div>
  );
};

export default DiarizationTimeline;
