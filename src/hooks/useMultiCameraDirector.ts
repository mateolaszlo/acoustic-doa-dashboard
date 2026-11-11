import { useState, useRef, useCallback } from 'react';
import { VirtualCamera, CameraDirectorConfig } from '../types/api_types';
import {
  DEFAULT_VIRTUAL_CAMERAS,
  DEFAULT_DIRECTOR_CONFIG,
  calculateCameraBearing,
  scoreCameraCandidate,
  stepCameraPan,
} from '../services/camera_ptz_math';

export function useMultiCameraDirector(
  initialCameras: VirtualCamera[] = DEFAULT_VIRTUAL_CAMERAS,
  initialConfig: CameraDirectorConfig = DEFAULT_DIRECTOR_CONFIG
) {
  const [cameras, setCameras] = useState<VirtualCamera[]>(initialCameras);
  const [directorConfig, setDirectorConfig] = useState<CameraDirectorConfig>(initialConfig);
  const [liveCamId, setLiveCamId] = useState<string>('cam-rear');

  // Hysteresis & Schmitt-trigger tracking refs
  const lastSwitchTimeRef = useRef<number>(Date.now());
  const candidateCamIdRef = useRef<string | null>(null);
  const candidateStartTimeRef = useRef<number>(0);

  const directorConfigRef = useRef(directorConfig);
  directorConfigRef.current = directorConfig;

  const liveCamIdRef = useRef(liveCamId);
  liveCamIdRef.current = liveCamId;

  const camerasRef = useRef(cameras);
  camerasRef.current = cameras;

  /**
   * Evaluates incoming speaker targets, executes Schmitt-trigger hysteresis switching,
   * and advances camera pan motors.
   */
  const processDirectorFrame = useCallback(
    (
      speakerPos: { x: number; y: number } | null,
      speakerAngleDeg: number | null,
      roomWidth: number,
      roomHeight: number,
      dtSec: number
    ): { activeCamera: VirtualCamera | null; switched: boolean } => {
      const now = Date.now();
      const config = directorConfigRef.current;
      const currentCameras = camerasRef.current;
      const currentLiveId = liveCamIdRef.current;

      let newLiveId = currentLiveId;
      let hasSwitched = false;

      if (speakerPos !== null && speakerAngleDeg !== null) {
        // 1. Calculate parallax aim bearing and quality score for each camera
        const scoredCameras = currentCameras.map((cam) => {
          const camX = cam.xRatio * roomWidth;
          const camY = cam.yRatio * roomHeight;
          const targetPan = calculateCameraBearing(camX, camY, speakerPos.x, speakerPos.y);
          const score = scoreCameraCandidate(cam, speakerPos, speakerAngleDeg, roomWidth, roomHeight);

          return {
            ...cam,
            targetPanDeg: targetPan,
            score,
          };
        });

        // 2. Identify top scoring camera candidate
        scoredCameras.sort((a, b) => b.score - a.score);
        const topCandidate = scoredCameras[0];
        const currentLiveCam = scoredCameras.find((c) => c.id === currentLiveId) || topCandidate;

        // 3. Evaluate Schmitt-Trigger & Hold-Time Hysteresis
        if (topCandidate.id !== currentLiveId) {
          const timeSinceLastSwitch = now - lastSwitchTimeRef.current;
          const scoreThreshold = currentLiveCam.score * (1.0 + config.hysteresisMarginPercent / 100.0);

          // Condition 1: Current camera must have completed minimum hold time
          // Condition 2: Candidate must exceed current camera score by hysteresis margin
          if (timeSinceLastSwitch >= config.holdTimeMs && topCandidate.score >= scoreThreshold) {
            // Condition 3: Candidate persistence debounce timer
            if (candidateCamIdRef.current !== topCandidate.id) {
              candidateCamIdRef.current = topCandidate.id;
              candidateStartTimeRef.current = now;
            } else if (now - candidateStartTimeRef.current >= config.confirmTimeMs) {
              // Confirmed sustained speech in candidate's view -> Trigger Cut!
              newLiveId = topCandidate.id;
              hasSwitched = true;
              lastSwitchTimeRef.current = now;
              candidateCamIdRef.current = null;
              setLiveCamId(newLiveId);
            }
          } else {
            // Conditions not met; reset candidate debounce
            candidateCamIdRef.current = null;
          }
        } else {
          candidateCamIdRef.current = null;
        }

        // 4. Advance pan angles for all cameras
        const updatedCameras = scoredCameras.map((cam) => {
          const isLive = cam.id === newLiveId;
          let newPan = cam.currentPanDeg;

          if (config.instantCut && isLive && hasSwitched) {
            // Broadcast cut: snap directly to target
            newPan = cam.targetPanDeg;
          } else {
            // Smooth slew toward target
            newPan = stepCameraPan(
              cam.currentPanDeg,
              cam.targetPanDeg,
              dtSec,
              config.slewSpeedDegPerSec,
              4.5
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
      } else {
        // Idle state: cameras gently return toward resting pan angles
        const idleCameras = currentCameras.map((cam) => {
          const idlePan = stepCameraPan(
            cam.currentPanDeg,
            cam.restingPanDeg,
            dtSec,
            40.0,
            2.5
          );
          return {
            ...cam,
            currentPanDeg: idlePan,
            isLive: cam.id === currentLiveId,
          };
        });

        camerasRef.current = idleCameras;
        setCameras(idleCameras);

        return {
          activeCamera: idleCameras.find((c) => c.id === currentLiveId) || null,
          switched: false,
        };
      }
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
    setLiveCamId('cam-rear');
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
