import React, { useRef, useEffect, useState } from 'react';
import { MeasurementEvent } from '../../types/api_types.js';
import { polarToCanvas, getSplColor } from '../../services/radar_math.js';
import { Pause, Play, Eye, EyeOff, Radio } from 'lucide-react';

interface PolarRadarCanvasProps {
  latestEvents: MeasurementEvent[];
  decayTimeMs?: number;
  showSweep?: boolean;
}

interface Blip {
  angleDeg: number;
  soundLevelDb: number;
  confidence: number;
  bornAt: number;
}

export const PolarRadarCanvas: React.FC<PolarRadarCanvasProps> = ({
  latestEvents,
  decayTimeMs: initialDecayMs = 2500,
  showSweep: initialShowSweep = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blipsRef = useRef<Blip[]>([]);
  const sweepAngleRef = useRef(0);

  // HUD Interactive Controls State
  const [isFrozen, setIsFrozen] = useState(false);
  const [showSweep, setShowSweep] = useState(initialShowSweep);
  const [decayTimeMs, setDecayTimeMs] = useState(initialDecayMs);
  const [gridMode, setGridMode] = useState<'polar' | 'compass'>('polar');

  // References for render loop to avoid closure capture
  const isFrozenRef = useRef(isFrozen);
  isFrozenRef.current = isFrozen;

  const showSweepRef = useRef(showSweep);
  showSweepRef.current = showSweep;

  const decayTimeMsRef = useRef(decayTimeMs);
  decayTimeMsRef.current = decayTimeMs;

  const gridModeRef = useRef(gridMode);
  gridModeRef.current = gridMode;

  const latestEventsRef = useRef(latestEvents);
  latestEventsRef.current = latestEvents;

  // Ingest incoming measurement events into the phosphor blip trail (when not frozen)
  useEffect(() => {
    if (latestEvents.length > 0 && !isFrozen) {
      const now = Date.now();
      for (const ev of latestEvents) {
        blipsRef.current.push({
          angleDeg: ev.angleDeg,
          soundLevelDb: ev.soundLevelDb,
          confidence: ev.confidence,
          bornAt: now,
        });
      }
      // Retain maximum 200 blips
      if (blipsRef.current.length > 200) {
        blipsRef.current = blipsRef.current.slice(-200);
      }
    }
  }, [latestEvents, isFrozen]);

  // Main 60 FPS Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const now = Date.now();
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Background clearing
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 28;

      // 2. Outer Compass Bezel
      ctx.strokeStyle = '#1a2436';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Concentric Range Rings (25%, 50%, 75%, 100%)
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      for (const step of ringSteps) {
        ctx.strokeStyle = step === 1.0 ? '#10b981' : '#172233';
        ctx.lineWidth = step === 1.0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * step, 0, Math.PI * 2);
        ctx.stroke();

        // Range ring distance markers
        if (step < 1.0) {
          ctx.fillStyle = '#334155';
          ctx.font = '8px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${Math.round(step * 100)}%`, centerX + 4, centerY - radius * step - 2);
        }
      }

      // 4. Crosshair Axes & Degree Ticks
      ctx.strokeStyle = '#1a2638';
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.stroke();

      // Cardinal & ordinal labels
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const isCompass = gridModeRef.current === 'compass';
      const cardinalPoints = [
        { deg: 0, label: isCompass ? 'N (FRONT)' : 'FRONT 0°', yOffset: -12, xOffset: 0 },
        { deg: 90, label: isCompass ? 'E (+90°)' : '+90° R', yOffset: 0, xOffset: 24 },
        { deg: 180, label: isCompass ? 'S (±180°)' : 'BACK ±180°', yOffset: 12, xOffset: 0 },
        { deg: -90, label: isCompass ? 'W (-90°)' : '-90° L', yOffset: 0, xOffset: -24 },
      ];

      for (const pt of cardinalPoints) {
        const pos = polarToCanvas(pt.deg, radius + 14, centerX, centerY);
        ctx.fillStyle = pt.deg === 0 ? '#10b981' : '#64748b';
        ctx.fillText(pt.label, pos.x + pt.xOffset, pos.y + pt.yOffset);
      }

      // Minor radial spokes (every 30 deg)
      for (let d = -150; d <= 150; d += 30) {
        if (d % 90 === 0) continue;
        const outer = polarToCanvas(d, radius, centerX, centerY);
        const inner = polarToCanvas(d, radius - 8, centerX, centerY);
        ctx.strokeStyle = '#243247';
        ctx.beginPath();
        ctx.moveTo(inner.x, inner.y);
        ctx.lineTo(outer.x, outer.y);
        ctx.stroke();

        // Small degree tick labels at 30° / 60°
        const labelPos = polarToCanvas(d, radius + 10, centerX, centerY);
        ctx.fillStyle = '#475569';
        ctx.font = '8px monospace';
        ctx.fillText(`${d > 0 ? '+' : ''}${d}°`, labelPos.x, labelPos.y);
      }

      // 5. Rotating Radar Sweep Line (Background HUD scan)
      if (showSweepRef.current) {
        if (!isFrozenRef.current) {
          sweepAngleRef.current = (sweepAngleRef.current + 1.2) % 360.0;
        }
        const sweepRad = (sweepAngleRef.current * Math.PI) / 180.0;
        const sweepPos = polarToCanvas(sweepAngleRef.current, radius, centerX, centerY);

        const sweepGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        sweepGradient.addColorStop(0, 'rgba(16, 185, 129, 0.0)');
        sweepGradient.addColorStop(1, 'rgba(16, 185, 129, 0.12)');

        ctx.fillStyle = sweepGradient;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, sweepRad - 0.28, sweepRad);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(sweepPos.x, sweepPos.y);
        ctx.stroke();
      }

      // 6. Phosphor Decay Blips & Trails
      const activeDecay = decayTimeMsRef.current;
      if (!isFrozenRef.current) {
        blipsRef.current = blipsRef.current.filter((b) => now - b.bornAt < activeDecay);
      }

      for (const b of blipsRef.current) {
        const ageMs = isFrozenRef.current ? 0 : now - b.bornAt;
        const alpha = Math.max(0, 1 - ageMs / activeDecay);
        const blipRadius = radius * (0.3 + 0.65 * b.confidence);
        const pos = polarToCanvas(b.angleDeg, blipRadius, centerX, centerY);

        // Outer glow
        const glowColor = getSplColor(b.soundLevelDb, alpha * 0.28);
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
        ctx.fill();

        // Inner sharp dot
        const dotColor = getSplColor(b.soundLevelDb, alpha * 0.85);
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 7. Multi-Source Active Beams (CLEAN Deconvolution Pass 0, 1, 2)
      const currentEvents = latestEventsRef.current;
      if (currentEvents.length > 0) {
        // Multi-source colors: 0 = Primary (Green/Amber/Red SPL), 1 = Secondary (Indigo), 2 = Tertiary (Cyan)
        currentEvents.slice(0, 3).forEach((ev, idx) => {
          const needlePos = polarToCanvas(ev.angleDeg, radius, centerX, centerY);

          if (idx === 0) {
            // Primary sound source: Solid illuminated vector beam
            const primaryColor = getSplColor(ev.soundLevelDb, 0.95);
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 10;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(needlePos.x, needlePos.y);
            ctx.stroke();

            ctx.shadowBlur = 0; // Reset blur

            // Outer target reticle at perimeter
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(needlePos.x, needlePos.y, 5, 0, Math.PI * 2);
            ctx.stroke();

            // Text tag at perimeter
            const tagPos = polarToCanvas(ev.angleDeg, radius + 24, centerX, centerY);
            ctx.fillStyle = primaryColor;
            ctx.font = 'bold 9px monospace';
            ctx.fillText(`${ev.angleDeg > 0 ? '+' : ''}${ev.angleDeg.toFixed(1)}°`, tagPos.x, tagPos.y);
          } else if (idx === 1) {
            // Secondary source (CLEAN Pass 1): Dashed Indigo beam
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = 'rgba(129, 140, 248, 0.85)';
            ctx.lineWidth = 1.8;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(needlePos.x, needlePos.y);
            ctx.stroke();

            // Smaller target bracket
            ctx.beginPath();
            ctx.arc(needlePos.x, needlePos.y, 3.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (idx === 2) {
            // Tertiary source (CLEAN Pass 2): Dotted Sky-Blue beam
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
            ctx.lineWidth = 1.4;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(needlePos.x, needlePos.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(needlePos.x, needlePos.y, 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
      }

      // 8. Draw Miniature Physical Quad-Microphone Array at Center (d = 82 mm)
      const arrayBox = 16;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(centerX - arrayBox / 2, centerY - arrayBox / 2, arrayBox, arrayBox);

      // 4 Microphone capsules at square corners: M0(RB), M1(RF), M2(LF), M3(LB)
      const corners = [
        { x: centerX + arrayBox / 2, y: centerY + arrayBox / 2 },
        { x: centerX + arrayBox / 2, y: centerY - arrayBox / 2 },
        { x: centerX - arrayBox / 2, y: centerY - arrayBox / 2 },
        { x: centerX - arrayBox / 2, y: centerY + arrayBox / 2 },
      ];
      for (const c of corners) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Center pivot dot
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Front orientation arrow at top of array
      ctx.strokeStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(centerX - 3, centerY - arrayBox / 2 - 2);
      ctx.lineTo(centerX, centerY - arrayBox / 2 - 6);
      ctx.lineTo(centerX + 3, centerY - arrayBox / 2 - 2);
      ctx.stroke();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto flex flex-col items-center justify-center p-3 bg-slate-950/70 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md overflow-hidden">
      {/* Top Floating HUD Controls */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          {/* Pause / Freeze Frame Toggle */}
          <button
            onClick={() => setIsFrozen((f) => !f)}
            title={isFrozen ? 'Resume live radar feed' : 'Freeze scope frame for transient inspection'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
              isFrozen
                ? 'bg-amber-950/80 border-amber-700 text-amber-300 animate-pulse'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {isFrozen ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isFrozen ? 'FROZEN' : 'LIVE'}</span>
          </button>

          {/* Sweep Toggle */}
          <button
            onClick={() => setShowSweep((s) => !s)}
            title="Toggle rotating sweep line"
            className={`p-1 rounded-md text-[11px] border transition ${
              showSweep
                ? 'bg-slate-800 border-slate-700 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {showSweep ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Grid Mode Toggle */}
          <button
            onClick={() => setGridMode((m) => (m === 'polar' ? 'compass' : 'polar'))}
            title="Toggle Polar degrees vs Compass navigation grid"
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            {gridMode === 'polar' ? '0°..360°' : 'N/E/S/W'}
          </button>

          {/* Persistence / Decay Selector */}
          <select
            value={decayTimeMs}
            onChange={(e) => setDecayTimeMs(parseInt(e.target.value, 10))}
            title="Phosphor trail persistence decay"
            className="bg-slate-900/90 border border-slate-800 text-slate-300 text-[10px] font-mono rounded px-1.5 py-0.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value={1200}>Decay: 1.2s</option>
            <option value={2500}>Decay: 2.5s</option>
            <option value={6000}>Decay: 6.0s</option>
            <option value={60000}>Persist: Inf</option>
          </select>
        </div>
      </div>

      {/* Main Radar Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Bottom Multi-Source Beam Legend */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-slate-400 pointer-events-none">
        <div className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-emerald-400" />
          <span className="text-slate-300">QUAD-MEMS 82mm</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Primary
          </span>
          {latestEvents.length > 1 && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-indigo-400 border-dashed inline-block" /> Sec (CLEAN)
            </span>
          )}
          {latestEvents.length > 2 && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-sky-400 border-dotted inline-block" /> Tert
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
