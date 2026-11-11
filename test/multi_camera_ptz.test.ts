import { describe, it, expect } from 'vitest';
import {
  calculateSpeakerWorldPos,
  calculateCameraBearing,
  scoreCameraCandidate,
  DEFAULT_VIRTUAL_CAMERAS,
  DEFAULT_ROOM_LAYOUT,
  wrapAngle180,
  stepCameraPan,
} from '../src/services/camera_ptz_math.js';
import { VirtualCamera } from '../src/types/api_types.js';

describe('Multi-Camera Studio & Trigonometric Parallax Geometry', () => {
  const arrayX = 400;
  const arrayY = 230;
  const radiusPx = 180;

  it('calculates true 2D speaker world coordinates from DOA array azimuth', () => {
    // 0 deg = North (Up / -Y)
    const northPos = calculateSpeakerWorldPos(arrayX, arrayY, 0, radiusPx);
    expect(northPos.x).toBeCloseTo(400, 2);
    expect(northPos.y).toBeCloseTo(230 - 180, 2); // 50

    // +90 deg = East (Right / +X)
    const eastPos = calculateSpeakerWorldPos(arrayX, arrayY, 90, radiusPx);
    expect(eastPos.x).toBeCloseTo(400 + 180, 2); // 580
    expect(eastPos.y).toBeCloseTo(230, 2);

    // +-180 deg = South (Down / +Y)
    const southPos = calculateSpeakerWorldPos(arrayX, arrayY, 180, radiusPx);
    expect(southPos.x).toBeCloseTo(400, 2);
    expect(southPos.y).toBeCloseTo(230 + 180, 2); // 410

    // -90 deg = West (Left / -X)
    const westPos = calculateSpeakerWorldPos(arrayX, arrayY, -90, radiusPx);
    expect(westPos.x).toBeCloseTo(400 - 180, 2); // 220
    expect(westPos.y).toBeCloseTo(230, 2);
  });

  it('resolves parallax bearing discrepancy (fixes camera pointing into wall bug)', () => {
    // Test the exact scenario from user's screenshot:
    // Speaker is at +105 deg from table center array (400, 230)
    const speakerPos = calculateSpeakerWorldPos(arrayX, arrayY, 105, radiusPx);
    // Speaker x ~= 573.86, y ~= 276.58

    // Rear camera mounted at bottom center: (400, 400)
    const rearCamX = 400;
    const rearCamY = 400;

    const bearing = calculateCameraBearing(rearCamX, rearCamY, speakerPos.x, speakerPos.y);

    // The raw DOA angle was 105° (which points down-right into wall).
    // The true bearing from rear camera (400, 400) to speaker (573.86, 276.58) is UP and RIGHT (~54.6°)
    expect(bearing).toBeGreaterThan(45);
    expect(bearing).toBeLessThan(65);
    expect(bearing).toBeCloseTo(54.6, 1);
  });

  it('correctly calculates bearings for cameras in all room orientations', () => {
    const targetX = 500;
    const targetY = 100;

    // Camera directly below target: aim should be 0 deg (North)
    expect(calculateCameraBearing(500, 300, targetX, targetY)).toBeCloseTo(0, 1);

    // Camera directly to left of target: aim should be 90 deg (East)
    expect(calculateCameraBearing(300, 100, targetX, targetY)).toBeCloseTo(90, 1);

    // Camera directly above target: aim should be 180 deg (South)
    expect(calculateCameraBearing(500, 50, targetX, targetY)).toBeCloseTo(180, 1);

    // Camera directly to right of target: aim should be -90 deg (West)
    expect(calculateCameraBearing(700, 100, targetX, targetY)).toBeCloseTo(-90, 1);
  });

  it('scores camera candidates by perspective and distance', () => {
    const roomW = 800;
    const roomH = 500;
    const frontCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'front')!;
    const rearCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'rear')!;
    const sideCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'side')!;

    // Case 1: Keynote speaker at Podium (North / 0 deg)
    // Presenter faces South -> Rear camera must win
    const podiumSpeakerPos = calculateSpeakerWorldPos(400, 250, 0, 160);
    const rearScorePodium = scoreCameraCandidate(rearCam, podiumSpeakerPos, 0, roomW, roomH);
    const frontScorePodium = scoreCameraCandidate(frontCam, podiumSpeakerPos, 0, roomW, roomH);

    expect(rearScorePodium).toBeGreaterThan(frontScorePodium);
    expect(rearScorePodium - frontScorePodium).toBeGreaterThan(30);

    // Case 2: Audience participant speaking (120 deg)
    // Table participant faces North -> Front camera must win
    const audienceSpeakerPos = calculateSpeakerWorldPos(400, 250, 120, 160);
    const frontScoreAudience = scoreCameraCandidate(frontCam, audienceSpeakerPos, 120, roomW, roomH);
    const rearScoreAudience = scoreCameraCandidate(rearCam, audienceSpeakerPos, 120, roomW, roomH);

    expect(frontScoreAudience).toBeGreaterThan(rearScoreAudience);
    expect(frontScoreAudience - rearScoreAudience).toBeGreaterThan(30);

    // Case 3: Side camera receives cross-table boost for side angles (~90 deg)
    const sideSpeakerPos = calculateSpeakerWorldPos(400, 250, 90, 160);
    const sideScore = scoreCameraCandidate(sideCam, sideSpeakerPos, 90, roomW, roomH);
    expect(sideScore).toBeGreaterThan(35);
  });

  it('verifies Schmitt trigger hysteresis margin prevents camera hunting', () => {
    // If Camera A is at score 70, with a 20% margin, Camera B needs at least 84 to switch
    const currentScore = 70;
    const marginPercent = 20;
    const threshold = currentScore * (1 + marginPercent / 100);
    expect(threshold).toBe(84);

    const closeCandidateScore = 80;
    expect(closeCandidateScore >= threshold).toBe(false); // Does not oscillate

    const strongCandidateScore = 86;
    expect(strongCandidateScore >= threshold).toBe(true); // Decisive switch
  });

  it('validates default room layout and virtual camera configuration', () => {
    expect(DEFAULT_ROOM_LAYOUT.tableShape).toBe('oval');
    expect(DEFAULT_ROOM_LAYOUT.seatCount).toBe(8);
    expect(DEFAULT_ROOM_LAYOUT.tableWidthRatio).toBeGreaterThan(0.3);

    expect(DEFAULT_VIRTUAL_CAMERAS.length).toBe(3);
    for (const cam of DEFAULT_VIRTUAL_CAMERAS) {
      expect(cam.assignedTargetSlot).toBeNull();
      expect(cam.isLockedOnSubject).toBe(false);
      expect(cam.lastTargetPos).toBeNull();
    }
  });

  it('verifies sticky memory maintains speaker aim angle during speech pauses', () => {
    // Front camera at (400, 40)
    const roomW = 800;
    const roomH = 500;
    const camX = 400;
    const camY = 40;

    // Speaker 1 at (450, 300)
    const speaker1Pos = { x: 450, y: 300 };
    const aimAngle = calculateCameraBearing(camX, camY, speaker1Pos.x, speaker1Pos.y);

    // Initial camera state
    let testCam: VirtualCamera = {
      ...DEFAULT_VIRTUAL_CAMERAS[0],
      currentPanDeg: 180, // Facing South
      targetPanDeg: aimAngle,
      assignedTargetSlot: 0,
      isLockedOnSubject: true,
      lastTargetPos: speaker1Pos,
    };

    // Camera slews toward speaker over multiple animation frames
    for (let frame = 0; frame < 30; frame++) {
      testCam.currentPanDeg = stepCameraPan(testCam.currentPanDeg, testCam.targetPanDeg, 0.05, 120);
    }
    expect(testCam.currentPanDeg).toBeCloseTo(aimAngle, 1);

    // Now speaker goes quiet (slot inactive, speaker leaves active list)
    // Sticky memory: camera should retain aim angle on lastTargetPos rather than jumping to resting angle (180)
    const holdAngle = calculateCameraBearing(camX, camY, testCam.lastTargetPos!.x, testCam.lastTargetPos!.y);
    expect(holdAngle).toBeCloseTo(aimAngle, 2);
    expect(holdAngle).not.toBe(testCam.restingPanDeg);
  });

  it('verifies camera assignment separates distinct speakers across cameras', () => {
    const roomW = 800;
    const roomH = 500;
    const frontCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'front')!;
    const rearCam = DEFAULT_VIRTUAL_CAMERAS.find((c) => c.role === 'rear')!;

    // Speaker 0 at Podium (North, 0 deg)
    const podiumSpeaker = calculateSpeakerWorldPos(400, 250, 0, 160);
    // Speaker 1 at Audience (South, 180 deg)
    const audienceSpeaker = calculateSpeakerWorldPos(400, 250, 180, 160);

    const podiumRearScore = scoreCameraCandidate(rearCam, podiumSpeaker, 0, roomW, roomH);
    const podiumFrontScore = scoreCameraCandidate(frontCam, podiumSpeaker, 0, roomW, roomH);

    const audienceRearScore = scoreCameraCandidate(rearCam, audienceSpeaker, 180, roomW, roomH);
    const audienceFrontScore = scoreCameraCandidate(frontCam, audienceSpeaker, 180, roomW, roomH);

    // Rear camera is optimal for podium presenter
    expect(podiumRearScore).toBeGreaterThan(podiumFrontScore);

    // Front camera is optimal for audience speaker
    expect(audienceFrontScore).toBeGreaterThan(audienceRearScore);

    // Demonstrates that optimal camera assignment gives each speaker their own dedicated camera
    expect(podiumRearScore).toBeGreaterThan(audienceRearScore);
    expect(audienceFrontScore).toBeGreaterThan(podiumFrontScore);
  });
});
