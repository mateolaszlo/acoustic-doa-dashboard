import React, { useRef, useEffect } from 'react';
import { MeasurementEvent } from '../../types/api_types.js';
import { polarToCanvas, getSplColor } from '../../services/radar_math.js';

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
  decayTimeMs = 2000,
  showSweep = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blipsRef = useRef<Blip[]>([]);
  const sweepAngleRef = useRef(0);

  // Ingest incoming measurement events into the phosphor blip trail
  useEffect(() => {
    if (latestEvents.length > 0) {
      const now = Date.now();
      for (const ev of latestEvents) {
        blipsRef.current.push({
          angleDeg: ev.angleDeg,
          soundLevelDb: ev.soundLevelDb,
          confidence: ev.confidence,
          bornAt: now,
        });
      }
      // Retain maximum 150 blips
      if (blipsRef.current.length > 150) {
        blipsRef.current = blipsRef.current.slice(-150);
      }
    }
  }, [latestEvents]);

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

      // Background clearing with slight trail
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 30;

      // 1. Draw Outer Compass Bezel
      ctx.strokeStyle = '#1f293d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Draw Concentric Range Rings
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      for (const step of ringSteps) {
        ctx.strokeStyle = step === 1.0 ? '#10b981' : '#1f293d';
        ctx.lineWidth = step === 1.0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * step, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3. Draw Crosshair Axes & Degree Ticks
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      // Vertical line (Front 0 / Back 180)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();

      // Horizontal line (Left -90 / Right +90)
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.stroke();

      // Degree labels and ticks
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#64748b';

      const cardinalPoints = [
        { deg: 0, label: 'FRONT 0°', yOffset: -12, xOffset: 0 },
        { deg: 90, label: '+90° R', yOffset: 0, xOffset: 24 },
        { deg: 180, label: 'BACK ±180°', yOffset: 12, xOffset: 0 },
        { deg: -90, label: '-90° L', yOffset: 0, xOffset: -24 },
      ];

      for (const pt of cardinalPoints) {
        const pos = polarToCanvas(pt.deg, radius + 15, centerX, centerY);
        ctx.fillStyle = pt.deg === 0 ? '#10b981' : '#64748b';
        ctx.fillText(pt.label, pos.x + pt.xOffset, pos.y + pt.yOffset);
      }

      // Minor radial spokes (every 30 deg)
      for (let d = -150; d <= 150; d += 30) {
        if (d % 90 === 0) continue;
        const outer = polarToCanvas(d, radius, centerX, centerY);
        const inner = polarToCanvas(d, radius - 8, centerX, centerY);
        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(inner.x, inner.y);
        ctx.lineTo(outer.x, outer.y);
        ctx.stroke();
      }

      // 4. Draw Rotating Radar Sweep Line (Background HUD scan)
      if (showSweep) {
        sweepAngleRef.current = (sweepAngleRef.current + 1.2) % 360.0;
        const sweepRad = (sweepAngleRef.current * Math.PI) / 180.0;
        const sweepPos = polarToCanvas(sweepAngleRef.current, radius, centerX, centerY);

        const sweepGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        sweepGradient.addColorStop(0, 'rgba(16, 185, 129, 0.0)');
        sweepGradient.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

        ctx.fillStyle = sweepGradient;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, sweepRad - 0.3, sweepRad);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(sweepPos.x, sweepPos.y);
        ctx.stroke();
      }

      // 5. Draw Phosphor Decay Blips & Trails
      blipsRef.current = blipsRef.current.filter((b) => now - b.bornAt < decayTimeMs);

      for (const b of blipsRef.current) {
        const ageMs = now - b.bornAt;
        const alpha = Math.max(0, 1 - ageMs / decayTimeMs);
        const blipRadius = radius * (0.3 + 0.65 * b.confidence);
        const pos = polarToCanvas(b.angleDeg, blipRadius, centerX, centerY);

        // Outer glow
        const glowColor = getSplColor(b.soundLevelDb, alpha * 0.3);
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Inner sharp dot
        const dotColor = getSplColor(b.soundLevelDb, alpha * 0.9);
        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Draw Active Needles for the Most Recent Detections
      if (latestEvents.length > 0) {
        const primary = latestEvents[0];
        const needlePos = polarToCanvas(primary.angleDeg, radius, centerX, centerY);

        // Vector line
        const lineColor = getSplColor(primary.soundLevelDb, 0.9);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(needlePos.x, needlePos.y);
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset shadow

        // Central array symbol
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [decayTimeMs, showSweep]);

  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto flex items-center justify-center p-2 bg-slate-950/60 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-sm">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
