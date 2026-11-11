import React, { useRef, useEffect, useState } from 'react';
import { AcousticTrack, MeasurementEvent, SpatialZone } from '../../types/api_types';
import { stepCameraPan, computeCameraFovPoints, resolveSpatialZone, wrapAngle180 } from '../../services/camera_ptz_math';
import { Camera, Radio, Eye, EyeOff, Compass } from 'lucide-react';

interface SmartRoomDirectorCanvasProps {
  activeTracks?: AcousticTrack[];
  latestEvents?: MeasurementEvent[];
  zones: SpatialZone[];
}

export const SmartRoomDirectorCanvas: React.FC<SmartRoomDirectorCanvasProps> = ({
  activeTracks = [],
  latestEvents = [],
  zones = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // PTZ camera animation state refs
  const cameraPanRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const autoDirectorRef = useRef<boolean>(true);
  const manualPanRef = useRef<number>(0);
  const showZonesRef = useRef<boolean>(true);

  // Component UI State
  const [autoDirector, setAutoDirector] = useState(true);
  const [manualPan, setManualPan] = useState(0);
  const [showZones, setShowZones] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<string>('IDLE / SCANNING');
  const [activeZoneName, setActiveZoneName] = useState<string>('None');

  autoDirectorRef.current = autoDirector;
  manualPanRef.current = manualPan;
  showZonesRef.current = showZones;

  // Sync references to latest props for render loop
  const activeTracksRef = useRef(activeTracks);
  activeTracksRef.current = activeTracks;

  const latestEventsRef = useRef(latestEvents);
  latestEventsRef.current = latestEvents;

  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000.0, 0.1);
      lastTimeRef.current = time;

      // Handle DPI scaling
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

      const centerX = width / 2;
      const centerY = height / 2 + 15; // slightly lower center for table
      const cameraX = width / 2;
      const cameraY = height - 28; // PTZ camera at bottom edge (facing into room)

      // 1. Draw Conference Room Background & Grid
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Room border
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(12, 12, width - 24, height - 24);

      // Subtle room grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 20; x < width - 20; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 12);
        ctx.lineTo(x, height - 12);
        ctx.stroke();
      }
      for (let y = 20; y < height - 20; y += 30) {
        ctx.beginPath();
        ctx.moveTo(12, y);
        ctx.lineTo(width - 12, y);
        ctx.stroke();
      }

      // 2. Draw Geofenced Spatial Zones (Room Sectors)
      if (showZonesRef.current && zonesRef.current.length > 0) {
        const zoneRadius = Math.min(width, height) * 0.44;
        for (const zone of zonesRef.current) {
          const startRad = ((zone.min_angle_deg - 90) * Math.PI) / 180;
          const endRad = ((zone.max_angle_deg - 90) * Math.PI) / 180;

          // Sector wedge fill
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, zoneRadius, startRad, endRad);
          ctx.closePath();
          ctx.fillStyle = `${zone.color}15`; // ~8% opacity
          ctx.fill();

          // Sector boundary arc
          ctx.beginPath();
          ctx.arc(centerX, centerY, zoneRadius, startRad, endRad);
          ctx.strokeStyle = `${zone.color}66`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Radial sector boundary lines
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + Math.cos(startRad) * zoneRadius, centerY + Math.sin(startRad) * zoneRadius);
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + Math.cos(endRad) * zoneRadius, centerY + Math.sin(endRad) * zoneRadius);
          ctx.strokeStyle = `${zone.color}33`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Zone text label
          const midAngleDeg = (zone.min_angle_deg + zone.max_angle_deg) / 2;
          const midRad = ((midAngleDeg - 90) * Math.PI) / 180;
          const labelDist = zoneRadius * 0.82;
          const lx = centerX + Math.cos(midRad) * labelDist;
          const ly = centerY + Math.sin(midRad) * labelDist;

          ctx.font = '10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = zone.color;
          ctx.fillText(zone.name.toUpperCase(), lx, ly);

          ctx.font = '8px monospace';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillText(`${zone.min_angle_deg}°..${zone.max_angle_deg}°`, lx, ly + 11);
        }
      }

      // 3. Draw Conference Table in Room Center
      const tableWidth = width * 0.52;
      const tableHeight = height * 0.32;
      const tableX = centerX - tableWidth / 2;
      const tableY = centerY - tableHeight / 2;
      const radius = 24;

      // Drop shadow for table
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;

      ctx.beginPath();
      ctx.roundRect(tableX, tableY, tableWidth, tableHeight, radius);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Table inner bezel
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Table chairs / seating dots around table
      const chairColor = '#475569';
      const chairRadius = 4;
      const chairOffsets = [-tableWidth * 0.3, 0, tableWidth * 0.3];
      for (const off of chairOffsets) {
        // Top row chairs
        ctx.beginPath();
        ctx.arc(centerX + off, tableY - 10, chairRadius, 0, Math.PI * 2);
        ctx.fillStyle = chairColor;
        ctx.fill();

        // Bottom row chairs
        ctx.beginPath();
        ctx.arc(centerX + off, tableY + tableHeight + 10, chairRadius, 0, Math.PI * 2);
        ctx.fillStyle = chairColor;
        ctx.fill();
      }
      // Left and right side chairs
      ctx.beginPath();
      ctx.arc(tableX - 10, centerY, chairRadius, 0, Math.PI * 2);
      ctx.arc(tableX + tableWidth + 10, centerY, chairRadius, 0, Math.PI * 2);
      ctx.fillStyle = chairColor;
      ctx.fill();

      // 4. Draw ESP32 Planar Mic Array Pod at Table Center
      ctx.beginPath();
      ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // LED center glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();

      // 4 Mic Elements (cross configuration)
      const micOffsets = [
        { x: 0, y: -9 },
        { x: 9, y: 0 },
        { x: 0, y: 9 },
        { x: -9, y: 0 },
      ];
      ctx.fillStyle = '#e2e8f0';
      for (const m of micOffsets) {
        ctx.beginPath();
        ctx.arc(centerX + m.x, centerY + m.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pod label
      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('DOA ARRAY', centerX, centerY + 22);

      // 5. Determine Active Speaker & PTZ Target Azimuth
      const tracks = activeTracksRef.current;
      const primaryTrack = tracks.find((t) => t.trackSlot === 0 && t.state === 'ACTIVE');
      const secondaryTrack = tracks.find((t) => t.trackSlot === 1 && t.state === 'ACTIVE');
      const activeSpeakerTrack = primaryTrack || secondaryTrack || tracks.find((t) => t.state === 'ACTIVE');

      let targetAzimuthDeg: number | null = null;
      let targetStatusStr = 'IDLE / AMBIENT';

      if (autoDirectorRef.current) {
        if (activeSpeakerTrack) {
          targetAzimuthDeg = activeSpeakerTrack.angleDeg;
          const slotLabel = activeSpeakerTrack.trackSlot === 0 ? 'Speaker 1' : 'Speaker 2';
          const zoneObj = resolveSpatialZone(activeSpeakerTrack.angleDeg, zonesRef.current);
          const zoneName = zoneObj ? zoneObj.name : 'Unassigned';
          targetStatusStr = `TRACKING ${slotLabel.toUpperCase()} [${zoneName} @ ${Math.round(activeSpeakerTrack.angleDeg)}°]`;
          setActiveZoneName(zoneName);
        } else {
          // If no active track, check recent events
          const events = latestEventsRef.current;
          if (events.length > 0) {
            const latest = events[events.length - 1];
            if (Date.now() - latest.timestampMs < 1500 && latest.soundLevelDb >= 52) {
              targetAzimuthDeg = latest.angleDeg;
              const zoneObj = resolveSpatialZone(latest.angleDeg, zonesRef.current);
              const zoneName = zoneObj ? zoneObj.name : 'Unassigned';
              targetStatusStr = `DIRECTING AUDIO [${zoneName} @ ${Math.round(latest.angleDeg)}°]`;
              setActiveZoneName(zoneName);
            }
          }
        }
      } else {
        // Manual pan override
        targetAzimuthDeg = manualPanRef.current;
        targetStatusStr = `MANUAL OVERRIDE [${Math.round(manualPanRef.current)}°]`;
      }

      // Update camera pan via smooth spring inertia
      cameraPanRef.current = stepCameraPan(
        cameraPanRef.current,
        targetAzimuthDeg,
        dt,
        autoDirectorRef.current ? 35.0 : 60.0,
        3.8
      );
      setCameraStatus(targetStatusStr);

      // 6. Draw Simulated PTZ Camera FOV Optical Frustum (60 deg cone)
      const currentPan = cameraPanRef.current;
      const fovCone = computeCameraFovPoints(cameraX, cameraY, currentPan, 60.0, height * 0.95);

      // Gradient cone fill
      const coneGrad = ctx.createRadialGradient(cameraX, cameraY, 20, cameraX, cameraY, height * 0.95);
      if (activeSpeakerTrack) {
        coneGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        coneGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.15)');
        coneGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      } else {
        coneGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        coneGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
        coneGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      }

      ctx.beginPath();
      ctx.moveTo(cameraX, cameraY);
      ctx.lineTo(fovCone.leftX, fovCone.leftY);
      for (const p of fovCone.arcPoints) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo(fovCone.rightX, fovCone.rightY);
      ctx.closePath();
      ctx.fillStyle = coneGrad;
      ctx.fill();

      // Cone outer rays
      ctx.strokeStyle = activeSpeakerTrack ? 'rgba(16, 185, 129, 0.5)' : 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Centerline laser from camera along currentPan
      const panRad = ((currentPan - 90) * Math.PI) / 180;
      const laserLength = height * 0.92;
      ctx.beginPath();
      ctx.moveTo(cameraX, cameraY);
      ctx.lineTo(cameraX + Math.cos(panRad) * laserLength, cameraY + Math.sin(panRad) * laserLength);
      ctx.strokeStyle = activeSpeakerTrack ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 7. Draw Active Speaker Targets / Reticles
      const drawSpeaker = (angleDeg: number, splDb: number, slotId: number) => {
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        // Place speaker at realistic distance around conference table
        const distance = tableWidth * 0.44 + Math.min(25, (splDb - 50) * 0.8);
        const sx = centerX + Math.cos(rad) * distance;
        const sy = centerY + Math.sin(rad) * distance;
        const color = slotId === 0 ? '#10b981' : '#818cf8';

        // Animated sound wave ripple ring
        const ripplePhase = (time % 1200) / 1200;
        const rippleRadius = 14 + ripplePhase * 20;
        ctx.beginPath();
        ctx.arc(sx, sy, rippleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}${Math.floor((1 - ripplePhase) * 200).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Speaker Avatar / Icon Node
        ctx.beginPath();
        ctx.arc(sx, sy, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner glowing core
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Framing Reticle if Camera is looking at this speaker (angle delta < 25°)
        const angleDiff = Math.abs(wrapAngle180(currentPan - angleDeg));
        if (angleDiff < 26.0) {
          const reticleSize = 18;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          // Reticle corner brackets
          ctx.beginPath();
          // Top-left
          ctx.moveTo(sx - reticleSize, sy - reticleSize + 6);
          ctx.lineTo(sx - reticleSize, sy - reticleSize);
          ctx.lineTo(sx - reticleSize + 6, sy - reticleSize);
          // Top-right
          ctx.moveTo(sx + reticleSize - 6, sy - reticleSize);
          ctx.lineTo(sx + reticleSize, sy - reticleSize);
          ctx.lineTo(sx + reticleSize, sy - reticleSize + 6);
          // Bottom-left
          ctx.moveTo(sx - reticleSize, sy + reticleSize - 6);
          ctx.lineTo(sx - reticleSize, sy + reticleSize);
          ctx.lineTo(sx - reticleSize + 6, sy + reticleSize);
          // Bottom-right
          ctx.moveTo(sx + reticleSize - 6, sy + reticleSize);
          ctx.lineTo(sx + reticleSize, sy + reticleSize);
          ctx.lineTo(sx + reticleSize, sy + reticleSize - 6);
          ctx.stroke();

          // Reticle tag
          ctx.font = '8px Inter, sans-serif';
          ctx.fillStyle = '#f59e0b';
          ctx.textAlign = 'center';
          ctx.fillText('PTZ FRAMED', sx, sy - reticleSize - 4);
        }

        // Speaker label tag
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(slotId === 0 ? 'Speaker 1' : 'Speaker 2', sx, sy + 22);

        ctx.font = '8px monospace';
        ctx.fillStyle = color;
        ctx.fillText(`${Math.round(splDb)} dB | ${Math.round(angleDeg)}°`, sx, sy + 32);
      };

      if (primaryTrack && primaryTrack.state === 'ACTIVE') {
        drawSpeaker(primaryTrack.angleDeg, primaryTrack.soundLevelDb, 0);
      }
      if (secondaryTrack && secondaryTrack.state === 'ACTIVE') {
        drawSpeaker(secondaryTrack.angleDeg, secondaryTrack.soundLevelDb, 1);
      }

      // If no tracks active, draw latest event if recent
      if (!primaryTrack && !secondaryTrack && latestEventsRef.current.length > 0) {
        const latest = latestEventsRef.current[latestEventsRef.current.length - 1];
        if (Date.now() - latest.timestampMs < 1500) {
          drawSpeaker(latest.angleDeg, latest.soundLevelDb, latest.slotId ?? 0);
        }
      }

      // 8. Draw PTZ Camera Body & Lens at Bottom of Room
      ctx.beginPath();
      ctx.arc(cameraX, cameraY, 15, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Camera optical lens pivoted by currentPan
      ctx.save();
      ctx.translate(cameraX, cameraY);
      ctx.rotate((currentPan * Math.PI) / 180);
      ctx.beginPath();
      ctx.arc(0, -10, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.font = '9px Inter, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.fillText('PTZ DIRECTOR', cameraX, cameraY + 16);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Canvas Header & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-xs">
        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-200 uppercase tracking-wider">
            Smart Room Director
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            60° PTZ CONE
          </span>
        </div>

        {/* Real-time Camera Telemetry Pill */}
        <div className="flex items-center space-x-2 font-mono text-slate-400">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300 font-medium">{cameraStatus}</span>
        </div>

        {/* Interactive View Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowZones(!showZones)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1 border transition-colors ${
              showZones
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-transparent text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle spatial room sector overlays"
          >
            {showZones ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Zones</span>
          </button>

          <button
            onClick={() => setAutoDirector(!autoDirector)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1 border transition-colors ${
              autoDirector
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : 'bg-amber-950 text-amber-300 border-amber-700'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{autoDirector ? 'Auto Director' : 'Manual Pan'}</span>
          </button>
        </div>
      </div>

      {/* Manual Pan Slider (shown when Auto Director is disabled) */}
      {!autoDirector && (
        <div className="flex items-center space-x-3 px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 text-xs text-slate-300">
          <span className="font-mono text-amber-400">Manual Pan:</span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={manualPan}
            onChange={(e) => setManualPan(Number(e.target.value))}
            className="w-48 accent-amber-500 cursor-pointer"
          />
          <span className="font-mono w-14 text-right">{manualPan}°</span>
          <button
            onClick={() => setManualPan(0)}
            className="text-[10px] text-slate-400 hover:text-slate-200 underline"
          >
            Reset Center
          </button>
        </div>
      )}

      {/* Canvas Viewport */}
      <div className="relative w-full h-[440px]">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Bottom Room Legend */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Speaker 1 (Slot 0)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>Speaker 2 (Slot 1)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>PTZ Target Reticle</span>
          </div>
        </div>

        <div className="text-slate-500">
          Active Sector: <span className="text-slate-300 font-medium">{activeZoneName}</span>
        </div>
      </div>
    </div>
  );
};

export default SmartRoomDirectorCanvas;
