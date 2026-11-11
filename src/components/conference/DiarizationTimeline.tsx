import React, { useRef, useEffect, useState } from 'react';
import {
  DiarizationTimelineSegment,
  ActiveSpeechBurst,
  MeetingSessionAnalytics,
} from '../../types/api_types';
import { Download, Activity, Clock } from 'lucide-react';

interface DiarizationTimelineProps {
  timeline: DiarizationTimelineSegment[];
  activeBursts?: ActiveSpeechBurst[];
  analytics: MeetingSessionAnalytics;
}

interface HoveredSegment {
  slotId: number;
  durationMs: number;
  avgSplDb: number;
  zoneName: string;
  ageSec: number;
  isCrossTalk: boolean;
  x: number;
  y: number;
}

export const DiarizationTimeline: React.FC<DiarizationTimelineProps> = ({
  timeline,
  activeBursts = [],
  analytics,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<HoveredSegment | null>(null);

  // Keep references updated for the 60fps render loop
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const activeBurstsRef = useRef(activeBursts);
  activeBurstsRef.current = activeBursts;

  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  const windowMs = 60000; // 60 seconds continuous window

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const now = Date.now();
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear Canvas
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      const marginL = 70;
      const marginR = 14;
      const laneW = Math.max(100, width - marginL - marginR);

      const lane0Y = 12;
      const lane1Y = 46;
      const laneH = 26;

      // 1. Draw Time Axis Grid Lines & Background Lanes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;

      // Lane backgrounds
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(marginL, lane0Y, laneW, laneH);
      ctx.fillRect(marginL, lane1Y, laneW, laneH);

      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(marginL, lane0Y, laneW, laneH);
      ctx.strokeRect(marginL, lane1Y, laneW, laneH);

      // Grid tick intervals (-60s, -45s, -30s, -15s, -5s, 0s)
      const ticks = [
        { label: '-60s', frac: 0.0 },
        { label: '-45s', frac: 0.25 },
        { label: '-30s', frac: 0.5 },
        { label: '-15s', frac: 0.75 },
        { label: '-5s', frac: 0.916 },
        { label: 'Now', frac: 1.0 },
      ];

      for (const t of ticks) {
        const tx = marginL + t.frac * laneW;
        ctx.beginPath();
        ctx.moveTo(tx, 8);
        ctx.lineTo(tx, height - 18);
        ctx.strokeStyle = t.frac === 1.0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = t.frac === 1.0 ? 1.5 : 1;
        ctx.stroke();

        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = t.frac === 1.0 ? '#10b981' : '#64748b';
        ctx.fillText(t.label, tx, height - 15);
      }

      // Lane Headers / Badges on Left Margin
      const activeBurstsList = activeBurstsRef.current;
      const isSpk0Live = activeBurstsList.some((b) => b.slotId === 0);
      const isSpk1Live = activeBurstsList.some((b) => b.slotId === 1);

      // Speaker 1 Badge
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = isSpk0Live ? '#34d399' : '#94a3b8';
      ctx.fillText('SPEAKER 1', 12, lane0Y + laneH / 2);
      ctx.beginPath();
      ctx.arc(6, lane0Y + laneH / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = isSpk0Live ? '#10b981' : '#334155';
      ctx.fill();

      // Speaker 2 Badge
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = isSpk1Live ? '#a5b4fc' : '#94a3b8';
      ctx.fillText('SPEAKER 2', 12, lane1Y + laneH / 2);
      ctx.beginPath();
      ctx.arc(6, lane1Y + laneH / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = isSpk1Live ? '#6366f1' : '#334155';
      ctx.fill();

      // 2. Render Historical Finished Segments
      const segments = timelineRef.current;
      let currentHover: HoveredSegment | null = null;
      const mouse = mousePosRef.current;

      for (const seg of segments) {
        const ageStart = now - seg.timestampMs;
        const ageEnd = ageStart - seg.durationMs;

        // Skip if outside 60s sliding window
        if (ageEnd > windowMs || ageStart < 0) continue;

        const xStart = marginL + (1.0 - Math.min(1, Math.max(0, ageStart / windowMs))) * laneW;
        const xEnd = marginL + (1.0 - Math.min(1, Math.max(0, ageEnd / windowMs))) * laneW;
        const segWidth = Math.max(3, xEnd - xStart);
        const y = seg.slotId === 0 ? lane0Y + 2 : lane1Y + 2;
        const h = laneH - 4;

        // Hover detection
        if (
          mouse &&
          mouse.x >= xStart &&
          mouse.x <= xEnd &&
          mouse.y >= y &&
          mouse.y <= y + h
        ) {
          currentHover = {
            slotId: seg.slotId,
            durationMs: seg.durationMs,
            avgSplDb: seg.avgSplDb,
            zoneName: seg.zoneName,
            ageSec: Math.round(ageEnd / 1000),
            isCrossTalk: seg.isCrossTalk,
            x: Math.min(width - 150, Math.max(marginL, mouse.x)),
            y: seg.slotId === 0 ? lane0Y - 8 : lane1Y - 8,
          };
        }

        // Segment fill
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(xStart, y, segWidth, h, 3);
        } else {
          ctx.rect(xStart, y, segWidth, h);
        }

        if (seg.isCrossTalk) {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
          ctx.strokeStyle = '#fda4af';
        } else if (seg.slotId === 0) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.88)';
          ctx.strokeStyle = '#6ee7b7';
        } else {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.88)';
          ctx.strokeStyle = '#a5b4fc';
        }
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Render Real-Time Active Ongoing Speech Bursts
      for (const burst of activeBurstsList) {
        const ageStart = now - burst.startMs;
        const xStart = marginL + (1.0 - Math.min(1, Math.max(0, ageStart / windowMs))) * laneW;
        const xEnd = marginL + laneW; // Anchored directly to "Now" line!
        const burstWidth = Math.max(4, xEnd - xStart);
        const y = burst.slotId === 0 ? lane0Y + 2 : lane1Y + 2;
        const h = laneH - 4;

        ctx.save();
        ctx.shadowColor = burst.slotId === 0 ? '#10b981' : '#6366f1';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(xStart, y, burstWidth, h, 3);
        } else {
          ctx.rect(xStart, y, burstWidth, h);
        }

        if (burst.isCrossTalk) {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.95)';
          ctx.strokeStyle = '#ffccd5';
        } else if (burst.slotId === 0) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
          ctx.strokeStyle = '#a7f3d0';
        } else {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.95)';
          ctx.strokeStyle = '#c7d2fe';
        }
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Pulsing live head dot
        ctx.beginPath();
        ctx.arc(xEnd, y + h / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // 4. Draw "Now" Live Playhead Line
      const playheadX = marginL + laneW;
      ctx.beginPath();
      ctx.moveTo(playheadX, 6);
      ctx.lineTo(playheadX, height - 16);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 5. Mouse Hairline Scrubber
      if (mouse && mouse.x >= marginL && mouse.x <= playheadX) {
        ctx.beginPath();
        ctx.moveTo(mouse.x, 6);
        ctx.lineTo(mouse.x, height - 18);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        const timeOffsetSec = Math.round(((mouse.x - playheadX) / laneW) * 60);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(mouse.x - 16, height - 20, 32, 14);
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`${timeOffsetSec}s`, mouse.x, height - 9);
      }

      ctx.restore();

      setHoveredInfo(currentHover);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseLeave = () => {
    mousePosRef.current = null;
    setHoveredInfo(null);
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h4 className="font-semibold text-slate-200 text-sm">Meeting Diarization Timeline</h4>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded flex items-center space-x-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Session: {Math.round(analytics.totalDurationMs / 1000)}s</span>
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

      {/* 60fps HTML5 Canvas Timeline Viewport */}
      <div className="relative w-full bg-slate-950 border border-slate-800/80 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-24 block cursor-crosshair"
        />

        {/* Hover Inspection Tooltip */}
        {hoveredInfo && (
          <div
            className="absolute pointer-events-none z-20 px-2.5 py-1.5 rounded bg-slate-950/95 border border-slate-700 shadow-2xl text-[10px] font-mono text-slate-200 flex flex-col space-y-0.5 transition-all"
            style={{
              left: `${hoveredInfo.x}px`,
              top: `${Math.max(4, hoveredInfo.y - 32)}px`,
            }}
          >
            <div className="flex items-center space-x-2">
              <span
                className={`font-semibold ${hoveredInfo.slotId === 0 ? 'text-emerald-400' : 'text-indigo-400'}`}
              >
                Speaker {hoveredInfo.slotId + 1}
              </span>
              {hoveredInfo.isCrossTalk && (
                <span className="text-rose-400 font-bold bg-rose-950 px-1 rounded">CROSS-TALK</span>
              )}
              <span className="text-slate-400">{hoveredInfo.zoneName}</span>
            </div>
            <div className="text-slate-400 text-[9px]">
              Duration: <span className="text-slate-200 font-semibold">{(hoveredInfo.durationMs / 1000).toFixed(1)}s</span> &bull; SPL:{' '}
              <span className="text-amber-400 font-semibold">{hoveredInfo.avgSplDb} dB</span> &bull;{' '}
              <span>{hoveredInfo.ageSec}s ago</span>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Footer Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 px-1 gap-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
            <span>Speaker 1</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-indigo-500" />
            <span>Speaker 2</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-500" />
            <span>Simultaneous Cross-Talk</span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-500">
          Continuous Real-Time Sliding Window &bull; Hover for acoustic metadata
        </div>
      </div>
    </div>
  );
};

export default DiarizationTimeline;
