import React, { useRef, useEffect, useState } from 'react';
import { AcousticTrack, MeasurementEvent, SpatialZone, VirtualCamera } from '../../types/api_types';
import {
  computeCameraFovPoints,
  resolveSpatialZone,
  calculateSpeakerWorldPos,
} from '../../services/camera_ptz_math';
import { Camera, Radio, Eye, EyeOff, Sliders } from 'lucide-react';

interface SmartRoomDirectorCanvasProps {
  activeTracks?: AcousticTrack[];
  latestEvents?: MeasurementEvent[];
  zones: SpatialZone[];
  cameras: VirtualCamera[];
  liveCamId: string;
  onProcessFrame: (
    speakerPos: { x: number; y: number } | null,
    speakerAngleDeg: number | null,
    roomWidth: number,
    roomHeight: number,
    dtSec: number
  ) => { activeCamera: VirtualCamera | null; switched: boolean };
  onSelectManualLiveCam: (camId: string) => void;
  onOpenStudioSettings: () => void;
}

export const SmartRoomDirectorCanvas: React.FC<SmartRoomDirectorCanvasProps> = ({
  activeTracks = [],
  latestEvents = [],
  zones = [],
  cameras = [],
  liveCamId,
  onProcessFrame,
  onSelectManualLiveCam,
  onOpenStudioSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Component UI State
  const [showZones, setShowZones] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<string>('IDLE / SCANNING');
  const [activeZoneName, setActiveZoneName] = useState<string>('None');

  const showZonesRef = useRef<boolean>(showZones);
  showZonesRef.current = showZones;

  const activeTracksRef = useRef(activeTracks);
  activeTracksRef.current = activeTracks;

  const latestEventsRef = useRef(latestEvents);
  latestEventsRef.current = latestEvents;

  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  const camerasRef = useRef(cameras);
  camerasRef.current = cameras;

  const liveCamIdRef = useRef(liveCamId);
  liveCamIdRef.current = liveCamId;

  const onProcessFrameRef = useRef(onProcessFrame);
  onProcessFrameRef.current = onProcessFrame;

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
      const centerY = height / 2 + 10;
      const tableWidth = width * 0.52;
      const tableHeight = height * 0.32;
      const tableRadiusPx = tableWidth * 0.44;

      // 1. Draw Conference Room Floor & Grid
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Room boundary
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

      // 2. Draw Geofenced Spatial Zones
      if (showZonesRef.current && zonesRef.current.length > 0) {
        const zoneRadius = Math.min(width, height) * 0.44;
        for (const zone of zonesRef.current) {
          const startRad = ((zone.min_angle_deg - 90) * Math.PI) / 180;
          const endRad = ((zone.max_angle_deg - 90) * Math.PI) / 180;

          // Sector wedge
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, zoneRadius, startRad, endRad);
          ctx.closePath();
          ctx.fillStyle = `${zone.color}15`;
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
      const tableX = centerX - tableWidth / 2;
      const tableY = centerY - tableHeight / 2;
      const radius = 24;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.beginPath();
      ctx.roundRect(tableX, tableY, tableWidth, tableHeight, radius);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Chairs around table
      const chairColor = '#475569';
      const chairRadius = 4;
      const chairOffsets = [-tableWidth * 0.3, 0, tableWidth * 0.3];
      for (const off of chairOffsets) {
        ctx.beginPath();
        ctx.arc(centerX + off, tableY - 10, chairRadius, 0, Math.PI * 2);
        ctx.fillStyle = chairColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX + off, tableY + tableHeight + 10, chairRadius, 0, Math.PI * 2);
        ctx.fillStyle = chairColor;
        ctx.fill();
      }
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

      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();

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

      ctx.font = '8px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('DOA ARRAY', centerX, centerY + 22);

      // 5. Determine Active Speaker & World Coordinates
      const tracks = activeTracksRef.current;
      const primaryTrack = tracks.find((t) => t.trackSlot === 0 && t.state === 'ACTIVE');
      const secondaryTrack = tracks.find((t) => t.trackSlot === 1 && t.state === 'ACTIVE');
      const activeSpeakerTrack = primaryTrack || secondaryTrack || tracks.find((t) => t.state === 'ACTIVE');

      let activeSpeakerPos: { x: number; y: number } | null = null;
      let activeSpeakerAngle: number | null = null;
      let activeSpeakerSlot = 0;
      let activeSpeakerSpl = 0;

      if (activeSpeakerTrack) {
        activeSpeakerAngle = activeSpeakerTrack.angleDeg;
        activeSpeakerSlot = activeSpeakerTrack.trackSlot;
        activeSpeakerSpl = activeSpeakerTrack.soundLevelDb;
        activeSpeakerPos = calculateSpeakerWorldPos(centerX, centerY, activeSpeakerAngle, tableRadiusPx);

        const zoneObj = resolveSpatialZone(activeSpeakerAngle, zonesRef.current);
        const zoneName = zoneObj ? zoneObj.name : 'Unassigned';
        setActiveZoneName(zoneName);
      } else if (latestEventsRef.current.length > 0) {
        const latest = latestEventsRef.current[latestEventsRef.current.length - 1];
        if (Date.now() - latest.timestampMs < 1500 && latest.soundLevelDb >= 52) {
          activeSpeakerAngle = latest.angleDeg;
          activeSpeakerSlot = latest.slotId ?? 0;
          activeSpeakerSpl = latest.soundLevelDb;
          activeSpeakerPos = calculateSpeakerWorldPos(centerX, centerY, activeSpeakerAngle, tableRadiusPx);

          const zoneObj = resolveSpatialZone(activeSpeakerAngle, zonesRef.current);
          const zoneName = zoneObj ? zoneObj.name : 'Unassigned';
          setActiveZoneName(zoneName);
        }
      }

      // 6. Process Multi-Camera Director Frame (Trigonometric Parallax + Schmitt Hysteresis)
      const { activeCamera } = onProcessFrameRef.current(
        activeSpeakerPos,
        activeSpeakerAngle,
        width,
        height,
        dt
      );

      if (activeCamera && activeSpeakerPos !== null) {
        const aimDeg = Math.round(activeCamera.currentPanDeg);
        setCameraStatus(
          `[LIVE: ${activeCamera.name.toUpperCase()}] AIM: ${aimDeg > 0 ? '+' : ''}${aimDeg}° -> ${activeZoneName.toUpperCase()}`
        );
      } else {
        setCameraStatus('IDLE • MULTI-CAMERA STANDBY');
      }

      // 7. Render All Virtual Cameras (Frustums, Lasers, Tally Lights)
      const currentCams = camerasRef.current;
      for (const cam of currentCams) {
        const camX = cam.xRatio * width;
        const camY = cam.yRatio * height;
        const isLive = cam.id === liveCamIdRef.current;

        // Optical FOV Cone
        const coneRadius = Math.min(width, height) * 0.88;
        const fovCone = computeCameraFovPoints(camX, camY, cam.currentPanDeg, cam.fovDeg, coneRadius);

        const coneGrad = ctx.createRadialGradient(camX, camY, 15, camX, camY, coneRadius);
        if (isLive) {
          coneGrad.addColorStop(0, `${cam.color}55`); // ~33% opacity
          coneGrad.addColorStop(0.5, `${cam.color}20`); // ~12% opacity
          coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
        } else {
          coneGrad.addColorStop(0, 'rgba(148, 163, 184, 0.08)');
          coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
        }

        ctx.beginPath();
        ctx.moveTo(camX, camY);
        ctx.lineTo(fovCone.leftX, fovCone.leftY);
        for (const p of fovCone.arcPoints) {
          ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(fovCone.rightX, fovCone.rightY);
        ctx.closePath();
        ctx.fillStyle = coneGrad;
        ctx.fill();

        // Cone outline
        ctx.strokeStyle = isLive ? `${cam.color}99` : 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = isLive ? 1.5 : 1;
        ctx.setLineDash(isLive ? [] : [4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Laser centerline
        const panRad = ((cam.currentPanDeg - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(camX, camY);
        ctx.lineTo(camX + Math.cos(panRad) * coneRadius * 0.9, camY + Math.sin(panRad) * coneRadius * 0.9);
        ctx.strokeStyle = isLive ? cam.color : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = isLive ? 1.5 : 0.8;
        ctx.stroke();

        // Camera Base / Dome
        ctx.beginPath();
        ctx.arc(camX, camY, 13, 0, Math.PI * 2);
        ctx.fillStyle = isLive ? '#0f172a' : '#1e293b';
        ctx.fill();
        ctx.strokeStyle = isLive ? cam.color : '#475569';
        ctx.lineWidth = isLive ? 2.5 : 1.5;
        ctx.stroke();

        // Camera Lens Barrel (rotated by pan angle)
        ctx.save();
        ctx.translate(camX, camY);
        ctx.rotate((cam.currentPanDeg * Math.PI) / 180);
        ctx.beginPath();
        ctx.arc(0, -9, 5, 0, Math.PI * 2);
        ctx.fillStyle = isLive ? cam.color : '#334155';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // "ON AIR" Live Tally Light Indicator
        if (isLive) {
          const tallyPhase = (time % 1000) / 1000;
          ctx.beginPath();
          ctx.arc(camX, camY, 17 + tallyPhase * 6, 0, Math.PI * 2);
          ctx.strokeStyle = `${cam.color}${Math.floor((1 - tallyPhase) * 180).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Tally pill label
          ctx.font = '8px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText('ON AIR', camX, camY + 22);
        } else {
          ctx.font = '8px Inter, sans-serif';
          ctx.fillStyle = '#64748b';
          ctx.textAlign = 'center';
          ctx.fillText(cam.name.split(' ')[0], camX, camY + 22);
        }
      }

      // 8. Draw Active Speaker Node & Framing Reticles
      if (activeSpeakerPos !== null && activeSpeakerAngle !== null) {
        const sx = activeSpeakerPos.x;
        const sy = activeSpeakerPos.y;
        const color = activeSpeakerSlot === 0 ? '#10b981' : '#818cf8';

        // Ripple pulse
        const ripplePhase = (time % 1200) / 1200;
        const rippleRadius = 14 + ripplePhase * 20;
        ctx.beginPath();
        ctx.arc(sx, sy, rippleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}${Math.floor((1 - ripplePhase) * 200).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Speaker node
        ctx.beginPath();
        ctx.arc(sx, sy, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Framing Reticle
        const reticleSize = 18;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - reticleSize, sy - reticleSize + 6);
        ctx.lineTo(sx - reticleSize, sy - reticleSize);
        ctx.lineTo(sx - reticleSize + 6, sy - reticleSize);
        ctx.moveTo(sx + reticleSize - 6, sy - reticleSize);
        ctx.lineTo(sx + reticleSize, sy - reticleSize);
        ctx.lineTo(sx + reticleSize, sy - reticleSize + 6);
        ctx.moveTo(sx - reticleSize, sy + reticleSize - 6);
        ctx.lineTo(sx - reticleSize, sy + reticleSize);
        ctx.lineTo(sx - reticleSize + 6, sy + reticleSize);
        ctx.moveTo(sx + reticleSize - 6, sy + reticleSize);
        ctx.lineTo(sx + reticleSize, sy + reticleSize);
        ctx.lineTo(sx + reticleSize, sy + reticleSize - 6);
        ctx.stroke();

        ctx.font = '8px Inter, sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center';
        ctx.fillText('DIRECTOR FRAMED', sx, sy - reticleSize - 4);

        // Speaker label tag
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(activeSpeakerSlot === 0 ? 'Speaker 1' : 'Speaker 2', sx, sy + 22);

        ctx.font = '8px monospace';
        ctx.fillStyle = color;
        ctx.fillText(`${Math.round(activeSpeakerSpl)} dB | ${Math.round(activeSpeakerAngle)}°`, sx, sy + 32);
      }

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
            Smart Multi-Camera Director
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            3-NODE STUDIO
          </span>
        </div>

        {/* Real-time Camera Telemetry Pill */}
        <div className="flex items-center space-x-2 font-mono text-slate-400">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300 font-medium">{cameraStatus}</span>
        </div>

        {/* Interactive View Controls */}
        <div className="flex items-center space-x-2">
          {/* Live Camera Quick Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            {cameras.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectManualLiveCam(c.id)}
                className={`px-2 py-1 rounded font-medium transition ${
                  c.isLive
                    ? 'bg-emerald-600 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Switch live transmission to ${c.name}`}
              >
                {c.name.split(' ')[0]}
              </button>
            ))}
          </div>

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
            onClick={onOpenStudioSettings}
            className="px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Configure camera positions, slew speeds, and Schmitt-trigger hysteresis"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Studio Setup</span>
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative w-full h-[460px]">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Bottom Room Legend & Camera Status Strip */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 gap-2">
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
            <span>Framing Reticle</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 font-mono text-[10px]">
          {cameras.map((c) => (
            <div key={c.id} className="flex items-center space-x-1">
              <span
                className={`w-2 h-2 rounded-full ${c.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}
              />
              <span className={c.isLive ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                {c.name}: {Math.round(c.currentPanDeg)}°
              </span>
            </div>
          ))}
          <div className="text-slate-500 pl-2 border-l border-slate-800">
            Sector: <span className="text-slate-300 font-medium font-sans">{activeZoneName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartRoomDirectorCanvas;
