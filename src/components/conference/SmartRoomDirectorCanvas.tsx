import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AcousticTrack,
  MeasurementEvent,
  SpatialZone,
  VirtualCamera,
  RoomLayoutConfig,
  TableShapeType,
} from '../../types/api_types';
import {
  computeCameraFovPoints,
  resolveSpatialZone,
  calculateSpeakerWorldPos,
} from '../../services/camera_ptz_math';
import { ActiveSpeakerTarget } from '../../hooks/useMultiCameraDirector';
import { Camera, Radio, Eye, EyeOff, Sliders, Layout, Move } from 'lucide-react';

interface SmartRoomDirectorCanvasProps {
  activeTracks?: AcousticTrack[];
  latestEvents?: MeasurementEvent[];
  zones: SpatialZone[];
  cameras: VirtualCamera[];
  liveCamId: string;
  roomLayout: RoomLayoutConfig;
  onUpdateRoomLayout: (partial: Partial<RoomLayoutConfig>) => void;
  onUpdateCamera: (id: string, partial: Partial<VirtualCamera>) => void;
  onProcessFrame: (
    speakers: ActiveSpeakerTarget[],
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
  roomLayout,
  onUpdateRoomLayout,
  onUpdateCamera,
  onProcessFrame,
  onSelectManualLiveCam,
  onOpenStudioSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const draggingCamIdRef = useRef<string | null>(null);

  // Component UI State
  const [showZones, setShowZones] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<string>('IDLE • MULTI-CAMERA STANDBY');
  const [activeZoneName, setActiveZoneName] = useState<string>('None');
  const [isHoveringCamera, setIsHoveringCamera] = useState(false);

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

  const roomLayoutRef = useRef(roomLayout);
  roomLayoutRef.current = roomLayout;

  const onProcessFrameRef = useRef(onProcessFrame);
  onProcessFrameRef.current = onProcessFrame;

  // Mouse interaction handlers for direct camera drag-and-drop
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (const cam of camerasRef.current) {
      const camX = cam.xRatio * rect.width;
      const camY = cam.yRatio * rect.height;
      if (Math.hypot(mouseX - camX, mouseY - camY) < 22) {
        draggingCamIdRef.current = cam.id;
        return;
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggingCamIdRef.current) {
      const xRatio = Math.max(0.04, Math.min(0.96, mouseX / rect.width));
      const yRatio = Math.max(0.04, Math.min(0.96, mouseY / rect.height));
      onUpdateCamera(draggingCamIdRef.current, { xRatio, yRatio });
    } else {
      // Check hover for cursor styling
      let hovering = false;
      for (const cam of camerasRef.current) {
        const camX = cam.xRatio * rect.width;
        const camY = cam.yRatio * rect.height;
        if (Math.hypot(mouseX - camX, mouseY - camY) < 20) {
          hovering = true;
          break;
        }
      }
      setIsHoveringCamera(hovering);
    }
  }, [onUpdateCamera]);

  const handleMouseUp = useCallback(() => {
    draggingCamIdRef.current = null;
  }, []);

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
      const layout = roomLayoutRef.current;
      const tableWidth = width * layout.tableWidthRatio;
      const tableHeight = height * layout.tableHeightRatio;
      const tableRadiusPx = Math.min(tableWidth, tableHeight) * 0.48;

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

      // 2. Draw Geofenced Spatial Zones (Positioned cleanly away from wall cameras)
      if (showZonesRef.current && zonesRef.current.length > 0) {
        const zoneRadius = Math.min(width, height) * 0.42;
        for (const zone of zonesRef.current) {
          const startRad = ((zone.min_angle_deg - 90) * Math.PI) / 180;
          const endRad = ((zone.max_angle_deg - 90) * Math.PI) / 180;

          // Sector wedge
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, zoneRadius, startRad, endRad);
          ctx.closePath();
          ctx.fillStyle = `${zone.color}12`;
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

          // Zone text label (Offset radially to avoid colliding with top/bottom wall cameras)
          const midAngleDeg = (zone.min_angle_deg + zone.max_angle_deg) / 2;
          const midRad = ((midAngleDeg - 90) * Math.PI) / 180;
          const labelDist = zoneRadius * 0.68;
          const lx = centerX + Math.cos(midRad) * labelDist;
          const ly = centerY + Math.sin(midRad) * labelDist;

          ctx.save();
          ctx.fillStyle = 'rgba(9, 13, 22, 0.75)';
          ctx.fillRect(lx - 45, ly - 10, 90, 20);
          ctx.restore();

          ctx.font = '10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = zone.color;
          ctx.fillText(zone.name.toUpperCase(), lx, ly - 3);

          ctx.font = '8px monospace';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fillText(`${zone.min_angle_deg}°..${zone.max_angle_deg}°`, lx, ly + 8);
        }
      }

      // 3. Draw Conference Table based on Selected Table Shape
      const tableX = centerX - tableWidth / 2;
      const tableY = centerY - tableHeight / 2;
      const chairColor = '#475569';
      const chairRadius = 4.5;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;

      if (layout.tableShape === 'oval') {
        // Boardroom Oval Table
        ctx.beginPath();
        ctx.roundRect(tableX, tableY, tableWidth, tableHeight, 26);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Seating chairs around oval
        const xOffsets = [-tableWidth * 0.32, 0, tableWidth * 0.32];
        for (const off of xOffsets) {
          ctx.beginPath();
          ctx.arc(centerX + off, tableY - 11, chairRadius, 0, Math.PI * 2);
          ctx.arc(centerX + off, tableY + tableHeight + 11, chairRadius, 0, Math.PI * 2);
          ctx.fillStyle = chairColor;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(tableX - 11, centerY, chairRadius, 0, Math.PI * 2);
        ctx.arc(tableX + tableWidth + 11, centerY, chairRadius, 0, Math.PI * 2);
        ctx.fillStyle = chairColor;
        ctx.fill();
      } else if (layout.tableShape === 'round') {
        // Roundtable Circle Table
        const r = Math.min(tableWidth, tableHeight) * 0.44;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Radial chairs around circle
        const seats = layout.seatCount || 8;
        for (let i = 0; i < seats; i++) {
          const ang = (i / seats) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(centerX + Math.cos(ang) * (r + 12), centerY + Math.sin(ang) * (r + 12), chairRadius, 0, Math.PI * 2);
          ctx.fillStyle = chairColor;
          ctx.fill();
        }
      } else if (layout.tableShape === 'ushape') {
        // U-Shape Auditorium Table (Open North towards Stage)
        const wallThick = 26;
        ctx.beginPath();
        ctx.moveTo(tableX, tableY);
        ctx.lineTo(tableX + wallThick, tableY);
        ctx.lineTo(tableX + wallThick, tableY + tableHeight - wallThick);
        ctx.lineTo(tableX + tableWidth - wallThick, tableY + tableHeight - wallThick);
        ctx.lineTo(tableX + tableWidth - wallThick, tableY);
        ctx.lineTo(tableX + tableWidth, tableY);
        ctx.lineTo(tableX + tableWidth, tableY + tableHeight);
        ctx.lineTo(tableX, tableY + tableHeight);
        ctx.closePath();
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Chairs on outer boundary
        ctx.beginPath();
        ctx.arc(tableX - 11, centerY - 20, chairRadius, 0, Math.PI * 2);
        ctx.arc(tableX - 11, centerY + 20, chairRadius, 0, Math.PI * 2);
        ctx.arc(tableX + tableWidth + 11, centerY - 20, chairRadius, 0, Math.PI * 2);
        ctx.arc(tableX + tableWidth + 11, centerY + 20, chairRadius, 0, Math.PI * 2);
        ctx.arc(centerX - 35, tableY + tableHeight + 11, chairRadius, 0, Math.PI * 2);
        ctx.arc(centerX + 35, tableY + tableHeight + 11, chairRadius, 0, Math.PI * 2);
        ctx.fillStyle = chairColor;
        ctx.fill();
      } else {
        // Hollow Square
        const wallThick = 24;
        ctx.beginPath();
        ctx.rect(tableX, tableY, tableWidth, tableHeight);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#090d16';
        ctx.fillRect(tableX + wallThick, tableY + wallThick, tableWidth - wallThick * 2, tableHeight - wallThick * 2);
        ctx.strokeRect(tableX + wallThick, tableY + wallThick, tableWidth - wallThick * 2, tableHeight - wallThick * 2);
      }

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

      // 5. Build Active Speaker Targets for Broadcast Director
      const tracks = activeTracksRef.current;
      const speakerTargets: ActiveSpeakerTarget[] = [];

      const track0 = tracks.find((t) => t.trackSlot === 0 && t.state === 'ACTIVE');
      const track1 = tracks.find((t) => t.trackSlot === 1 && t.state === 'ACTIVE');

      let resolvedZone = 'Unassigned';

      if (track0) {
        const pos0 = calculateSpeakerWorldPos(centerX, centerY, track0.angleDeg, tableRadiusPx);
        speakerTargets.push({
          slotId: 0,
          pos: pos0,
          angleDeg: track0.angleDeg,
          isActive: true,
          splDb: track0.soundLevelDb,
        });
        const z0 = resolveSpatialZone(track0.angleDeg, zonesRef.current);
        if (z0) resolvedZone = z0.name;
      }

      if (track1) {
        const pos1 = calculateSpeakerWorldPos(centerX, centerY, track1.angleDeg, tableRadiusPx);
        speakerTargets.push({
          slotId: 1,
          pos: pos1,
          angleDeg: track1.angleDeg,
          isActive: true,
          splDb: track1.soundLevelDb,
        });
        const z1 = resolveSpatialZone(track1.angleDeg, zonesRef.current);
        if (z1) resolvedZone = z1.name;
      }

      // Fallback: If no tracks exist, inspect recent event
      if (speakerTargets.length === 0 && latestEventsRef.current.length > 0) {
        const latest = latestEventsRef.current[latestEventsRef.current.length - 1];
        if (Date.now() - latest.timestampMs < 1600 && latest.soundLevelDb >= 50) {
          const slot = latest.slotId ?? 0;
          const pos = calculateSpeakerWorldPos(centerX, centerY, latest.angleDeg, tableRadiusPx);
          speakerTargets.push({
            slotId: slot,
            pos,
            angleDeg: latest.angleDeg,
            isActive: true,
            splDb: latest.soundLevelDb,
          });
          const z = resolveSpatialZone(latest.angleDeg, zonesRef.current);
          if (z) resolvedZone = z.name;
        }
      }

      setActiveZoneName(resolvedZone);

      // 6. Process Multi-Camera Broadcast Assignment & Sticky Memory
      const { activeCamera } = onProcessFrameRef.current(speakerTargets, width, height, dt);

      if (activeCamera && speakerTargets.some((s) => s.isActive)) {
        const aimDeg = Math.round(activeCamera.currentPanDeg);
        setCameraStatus(
          `[LIVE: ${activeCamera.name.toUpperCase()}] AIM: ${aimDeg > 0 ? '+' : ''}${aimDeg}° -> ${resolvedZone.toUpperCase()}`
        );
      } else {
        setCameraStatus('IDLE • MULTI-CAMERA STANDBY');
      }

      // 7. Render All Virtual Cameras (Frustums, Cones, Tally Lights)
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
          coneGrad.addColorStop(0, `${cam.color}55`);
          coneGrad.addColorStop(0.5, `${cam.color}20`);
          coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
        } else {
          // Standby camera: faint context cone
          coneGrad.addColorStop(0, 'rgba(148, 163, 184, 0.07)');
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

        ctx.strokeStyle = isLive ? `${cam.color}99` : 'rgba(148, 163, 184, 0.22)';
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

        // Camera Label with Protected Background (Deconfliction)
        const labelY = cam.yRatio < 0.15 ? camY - 18 : camY + 22;
        const pillText = isLive ? `${cam.name} [ON AIR]` : cam.name.split(' ')[0];

        ctx.save();
        ctx.font = '8px Inter, sans-serif';
        const textWidth = ctx.measureText(pillText).width;
        ctx.fillStyle = isLive ? 'rgba(16, 185, 129, 0.85)' : 'rgba(15, 23, 42, 0.85)';
        ctx.roundRect(camX - textWidth / 2 - 4, labelY - 8, textWidth + 8, 13, 4);
        ctx.fill();

        ctx.fillStyle = isLive ? '#022c22' : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(pillText, camX, labelY + 2);
        ctx.restore();

        // Pulsing "ON AIR" Halo
        if (isLive) {
          const tallyPhase = (time % 1000) / 1000;
          ctx.beginPath();
          ctx.arc(camX, camY, 17 + tallyPhase * 6, 0, Math.PI * 2);
          ctx.strokeStyle = `${cam.color}${Math.floor((1 - tallyPhase) * 180).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // 8. Render Active Speakers & Framing Reticles
      for (const spk of speakerTargets) {
        const sx = spk.pos.x;
        const sy = spk.pos.y;
        const color = spk.slotId === 0 ? '#10b981' : '#818cf8';

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

        // Framing Reticle around speaker
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
        ctx.fillText(spk.slotId === 0 ? 'Speaker 1' : 'Speaker 2', sx, sy + 22);

        ctx.font = '8px monospace';
        ctx.fillStyle = color;
        ctx.fillText(`${Math.round(spk.splDb)} dB | ${Math.round(spk.angleDeg)}°`, sx, sy + 32);
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
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-xs gap-2">
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
          {/* Table Shape Switcher Toolbar */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <span className="px-1.5 text-slate-500 flex items-center space-x-1">
              <Layout className="w-3 h-3" />
              <span className="hidden sm:inline">Table:</span>
            </span>
            {(['oval', 'round', 'ushape'] as TableShapeType[]).map((shape) => (
              <button
                key={shape}
                onClick={() => onUpdateRoomLayout({ tableShape: shape })}
                className={`px-2 py-1 rounded font-medium capitalize transition ${
                  roomLayout.tableShape === shape
                    ? 'bg-emerald-600 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {shape === 'ushape' ? 'U-Shape' : shape}
              </button>
            ))}
          </div>

          {/* Zones Toggle */}
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

          {/* Studio Setup Trigger */}
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

      {/* Canvas Viewport with Mouse Drag Handler */}
      <div className="relative w-full h-[470px]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full h-full block ${isHoveringCamera ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        />
        {/* Drag Hint overlay */}
        <div className="absolute top-2 left-3 px-2 py-1 rounded bg-slate-950/70 border border-slate-800/80 text-[10px] text-slate-400 pointer-events-none flex items-center space-x-1">
          <Move className="w-3 h-3 text-cyan-400" />
          <span>Click &amp; drag cameras along walls to reposition</span>
        </div>
      </div>

      {/* Bottom Room Legend & High-Contrast Camera Angle Strip */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 gap-2">
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

        {/* High-Contrast Camera Angle Badges */}
        <div className="flex items-center space-x-2 font-mono text-[11px]">
          {cameras.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectManualLiveCam(c.id)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border transition ${
                c.isLive
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 font-bold shadow'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${c.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
              />
              <span>{c.name}:</span>
              <span className={c.isLive ? 'text-white' : 'text-slate-400'}>
                {Math.round(c.currentPanDeg)}°
              </span>
              {c.isLive && <span className="text-[9px] bg-emerald-500 text-slate-950 px-1 rounded">LIVE</span>}
            </button>
          ))}
          <div className="text-slate-500 pl-2 border-l border-slate-800">
            Sector: <span className="text-emerald-400 font-medium font-sans">{activeZoneName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartRoomDirectorCanvas;
