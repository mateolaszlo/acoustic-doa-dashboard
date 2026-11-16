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
import { apiRequestJson } from '../services/api_client.js';

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
  isAdmin?: boolean;
  latestDirectorState?: DirectorTelemetryState | null;
  latestStudioConfig?: StudioConfigPayload | null;
}

function saveStudioCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function mergeDirectorAnimationFrame(
  prevCameras: VirtualCamera[],
  animatedCameras: VirtualCamera[],
  hasBackendTelemetry: boolean
): VirtualCamera[] {
  let changed = false;
  const next = prevCameras.map((prevCam) => {
    const animCam = animatedCameras.find((a) => a.id === prevCam.id);
    if (!animCam) return prevCam;

    const panDiff = Math.abs(animCam.currentPanDeg - prevCam.currentPanDeg);
    const panChanged = panDiff >= 0.05;
    const liveChanged = animCam.isLive !== prevCam.isLive;
    const fallbackChanged =
      !hasBackendTelemetry &&
      (animCam.assignedTargetSlot !== prevCam.assignedTargetSlot ||
        animCam.isLockedOnSubject !== prevCam.isLockedOnSubject ||
        Math.abs(animCam.targetPanDeg - prevCam.targetPanDeg) >= 0.05);

    if (!panChanged && !liveChanged && !fallbackChanged) {
      return prevCam;
    }

    changed = true;
    return {
      ...prevCam,
      currentPanDeg: animCam.currentPanDeg,
      isLive: animCam.isLive,
      ...(hasBackendTelemetry
        ? {}
        : {
            targetPanDeg: animCam.targetPanDeg,
            assignedTargetSlot: animCam.assignedTargetSlot,
            isLockedOnSubject: animCam.isLockedOnSubject,
            lastTargetPos: animCam.lastTargetPos,
          }),
    };
  });

  return changed ? next : prevCameras;
}

export function useMultiCameraDirector({
  deviceId = 1,
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
  const [studioError, setStudioError] = useState<string | null>(null);

  const clearStudioError = useCallback(() => setStudioError(null), []);

  // Runtime tracking refs
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
  const isDraggingStudioRef = useRef<boolean>(false);

  const setDraggingStudio = useCallback((isDragging: boolean) => {
    isDraggingStudioRef.current = isDragging;
  }, []);

  // 2. Fetch authoritative studio layout & cameras from backend on mount / deviceId change
  useEffect(() => {
    let isCancelled = false;

    apiRequestJson<StudioConfigPayload>(`/api/v1/devices/${deviceId}/studio`, {
      fallbackError: 'Failed to load studio configuration.',
    })
      .then((data) => {
        if (isCancelled || !data) return;
        setStudioError(null);

        if (data.roomLayout) {
          setRoomLayout(data.roomLayout);
          saveStudioCache('acoustic_room_layout_config', data.roomLayout);
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
          saveStudioCache('acoustic_cameras_config', data.cameras);
        }

        if (data.directorConfig) {
          setDirectorConfig(data.directorConfig);
          saveStudioCache('acoustic_director_config', data.directorConfig);
        }

        if (data.liveCamId) {
          setLiveCamId(data.liveCamId);
        }
      })
      .catch((err) => {
        console.warn('[Director] Failed to fetch studio config from backend, using local defaults:', err);
        if (!isCancelled) {
          setStudioError(err instanceof Error ? err.message : 'Failed to load studio configuration.');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [deviceId]);

  // 3. React to real-time SSE studio_config broadcasts from backend
  useEffect(() => {
    if (!latestStudioConfig) return;

    if (!isDraggingStudioRef.current && latestStudioConfig.roomLayout) {
      roomLayoutRef.current = latestStudioConfig.roomLayout;
      setRoomLayout(latestStudioConfig.roomLayout);
    }
    if (latestStudioConfig.cameras && Array.isArray(latestStudioConfig.cameras)) {
      setCameras((prev) => {
        const next = latestStudioConfig.cameras.map((c) => {
          const ex = prev.find((p) => p.id === c.id);
          // Do not overwrite coordinates while the user is actively dragging a camera in this window
          if (isDraggingStudioRef.current && ex) {
            return { ...c, xRatio: ex.xRatio, yRatio: ex.yRatio, currentPanDeg: ex.currentPanDeg };
          }
          return { ...c, currentPanDeg: ex?.currentPanDeg ?? c.restingPanDeg };
        });
        camerasRef.current = next;
        return next;
      });
    }
    if (latestStudioConfig.directorConfig) {
      setDirectorConfig(latestStudioConfig.directorConfig);
    }
    if (latestStudioConfig.liveCamId) {
      setLiveCamId(latestStudioConfig.liveCamId);
    }
  }, [latestStudioConfig]);

  // 4. React to real-time authoritative PTZ director telemetry from measurement stream
  useEffect(() => {
    if (!latestDirectorState) return;

    if (latestDirectorState.liveCamId && latestDirectorState.liveCamId !== liveCamIdRef.current) {
      setLiveCamId(latestDirectorState.liveCamId);
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
      if (!isAdmin) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      const executeSave = async () => {
        try {
          await apiRequestJson(`/api/v1/devices/${deviceId}/studio`, {
            method: 'PUT',
            body: JSON.stringify(payload),
            fallbackError: 'Failed to save studio changes.',
          });
          setStudioError(null);
        } catch (err) {
          console.warn('[Director] Failed to sync studio configuration with backend:', err);
          setStudioError(
            err instanceof Error ? err.message : 'Failed to save studio changes to the server.'
          );
        }
      };

      if (immediate) {
        executeSave();
      } else {
        saveTimeoutRef.current = setTimeout(executeSave, 250);
      }
    },
    [deviceId, isAdmin]
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
    ): { activeCamera: VirtualCamera | null } => {
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

      setCameras((prev) => {
        const merged = mergeDirectorAnimationFrame(prev, updatedCameras, hasBackendTelemetry);
        camerasRef.current = merged;
        return merged;
      });

      return {
        activeCamera: updatedCameras.find((c) => c.id === currentLiveId) || null,
      };
    },
    [latestDirectorState]
  );

  // User actions with local immediate update + debounced backend persistence
  const updateRoomLayout = useCallback(
    (partial: Partial<RoomLayoutConfig>) => {
      setRoomLayout((prev) => {
        const next = { ...prev, ...partial };
        if (partial.customChairs === null) {
          delete next.customChairs;
        }
        roomLayoutRef.current = next;
        saveStudioCache('acoustic_room_layout_config', next);
        scheduleBackendSync(
          {
            roomLayout: {
              ...next,
              customChairs: partial.customChairs === null ? null : next.customChairs,
            },
          },
          false
        );
        return next;
      });
    },
    [scheduleBackendSync]
  );

  const setCameraCount = useCallback(
    (count: number) => {
      const targetCount = Math.max(1, Math.min(3, Math.round(count)));
      setCameras((prevCams) => {
        const nextCams: VirtualCamera[] = [];
        for (let i = 0; i < targetCount; i++) {
          const defaultCam = DEFAULT_VIRTUAL_CAMERAS[i];
          const existing = prevCams.find((c) => c.id === defaultCam.id);
          if (existing) {
            nextCams.push({ ...existing });
          } else {
            nextCams.push({ ...defaultCam });
          }
        }

        let nextLiveId = liveCamIdRef.current;
        if (!nextCams.some((c) => c.id === nextLiveId)) {
          nextLiveId = nextCams[0]?.id || 'cam-front';
          setLiveCamId(nextLiveId);
        }

        const updatedWithLive = nextCams.map((c) => ({
          ...c,
          isLive: c.id === nextLiveId,
        }));
        camerasRef.current = updatedWithLive;
        saveStudioCache('acoustic_cameras_config', updatedWithLive);

        scheduleBackendSync({ cameras: updatedWithLive, liveCamId: nextLiveId }, true);
        return updatedWithLive;
      });
    },
    [scheduleBackendSync]
  );

  const updateCamera = useCallback(
    (id: string, partial: Partial<VirtualCamera>) => {
      setCameras((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...partial } : c));
        camerasRef.current = next;
        saveStudioCache('acoustic_cameras_config', next);
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
        saveStudioCache('acoustic_director_config', next);
        scheduleBackendSync({ directorConfig: next }, true);
        return next;
      });
    },
    [scheduleBackendSync]
  );

  const setManualLiveCamera = useCallback(
    (id: string) => {
      setLiveCamId(id);
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

    saveStudioCache('acoustic_room_layout_config', DEFAULT_ROOM_LAYOUT);
    saveStudioCache('acoustic_cameras_config', DEFAULT_VIRTUAL_CAMERAS);
    saveStudioCache('acoustic_director_config', DEFAULT_DIRECTOR_CONFIG);

    scheduleBackendSync({ reset: true }, true);
  }, [scheduleBackendSync]);

  return {
    roomLayout,
    cameras,
    liveCamId,
    directorConfig,
    studioError,
    clearStudioError,
    processDirectorFrame,
    setManualLiveCamera,
    setCameraCount,
    updateCamera,
    updateConfig,
    updateRoomLayout,
    resetToDefaults,
    setDraggingStudio,
  };
}
