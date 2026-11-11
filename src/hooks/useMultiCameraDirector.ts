import { useState, useRef, useCallback } from 'react';
import { VirtualCamera, CameraDirectorConfig } from '../types/api_types';
import {
  DEFAULT_VIRTUAL_CAMERAS,
  DEFAULT_DIRECTOR_CONFIG,
  calculateCameraBearing,
  scoreCameraCandidate,
  stepCameraPan,
} from '../services/camera_ptz_math';

export interface ActiveSpeakerTarget {
  slotId: number;
  pos: { x: number; y: number };
  angleDeg: number;
  isActive: boolean;
  splDb: number;
}

export function useMultiCameraDirector(
  initialCameras: VirtualCamera[] = DEFAULT_VIRTUAL_CAMERAS,
  initialConfig: CameraDirectorConfig = DEFAULT_DIRECTOR_CONFIG
) {
  const [cameras, setCameras] = useState<VirtualCamera[]>(initialCameras);
  const [directorConfig, setDirectorConfig] = useState<CameraDirectorConfig>(initialConfig);
  const [liveCamId, setLiveCamId] = useState<string>('cam-front');

  // Hysteresis & Schmitt-trigger tracking refs
  const lastSwitchTimeRef = useRef<number>(Date.now());
  const candidateCamIdRef = useRef<string | null>(null);
  const candidateStartTimeRef = useRef<number>(0);
  const lastRoomAudioTimeRef = useRef<number>(Date.now());

  const directorConfigRef = useRef(directorConfig);
  directorConfigRef.current = directorConfig;

  const liveCamIdRef = useRef(liveCamId);
  liveCamIdRef.current = liveCamId;

  const camerasRef = useRef(cameras);
  camerasRef.current = cameras;

  /**
   * Broadcast-grade Camera Assignment & Sticky Memory Engine.
   *
   * 1. Assigns ONLY the optimal camera to a speaker (other cameras do NOT swarm to the same speaker).
   * 2. Sticky Memory: Cameras hold framing on a speaker even during silence/breaths.
   * 3. Schmitt Trigger: Smoothly cuts the "ON AIR" tally between cameras without hunting.
   */
  const processDirectorFrame = useCallback(
    (
      speakers: ActiveSpeakerTarget[],
      roomWidth: number,
      roomHeight: number,
      dtSec: number
    ): { activeCamera: VirtualCamera | null; switched: boolean } => {
      const now = Date.now();
      const config = directorConfigRef.current;
      let currentCameras = [...camerasRef.current];
      const currentLiveId = liveCamIdRef.current;

      const activeSpeakers = speakers.filter((s) => s.isActive);
      if (activeSpeakers.length > 0) {
        lastRoomAudioTimeRef.current = now;
      }

      // Step 1: Manage Camera-to-Speaker Subject Allocation
      // For each active speaker, bind them to their dedicated camera
      for (const speaker of activeSpeakers) {
        // Check if a camera is already assigned to this speaker slot
        let boundCam = currentCameras.find((c) => c.assignedTargetSlot === speaker.slotId);

        if (!boundCam) {
          // Camera not yet assigned: find best candidate among unassigned cameras (or non-live cameras)
          const availableCams = currentCameras.filter(
            (c) => c.assignedTargetSlot === null || (!c.isLive && c.id !== currentLiveId)
          );
          const pool = availableCams.length > 0 ? availableCams : currentCameras;

          // Score cameras for this speaker
          const scored = pool.map((cam) => ({
            cam,
            score: scoreCameraCandidate(cam, speaker.pos, speaker.angleDeg, roomWidth, roomHeight),
          }));
          scored.sort((a, b) => b.score - a.score);

          if (scored.length > 0) {
            boundCam = scored[0].cam;
            // Bind camera to this speaker slot
            currentCameras = currentCameras.map((c) =>
              c.id === boundCam!.id
                ? {
                    ...c,
                    assignedTargetSlot: speaker.slotId,
                    isLockedOnSubject: true,
                    lastTargetPos: speaker.pos,
                  }
                : c.assignedTargetSlot === speaker.slotId
                ? { ...c, assignedTargetSlot: null, isLockedOnSubject: false }
                : c
            );
          }
        } else {
          // Update last target position for persistent sticky framing
          currentCameras = currentCameras.map((c) =>
            c.id === boundCam!.id ? { ...c, lastTargetPos: speaker.pos } : c
          );
        }
      }

      // Step 2: Compute target pan bearings for each camera independently
      currentCameras = currentCameras.map((cam) => {
        const camX = cam.xRatio * roomWidth;
        const camY = cam.yRatio * roomHeight;

        // If camera is bound to a speaker
        if (cam.assignedTargetSlot !== null) {
          const boundSpeaker = speakers.find((s) => s.slotId === cam.assignedTargetSlot);
          const targetPos = boundSpeaker?.pos || cam.lastTargetPos;

          if (targetPos) {
            // Camera tracks its assigned speaker
            const aimAngle = calculateCameraBearing(camX, camY, targetPos.x, targetPos.y);
            return {
              ...cam,
              targetPanDeg: aimAngle,
              isLockedOnSubject: true,
            };
          }
        }

        // Camera is not bound to an active speaker
        // Sticky Memory: If it previously had a target and room silence is < 45s, HOLD position!
        const isProlongedSilence = now - lastRoomAudioTimeRef.current > 45000;
        if (cam.lastTargetPos && !isProlongedSilence) {
          const holdAngle = calculateCameraBearing(camX, camY, cam.lastTargetPos.x, cam.lastTargetPos.y);
          return {
            ...cam,
            targetPanDeg: holdAngle,
            isLockedOnSubject: true,
          };
        }

        // Otherwise, hold resting pan angle
        return {
          ...cam,
          targetPanDeg: cam.restingPanDeg,
          isLockedOnSubject: false,
        };
      });

      // Step 3: Schmitt-Trigger & Live Tally Switcher ("ON AIR" Selection)
      let newLiveId = currentLiveId;
      let hasSwitched = false;

      // Find the speaker who is speaking with highest volume right now
      const dominantSpeaker = activeSpeakers.sort((a, b) => b.splDb - a.splDb)[0];

      if (dominantSpeaker) {
        // Find which camera is framing this dominant speaker
        const targetCam = currentCameras.find((c) => c.assignedTargetSlot === dominantSpeaker.slotId);

        if (targetCam && targetCam.id !== currentLiveId) {
          const timeSinceLastSwitch = now - lastSwitchTimeRef.current;
          const currentLiveCam = currentCameras.find((c) => c.id === currentLiveId);

          const liveScore = currentLiveCam
            ? scoreCameraCandidate(currentLiveCam, dominantSpeaker.pos, dominantSpeaker.angleDeg, roomWidth, roomHeight)
            : 0;
          const targetScore = scoreCameraCandidate(targetCam, dominantSpeaker.pos, dominantSpeaker.angleDeg, roomWidth, roomHeight);
          const threshold = liveScore * (1.0 + config.hysteresisMarginPercent / 100.0);

          // Schmitt Trigger: Hold time + Score margin + Confirmation debounce
          if (timeSinceLastSwitch >= config.holdTimeMs && targetScore >= threshold) {
            if (candidateCamIdRef.current !== targetCam.id) {
              candidateCamIdRef.current = targetCam.id;
              candidateStartTimeRef.current = now;
            } else if (now - candidateStartTimeRef.current >= config.confirmTimeMs) {
              newLiveId = targetCam.id;
              hasSwitched = true;
              lastSwitchTimeRef.current = now;
              candidateCamIdRef.current = null;
              setLiveCamId(newLiveId);
            }
          } else {
            candidateCamIdRef.current = null;
          }
        } else {
          candidateCamIdRef.current = null;
        }
      }

      // Step 4: Advance camera pan motors (Snappy 120°/s or instant cuts)
      const updatedCameras = currentCameras.map((cam) => {
        const isLive = cam.id === newLiveId;
        let newPan = cam.currentPanDeg;

        if (config.instantCut && isLive && hasSwitched) {
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
        activeCamera: updatedCameras.find((c) => c.id === newLiveId) || null,
        switched: hasSwitched,
      };
    },
    []
  );

  const setManualLiveCamera = useCallback((id: string) => {
    setLiveCamId(id);
    lastSwitchTimeRef.current = Date.now();
    setCameras((prev) =>
      prev.map((c) => ({
        ...c,
        isLive: c.id === id,
      }))
    );
  }, []);

  const updateCamera = useCallback((id: string, partial: Partial<VirtualCamera>) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...partial } : c))
    );
  }, []);

  const updateConfig = useCallback((partial: Partial<CameraDirectorConfig>) => {
    setDirectorConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setCameras(DEFAULT_VIRTUAL_CAMERAS);
    setDirectorConfig(DEFAULT_DIRECTOR_CONFIG);
    setLiveCamId('cam-front');
    lastSwitchTimeRef.current = Date.now();
  }, []);

  return {
    cameras,
    liveCamId,
    directorConfig,
    processDirectorFrame,
    setManualLiveCamera,
    updateCamera,
    updateConfig,
    resetToDefaults,
  };
}

export default useMultiCameraDirector;
