import { useState, useRef, useEffect, useCallback } from 'react';
import {
  VirtualCamera,
  CameraDirectorConfig,
  RoomLayoutConfig,
  DirectorTelemetryState,
  StudioConfigPayload,
} from '../types/api_types';
import {
  DEFAULT_VIRTUAL_CAMERAS,
  DEFAULT_DIRECTOR_CONFIG,
  DEFAULT_ROOM_LAYOUT,
  BASE_ROOM_WIDTH,
  BASE_ROOM_HEIGHT,
  calculateCameraBearing,
  scoreCameraCandidate,
  stepCameraPan,
} from '../services/camera_ptz_math';

export interface ActiveSpeakerTarget {
  slotId: number;
  pos: { x: number; y: number };
  canonicalPos?: { x: number; y: number };
  angleDeg: number;
  isActive: boolean;
  splDb: number;
}

export interface UseMultiCameraDirectorOptions {
  deviceId?: number;
  token?: string | null;
  isAdmin?: boolean;
  latestDirectorState?: DirectorTelemetryState | null;
  latestStudioConfig?: StudioConfigPayload | null;
}

export function useMultiCameraDirector({
  deviceId = 1,
  token = null,
  isAdmin = false,
  latestDirectorState = null,
  latestStudioConfig = null,
}: UseMultiCameraDirectorOptions = {}) {
  // 1. Studio state with offline localStorage fallback
  const [roomLayout, setRoomLayout] = useState<RoomLayoutConfig>(() => {
    try {
      const saved = localStorage.getItem('acoustic_room_layout_config');
      if (saved) return { ...DEFAULT_ROOM_LAYOUT, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_ROOM_LAYOUT;
  });

  const [cameras, setCameras] = useState<VirtualCamera[]>(() => {
    try {
      const saved = localStorage.getItem('acoustic_cameras_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_VIRTUAL_CAMERAS;
  });

  const [directorConfig, setDirectorConfig] = useState<CameraDirectorConfig>(() => {
    try {
      const saved = localStorage.getItem('acoustic_director_config');
      if (saved) return { ...DEFAULT_DIRECTOR_CONFIG, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_DIRECTOR_CONFIG;
  });

  const [liveCamId, setLiveCamId] = useState<string>('cam-front');
  const [activeZoneName, setActiveZoneName] = useState<string>('None');
  const [isLoadingStudio, setIsLoadingStudio] = useState<boolean>(false);

  // Runtime tracking refs
  const lastSwitchTimeRef = useRef<number>(Date.now());
  const lastRoomAudioTimeRef = useRef<number>(Date.now());

  const roomLayoutRef = useRef(roomLayout);
  roomLayoutRef.current = roomLayout;

  const camerasRef = useRef(cameras);
  camerasRef.current = cameras;

  const directorConfigRef = useRef(directorConfig);
  directorConfigRef.current = directorConfig;

  const liveCamIdRef = useRef(liveCamId);
  liveCamIdRef.current = liveCamId;

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2. Fetch authoritative studio layout & cameras from backend on mount / deviceId change
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingStudio(true);

    fetch(`/api/v1/devices/${deviceId}/studio`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StudioConfigPayload | null) => {
        if (isCancelled || !data) return;

        if (data.roomLayout) {
          setRoomLayout(data.roomLayout);
          try {
            localStorage.setItem('acoustic_room_layout_config', JSON.stringify(data.roomLayout));
          } catch {}
        }

        if (data.cameras && Array.isArray(data.cameras)) {
          // Preserve local currentPanDeg during initial hydration
          setCameras((prevCams) =>
            data.cameras.map((c) => {
              const existing = prevCams.find((p) => p.id === c.id);
              return {
                ...c,
                currentPanDeg: existing?.currentPanDeg ?? c.restingPanDeg,
              };
            })
          );
          try {
            localStorage.setItem('acoustic_cameras_config', JSON.stringify(data.cameras));
          } catch {}
        }

        if (data.directorConfig) {
          setDirectorConfig(data.directorConfig);
          try {
            localStorage.setItem('acoustic_director_config', JSON.stringify(data.directorConfig));
          } catch {}
        }

        if (data.liveCamId) {
          setLiveCamId(data.liveCamId);
        }

        if (data.activeZoneName) {
          setActiveZoneName(data.activeZoneName);
        }
      })
      .catch((err) => {
        console.warn('[Director] Failed to fetch studio config from backend, using local defaults:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingStudio(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [deviceId]);

  // 3. React to real-time SSE studio_config broadcasts from backend
  useEffect(() => {
    if (!latestStudioConfig) return;

    if (latestStudioConfig.roomLayout) {
      setRoomLayout(latestStudioConfig.roomLayout);
    }
    if (latestStudioConfig.cameras && Array.isArray(latestStudioConfig.cameras)) {
      setCameras((prev) =>
        latestStudioConfig.cameras.map((c) => {
          const ex = prev.find((p) => p.id === c.id);
          return { ...c, currentPanDeg: ex?.currentPanDeg ?? c.restingPanDeg };
        })
      );
    }
    if (latestStudioConfig.directorConfig) {
      setDirectorConfig(latestStudioConfig.directorConfig);
    }
    if (latestStudioConfig.liveCamId) {
      setLiveCamId(latestStudioConfig.liveCamId);
    }
    if (latestStudioConfig.activeZoneName) {
      setActiveZoneName(latestStudioConfig.activeZoneName);
    }
  }, [latestStudioConfig]);

  // 4. React to real-time authoritative PTZ director telemetry from measurement stream
  useEffect(() => {
    if (!latestDirectorState) return;

    if (latestDirectorState.liveCamId && latestDirectorState.liveCamId !== liveCamIdRef.current) {
      setLiveCamId(latestDirectorState.liveCamId);
    }

    if (latestDirectorState.activeZoneName) {
      setActiveZoneName(latestDirectorState.activeZoneName);
    }

    if (Array.isArray(latestDirectorState.cameras)) {
      setCameras((prevCams) =>
        prevCams.map((cam) => {
          const authCam = latestDirectorState.cameras.find((ac) => ac.id === cam.id);
          if (!authCam) return cam;

          return {
            ...cam,
            targetPanDeg: authCam.targetPanDeg,
            assignedTargetSlot: authCam.assignedTargetSlot,
            isLockedOnSubject: authCam.isLockedOnSubject,
            lastTargetPos: authCam.lastTargetPos ?? cam.lastTargetPos,
            isLive: authCam.id === latestDirectorState.liveCamId,
          };
        })
      );
    }
  }, [latestDirectorState]);

  // 5. Debounced backend persistence helper
  const scheduleBackendSync = useCallback(
    (
      payload: Partial<{
        roomLayout: RoomLayoutConfig;
        cameras: VirtualCamera[];
        directorConfig: CameraDirectorConfig;
        liveCamId: string;
        reset?: boolean;
      }>,
      immediate = false
    ) => {
      if (!isAdmin || !token) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      const executeSave = async () => {
        try {
          await fetch(`/api/v1/devices/${deviceId}/studio`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
        } catch (err) {
          console.warn('[Director] Failed to sync studio configuration with backend:', err);
        }
      };

      if (immediate) {
        executeSave();
      } else {
        saveTimeoutRef.current = setTimeout(executeSave, 250);
      }
    },
    [deviceId, isAdmin, token]
  );

  /**
   * 60 FPS Animation & Slew-Rate Frame Stepper.
   * Advances each camera's currentPanDeg smoothly toward authoritative targetPanDeg.
   */
  const processDirectorFrame = useCallback(
    (
      speakers: ActiveSpeakerTarget[],
      roomWidth: number = BASE_ROOM_WIDTH,
      roomHeight: number = BASE_ROOM_HEIGHT,
      dtSec: number = 0.016
    ): { activeCamera: VirtualCamera | null; switched: boolean } => {
      const now = Date.now();
      const config = directorConfigRef.current;
      let currentCameras = [...camerasRef.current];
      const currentLiveId = liveCamIdRef.current;

      const activeSpeakers = speakers.filter((s) => s.isActive);
      if (activeSpeakers.length > 0) {
        lastRoomAudioTimeRef.current = now;
      }

      // Backend director telemetry is authoritative when connected via SSE.
      // Do not expire backend telemetry during natural speech pauses or quiet periods!
      const hasBackendTelemetry = Boolean(latestDirectorState);

      if (!hasBackendTelemetry) {
        // Fallback local allocation across candidates (only used when running standalone without backend)
        const candidateSpeakers = speakers;
        const candidateSlotIds = new Set(candidateSpeakers.map((s) => s.slotId));
        currentCameras = currentCameras.map((c) => {
          if (c.assignedTargetSlot !== null && !candidateSlotIds.has(c.assignedTargetSlot)) {
            return { ...c, assignedTargetSlot: null, isLockedOnSubject: false };
          }
          return c;
        });

        if (candidateSpeakers.length === 1) {
          const spk = candidateSpeakers[0];
          const targetCoord = spk.canonicalPos || spk.pos;
          const scored = currentCameras.map((cam) => ({
            cam,
            score: scoreCameraCandidate(cam, targetCoord, spk.angleDeg, roomWidth, roomHeight),
          }));
          scored.sort((a, b) => b.score - a.score);

          if (scored.length > 0) {
            const bestCam = scored[0].cam;
            currentCameras = currentCameras.map((c) =>
              c.id === bestCam.id
                ? {
                    ...c,
                    assignedTargetSlot: spk.slotId,
                    isLockedOnSubject: true,
                    lastTargetPos: targetCoord,
                  }
                : c.assignedTargetSlot === spk.slotId
                ? { ...c, assignedTargetSlot: null, isLockedOnSubject: false }
                : c
            );
          }
        }

        // Compute pan target using canonical room coordinates
        currentCameras = currentCameras.map((cam) => {
          const camX = cam.xRatio * roomWidth;
          const camY = cam.yRatio * roomHeight;

          if (cam.assignedTargetSlot !== null) {
            const boundSpeaker = speakers.find((s) => s.slotId === cam.assignedTargetSlot);
            const targetPos = boundSpeaker?.canonicalPos || boundSpeaker?.pos || cam.lastTargetPos;
            if (targetPos) {
              return {
                ...cam,
                targetPanDeg: calculateCameraBearing(camX, camY, targetPos.x, targetPos.y),
                isLockedOnSubject: true,
              };
            }
          }

          const isProlongedSilence = now - lastRoomAudioTimeRef.current > 45000;
          if (cam.lastTargetPos && !isProlongedSilence) {
            return {
              ...cam,
              targetPanDeg: calculateCameraBearing(camX, camY, cam.lastTargetPos.x, cam.lastTargetPos.y),
              isLockedOnSubject: true,
            };
          }

          return {
            ...cam,
            targetPanDeg: cam.restingPanDeg,
            isLockedOnSubject: false,
          };
        });
      }

      // Slew camera pan motors toward targetPanDeg at 60 FPS
      const updatedCameras = currentCameras.map((cam) => {
        const isLive = cam.id === currentLiveId;
        let newPan = cam.currentPanDeg;

        if (config.instantCut && isLive) {
          newPan = cam.targetPanDeg;
        } else {
          newPan = stepCameraPan(
            cam.currentPanDeg,
            cam.targetPanDeg,
            dtSec,
            config.slewSpeedDegPerSec,
            4.2
          );
        }

        return {
          ...cam,
          currentPanDeg: newPan,
          isLive,
        };
      });

      camerasRef.current = updatedCameras;
      setCameras(updatedCameras);

      return {
        activeCamera: updatedCameras.find((c) => c.id === currentLiveId) || null,
        switched: false,
      };
    },
    [latestDirectorState]
  );

  // User actions with local immediate update + debounced backend persistence
  const updateRoomLayout = useCallback(
    (partial: Partial<RoomLayoutConfig>) => {
      setRoomLayout((prev) => {
        const next = { ...prev, ...partial };
        try {
          localStorage.setItem('acoustic_room_layout_config', JSON.stringify(next));
        } catch {}
        scheduleBackendSync({ roomLayout: next }, false);
        return next;
      });
    },
    [scheduleBackendSync]
  );

  const updateCamera = useCallback(
    (id: string, partial: Partial<VirtualCamera>) => {
      setCameras((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...partial } : c));
        try {
          localStorage.setItem('acoustic_cameras_config', JSON.stringify(next));
        } catch {}
        scheduleBackendSync({ cameras: next }, false);
        return next;
      });
    },
    [scheduleBackendSync]
  );

  const updateConfig = useCallback(
    (partial: Partial<CameraDirectorConfig>) => {
      setDirectorConfig((prev) => {
        const next = { ...prev, ...partial };
        try {
          localStorage.setItem('acoustic_director_config', JSON.stringify(next));
        } catch {}
        scheduleBackendSync({ directorConfig: next }, true);
        return next;
      });
    },
    [scheduleBackendSync]
  );

  const setManualLiveCamera = useCallback(
    (id: string) => {
      setLiveCamId(id);
      lastSwitchTimeRef.current = Date.now();
      setCameras((prev) =>
        prev.map((c) => ({
          ...c,
          isLive: c.id === id,
        }))
      );
      scheduleBackendSync({ liveCamId: id }, true);
    },
    [scheduleBackendSync]
  );

  const resetToDefaults = useCallback(() => {
    setRoomLayout(DEFAULT_ROOM_LAYOUT);
    setCameras(DEFAULT_VIRTUAL_CAMERAS);
    setDirectorConfig(DEFAULT_DIRECTOR_CONFIG);
    setLiveCamId('cam-front');
    lastSwitchTimeRef.current = Date.now();

    try {
      localStorage.setItem('acoustic_room_layout_config', JSON.stringify(DEFAULT_ROOM_LAYOUT));
      localStorage.setItem('acoustic_cameras_config', JSON.stringify(DEFAULT_VIRTUAL_CAMERAS));
      localStorage.setItem('acoustic_director_config', JSON.stringify(DEFAULT_DIRECTOR_CONFIG));
    } catch {}

    scheduleBackendSync({ reset: true }, true);
  }, [scheduleBackendSync]);

  return {
    roomLayout,
    cameras,
    liveCamId,
    directorConfig,
    activeZoneName,
    isLoadingStudio,
    processDirectorFrame,
    setManualLiveCamera,
    updateCamera,
    updateConfig,
    updateRoomLayout,
    resetToDefaults,
  };
}

export default useMultiCameraDirector;
