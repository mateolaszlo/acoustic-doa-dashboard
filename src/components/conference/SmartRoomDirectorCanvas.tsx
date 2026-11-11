import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  VirtualCamera,
  SpatialZone,
  AcousticTrack,
  MeasurementEvent,
  RoomLayoutConfig,
  TableShapeType,
} from '../../types/api_types';
import {
  calculateTablePerimeterPos,
  resolveSpatialZone,
  DEFAULT_ROOM_LAYOUT,
  computeDefaultChairs,
} from '../../services/camera_ptz_math';
import { ActiveSpeakerTarget } from '../../hooks/useMultiCameraDirector';
import {
  Camera,
  Radio,
  Eye,
  EyeOff,
  Sliders,
  Layout,
  Move,
  Maximize2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

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

function drawChair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  isHovered: boolean = false,
  isDragging: boolean = false
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isDragging ? '#10b981' : isHovered ? '#38bdf8' : color;
  ctx.fill();
  ctx.strokeStyle = isDragging ? '#34d399' : isHovered ? '#7dd3fc' : '#1e293b';
  ctx.lineWidth = isHovered || isDragging ? 2 : 1;
  ctx.stroke();

  // Subtle chair center dot for high-DPI finish
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = isDragging ? '#064e3b' : isHovered ? '#0369a1' : '#334155';
  ctx.fill();
  ctx.restore();
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
  const draggingChairIdRef = useRef<string | null>(null);
  const isResizingTableRef = useRef<boolean>(false);

  // Component UI State
  const [showZones, setShowZones] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<string>('IDLE • MULTI-CAMERA STANDBY');
  const [activeZoneName, setActiveZoneName] = useState<string>('None');
  const [isHoveringCamera, setIsHoveringCamera] = useState(false);
  const [hoveringChairId, setHoveringChairId] = useState<string | null>(null);
  const hoveringChairIdRef = useRef<string | null>(null);
  hoveringChairIdRef.current = hoveringChairId;
  const [isHoveringResize, setIsHoveringResize] = useState(false);
  const [isTableSettingsOpen, setIsTableSettingsOpen] = useState(false);

  // Interactive Canvas Zoom State
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('acoustic_director_canvas_zoom');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 0.5 && val <= 2.0) return val;
      }
    } catch {}
    return 1.0;
  });

  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  const handleZoom = useCallback((delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.max(0.5, Math.min(2.0, Math.round((prev + delta) * 10) / 10));
      try {
        localStorage.setItem('acoustic_director_canvas_zoom', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1.0);
    try {
      localStorage.setItem('acoustic_director_canvas_zoom', '1');
    } catch {}
  }, []);

  const handleFitZoom = useCallback(() => {
    const layout = roomLayoutRef.current;
    const maxDim = Math.max(layout.tableWidthRatio, layout.tableHeightRatio);
    const fitZoom = maxDim > 0.65 ? 0.75 : maxDim > 0.5 ? 0.85 : 1.0;
    setZoomLevel(fitZoom);
    try {
      localStorage.setItem('acoustic_director_canvas_zoom', String(fitZoom));
    } catch {}
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoomLevel((prev) => {
      const next = Math.max(0.5, Math.min(2.0, Math.round((prev + delta) * 100) / 100));
      try {
        localStorage.setItem('acoustic_director_canvas_zoom', String(next));
      } catch {}
      return next;
    });
  }, []);

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

  // Mouse interaction handlers for direct camera drag-and-drop, chair repositioning & table resizing
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Inverse Zoom Transformation: convert viewport client mouse pos to room world pos
    const centerX = rect.width / 2;
    const centerY = rect.height / 2 + 10;
    const zoom = zoomLevelRef.current;
    const worldX = centerX + (mouseX - centerX) / zoom;
    const worldY = centerY + (mouseY - centerY) / zoom;

    // 1. Check camera drag
    for (const cam of camerasRef.current) {
      const camX = cam.xRatio * rect.width;
      const camY = cam.yRatio * rect.height;
      if (Math.hypot(worldX - camX, worldY - camY) < 22) {
        draggingCamIdRef.current = cam.id;
        return;
      }
    }

    // 2. Check chair drag
    const layout = roomLayoutRef.current;
    const totalSeats = Math.max(2, layout.seatCount || 8);
    const activeChairs = (layout.customChairs && layout.customChairs.length === totalSeats)
      ? layout.customChairs
      : computeDefaultChairs(layout, rect.width, rect.height);

    for (const chair of activeChairs) {
      const cx = chair.xRatio * rect.width;
      const cy = chair.yRatio * rect.height;
      if (Math.hypot(worldX - cx, worldY - cy) < 16) {
        draggingChairIdRef.current = chair.id;
        if (!layout.customChairs || layout.customChairs.length !== totalSeats) {
          onUpdateRoomLayout({ customChairs: activeChairs });
        }
        return;
      }
    }

    // 3. Check table resize corner handle
    const tableW = rect.width * layout.tableWidthRatio;
    const tableH = rect.height * layout.tableHeightRatio;
    const isRound = layout.tableShape === 'round';
    const roundR = Math.min(tableW, tableH) * 0.48;
    const handleX = isRound ? centerX + roundR * Math.cos(Math.PI / 4) : centerX + tableW / 2;
    const handleY = isRound ? centerY + roundR * Math.sin(Math.PI / 4) : centerY + tableH / 2;

    if (Math.hypot(worldX - handleX, worldY - handleY) < 20) {
      isResizingTableRef.current = true;
    }
  }, [onUpdateRoomLayout]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Inverse Zoom Transformation: convert viewport client mouse pos to room world pos
      const centerX = rect.width / 2;
      const centerY = rect.height / 2 + 10;
      const zoom = zoomLevelRef.current;
      const worldX = centerX + (mouseX - centerX) / zoom;
      const worldY = centerY + (mouseY - centerY) / zoom;

      if (draggingCamIdRef.current) {
        const xRatio = Math.max(0.04, Math.min(0.96, worldX / rect.width));
        const yRatio = Math.max(0.04, Math.min(0.96, worldY / rect.height));
        onUpdateCamera(draggingCamIdRef.current, { xRatio, yRatio });
      } else if (draggingChairIdRef.current) {
        const xRatio = Math.max(0.05, Math.min(0.95, worldX / rect.width));
        const yRatio = Math.max(0.05, Math.min(0.95, worldY / rect.height));
        const layout = roomLayoutRef.current;
        const totalSeats = Math.max(2, layout.seatCount || 8);
        const activeChairs = (layout.customChairs && layout.customChairs.length === totalSeats)
          ? layout.customChairs
          : computeDefaultChairs(layout, rect.width, rect.height);

        const updatedChairs = activeChairs.map((c) =>
          c.id === draggingChairIdRef.current ? { ...c, xRatio, yRatio } : c
        );
        onUpdateRoomLayout({ customChairs: updatedChairs });
      } else if (isResizingTableRef.current) {
        const isRound = roomLayoutRef.current.tableShape === 'round';
        if (isRound) {
          const dist = Math.hypot(worldX - centerX, worldY - centerY);
          const minDim = Math.min(rect.width, rect.height);
          const targetRatio = Math.max(0.28, Math.min(0.75, (dist / 0.48) / minDim));
          onUpdateRoomLayout({
            tableWidthRatio: Math.round(targetRatio * 100) / 100,
            tableHeightRatio: Math.round(targetRatio * 100) / 100,
          });
        } else {
          const deltaX = Math.max(40, worldX - centerX);
          const deltaY = Math.max(30, worldY - centerY);
          const tableWidthRatio = Math.max(0.30, Math.min(0.82, (deltaX * 2) / rect.width));
          const tableHeightRatio = Math.max(0.20, Math.min(0.60, (deltaY * 2) / rect.height));
          onUpdateRoomLayout({
            tableWidthRatio: Math.round(tableWidthRatio * 100) / 100,
            tableHeightRatio: Math.round(tableHeightRatio * 100) / 100,
          });
        }
      } else {
        // Hover detection for cameras
        let hoveringCam = false;
        for (const cam of camerasRef.current) {
          const camX = cam.xRatio * rect.width;
          const camY = cam.yRatio * rect.height;
          if (Math.hypot(worldX - camX, worldY - camY) < 20) {
            hoveringCam = true;
            break;
          }
        }
        setIsHoveringCamera(hoveringCam);

        // Hover detection for chairs
        let foundChairId: string | null = null;
        const layout = roomLayoutRef.current;
        const totalSeats = Math.max(2, layout.seatCount || 8);
        const activeChairs = (layout.customChairs && layout.customChairs.length === totalSeats)
          ? layout.customChairs
          : computeDefaultChairs(layout, rect.width, rect.height);

        for (const chair of activeChairs) {
          const cx = chair.xRatio * rect.width;
          const cy = chair.yRatio * rect.height;
          if (Math.hypot(worldX - cx, worldY - cy) < 16) {
            foundChairId = chair.id;
            break;
          }
        }
        setHoveringChairId(foundChairId);

        // Hover detection for table resize handle
        const tableW = rect.width * layout.tableWidthRatio;
        const tableH = rect.height * layout.tableHeightRatio;
        const isRound = layout.tableShape === 'round';
        const roundR = Math.min(tableW, tableH) * 0.48;
        const handleX = isRound ? centerX + roundR * Math.cos(Math.PI / 4) : centerX + tableW / 2;
        const handleY = isRound ? centerY + roundR * Math.sin(Math.PI / 4) : centerY + tableH / 2;
        setIsHoveringResize(Math.hypot(worldX - handleX, worldY - handleY) < 18);
      }
    },
    [onUpdateCamera, onUpdateRoomLayout]
  );

  const handleMouseUp = useCallback(() => {
    draggingCamIdRef.current = null;
    draggingChairIdRef.current = null;
    isResizingTableRef.current = false;
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

      // 1. Draw Conference Room Floor & Grid
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Apply Center Zoom Transform
      ctx.save();
      const zoom = zoomLevelRef.current;
      ctx.translate(centerX, centerY);
      ctx.scale(zoom, zoom);
      ctx.translate(-centerX, -centerY);

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

      // 2. DRAW CONFERENCE TABLE FIRST (So spatial zones overlay it cleanly)
      const tableX = centerX - tableWidth / 2;
      const tableY = centerY - tableHeight / 2;
      const chairColor = '#475569';
      const chairRadius = 5.5;
      const totalSeats = Math.max(2, layout.seatCount || 8);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;

      if (layout.tableShape === 'oval') {
        // Boardroom Oval Table
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(tableX, tableY, tableWidth, tableHeight, 26);
        } else {
          ctx.rect(tableX, tableY, tableWidth, tableHeight);
        }
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (layout.tableShape === 'round') {
        // Roundtable Circle Table
        const r = Math.min(tableWidth, tableHeight) * 0.48;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (layout.tableShape === 'ushape') {
        // U-Shape Auditorium Table (Open North towards Stage/Screen)
        const wallThick = Math.max(34, Math.min(tableWidth * 0.22, tableHeight * 0.32));
        const outerR = 14;
        const innerR = 8;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tableX, tableY);
        // Left outer edge down to bottom-left
        ctx.lineTo(tableX, tableY + tableHeight - outerR);
        ctx.arcTo(tableX, tableY + tableHeight, tableX + outerR, tableY + tableHeight, outerR);
        // Bottom outer edge to bottom-right
        ctx.lineTo(tableX + tableWidth - outerR, tableY + tableHeight);
        ctx.arcTo(
          tableX + tableWidth,
          tableY + tableHeight,
          tableX + tableWidth,
          tableY + tableHeight - outerR,
          outerR
        );
        // Right outer edge up to top-right
        ctx.lineTo(tableX + tableWidth, tableY);
        // Right top inner cap
        ctx.lineTo(tableX + tableWidth - wallThick, tableY);
        // Right inner edge down to inner corner
        ctx.lineTo(tableX + tableWidth - wallThick, tableY + tableHeight - wallThick + innerR);
        ctx.arcTo(
          tableX + tableWidth - wallThick,
          tableY + tableHeight - wallThick,
          tableX + tableWidth - wallThick - innerR,
          tableY + tableHeight - wallThick,
          innerR
        );
        // Bottom inner edge to inner left corner
        ctx.lineTo(tableX + wallThick + innerR, tableY + tableHeight - wallThick);
        ctx.arcTo(
          tableX + wallThick,
          tableY + tableHeight - wallThick,
          tableX + wallThick,
          tableY + tableHeight - wallThick - innerR,
          innerR
        );
        // Left inner edge up to top-left
        ctx.lineTo(tableX + wallThick, tableY);
        ctx.closePath();

        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } else {
        // Hollow Square Executive Table
        const wallThick = Math.max(28, Math.min(tableWidth * 0.2, tableHeight * 0.28));
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(tableX, tableY, tableWidth, tableHeight, 8);
        } else {
          ctx.rect(tableX, tableY, tableWidth, tableHeight);
        }
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#090d16';
        ctx.fillRect(
          tableX + wallThick,
          tableY + wallThick,
          tableWidth - wallThick * 2,
          tableHeight - wallThick * 2
        );
        ctx.strokeRect(
          tableX + wallThick,
          tableY + wallThick,
          tableWidth - wallThick * 2,
          tableHeight - wallThick * 2
        );
      }

      // 3. Render Independent Chairs (Custom or Auto-Arranged - No connecting lines or polygons)
      const currentChairs = (layout.customChairs && layout.customChairs.length === totalSeats)
        ? layout.customChairs
        : computeDefaultChairs(layout, width, height);

      for (const ch of currentChairs) {
        const cx = ch.xRatio * width;
        const cy = ch.yRatio * height;
        const isHovered = hoveringChairIdRef.current === ch.id;
        const isDragging = draggingChairIdRef.current === ch.id;
        drawChair(ctx, cx, cy, chairRadius, chairColor, isHovered, isDragging);
      }

      // 4. DRAW FULL-ROOM INFINITE SPATIAL ZONES OVER TABLE AND FLOOR (Clipped to Room Walls)
      if (showZonesRef.current && zonesRef.current.length > 0) {
        const fullRoomRadius = Math.hypot(width, height);

        // Clip wedge fills and radial dividing lines to inside the room boundary walls
        ctx.save();
        ctx.beginPath();
        ctx.rect(12, 12, width - 24, height - 24);
        ctx.clip();

        for (const zone of zonesRef.current) {
          const startDeg = zone.min_angle_deg;
          let endDeg = zone.max_angle_deg;
          if (endDeg <= startDeg) {
            endDeg += 360;
          }
          const startRad = ((startDeg - 90) * Math.PI) / 180;
          const endRad = ((endDeg - 90) * Math.PI) / 180;

          // Semi-transparent sector wedge (Extends across floor and table to room boundary)
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, fullRoomRadius, startRad, endRad);
          ctx.closePath();
          ctx.fillStyle = `${zone.color}15`; // Subtle translucent tint across entire sector
          ctx.fill();

          // High-contrast dividing radial dashed line extending to room boundary
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(
            centerX + Math.cos(startRad) * fullRoomRadius,
            centerY + Math.sin(startRad) * fullRoomRadius
          );
          ctx.strokeStyle = `${zone.color}77`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.restore(); // Restore room clipping

        // Draw readable zone name badges along sector bisectors
        const labelDist = Math.min(width, height) * 0.35;
        for (const zone of zonesRef.current) {
          const startDeg = zone.min_angle_deg;
          let endDeg = zone.max_angle_deg;
          if (endDeg <= startDeg) {
            endDeg += 360;
          }
          let midAngleDeg = (startDeg + endDeg) / 2;
          if (midAngleDeg > 180) midAngleDeg -= 360;
          const midRad = ((midAngleDeg - 90) * Math.PI) / 180;
          const lx = centerX + Math.cos(midRad) * labelDist;
          const ly = centerY + Math.sin(midRad) * labelDist;

          const boxW = 104;
          const boxH = 26;
          ctx.save();
          ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
          if (ctx.roundRect) {
            ctx.roundRect(lx - boxW / 2, ly - boxH / 2, boxW, boxH, 6);
          } else {
            ctx.rect(lx - boxW / 2, ly - boxH / 2, boxW, boxH);
          }
          ctx.fill();
          ctx.strokeStyle = `${zone.color}99`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();

          ctx.font = 'bold 12px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = zone.color;
          ctx.fillText(zone.name.toUpperCase(), lx, ly - 5);

          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#f1f5f9';
          ctx.fillText(`${zone.min_angle_deg}°..${zone.max_angle_deg}°`, lx, ly + 6);
        }
      }

      // 5. Draw ESP32 Planar Mic Array Pod at Table Center
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

      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.fillText('DOA ARRAY', centerX, centerY + 22);

      // 6. Interactive Table Resize Corner Handle
      const isRound = layout.tableShape === 'round';
      const roundR = Math.min(tableWidth, tableHeight) * 0.48;
      const handleX = isRound ? centerX + roundR * Math.cos(Math.PI / 4) : tableX + tableWidth;
      const handleY = isRound ? centerY + roundR * Math.sin(Math.PI / 4) : tableY + tableHeight;

      ctx.beginPath();
      ctx.arc(handleX, handleY, 8, 0, Math.PI * 2);
      ctx.fillStyle = isResizingTableRef.current ? '#10b981' : isHoveringResize ? '#38bdf8' : '#334155';
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Handle grip icon
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(handleX - 2, handleY - 2, 1.2, 0, Math.PI * 2);
      ctx.arc(handleX + 2, handleY - 2, 1.2, 0, Math.PI * 2);
      ctx.arc(handleX - 2, handleY + 2, 1.2, 0, Math.PI * 2);
      ctx.arc(handleX + 2, handleY + 2, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // 6. Build Active Speaker Targets for Broadcast Director (Shape-Aware Positions)
      const tracks = activeTracksRef.current;
      const speakerTargets: ActiveSpeakerTarget[] = [];

      const track0 = tracks.find((t) => t.trackSlot === 0 && t.state === 'ACTIVE');
      const track1 = tracks.find((t) => t.trackSlot === 1 && t.state === 'ACTIVE');

      let resolvedZone = 'Unassigned';

      if (track0) {
        const pos0 = calculateTablePerimeterPos(centerX, centerY, track0.angleDeg, layout, width, height);
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
        const pos1 = calculateTablePerimeterPos(centerX, centerY, track1.angleDeg, layout, width, height);
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
          const pos = calculateTablePerimeterPos(centerX, centerY, latest.angleDeg, layout, width, height);
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

      // 7. Process Multi-Camera Broadcast Assignment & Sticky Memory
      const { activeCamera } = onProcessFrameRef.current(speakerTargets, width, height, dt);

      if (activeCamera && speakerTargets.some((s) => s.isActive)) {
        const aimDeg = Math.round(activeCamera.currentPanDeg);
        const role = activeCamera.role === 'front' ? 'FRONT' : activeCamera.role === 'rear' ? 'REAR' : 'SIDE';
        setCameraStatus(
          `[LIVE: ${role}] ${aimDeg > 0 ? '+' : ''}${aimDeg}° • ${resolvedZone.toUpperCase()}`
        );
      } else {
        setCameraStatus('STANDBY • 3-NODE READY');
      }

      // 8. Render All Virtual Cameras (Frustums, Cones, Tally Lights)
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
        ctx.lineTo(
          camX + Math.cos(panRad) * coneRadius * 0.9,
          camY + Math.sin(panRad) * coneRadius * 0.9
        );
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

        // Camera Label with Protected Background (Deconfliction & High Legibility)
        const labelY = cam.yRatio < 0.15 ? camY - 22 : camY + 24;
        const pillText = isLive ? `${cam.name} [ON AIR]` : cam.name.split(' ')[0];

        ctx.save();
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        const textMetrics = ctx.measureText(pillText);
        const textWidth = textMetrics.width;
        const pillH = 18;
        const pillW = textWidth + 16;
        const pillX = camX - pillW / 2;
        const pillY = labelY - pillH / 2;

        ctx.fillStyle = isLive ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.9)';
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillW, pillH, 5);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fill();

        ctx.strokeStyle = isLive ? '#34d399' : '#334155';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isLive ? '#022c22' : '#f1f5f9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pillText, camX, labelY);
        ctx.restore();

        // Pulsing "ON AIR" Halo
        if (isLive) {
          const tallyPhase = (time % 1000) / 1000;
          ctx.beginPath();
          ctx.arc(camX, camY, 17 + tallyPhase * 6, 0, Math.PI * 2);
          ctx.strokeStyle = `${cam.color}${Math.floor((1 - tallyPhase) * 180)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // 9. Render Active Speakers & Framing Reticles
      for (const spk of speakerTargets) {
        const sx = spk.pos.x;
        const sy = spk.pos.y;
        const color = spk.slotId === 0 ? '#10b981' : '#818cf8';

        // Ripple pulse
        const ripplePhase = (time % 1200) / 1200;
        const rippleRadius = 14 + ripplePhase * 20;
        ctx.beginPath();
        ctx.arc(sx, sy, rippleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}${Math.floor((1 - ripplePhase) * 200)
          .toString(16)
          .padStart(2, '0')}`;
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

        ctx.font = 'bold 9px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.fillText('DIRECTOR FRAMED', sx, sy - reticleSize - 5);

        // Speaker label tag
        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(spk.slotId === 0 ? 'Speaker 1' : 'Speaker 2', sx, sy + 24);

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = spk.slotId === 0 ? '#34d399' : '#a5b4fc';
        ctx.fillText(`${Math.round(spk.splDb)} dB | ${Math.round(spk.angleDeg)}°`, sx, sy + 36);
      }

      ctx.restore(); // Restore zoom transform
      ctx.restore(); // Restore DPR transform
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const shapeOptions: { id: TableShapeType; label: string }[] = [
    { id: 'oval', label: 'Oval' },
    { id: 'round', label: 'Round' },
    { id: 'ushape', label: 'U-Shape' },
  ];

  const cursorClass = isHoveringCamera || hoveringChairId
    ? 'cursor-grab active:cursor-grabbing'
    : isHoveringResize
    ? 'cursor-nwse-resize'
    : 'cursor-crosshair';

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Canvas Top Bar Controls & Telemetry */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 gap-3 overflow-x-auto whitespace-nowrap">
        {/* Title & Studio Status */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-1.5">
            <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-xs">
              Director Studio
            </span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              3 NODES
            </span>
          </div>

          {/* Real-time Camera Telemetry Pill */}
          <div
            className="flex items-center space-x-1.5 font-mono text-slate-400 text-xs max-w-[260px] truncate bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800"
            title={cameraStatus}
          >
            <Radio className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-slate-200 font-medium truncate">{cameraStatus}</span>
          </div>
        </div>

        {/* Interactive View Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Table Shape Switcher Toolbar */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <span className="px-1.5 text-slate-500 flex items-center space-x-1">
              <Layout className="w-3 h-3" />
              <span className="hidden sm:inline">Table:</span>
            </span>
            {shapeOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onUpdateRoomLayout({ tableShape: opt.id, customChairs: undefined })}
                className={`px-2 py-1 rounded font-medium capitalize transition ${
                  roomLayout.tableShape === opt.id
                    ? 'bg-emerald-600 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Table Dimensions & Layout Settings Popover Trigger */}
          <button
            onClick={() => setIsTableSettingsOpen(!isTableSettingsOpen)}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center space-x-1 border transition ${
              isTableSettingsOpen
                ? 'bg-slate-800 text-emerald-400 border-slate-700'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title="Adjust table dimensions, seating layout, and chairs"
          >
            <Maximize2 className="w-3 h-3 text-cyan-400" />
            <span className="font-mono text-[10px]">
              W {Math.round(roomLayout.tableWidthRatio * 100)}% × L {Math.round(roomLayout.tableHeightRatio * 100)}%
            </span>
            {isTableSettingsOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

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

      {/* Expandable Table Dimensions & Chair Seating Settings Card */}
      {isTableSettingsOpen && (
        <div className="bg-slate-950 border-b border-slate-800 px-5 py-3 text-xs grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
          {/* Width Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Table Width:</span>
              <span className="font-mono text-emerald-400 font-bold">
                {Math.round(roomLayout.tableWidthRatio * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={80}
              step={2}
              value={Math.round(roomLayout.tableWidthRatio * 100)}
              onChange={(e) =>
                onUpdateRoomLayout({ tableWidthRatio: Number(e.target.value) / 100 })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Length Slider (Renamed from Table Height) */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Table Length:</span>
              <span className="font-mono text-cyan-400 font-bold">
                {Math.round(roomLayout.tableHeightRatio * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={60}
              step={2}
              value={Math.round(roomLayout.tableHeightRatio * 100)}
              onChange={(e) =>
                onUpdateRoomLayout({ tableHeightRatio: Number(e.target.value) / 100 })
              }
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Seat Count Slider (min 2, max 16, step 1) */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Participant Seats:</span>
              <span className="font-mono text-indigo-400 font-bold">
                {roomLayout.seatCount || 8} Chairs
                {roomLayout.customChairs ? ' (Custom)' : ''}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={roomLayout.seatCount || 8}
              onChange={(e) =>
                onUpdateRoomLayout({
                  seatCount: Number(e.target.value),
                  customChairs: undefined,
                })
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* Presets, Reset & Auto-Arrange Chairs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0 sm:justify-end">
            <button
              onClick={() => onUpdateRoomLayout({ customChairs: undefined })}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-indigo-300 text-[10px] border border-indigo-900/60 hover:border-indigo-700 transition"
              title="Reset chair placements back to default symmetry"
            >
              Auto-Arrange Chairs
            </button>
            <button
              onClick={() => {
                const isRound = roomLayout.tableShape === 'round';
                onUpdateRoomLayout({
                  tableWidthRatio: isRound ? 0.44 : 0.42,
                  tableHeightRatio: isRound ? 0.44 : 0.26,
                  seatCount: isRound ? 6 : 6,
                  customChairs: undefined,
                });
              }}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800 transition"
            >
              Compact
            </button>
            <button
              onClick={() => {
                const isRound = roomLayout.tableShape === 'round';
                onUpdateRoomLayout({
                  tableWidthRatio: isRound ? 0.54 : 0.52,
                  tableHeightRatio: isRound ? 0.54 : 0.32,
                  seatCount: 8,
                  customChairs: undefined,
                });
              }}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800 transition"
            >
              Standard
            </button>
            <button
              onClick={() => {
                const isRound = roomLayout.tableShape === 'round';
                onUpdateRoomLayout({
                  tableWidthRatio: isRound ? 0.64 : 0.66,
                  tableHeightRatio: isRound ? 0.64 : 0.36,
                  seatCount: 12,
                  customChairs: undefined,
                });
              }}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800 transition"
            >
              Executive
            </button>
            <button
              onClick={() => onUpdateRoomLayout({ ...DEFAULT_ROOM_LAYOUT, customChairs: undefined })}
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
              title="Reset to default table dimensions"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Canvas Viewport with Mouse Drag & Resize Handler */}
      <div className="relative w-full h-[470px]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`w-full h-full block ${cursorClass}`}
        />
        {/* Interactive Hints Overlay */}
        <div className="absolute top-2 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="px-2 py-1 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 flex items-center space-x-1 backdrop-blur-sm">
            <Move className="w-3 h-3 text-cyan-400" />
            <span>Drag cameras</span>
          </div>
          <div className="px-2 py-1 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 flex items-center space-x-1 backdrop-blur-sm">
            <Move className="w-3 h-3 text-indigo-400" />
            <span>Drag chairs to rearrange</span>
          </div>
          <div className="px-2 py-1 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 flex items-center space-x-1 backdrop-blur-sm">
            <Maximize2 className="w-3 h-3 text-emerald-400" />
            <span>Drag handle to resize</span>
          </div>
        </div>

        {/* Floating Zoom Controls Toolbar */}
        <div className="absolute bottom-3 left-3 flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-1 space-x-1 shadow-lg backdrop-blur-sm z-10 font-mono text-xs text-slate-300">
          <button
            type="button"
            onClick={() => handleZoom(-0.1)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Zoom Out (Mouse Wheel Down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition text-[11px]"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            type="button"
            onClick={() => handleZoom(0.1)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Zoom In (Mouse Wheel Up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3 bg-slate-800 my-auto" />
          <button
            type="button"
            onClick={handleFitZoom}
            className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition text-[10px]"
            title="Fit Room to Viewport (85%)"
          >
            Fit
          </button>
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
                className={`w-2 h-2 rounded-full ${
                  c.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{c.name}:</span>
              <span className={c.isLive ? 'text-white' : 'text-slate-400'}>
                {Math.round(c.currentPanDeg)}°
              </span>
              {c.isLive && (
                <span className="text-[9px] bg-emerald-500 text-slate-950 px-1 rounded">LIVE</span>
              )}
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

/**
 * Computes polygon points for a camera's field-of-view visual frustum cone.
 */
function computeCameraFovPoints(
  camX: number,
  camY: number,
  panDeg: number,
  fovDeg: number,
  coneRadius: number
): { leftX: number; leftY: number; rightX: number; rightY: number; arcPoints: { x: number; y: number }[] } {
  const halfFov = fovDeg / 2;
  const leftAngleRad = ((panDeg - halfFov - 90) * Math.PI) / 180;
  const rightAngleRad = ((panDeg + halfFov - 90) * Math.PI) / 180;

  const leftX = camX + Math.cos(leftAngleRad) * coneRadius;
  const leftY = camY + Math.sin(leftAngleRad) * coneRadius;
  const rightX = camX + Math.cos(rightAngleRad) * coneRadius;
  const rightY = camY + Math.sin(rightAngleRad) * coneRadius;

  const arcPoints: { x: number; y: number }[] = [];
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const fraction = i / steps;
    const a = leftAngleRad + fraction * (rightAngleRad - leftAngleRad);
    arcPoints.push({
      x: camX + Math.cos(a) * coneRadius,
      y: camY + Math.sin(a) * coneRadius,
    });
  }

  return { leftX, leftY, rightX, rightY, arcPoints };
}

export default SmartRoomDirectorCanvas;
